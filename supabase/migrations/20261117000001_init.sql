-- Huoltoputki: perusskeema
-- Kaikki yrityksen omistamat rivit sisältävät organization_id:n. Kriittiset
-- liiketoimintatapahtumat ajetaan security definer -RPC-funktioina, jotka
-- tarkistavat oikeudet itse. Selain ei saa kirjoittaa tapahtumatauluihin suoraan.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tenant ja käyttäjät
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  public_form_enabled boolean not null default true,
  default_vat_rate numeric(5,2) not null default 25.5,
  hourly_rate numeric(10,2) not null default 65,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  color text not null default '#0e7490',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'installer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index on public.organization_members (user_id);

-- Uusi auth-käyttäjä saa profiilin automaattisesti.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Oikeusapurit. security definer, jotta ne eivät rekursoi RLS:ään.
create function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and active
  );
$$;

create function public.is_admin(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = p_org and user_id = auth.uid() and active and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Myynti
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  city text,
  lat double precision,
  lng double precision,
  notes text,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sku_type text not null default 'other' check (sku_type in ('sahkonumero', 'lvinumero', 'other')),
  sku text,
  unit text not null default 'kpl',
  pack_size numeric(12,3) not null default 1 check (pack_size > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  category text not null default 'sähkö' check (category in ('sähkö', 'lvi', 'muu')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index on public.products (organization_id, sku);

create table public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  code text not null,
  normalized_code text not null,
  multiplier numeric(12,3) not null default 1 check (multiplier > 0),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, normalized_code),
  foreign key (organization_id, product_id) references public.products(organization_id, id) on delete cascade
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid,
  contact_name text not null,
  phone text,
  email text,
  address text,
  city text,
  description text not null,
  source text not null default 'phone' check (source in ('phone', 'form', 'email', 'voice', 'other')),
  status text not null default 'new' check (status in ('new', 'in_progress', 'quoted', 'accepted', 'rejected')),
  urgent boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_request_id uuid,
  customer_id uuid not null,
  title text not null,
  description text not null default '',
  address text,
  city text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  valid_until date,
  estimated_hours numeric(8,2) not null default 0 check (estimated_hours >= 0),
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, quote_request_id) references public.quote_requests(organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id)
);

create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null,
  kind text not null default 'product' check (kind in ('product', 'labor', 'other')),
  product_id uuid,
  description text not null,
  qty numeric(12,3) not null default 1 check (qty > 0),
  unit text not null default 'kpl',
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  vat_rate numeric(5,2) not null default 25.5,
  sort int not null default 0,
  foreign key (organization_id, quote_id) references public.quotes(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);
create index on public.quote_lines (quote_id);

-- ---------------------------------------------------------------------------
-- Työt (järjestelmän pääolio)
-- ---------------------------------------------------------------------------

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid,
  quote_id uuid unique, -- yksi tarjous -> korkeintaan yksi työ (idempotenssi)
  create_event_id uuid unique, -- suoran luonnin idempotenssi
  title text not null,
  description text not null default '',
  address text,
  city text,
  lat double precision,
  lng double precision,
  contact_name text,
  contact_phone text,
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'in_progress', 'waiting', 'done', 'billable', 'invoiced')),
  waiting_reason text,
  estimated_hours numeric(8,2),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  billable_at timestamptz,
  invoiced_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, customer_id) references public.customers(organization_id, id),
  foreign key (organization_id, quote_id) references public.quotes(organization_id, id)
);
create index on public.jobs (organization_id, status);

create table public.job_visits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  assigned_to uuid references public.profiles(id),
  visit_date date not null default current_date,
  sort int not null default 0,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade
);
create index on public.job_visits (assigned_to, visit_date);
create index on public.job_visits (job_id);

create table public.job_status_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  from_status text,
  to_status text not null,
  note text,
  actor uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade
);
create index on public.job_status_events (job_id, created_at);

create table public.job_extra_work (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  description text not null,
  estimated_hours numeric(8,2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  event_id uuid unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Materiaalit: tarve ≠ haettu ≠ käytetty
-- ---------------------------------------------------------------------------

create table public.job_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  product_id uuid,
  description text not null,
  unit text not null default 'kpl',
  qty_needed numeric(12,3) not null check (qty_needed >= 0),
  missing boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);
create index on public.job_materials (job_id);
create index on public.job_materials (product_id);

create table public.material_picks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_material_id uuid not null,
  qty numeric(12,3) not null check (qty <> 0), -- negatiivinen = palautus
  source text not null default 'manual' check (source in ('scan', 'manual', 'return')),
  event_id uuid not null unique,
  picked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, job_material_id) references public.job_materials(organization_id, id) on delete cascade
);
create index on public.material_picks (job_material_id);

-- Haettu saldo ei saa mennä alle nollan.
create function public.check_pick_balance() returns trigger
language plpgsql as $$
begin
  if (select coalesce(sum(qty), 0) from public.material_picks where job_material_id = new.job_material_id) < 0 then
    raise exception 'Palautus on suurempi kuin haettu määrä' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger material_picks_balance after insert on public.material_picks
