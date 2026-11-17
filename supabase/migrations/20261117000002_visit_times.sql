-- Käynneille kellonaika ja kesto (kalenteri).
alter table public.job_visits
  add column start_time time,
  add column duration_minutes int check (duration_minutes is null or duration_minutes between 5 and 24 * 60);

create index on public.job_visits (assigned_to, visit_date, start_time);

-- Käynnin tehollinen kesto: oma kesto -> työn arvio -> 1 h.
create function public.visit_duration(p_visit public.job_visits) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(p_visit.duration_minutes,
                  (select round(estimated_hours * 60)::int from jobs where id = p_visit.job_id and estimated_hours > 0),
                  60);
$$;

-- Ehdotettu aloitusaika: asentajan päivän viimeisen käynnin jälkeen, muuten klo 8.
create function public._next_free_time(p_user uuid, p_date date) returns time
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select max(v.start_time + make_interval(mins => visit_duration(v)))
     from job_visits v
     where v.assigned_to = p_user and v.visit_date = p_date and v.status <> 'cancelled' and v.start_time is not null),
    time '08:00');
$$;

drop function public.assign_visit(uuid, uuid, date, uuid);

-- Delegointi / uudelleenohjaus. Uusi käynti saa oletuksena seuraavan vapaan ajan.
-- Siirrossa aika säilyy, ellei uutta anneta.
create function public.assign_visit(
  p_job_id uuid,
  p_user_id uuid,
  p_date date,
  p_visit_id uuid default null,
  p_start_time time default null,
  p_duration_minutes int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_visit job_visits;
  v_id uuid;
  v_name text;
  v_time time;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if not found then raise exception 'Työtä ei löydy'; end if;
  perform _require_admin(v_job.organization_id);
  if p_user_id is not null and not exists (
    select 1 from organization_members
    where organization_id = v_job.organization_id and user_id = p_user_id and active
  ) then
    raise exception 'Asentaja ei kuulu yritykseen';
  end if;
  select full_name into v_name from profiles where id = p_user_id;

  if p_visit_id is null then
    v_time := coalesce(p_start_time, case when p_user_id is not null then _next_free_time(p_user_id, p_date) end);
    insert into job_visits (organization_id, job_id, assigned_to, visit_date, sort, start_time, duration_minutes)
    values (v_job.organization_id, p_job_id, p_user_id, p_date,
            coalesce((select max(sort) + 1 from job_visits where assigned_to = p_user_id and visit_date = p_date), 0),
            v_time, p_duration_minutes)
    returning id into v_id;
  else
    select * into v_visit from job_visits where id = p_visit_id and job_id = p_job_id for update;
    if not found then raise exception 'Käyntiä ei löydy'; end if;
    v_time := coalesce(p_start_time, v_visit.start_time);
    update job_visits set assigned_to = p_user_id, visit_date = p_date, start_time = v_time,
           duration_minutes = coalesce(p_duration_minutes, duration_minutes)
    where id = p_visit_id;
    v_id := p_visit_id;
  end if;

  insert into job_status_events (organization_id, job_id, from_status, to_status, note, actor)
  values (v_job.organization_id, p_job_id, v_job.status, v_job.status,
          format('Käynti %s%s: %s', to_char(p_date, 'DD.MM.YYYY'),
                 coalesce(' klo ' || to_char(v_time, 'HH24.MI'), ''), coalesce(v_name, 'ei asentajaa')), auth.uid());

  if v_job.status in ('draft', 'waiting') and p_user_id is not null then
    perform _set_job_status(v_job, 'scheduled', null);
  end if;
  return v_id;
end $$;

-- Kellonajan ja keston muutos (null = ei kellonaikaa / työn arvio).
create function public.set_visit_time(p_visit_id uuid, p_start_time time, p_duration_minutes int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_v job_visits;
begin
  select * into v_v from job_visits where id = p_visit_id for update;
  if not found then raise exception 'Käyntiä ei löydy'; end if;
  perform _require_admin(v_v.organization_id);
  update job_visits set start_time = p_start_time, duration_minutes = p_duration_minutes where id = p_visit_id;
end $$;

revoke execute on function public._next_free_time(uuid, date) from public, anon, authenticated;
revoke execute on function public.assign_visit(uuid, uuid, date, uuid, time, int) from anon;
revoke execute on function public.set_visit_time(uuid, time, int) from anon;
revoke execute on function public.visit_duration(public.job_visits) from anon;
