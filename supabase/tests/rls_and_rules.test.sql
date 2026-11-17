-- Ajetaan: npx supabase test db   (vaatii seed.sql-demodatan)
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Apurit: kirjaudu käyttäjäksi / palaa superuseriksi
create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Toinen yritys ristikkäistestejä varten
insert into auth.users (id, email, aud, role) values ('bbbbbbbb-0000-0000-0000-000000000001', 'toinen@muu.fi', 'authenticated', 'authenticated');
insert into organizations (id, name, slug) values ('22222222-2222-2222-2222-222222222222', 'Muu Oy', 'muu-oy');
insert into organization_members values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 'admin', true, now());

-- Odotusarvot lasketaan datasta, jotta testi kestää sovelluksessa tehdyt muutokset.
create temp table t_exp as select
  (select count(distinct job_id) from job_visits where assigned_to = 'aaaaaaaa-0000-0000-0000-000000000002')::int as jobs,
  (select count(distinct j.customer_id) from jobs j join job_visits v on v.job_id = j.id
    where v.assigned_to = 'aaaaaaaa-0000-0000-0000-000000000002')::int as customers;
grant select on t_exp to authenticated;

-- ---- Asentaja Mikko -------------------------------------------------------
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');

select is((select count(*) from jobs)::int, (select jobs from t_exp), 'Asentaja näkee täsmälleen omat työnsä');
select is((select count(*) from jobs where id = 'dddddddd-0000-0000-0000-000000000003')::int, 0, 'Asentaja ei näe toisen asentajan työtä');
select is((select count(*) from quote_requests)::int, 0, 'Asentaja ei näe tarjouspyyntöjä');
select is((select count(*) from customers)::int, (select customers from t_exp), 'Asentaja näkee vain omien töidensä asiakkaat');
select is((select count(*) from job_material_status where job_id = 'dddddddd-0000-0000-0000-000000000003')::int, 0, 'Asentaja ei näe toisen työn tarvikkeita');