for each row execute function public.check_pick_balance();

create table public.material_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  job_material_id uuid,
  product_id uuid,
  description text not null,
  qty numeric(12,3) not null check (qty > 0),
  unit text not null default 'kpl',
  recorded_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade,
  foreign key (organization_id, job_material_id) references public.job_materials(organization_id, id) on delete set null (job_material_id),
  foreign key (organization_id, product_id) references public.products(organization_id, id)
);
create index on public.material_usage (job_id);

create table public.material_scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  normalized_code text not null,
  product_id uuid,
  job_material_id uuid,
  qty numeric(12,3),
  result text not null check (result in ('assigned', 'unknown', 'no_need')),
  event_id uuid not null unique,
  scanned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Työaika, raportit, liitteet
-- ---------------------------------------------------------------------------

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  visit_id uuid,
  user_id uuid not null references public.profiles(id),
  started_at timestamptz not null,
  ended_at timestamptz,
  corrected_minutes int check (corrected_minutes is null or corrected_minutes between 0 and 24 * 60),
  correction_reason text,
  event_id uuid not null unique,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade,
  foreign key (organization_id, visit_id) references public.job_visits(organization_id, id) on delete set null (visit_id)
);
create index on public.time_entries (job_id);
create index on public.time_entries (user_id, started_at);
-- Yhdellä käyttäjällä voi olla vain yksi avoin ajanotto.
create unique index time_entries_one_open on public.time_entries (user_id) where ended_at is null;

create table public.job_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  version int not null,
  raw_text text not null default '',
  structured jsonb,
  ai_used boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  unique (job_id, version),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade
);

-- Vahvistettu raportti on lukittu: korjaus tehdään uutena versiona.
create function public.lock_confirmed_report() returns trigger
language plpgsql as $$
begin
  if old.confirmed_at is not null then
    raise exception 'Vahvistettua raporttia ei voi muuttaa. Tee korjaus uutena versiona.';
  end if;
  return new;
end $$;
create trigger job_reports_lock before update on public.job_reports
for each row execute function public.lock_confirmed_report();

create table public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null,
  path text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, job_id) references public.jobs(organization_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Työvuorot ja sijainti
-- ---------------------------------------------------------------------------

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  auto_closed boolean not null default false,
  unique (organization_id, id)
);
create unique index shifts_one_open on public.shifts (user_id) where ended_at is null;

create table public.location_pings (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  shift_id uuid not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision,
  recorded_at timestamptz not null default now(),
  foreign key (organization_id, shift_id) references public.shifts(organization_id, id) on delete cascade
);
create index on public.location_pings (user_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Apuprosessit
-- ---------------------------------------------------------------------------

create table public.geocode_cache (
  query text primary key,
  lat double precision,
  lng double precision,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  data jsonb,
  created_at timestamptz not null default now()
);

create table public.public_request_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index on public.public_request_log (ip_hash, created_at);

-- ---------------------------------------------------------------------------
-- Näkymät (security_invoker -> RLS pätee)
-- ---------------------------------------------------------------------------

create view public.job_material_status with (security_invoker = true) as
select
  jm.id,
  jm.organization_id,
  jm.job_id,
  jm.product_id,
  jm.description,
  jm.unit,
  jm.qty_needed,
  jm.missing,
  coalesce((select sum(p.qty) from public.material_picks p where p.job_material_id = jm.id), 0) as qty_picked,
  coalesce((select sum(u.qty) from public.material_usage u where u.job_material_id = jm.id), 0) as qty_used
from public.job_materials jm;

create view public.job_readiness with (security_invoker = true) as
select
  j.id as job_id,
  count(s.id) as lines,
  count(s.id) filter (where s.qty_picked >= s.qty_needed) as lines_ready,
  count(s.id) filter (where s.missing) as lines_missing,
  case
    when count(s.id) = 0 then 'no_materials'
    when count(s.id) filter (where s.missing) > 0 then 'missing'
    when count(s.id) filter (where s.qty_picked >= s.qty_needed) = count(s.id) then 'ready'
    when count(s.id) filter (where s.qty_picked > 0) > 0 then 'partial'
    else 'none'
  end as readiness
from public.jobs j
left join public.job_material_status s on s.job_id = j.id
group by j.id;

create view public.job_time_totals with (security_invoker = true) as
select
  t.job_id,
  sum(coalesce(t.corrected_minutes,
      round(extract(epoch from (coalesce(t.ended_at, now()) - t.started_at)) / 60)::int)) as minutes,
  bool_or(t.ended_at is null) as running
from public.time_entries t
group by t.job_id;

create view public.latest_locations with (security_invoker = true) as
select distinct on (lp.user_id)
  lp.user_id, lp.organization_id, lp.lat, lp.lng, lp.accuracy, lp.recorded_at,
  (s.ended_at is null) as shift_open
from public.location_pings lp
join public.shifts s on s.id = lp.shift_id
order by lp.user_id, lp.recorded_at desc;

-- ---------------------------------------------------------------------------
-- Oikeusapurit töille
-- ---------------------------------------------------------------------------

create function public.can_see_job(p_job uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from jobs j
    where j.id = p_job
      and (
        is_admin(j.organization_id)
        or (is_member(j.organization_id) and exists (
          select 1 from job_visits v where v.job_id = j.id and v.assigned_to = auth.uid()
        ))
      )
  );
$$;

create function public.can_see_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from customers c
    where c.id = p_customer
      and (
        is_admin(c.organization_id)
        or exists (
          select 1 from jobs j join job_visits v on v.job_id = j.id
          where j.customer_id = c.id and v.assigned_to = auth.uid() and is_member(j.organization_id)
        )
      )
  );
$$;

create function public.shares_org(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user = auth.uid() or exists (
    select 1 from organization_members a
    join organization_members b on a.organization_id = b.organization_id
    where a.user_id = auth.uid() and a.active and b.user_id = p_user
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.product_barcodes enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.jobs enable row level security;
alter table public.job_visits enable row level security;
alter table public.job_status_events enable row level security;
alter table public.job_extra_work enable row level security;
alter table public.job_materials enable row level security;
alter table public.material_picks enable row level security;
alter table public.material_usage enable row level security;
alter table public.material_scans enable row level security;
alter table public.time_entries enable row level security;
alter table public.job_reports enable row level security;
alter table public.job_attachments enable row level security;
alter table public.shifts enable row level security;
alter table public.location_pings enable row level security;
alter table public.geocode_cache enable row level security;      -- vain service role
alter table public.audit_events enable row level security;
alter table public.public_request_log enable row level security; -- vain service role

create policy org_select on public.organizations for select using (is_member(id));
create policy org_update on public.organizations for update using (is_admin(id)) with check (is_admin(id));

create policy profiles_select on public.profiles for select using (shares_org(id));
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.organization_members for select using (is_member(organization_id));
create policy members_admin_write on public.organization_members for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy customers_select on public.customers for select using (can_see_customer(id));
create policy customers_admin on public.customers for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy products_select on public.products for select using (is_member(organization_id));
create policy products_admin on public.products for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy barcodes_select on public.product_barcodes for select using (is_member(organization_id));
create policy barcodes_admin on public.product_barcodes for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy qr_admin on public.quote_requests for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy quotes_admin on public.quotes for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));
create policy quote_lines_admin on public.quote_lines for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy jobs_select on public.jobs for select using (can_see_job(id));
create policy jobs_admin on public.jobs for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy visits_select on public.job_visits for select
  using (is_admin(organization_id) or (assigned_to = auth.uid() and is_member(organization_id)));
create policy visits_admin on public.job_visits for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy status_events_select on public.job_status_events for select using (can_see_job(job_id));
create policy extra_work_select on public.job_extra_work for select using (can_see_job(job_id));

create policy job_materials_select on public.job_materials for select using (can_see_job(job_id));
create policy job_materials_admin on public.job_materials for all
  using (is_admin(organization_id)) with check (is_admin(organization_id));

create policy picks_select on public.material_picks for select using (
  exists (select 1 from public.job_materials jm where jm.id = job_material_id and can_see_job(jm.job_id))
);
create policy usage_select on public.material_usage for select using (can_see_job(job_id));
create policy scans_select on public.material_scans for select
  using (is_admin(organization_id) or scanned_by = auth.uid());

create policy time_select on public.time_entries for select
  using (is_admin(organization_id) or user_id = auth.uid());

create policy reports_select on public.job_reports for select using (can_see_job(job_id));

create policy attachments_select on public.job_attachments for select using (can_see_job(job_id));
create policy attachments_insert on public.job_attachments for insert
  with check (can_see_job(job_id) and created_by = auth.uid());

create policy shifts_select on public.shifts for select
  using (is_admin(organization_id) or user_id = auth.uid());

create policy pings_select on public.location_pings for select
  using (is_admin(organization_id) or user_id = auth.uid());
create policy pings_insert on public.location_pings for insert with check (
  user_id = auth.uid()
  and is_member(organization_id)
  and exists (
    select 1 from public.shifts s
    where s.id = shift_id and s.user_id = auth.uid() and s.ended_at is null
  )
);

create policy audit_admin on public.audit_events for select using (is_admin(organization_id));

-- ---------------------------------------------------------------------------
-- RPC: sisäiset apurit
-- ---------------------------------------------------------------------------