update organization_members set role = 'admin' where user_id = 'aaaaaaaa-0000-0000-0000-000000000002';
select pg_temp.logout();
select is((select role from organization_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000002'), 'installer', 'Asentaja ei voi korottaa omaa rooliaan');
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');

select throws_ok(
  $$ select create_direct_job('11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'X') $$,
  '42501', null, 'Asentaja ei voi luoda töitä');

select throws_ok(
  $$ select record_pick(gen_random_uuid(), (select id from job_materials where job_id = 'dddddddd-0000-0000-0000-000000000003' limit 1), 1, 'manual') $$,
  '42501', null, 'Asentaja ei voi kirjata toisen työn tarvikkeita');

-- Keräilyn idempotenssi ja saldo
select pg_temp.logout();
create temp table t_ev as select gen_random_uuid() as ev,
  (select id from job_materials where job_id = 'dddddddd-0000-0000-0000-000000000002' limit 1) as jm;
grant select on t_ev to authenticated;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
select record_pick((select ev from t_ev), (select jm from t_ev), 1, 'scan', '2000041000318');
select is(record_pick((select ev from t_ev), (select jm from t_ev), 1, 'scan', '2000041000318')->>'status', 'duplicate', 'Sama event_id ei tuplaa keräilyä');
select is((select qty_picked from job_material_status where id = (select jm from t_ev))::numeric, 1::numeric, 'Haettu määrä = 1');
select throws_ok(
  $$ select record_pick(gen_random_uuid(), (select jm from t_ev), -5, 'manual') $$,
  '23514', null, 'Palautus ei voi ylittää haettua määrää');

-- Ajanotto ja valmistuminen
select start_work('dddddddd-0000-0000-0000-000000000002', 'cccccccc-1111-0000-0000-000000000001');
select is((select status from jobs where id = 'dddddddd-0000-0000-0000-000000000002'), 'in_progress', 'Aloitus siirtää työn käyntiin');
select is(start_work('dddddddd-0000-0000-0000-000000000002', 'cccccccc-1111-0000-0000-000000000001'),
          (select id from time_entries where event_id = 'cccccccc-1111-0000-0000-000000000001'), 'Aloituksen toisto on idempotentti');
select stop_work('cccccccc-1111-0000-0000-000000000001', now(), 50, 'Testi');
select save_report('dddddddd-0000-0000-0000-000000000002', 'Vaihdettiin vikavirtasuoja', null, false, true);
select complete_job('dddddddd-0000-0000-0000-000000000002');
select is((select status from jobs where id = 'dddddddd-0000-0000-0000-000000000002'), 'done', 'Valmis-tila, ei automaattista laskutushyväksyntää');
select throws_ok(
  $$ select approve_billing('dddddddd-0000-0000-0000-000000000002') $$,
  '42501', null, 'Asentaja ei voi hyväksyä laskutusta');

-- Sijainti vain vuoron aikana
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok(
  $$ insert into location_pings (organization_id, user_id, shift_id, lat, lng)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', '99999999-0000-0000-0000-000000000002', 60, 24) $$,
  '42501', null, 'Sijaintia ei voi lähettää ilman omaa avointa vuoroa');
select is((select count(*) from location_pings)::int, 0, 'Asentaja ei näe muiden sijainteja');

-- ---- Johtaja ----------------------------------------------------------------
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select accept_quote('ffffffff-0000-0000-0000-000000000001');
select is(create_job_from_quote('ffffffff-0000-0000-0000-000000000001'),
          create_job_from_quote('ffffffff-0000-0000-0000-000000000001'), 'Tarjouksesta syntyy yksi työ toistosta huolimatta');
select is((select count(*) from job_materials jm join jobs j on j.id = jm.job_id where j.quote_id = 'ffffffff-0000-0000-0000-000000000001')::int, 4,
          'Tarjouksen tuoterivit kopioituvat työn tarpeiksi');
-- Kellonajat: tyhjä päivä alkaa klo 8, seuraava käynti edellisen jälkeen (työn arvio 8 h)
create temp table t_v as select
  assign_visit(create_job_from_quote('ffffffff-0000-0000-0000-000000000001'), 'aaaaaaaa-0000-0000-0000-000000000004', current_date + 30) as v1;
select is((select start_time from job_visits where id = (select v1 from t_v limit 1)), time '08:00', 'Tyhjän päivän ensimmäinen käynti klo 8');
insert into t_v select assign_visit(create_job_from_quote('ffffffff-0000-0000-0000-000000000001'), 'aaaaaaaa-0000-0000-0000-000000000004', current_date + 30);
select is((select start_time from job_visits where id = (select v1 from t_v offset 1)), time '16:00', 'Seuraava käynti saa ajan edellisen (8 h) jälkeen');
select set_visit_time((select v1 from t_v limit 1), time '07:15', 90);
select is((select start_time::text || ' ' || duration_minutes from job_visits where id = (select v1 from t_v limit 1)), '07:15:00 90', 'Johtaja voi muuttaa kellonajan ja keston');
grant select on t_v to authenticated;
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
select throws_ok($$ select set_visit_time((select v1 from t_v limit 1), time '09:00', null) $$, '42501', null, 'Asentaja ei voi muuttaa aikataulua');
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$ select create_job_from_quote('ffffffff-0000-0000-0000-000000000002') $$,
  'P0001', 'Vain hyväksytystä tarjouksesta voi luoda työn', 'Hyväksymätön tarjous ei luo työtä');
-- RLS estää suoran muokkauksen; lisäksi lukitustriggeri estää sen myös palvelinroolilta.
select pg_temp.logout();
select throws_ok(
  $$ update job_reports set raw_text = 'muutettu' where job_id = 'dddddddd-0000-0000-0000-000000000007' $$,
  'P0001', null, 'Vahvistettua raporttia ei voi muuttaa');

-- ---- Toinen yritys ----------------------------------------------------------
select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
select is((select count(*) from jobs)::int + (select count(*) from customers)::int + (select count(*) from location_pings)::int, 0,
          'Toisen yrityksen admin ei näe mitään');

select * from finish();
rollback;