create function public._require_member(p_org uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_member(p_org) then
    raise exception 'Ei oikeutta' using errcode = '42501';
  end if;
end $$;

create function public._require_admin(p_org uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_admin(p_org) then
    raise exception 'Vain työnjohdolla on oikeus tähän' using errcode = '42501';
  end if;
end $$;

create function public._require_job(p_job uuid) returns public.jobs
language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  select * into v_job from jobs where id = p_job for update;
  if not found or not can_see_job(p_job) then
    raise exception 'Työtä ei löydy tai ei oikeutta' using errcode = '42501';
  end if;
  return v_job;
end $$;

create function public._audit(p_org uuid, p_action text, p_entity text, p_id uuid, p_data jsonb default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_events (organization_id, actor, action, entity, entity_id, data)
  values (p_org, auth.uid(), p_action, p_entity, p_id, p_data);
$$;

-- Sallitut tilasiirtymät. Valmistuminen ei tarkoita laskutushyväksyntää.
create function public._set_job_status(p_job public.jobs, p_to text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ok boolean;
  v_admin boolean := is_admin(p_job.organization_id);
begin
  if p_job.status = p_to then
    return;
  end if;
  v_ok := case
    when p_job.status = 'draft' and p_to in ('scheduled') then true
    when p_job.status = 'scheduled' and p_to in ('in_progress', 'waiting', 'draft') then true
    when p_job.status = 'in_progress' and p_to in ('waiting', 'done', 'scheduled') then true
    when p_job.status = 'waiting' and p_to in ('scheduled', 'in_progress', 'done') then true
    when p_job.status = 'done' and p_to = 'billable' and v_admin then true
    when p_job.status = 'done' and p_to = 'in_progress' and v_admin then true
    when p_job.status = 'billable' and p_to in ('invoiced', 'done') and v_admin then true
    else false
  end;
  if not v_ok then
    raise exception 'Tilasiirtymä % -> % ei ole sallittu', p_job.status, p_to using errcode = 'check_violation';
  end if;
  update jobs set
    status = p_to,
    waiting_reason = case when p_to = 'waiting' then p_note else null end,
    completed_at = case when p_to = 'done' then now() when p_to in ('in_progress', 'scheduled') then null else completed_at end,
    billable_at = case when p_to = 'billable' then now() when p_to = 'done' then null else billable_at end,
    invoiced_at = case when p_to = 'invoiced' then now() else invoiced_at end
  where id = p_job.id;
  insert into job_status_events (organization_id, job_id, from_status, to_status, note, actor)
  values (p_job.organization_id, p_job.id, p_job.status, p_to, p_note, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- RPC: työt
-- ---------------------------------------------------------------------------

-- Suora työn luonti (esim. kiireellinen vikakeikka). Idempotentti p_event_id:llä.
create function public.create_direct_job(
  p_org uuid,
  p_event_id uuid,
  p_title text,
  p_description text default '',
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_address text default null,
  p_city text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_priority text default 'normal',
  p_assigned_to uuid default null,
  p_visit_date date default null,
  p_materials jsonb default '[]'::jsonb,
  p_estimated_hours numeric default null,
  p_lat double precision default null,
  p_lng double precision default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job_id uuid;
  v_customer uuid := p_customer_id;
  v_item jsonb;
begin
  perform _require_admin(p_org);
  select id into v_job_id from jobs where create_event_id = p_event_id;
  if found then
    return v_job_id;
  end if;
  if coalesce(trim(p_title), '') = '' then
    raise exception 'Työllä pitää olla otsikko';
  end if;

  if v_customer is null and coalesce(trim(p_customer_name), '') <> '' then
    insert into customers (organization_id, name, phone, address, city, lat, lng)
    values (p_org, trim(p_customer_name), p_contact_phone, p_address, p_city, p_lat, p_lng)
    returning id into v_customer;
  end if;

  insert into jobs (organization_id, customer_id, create_event_id, title, description, address, city,
                    contact_name, contact_phone, priority, estimated_hours, created_by, lat, lng)
  values (p_org, v_customer, p_event_id, trim(p_title), coalesce(p_description, ''), p_address, p_city,
          coalesce(p_contact_name, p_customer_name), p_contact_phone, coalesce(p_priority, 'normal'),
          p_estimated_hours, auth.uid(), p_lat, p_lng)
  returning id into v_job_id;

  insert into job_status_events (organization_id, job_id, from_status, to_status, note, actor)
  values (p_org, v_job_id, null, 'draft', 'Työ luotu', auth.uid());

  for v_item in select * from jsonb_array_elements(coalesce(p_materials, '[]'::jsonb)) loop
    insert into job_materials (organization_id, job_id, product_id, description, unit, qty_needed)
    select p_org, v_job_id, pr.id,
           coalesce(v_item->>'description', pr.name),
           coalesce(v_item->>'unit', pr.unit, 'kpl'),
           (v_item->>'qty')::numeric
    from (select 1) one
    left join products pr on pr.id = (v_item->>'product_id')::uuid and pr.organization_id = p_org;
  end loop;

  if p_assigned_to is not null then
    perform assign_visit(v_job_id, p_assigned_to, coalesce(p_visit_date, current_date));
  end if;

  perform _audit(p_org, 'create_job', 'job', v_job_id, null);
  return v_job_id;
end $$;

-- Tarjouksen hyväksyntä: hinnat ja ALV lukitaan riveille (snapshot).
create function public.accept_quote(p_quote_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_q quotes;
begin
  select * into v_q from quotes where id = p_quote_id for update;
  if not found then raise exception 'Tarjousta ei löydy'; end if;
  perform _require_admin(v_q.organization_id);
  if v_q.status = 'accepted' then return; end if;
  if v_q.status = 'rejected' then raise exception 'Hylättyä tarjousta ei voi hyväksyä'; end if;
  update quotes set status = 'accepted', accepted_at = now() where id = p_quote_id;
  if v_q.quote_request_id is not null then
    update quote_requests set status = 'accepted' where id = v_q.quote_request_id;
  end if;
  perform _audit(v_q.organization_id, 'accept_quote', 'quote', p_quote_id, null);
end $$;

-- Hyväksytystä tarjouksesta työ. Toistettu kutsu palauttaa saman työn.
create function public.create_job_from_quote(
  p_quote_id uuid,
  p_assigned_to uuid default null,
  p_visit_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_q quotes;
  v_c customers;
  v_job_id uuid;
begin
  select * into v_q from quotes where id = p_quote_id for update;
  if not found then raise exception 'Tarjousta ei löydy'; end if;
  perform _require_admin(v_q.organization_id);
  if v_q.status <> 'accepted' then
    raise exception 'Vain hyväksytystä tarjouksesta voi luoda työn';
  end if;

  select id into v_job_id from jobs where quote_id = p_quote_id;
  if found then
    return v_job_id;
  end if;

  select * into v_c from customers where id = v_q.customer_id;

  insert into jobs (organization_id, customer_id, quote_id, title, description, address, city,
                    contact_name, contact_phone, estimated_hours, created_by, lat, lng)
  values (v_q.organization_id, v_q.customer_id, v_q.id, v_q.title, v_q.description,
          coalesce(v_q.address, v_c.address), coalesce(v_q.city, v_c.city),
          v_c.name, v_c.phone, v_q.estimated_hours, auth.uid(), v_c.lat, v_c.lng)
  returning id into v_job_id;

  insert into job_status_events (organization_id, job_id, from_status, to_status, note, actor)
  values (v_q.organization_id, v_job_id, null, 'draft', 'Luotu tarjouksesta', auth.uid());

  insert into job_materials (organization_id, job_id, product_id, description, unit, qty_needed)
  select organization_id, v_job_id, product_id, description, unit, qty
  from quote_lines
  where quote_id = p_quote_id and kind = 'product'
  order by sort;

  if p_assigned_to is not null then
    perform assign_visit(v_job_id, p_assigned_to, coalesce(p_visit_date, current_date));
  end if;

  perform _audit(v_q.organization_id, 'create_job_from_quote', 'job', v_job_id, jsonb_build_object('quote_id', p_quote_id));
  return v_job_id;
end $$;

-- Delegointi / uudelleenohjaus. Ilman p_visit_id:tä luodaan uusi käynti.
create function public.assign_visit(
  p_job_id uuid,
  p_user_id uuid,
  p_date date,
  p_visit_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_visit job_visits;
  v_id uuid;
  v_name text;
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
    insert into job_visits (organization_id, job_id, assigned_to, visit_date, sort)
    values (v_job.organization_id, p_job_id, p_user_id, p_date,
            coalesce((select max(sort) + 1 from job_visits where assigned_to = p_user_id and visit_date = p_date), 0))
    returning id into v_id;
  else
    select * into v_visit from job_visits where id = p_visit_id and job_id = p_job_id for update;
    if not found then raise exception 'Käyntiä ei löydy'; end if;
    update job_visits set assigned_to = p_user_id, visit_date = p_date where id = p_visit_id;
    v_id := p_visit_id;
  end if;

  insert into job_status_events (organization_id, job_id, from_status, to_status, note, actor)
  values (v_job.organization_id, p_job_id, v_job.status, v_job.status,
          format('Käynti %s: %s', to_char(p_date, 'DD.MM.YYYY'), coalesce(v_name, 'ei asentajaa')), auth.uid());

  if v_job.status in ('draft', 'waiting') and p_user_id is not null then
    perform _set_job_status(v_job, 'scheduled', null);
  end if;
  return v_id;
end $$;

create function public.cancel_visit(p_visit_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_v job_visits;
begin
  select * into v_v from job_visits where id = p_visit_id for update;
  if not found then raise exception 'Käyntiä ei löydy'; end if;
  perform _require_admin(v_v.organization_id);
  update job_visits set status = 'cancelled' where id = p_visit_id;
end $$;

-- Ajanotto alkaa. Asiakkaan aikaleima hyväksytään (offline), mutta ei tulevaisuudesta.
create function public.start_work(
  p_job_id uuid,
  p_event_id uuid,
  p_started_at timestamptz default now(),
  p_visit_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_id uuid;
  v_start timestamptz := least(coalesce(p_started_at, now()), now());
begin
  select id into v_id from time_entries where event_id = p_event_id;
  if found then return v_id; end if;

  v_job := _require_job(p_job_id);
  if v_job.status in ('done', 'billable', 'invoiced') then
    raise exception 'Työ on jo valmis';
  end if;

  -- Sulje mahdollinen unohtunut ajanotto toisessa työssä.
  update time_entries set ended_at = greatest(v_start, started_at), correction_reason = 'Suljettu automaattisesti uuden työn alkaessa'
  where user_id = auth.uid() and ended_at is null;

  insert into time_entries (organization_id, job_id, visit_id, user_id, started_at, event_id)
  values (v_job.organization_id, p_job_id,
          coalesce(p_visit_id, (select id from job_visits where job_id = p_job_id and assigned_to = auth.uid()
                                and status <> 'cancelled' order by visit_date desc limit 1)),
          auth.uid(), v_start, p_event_id)
  returning id into v_id;

  update job_visits set status = 'in_progress'
  where job_id = p_job_id and assigned_to = auth.uid() and status = 'planned' and visit_date <= current_date;

  if v_job.status in ('draft', 'scheduled', 'waiting') then
    if v_job.status = 'draft' then
      perform _set_job_status(v_job, 'scheduled', null);
      select * into v_job from jobs where id = p_job_id;
    end if;
    perform _set_job_status(v_job, 'in_progress', null);
  end if;
  return v_id;
end $$;

-- Ajanotto päättyy (tunnistetaan aloituksen event_id:llä, jotta offline-jono toimii).
create function public.stop_work(
  p_start_event_id uuid,
  p_ended_at timestamptz default now(),
  p_corrected_minutes int default null,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare v_t time_entries;
begin
  select * into v_t from time_entries where event_id = p_start_event_id for update;
  if not found then raise exception 'Ajanottoa ei löydy'; end if;
  if v_t.user_id <> auth.uid() and not is_admin(v_t.organization_id) then
    raise exception 'Ei oikeutta' using errcode = '42501';
  end if;
  update time_entries set
    ended_at = coalesce(ended_at, greatest(least(coalesce(p_ended_at, now()), now()), started_at)),
    corrected_minutes = coalesce(p_corrected_minutes, corrected_minutes),
    correction_reason = coalesce(p_reason, correction_reason)
  where id = v_t.id;
end $$;

-- Ajan korjaus jälkikäteen (näkyy historiassa correction_reasonina ja auditissa).
create function public.correct_time(p_entry_id uuid, p_minutes int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_t time_entries;
begin
  select * into v_t from time_entries where id = p_entry_id for update;
  if not found then raise exception 'Aikakirjausta ei löydy'; end if;
  if v_t.user_id <> auth.uid() and not is_admin(v_t.organization_id) then
    raise exception 'Ei oikeutta' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Kerro korjauksen syy'; end if;
  update time_entries set corrected_minutes = p_minutes, correction_reason = p_reason where id = p_entry_id;
  perform _audit(v_t.organization_id, 'correct_time', 'time_entry', p_entry_id,
                 jsonb_build_object('from', v_t.corrected_minutes, 'to', p_minutes, 'reason', p_reason));
end $$;

-- Työ jää kesken: osa puuttuu / odottaa hyväksyntää / jatkokäynti.
create function public.set_job_waiting(p_job_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  v_job := _require_job(p_job_id);
  update time_entries set ended_at = now() where job_id = p_job_id and user_id = auth.uid() and ended_at is null;
  update job_visits set status = 'done' where job_id = p_job_id and assigned_to = auth.uid() and status = 'in_progress';
  perform _set_job_status(v_job, 'waiting', p_reason);
end $$;

-- Työ valmis. Ei merkitse laskutettavaksi: työnjohto hyväksyy sen erikseen.
create function public.complete_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  v_job := _require_job(p_job_id);
  if v_job.status in ('done', 'billable', 'invoiced') then return; end if;
  update time_entries set ended_at = now() where job_id = p_job_id and ended_at is null;
  update job_visits set status = 'done' where job_id = p_job_id and status in ('planned', 'in_progress')
    and (assigned_to = auth.uid() or is_admin(organization_id));
  if v_job.status in ('draft', 'scheduled') then
    if v_job.status = 'draft' then
      perform _set_job_status(v_job, 'scheduled', null);
      select * into v_job from jobs where id = p_job_id;
    end if;
    perform _set_job_status(v_job, 'in_progress', null);
    select * into v_job from jobs where id = p_job_id;
  end if;
  perform _set_job_status(v_job, 'done', null);
end $$;

create function public.reopen_job(p_job_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if not found then raise exception 'Työtä ei löydy'; end if;
  perform _require_admin(v_job.organization_id);
  if v_job.status = 'waiting' then
    perform _set_job_status(v_job, 'scheduled', p_reason);
  else
    perform _set_job_status(v_job, 'in_progress', p_reason);
  end if;
end $$;

-- Laskutus: johtaja hyväksyy valmiin työn laskutettavaksi, sitten laskutetuksi.
create function public.approve_billing(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_job jobs;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if not found then raise exception 'Työtä ei löydy'; end if;
  perform _require_admin(v_job.organization_id);
  if exists (select 1 from job_extra_work where job_id = p_job_id and status = 'pending') then
    raise exception 'Työssä on käsittelemättömiä lisätöitä';
  end if;
  perform _set_job_status(v_job, 'billable', null);
end $$;

create function public.mark_invoiced(p_job_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare v_job jobs; v_n int := 0;
begin
  for v_job in select * from jobs where id = any(p_job_ids) and status = 'billable' for update loop
    perform _require_admin(v_job.organization_id);
    perform _set_job_status(v_job, 'invoiced', null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Lisätyö kirjataan erikseen hyväksyttäväksi; ei automaattista laskutuslisää.
create function public.add_extra_work(p_job_id uuid, p_event_id uuid, p_description text, p_hours numeric default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_job jobs; v_id uuid;
begin
  select id into v_id from job_extra_work where event_id = p_event_id;
  if found then return v_id; end if;
  v_job := _require_job(p_job_id);
  if coalesce(trim(p_description), '') = '' then raise exception 'Kuvaa lisätyö'; end if;
  insert into job_extra_work (organization_id, job_id, description, estimated_hours, event_id, created_by)
  values (v_job.organization_id, p_job_id, trim(p_description), p_hours, p_event_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create function public.decide_extra_work(p_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_e job_extra_work;
begin
  select * into v_e from job_extra_work where id = p_id for update;
  if not found then raise exception 'Lisätyötä ei löydy'; end if;
  perform _require_admin(v_e.organization_id);
  update job_extra_work set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now()
  where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: materiaalit
-- ---------------------------------------------------------------------------

create function public.normalize_barcode(p_code text) returns text
language sql immutable as $$
  select case
    when regexp_replace(coalesce(p_code, ''), '\s', '', 'g') ~ '^[0-9]+$'
      then ltrim(regexp_replace(p_code, '\s', '', 'g'), '0') -- EAN-8/12/13/14: etunollat pois
    else upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'))
  end;
$$;

-- Keräilyn kirjaus: haku + skannausloki samassa transaktiossa, event_id estää tuplat.
create function public.record_pick(
  p_event_id uuid,
  p_job_material_id uuid,
  p_qty numeric,
  p_source text default 'manual',
  p_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_jm job_materials;
  v_existing material_picks;
begin
  select * into v_existing from material_picks where event_id = p_event_id;
  if found then
    return jsonb_build_object('status', 'duplicate', 'pick_id', v_existing.id);
  end if;
  select * into v_jm from job_materials where id = p_job_material_id for update;
  if not found or not can_see_job(v_jm.job_id) then
    raise exception 'Tarvetta ei löydy tai ei oikeutta' using errcode = '42501';
  end if;
  if p_qty is null or p_qty = 0 then raise exception 'Määrä puuttuu'; end if;

  insert into material_picks (organization_id, job_material_id, qty, source, event_id, picked_by)
  values (v_jm.organization_id, p_job_material_id, p_qty,
          case when p_qty < 0 then 'return' else coalesce(p_source, 'manual') end, p_event_id, auth.uid());

  if p_code is not null then
    insert into material_scans (organization_id, code, normalized_code, product_id, job_material_id, qty, result, event_id, scanned_by)
    values (v_jm.organization_id, p_code, normalize_barcode(p_code), v_jm.product_id, p_job_material_id, p_qty,
            'assigned', p_event_id, auth.uid());
  end if;

  if p_qty > 0 and v_jm.missing then
    update job_materials set missing = false where id = p_job_material_id;
  end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- Tuntemattoman tai turhan skannauksen loki (ei määriä).
create function public.log_scan(p_org uuid, p_event_id uuid, p_code text, p_result text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_member(p_org);
  insert into material_scans (organization_id, code, normalized_code, result, event_id, scanned_by)
  values (p_org, p_code, normalize_barcode(p_code), p_result, p_event_id, auth.uid())
  on conflict (event_id) do nothing;
end $$;

-- Tuntematon viivakoodi liitetään tuotteeseen kerran; seuraava skannaus muistaa sen.
create function public.link_barcode(p_org uuid, p_code text, p_product_id uuid, p_multiplier numeric default 1)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform _require_member(p_org);
  if not exists (select 1 from products where id = p_product_id and organization_id = p_org) then
    raise exception 'Tuotetta ei löydy';
  end if;
  if normalize_barcode(p_code) = '' then raise exception 'Tyhjä viivakoodi'; end if;
  insert into product_barcodes (organization_id, product_id, code, normalized_code, multiplier, created_by)
  values (p_org, p_product_id, p_code, normalize_barcode(p_code), coalesce(p_multiplier, 1), auth.uid())
  on conflict (organization_id, normalized_code) do update
    set product_id = excluded.product_id, multiplier = excluded.multiplier
    where is_admin(p_org); -- asentaja ei voi ylikirjoittaa olemassa olevaa liitosta
  perform _audit(p_org, 'link_barcode', 'product', p_product_id, jsonb_build_object('code', p_code));
end $$;

create function public.set_material_missing(p_job_material_id uuid, p_missing boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_jm job_materials;
begin
  select * into v_jm from job_materials where id = p_job_material_id for update;
  if not found or not can_see_job(v_jm.job_id) then
    raise exception 'Ei oikeutta' using errcode = '42501';
  end if;
  update job_materials set missing = p_missing where id = p_job_material_id;
end $$;

-- Toteutuneet materiaalit. Korvaa saman käyttäjän aiemman kirjauksen tälle työlle
-- (korjaus mahdollinen); muutos lokitetaan.
create function public.save_usage(p_job_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_item jsonb;
begin
  v_job := _require_job(p_job_id);
  if v_job.status in ('billable', 'invoiced') then
    raise exception 'Laskutettavaksi hyväksytyn työn materiaaleja ei voi muuttaa';
  end if;
  delete from material_usage where job_id = p_job_id and recorded_by = auth.uid();
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    if coalesce((v_item->>'qty')::numeric, 0) > 0 then
      insert into material_usage (organization_id, job_id, job_material_id, product_id, description, qty, unit, recorded_by)
      values (v_job.organization_id, p_job_id,
              (select id from job_materials where id = (v_item->>'job_material_id')::uuid and job_id = p_job_id),
              (select id from products where id = (v_item->>'product_id')::uuid and organization_id = v_job.organization_id),
              coalesce(nullif(trim(v_item->>'description'), ''), 'Tarvike'),
              (v_item->>'qty')::numeric,
              coalesce(v_item->>'unit', 'kpl'),
              auth.uid());
    end if;
  end loop;
  perform _audit(v_job.organization_id, 'save_usage', 'job', p_job_id, p_items);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: raportit
-- ---------------------------------------------------------------------------

-- Tallentaa luonnoksen: päivittää käyttäjän viimeisimmän vahvistamattoman version
-- tai luo uuden version (myös vahvistetun raportin korjaus).
create function public.save_report(
  p_job_id uuid,
  p_raw_text text,
  p_structured jsonb default null,
  p_ai_used boolean default false,
  p_confirm boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
  v_r job_reports;
  v_id uuid;
begin
  v_job := _require_job(p_job_id);
  if coalesce(trim(p_raw_text), '') = '' and p_structured is null then
    raise exception 'Raportti on tyhjä';
  end if;
  select * into v_r from job_reports where job_id = p_job_id order by version desc limit 1;
  if found and v_r.confirmed_at is null and v_r.created_by = auth.uid() then
    update job_reports set raw_text = coalesce(p_raw_text, ''), structured = p_structured,
           ai_used = p_ai_used,
           confirmed_at = case when p_confirm then now() end,
           confirmed_by = case when p_confirm then auth.uid() end
    where id = v_r.id;
    v_id := v_r.id;
  else
    insert into job_reports (organization_id, job_id, version, raw_text, structured, ai_used, created_by,
                             confirmed_at, confirmed_by)
    values (v_job.organization_id, p_job_id, coalesce(v_r.version, 0) + 1, coalesce(p_raw_text, ''),
            p_structured, p_ai_used, auth.uid(),
            case when p_confirm then now() end, case when p_confirm then auth.uid() end)
    returning id into v_id;
  end if;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: työvuorot ja sijainti
-- ---------------------------------------------------------------------------

create function public.start_shift(p_org uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform _require_member(p_org);
  select id into v_id from shifts where user_id = auth.uid() and ended_at is null;
  if found then return v_id; end if;
  insert into shifts (organization_id, user_id) values (p_org, auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function public.end_shift() returns void
language plpgsql security definer set search_path = public as $$
begin
  update shifts set ended_at = now() where user_id = auth.uid() and ended_at is null;
end $$;

-- Ylläpito: unohtuneet vuorot suljetaan 12 h jälkeen, sijaintihistoria 30 pv.
create function public.maintenance_cleanup() returns void
language plpgsql security definer set search_path = public as $$
begin
  update shifts set ended_at = started_at + interval '12 hours', auto_closed = true
  where ended_at is null and started_at < now() - interval '12 hours';
  delete from location_pings where recorded_at < now() - interval '30 days';
  delete from public_request_log where created_at < now() - interval '1 day';
end $$;
revoke execute on function public.maintenance_cleanup() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('huoltoputki-cleanup', '15 * * * *', 'select public.maintenance_cleanup()');
exception when others then
  raise notice 'pg_cron ei käytettävissä, ajasta maintenance_cleanup() muuten: %', sqlerrm;
end $$;

-- Sisäiset apurit eivät ole suoraan kutsuttavissa selaimesta.
revoke execute on function public._require_member(uuid) from public, anon, authenticated;
revoke execute on function public._require_admin(uuid) from public, anon, authenticated;
revoke execute on function public._require_job(uuid) from public, anon, authenticated;
revoke execute on function public._audit(uuid, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public._set_job_status(public.jobs, text, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Anonyymi käyttäjä ei kutsu mitään RPC:tä (julkinen lomake kulkee Edge Functionin kautta).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from anon', r.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Realtime ja Storage
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.jobs, public.job_visits, public.location_pings,
    public.job_reports, public.material_picks, public.time_entries;
exception when undefined_object then
  raise notice 'supabase_realtime-julkaisua ei ole';
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Polku: <organization_id>/<job_id>/<tiedosto>
create policy attachments_read on storage.objects for select to authenticated using (
  bucket_id = 'attachments'
  and public.is_member(((storage.foldername(name))[1])::uuid)
  and public.can_see_job(((storage.foldername(name))[2])::uuid)
);
create policy attachments_write on storage.objects for insert to authenticated with check (
  bucket_id = 'attachments'
  and public.is_member(((storage.foldername(name))[1])::uuid)
  and public.can_see_job(((storage.foldername(name))[2])::uuid)
);
