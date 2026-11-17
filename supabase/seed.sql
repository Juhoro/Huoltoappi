-- Huoltoputki demodata (VAIN paikalliseen kehitykseen).
-- Kirjautuminen: johtaja@demo.fi / mikko@demo.fi / sanna@demo.fi / olli@demo.fi, salasana: huolto123
-- Päivämäärät ovat suhteessa current_dateen, jotta demo on aina "tänään".

-- EAN-13 tarkistenumero (12 numeroa -> 13 numeroa)
create function pg_temp.ean13(base text) returns text language sql immutable as $$
  select base || ((10 - (
    select sum(substr(base, i, 1)::int * case when i % 2 = 0 then 3 else 1 end)
    from generate_series(1, 12) i
  ) % 10) % 10)::text;
$$;

insert into public.organizations (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Demo Sähkö & LVI Oy', 'demo-huolto');

-- Käyttäjät -----------------------------------------------------------------
with u(id, email, full_name) as (values
  ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'johtaja@demo.fi', 'Jussi Johtaja'),
  ('aaaaaaaa-0000-0000-0000-000000000002'::uuid, 'mikko@demo.fi',   'Mikko Virtanen'),
  ('aaaaaaaa-0000-0000-0000-000000000003'::uuid, 'sanna@demo.fi',   'Sanna Putkonen'),
  ('aaaaaaaa-0000-0000-0000-000000000004'::uuid, 'olli@demo.fi',    'Olli Sähkönen')
)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('huolto123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', full_name),
       now(), now(), '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users where email like '%@demo.fi';

update public.profiles set phone = '040 100 0001', color = '#0f172a' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set phone = '040 100 0002', color = '#2563eb' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.profiles set phone = '040 100 0003', color = '#16a34a' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
update public.profiles set phone = '040 100 0004', color = '#d97706' where id = 'aaaaaaaa-0000-0000-0000-000000000004';

insert into public.organization_members (organization_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'admin'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'installer'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', 'installer'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000004', 'installer');

-- Tuotteet (sähkö- ja LVI-numerot sekä EAN-koodit ovat demoarvoja) --------------
insert into public.products (organization_id, name, sku_type, sku, unit, pack_size, price, category)
select '11111111-1111-1111-1111-111111111111', name, sku_type, sku, unit, pack_size, price, category
from (values
  ('MMJ 3x1,5S kaapeli',                     'sahkonumero', '4100001', 'm',   1,   0.95, 'sähkö'),
  ('MMJ 3x2,5S kaapeli',                     'sahkonumero', '4100002', 'm',   1,   1.45, 'sähkö'),
  ('MMJ 5x2,5S kaapeli',                     'sahkonumero', '4100003', 'm',   1,   2.40, 'sähkö'),
  ('MMJ 5x6S kaapeli',                       'sahkonumero', '4100004', 'm',   1,   5.90, 'sähkö'),
  ('Asennusrasia uppo 1-os.',                'sahkonumero', '4100010', 'kpl', 1,   1.20, 'sähkö'),
  ('Jakorasia pinta IP44',                   'sahkonumero', '4100011', 'kpl', 1,   3.80, 'sähkö'),
  ('Kytkin 1-napainen uppo valk.',           'sahkonumero', '4100020', 'kpl', 1,   8.50, 'sähkö'),
  ('Vaihtokytkin uppo valk.',                'sahkonumero', '4100021', 'kpl', 1,  10.90, 'sähkö'),
  ('Pistorasia 2-os. maadoitettu uppo',      'sahkonumero', '4100022', 'kpl', 1,  12.40, 'sähkö'),
  ('Ulkopistorasia IP44 kansi',              'sahkonumero', '4100023', 'kpl', 1,  18.90, 'sähkö'),
  ('Johdonsuojakatkaisija C16 1-nap.',       'sahkonumero', '4100030', 'kpl', 1,   6.90, 'sähkö'),
  ('Vikavirtasuoja 40A 30mA 4-nap.',         'sahkonumero', '4100031', 'kpl', 1,  39.00, 'sähkö'),
  ('Yhdistelmäsuoja C16 30mA',               'sahkonumero', '4100032', 'kpl', 1,  42.00, 'sähkö'),
  ('Ryhmäkeskus 24-moduuli uppo',            'sahkonumero', '4100033', 'kpl', 1,  89.00, 'sähkö'),
  ('LED-kattovalaisin 18W IP44',             'sahkonumero', '4100040', 'kpl', 1,  34.00, 'sähkö'),
  ('LED-alasvalo 7W himmennettävä',          'sahkonumero', '4100041', 'kpl', 1,  19.50, 'sähkö'),
  ('Liiketunnistin 360° kattoon',            'sahkonumero', '4100042', 'kpl', 1,  29.00, 'sähkö'),
  ('Palovaroitin 230V + varaparisto',        'sahkonumero', '4100043', 'kpl', 1,  27.00, 'sähkö'),
  ('Wago 221-413 pikaliitin',                'sahkonumero', '4100050', 'kpl', 50,  0.42, 'sähkö'),
  ('Sokeripala 2,5 mm² 12-nap.',             'sahkonumero', '4100051', 'kpl', 1,   1.10, 'sähkö'),
  ('Nippuside 200 mm musta',                 'sahkonumero', '4100052', 'kpl', 100, 0.04, 'sähkö'),
  ('Asennusputki 20 mm harmaa',              'sahkonumero', '4100053', 'm',   1,   0.85, 'sähkö'),
  ('Lattialämmityskaapeli 10 m²',            'sahkonumero', '4100060', 'kpl', 1, 249.00, 'sähkö'),
  ('Lattialämmitystermostaatti',             'sahkonumero', '4100061', 'kpl', 1,  69.00, 'sähkö'),
  ('Latausasema 11 kW Type 2',               'sahkonumero', '4100062', 'kpl', 1, 690.00, 'sähkö'),
  ('PEX-putki 16x2,2 suojaputkessa',         'lvinumero',   '1500001', 'm',   1,   2.10, 'lvi'),
  ('Komposiittiputki 16x2,0',                'lvinumero',   '1500002', 'm',   1,   2.60, 'lvi'),
  ('Puristusliitin suora 16x16',             'lvinumero',   '1500010', 'kpl', 1,   6.40, 'lvi'),
  ('Puristuskulma 16x16',                    'lvinumero',   '1500011', 'kpl', 1,   7.20, 'lvi'),
  ('Pallosulkuventtiili 15 mm',              'lvinumero',   '1500020', 'kpl', 1,  14.90, 'lvi'),
  ('Hanakulmaventtiili 15 mm',               'lvinumero',   '1500021', 'kpl', 1,  11.50, 'lvi'),
  ('Liitäntäletku 300 mm 15x10',             'lvinumero',   '1500022', 'kpl', 1,   8.90, 'lvi'),
  ('Keittiöhana astianpesukoneventtiilillä', 'lvinumero',   '1500030', 'kpl', 1, 149.00, 'lvi'),
  ('Suihkutermostaatti 160 cc',              'lvinumero',   '1500031', 'kpl', 1, 189.00, 'lvi'),
  ('WC-istuin kiinteä kaksoishuuhtelu',      'lvinumero',   '1500032', 'kpl', 1, 229.00, 'lvi'),
  ('Lattiakaivo muovi 50/75',                'lvinumero',   '1500040', 'kpl', 1,  64.00, 'lvi'),
  ('Patterin termostaattiventtiili',         'lvinumero',   '1500041', 'kpl', 1,  32.00, 'lvi'),
  ('Linjasäätöventtiili 15 mm',              'lvinumero',   '1500042', 'kpl', 1,  44.00, 'lvi'),
  ('Jakotukki 4-lähtö',                      'lvinumero',   '1500043', 'kpl', 1,  98.00, 'lvi'),
  ('Teflonteippi 12 m',                      'lvinumero',   '1500050', 'kpl', 1,   1.90, 'lvi'),
  ('Kierretiiviste pellava 40 g',            'lvinumero',   '1500051', 'kpl', 1,   4.50, 'lvi'),
  ('Lämminvesivaraaja 100 L',                'lvinumero',   '1500060', 'kpl', 1, 549.00, 'lvi')
) as t(name, sku_type, sku, unit, pack_size, price, category);

-- Jokaiselle tuotteelle yksittäiskoodi, pakkaustuotteille lisäksi laatikkokoodi (kerroin).
insert into public.product_barcodes (organization_id, product_id, code, normalized_code, multiplier)
select organization_id, id, c, public.normalize_barcode(c), 1
from (
  select organization_id, id, pg_temp.ean13('200' || lpad(sku, 9, '0')) as c
  from public.products
) s;

insert into public.product_barcodes (organization_id, product_id, code, normalized_code, multiplier)
select organization_id, id, c, public.normalize_barcode(c), pack_size
from (
  select organization_id, id, pack_size, pg_temp.ean13('209' || lpad(sku, 9, '0')) as c
  from public.products where pack_size > 1
) s;

-- Asiakkaat -----------------------------------------------------------------
insert into public.customers (id, organization_id, name, phone, email, address, city, lat, lng) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'As Oy Mannerheimin Helmi', '09 123 4501', 'isannointi@helmi.example', 'Mannerheimintie 100', 'Helsinki', 60.1880, 24.9220),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Liisa Laine',              '040 555 0102', 'liisa@example.com',        'Hämeentie 50 B 12',  'Helsinki', 60.1870, 24.9600),
  ('cccccccc-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Kahvila Tapiola',          '050 555 0103', 'kahvila@example.com',      'Tapiolantie 10',     'Espoo',    60.1760, 24.8050),
  ('cccccccc-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'Pekka Mäkinen',            '044 555 0104', null,                       'Leppävaarankatu 5',  'Espoo',    60.2190, 24.8130),
  ('cccccccc-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Tikkurilan Kuntosali Oy',  '09 555 0105',  'info@kuntosali.example',   'Tikkurilantie 20',   'Vantaa',   60.2930, 25.0400),
  ('cccccccc-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Anna ja Timo Korhonen',    '040 555 0106', 'korhoset@example.com',     'Myyrmäentie 3',      'Vantaa',   60.2610, 24.8540),
  ('cccccccc-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'As Oy Lauttasaaren Ranta', '09 555 0107',  'hallitus@ranta.example',   'Lauttasaarentie 30', 'Helsinki', 60.1590, 24.8780);

-- Työt ---------------------------------------------------------------------
create function pg_temp.mat(p_job uuid, p_sku text, p_qty numeric) returns void language sql as $$
  insert into public.job_materials (organization_id, job_id, product_id, description, unit, qty_needed)
  select organization_id, p_job, id, name, unit, p_qty from public.products where sku = p_sku;
$$;

insert into public.jobs (id, organization_id, customer_id, title, description, address, city, lat, lng,
                         contact_name, contact_phone, priority, status, estimated_hours, created_by)
values
  ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000002',
   'Keittiön pistorasiat ja valaistus', 'Lisätään 3 pistorasiaa työtason yläpuolelle ja vaihdetaan kattovalaisin LED-malliin.',
   'Hämeentie 50 B 12', 'Helsinki', 60.1870, 24.9600, 'Liisa Laine', '040 555 0102', 'normal', 'scheduled', 4,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000003',
   'Vikavirtasuojan laukeaminen', 'Asiakas ilmoittaa että vikavirtasuoja laukeaa aamuisin kahvinkeittimen käynnistyessä. Vianetsintä.',
   'Tapiolantie 10', 'Espoo', 60.1760, 24.8050, 'Kahvila Tapiola', '050 555 0103', 'urgent', 'scheduled', 2,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000006',
   'Keittiöhanan ja kulmaventtiilien vaihto', 'Vanha hana vuotaa. Vaihdetaan hana ja kulmaventtiilit, asennetaan astianpesukoneliitäntä.',
   'Myyrmäentie 3', 'Vantaa', 60.2610, 24.8540, 'Anna Korhonen', '040 555 0106', 'normal', 'scheduled', 3,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000007',
   'Patteriventtiilien vaihto 3 krs', 'Vaihdetaan 6 kpl termostaattiventtiilejä ja tasapainotus.',
   'Lauttasaarentie 30', 'Helsinki', 60.1590, 24.8780, 'Isännöitsijä Rantala', '09 555 0107', 'normal', 'scheduled', 5,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000005',
   'Pukuhuoneen valaistus ja liiketunnistimet', 'Vaihdetaan 8 valaisinta LED-malliin ja lisätään 2 liiketunnistinta.',
   'Tikkurilantie 20', 'Vantaa', 60.2930, 25.0400, 'Sali-Jukka', '09 555 0105', 'normal', 'scheduled', 6,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000004',
   'Sähköauton latausaseman asennus', 'Latausasema autokatokseen, syöttö keskukselta n. 18 m.',
   'Leppävaarankatu 5', 'Espoo', 60.2190, 24.8130, 'Pekka Mäkinen', '044 555 0104', 'normal', 'scheduled', 6,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001',
   'Porraskäytävän palovaroittimet', 'Vaihdettu 6 palovaroitinta porraskäytäviin A ja B.',
   'Mannerheimintie 100', 'Helsinki', 60.1880, 24.9220, 'Isännöitsijä Helmi', '09 123 4501', 'normal', 'done', 2,
   'aaaaaaaa-0000-0000-0000-000000000001'),
  ('dddddddd-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000002',
   'Kylpyhuoneen lattialämmitys', 'Lattialämmityskaapelin ja termostaatin asennus. Odottaa termostaattia tukusta.',
   'Hämeentie 50 B 12', 'Helsinki', 60.1870, 24.9600, 'Liisa Laine', '040 555 0102', 'normal', 'waiting', 5,
   'aaaaaaaa-0000-0000-0000-000000000001');

update public.jobs set waiting_reason = 'Osa puuttuu: termostaatti tilattu, saapuu ensi viikolla'
where id = 'dddddddd-0000-0000-0000-000000000008';
update public.jobs set completed_at = now() - interval '1 day' where id = 'dddddddd-0000-0000-0000-000000000007';

select pg_temp.mat('dddddddd-0000-0000-0000-000000000001', '4100022', 3);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000001', '4100010', 3);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000001', '4100002', 12);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000001', '4100040', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000001', '4100050', 10);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000002', '4100031', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000003', '1500030', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000003', '1500021', 2);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000003', '1500022', 2);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000003', '1500050', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000004', '1500041', 6);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000005', '4100040', 8);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000005', '4100042', 2);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000005', '4100050', 20);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000006', '4100062', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000006', '4100004', 18);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000006', '4100032', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000007', '4100043', 6);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000008', '4100060', 1);
select pg_temp.mat('dddddddd-0000-0000-0000-000000000008', '4100061', 1);

-- Käynnit: Mikko (sähkö), Sanna (LVI), Olli (sähkö)
insert into public.job_visits (organization_id, job_id, assigned_to, visit_date, sort, status) values
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002', current_date, 0, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', current_date, 1, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000006', 'aaaaaaaa-0000-0000-0000-000000000002', current_date + 1, 0, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000003', current_date, 0, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000003', current_date, 1, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000004', current_date, 0, 'planned'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000004', current_date - 1, 0, 'done'),
  ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000008', 'aaaaaaaa-0000-0000-0000-000000000004', current_date - 2, 0, 'done');

-- Kellonajat kalenteriin
update public.job_visits v set start_time = t.st from (values
  ('dddddddd-0000-0000-0000-000000000002'::uuid, time '08:00'), ('dddddddd-0000-0000-0000-000000000001', '10:30'),
  ('dddddddd-0000-0000-0000-000000000006', '08:00'), ('dddddddd-0000-0000-0000-000000000003', '08:00'),
  ('dddddddd-0000-0000-0000-000000000004', '12:00'), ('dddddddd-0000-0000-0000-000000000005', '08:00'),
  ('dddddddd-0000-0000-0000-000000000007', '09:00'), ('dddddddd-0000-0000-0000-000000000008', '09:00')) t(job, st)
where v.job_id = t.job;

insert into public.job_status_events (organization_id, job_id, from_status, to_status, note, actor)
select organization_id, id, null, status, 'Demodata', 'aaaaaaaa-0000-0000-0000-000000000001' from public.jobs;

-- Valmis työ: haetut + käytetyt materiaalit, aika ja vahvistettu raportti (laskutusdemo)
insert into public.material_picks (organization_id, job_material_id, qty, source, event_id, picked_by)
select organization_id, id, qty_needed, 'scan', gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000004'
from public.job_materials where job_id = 'dddddddd-0000-0000-0000-000000000007';
insert into public.material_usage (organization_id, job_id, job_material_id, product_id, description, qty, unit, recorded_by)
select organization_id, job_id, id, product_id, description, qty_needed, unit, 'aaaaaaaa-0000-0000-0000-000000000004'
from public.job_materials where job_id = 'dddddddd-0000-0000-0000-000000000007';
insert into public.time_entries (organization_id, job_id, user_id, started_at, ended_at, event_id)
values ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000007', 'aaaaaaaa-0000-0000-0000-000000000004',
        date_trunc('day', now()) - interval '1 day' + interval '9 hours',
        date_trunc('day', now()) - interval '1 day' + interval '10 hours 45 minutes', gen_random_uuid());
insert into public.job_reports (organization_id, job_id, version, raw_text, structured, ai_used, created_by, confirmed_at, confirmed_by)
values ('11111111-1111-1111-1111-111111111111', 'dddddddd-0000-0000-0000-000000000007', 1,
  'vaihdettiin kuusi palovaroitinta porraskäytäviin A ja B, vanhat oli vuodelta 2014. testattiin kaikki toimii. B-rapun kolmannen kerroksen valaisimen kupu on haljennut kannattaa vaihtaa ensi kerralla',
  '{"summary":"Porraskäytävien A ja B palovaroittimet vaihdettu (6 kpl) ja testattu.","actions":["Vaihdettu 6 palovaroitinta porraskäytäviin A ja B (vanhat vuodelta 2014)","Testattu kaikkien varoittimien toiminta"],"materials":[{"name":"Palovaroitin 230V","qty":"6 kpl"}],"issues":["B-rapun 3. kerroksen valaisimen kupu haljennut"],"follow_up":["Vaihda B-rapun 3. kerroksen valaisimen kupu seuraavalla käynnillä"],"customer_notes":"Kaikki palovaroittimet toimivat."}',
  true, 'aaaaaaaa-0000-0000-0000-000000000004', now() - interval '1 day', 'aaaaaaaa-0000-0000-0000-000000000004');

-- Mikko on hakenut osan keittiötyön tarvikkeista
insert into public.material_picks (organization_id, job_material_id, qty, source, event_id, picked_by)
select organization_id, id, qty_needed, 'scan', gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002'
from public.job_materials
where job_id = 'dddddddd-0000-0000-0000-000000000001' and description like 'Pistorasia%';
update public.job_materials set missing = true
where job_id = 'dddddddd-0000-0000-0000-000000000008' and description like 'Lattialämmitystermostaatti%';

-- Tarjouspyynnöt ja tarjoukset ----------------------------------------------
insert into public.quote_requests (id, organization_id, customer_id, contact_name, phone, email, address, city, description, source, status, urgent, created_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', null, 'Matti Nieminen', '040 777 0201', 'matti@example.com',
   'Kauppakartanonkatu 7', 'Helsinki', 'Haluaisin tarjouksen kylpyhuoneen putkiremontista: suihkutermostaatti, wc-istuin ja lattiakaivon vaihto.', 'form', 'new', false, now() - interval '3 hours'),
  ('eeeeeeee-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, 'Riikka Salo', '050 777 0202', null,
   'Fleminginkatu 10', 'Helsinki', 'Sähköauton latauspiste taloyhtiön parkkipaikalle, 4 autopaikkaa.', 'phone', 'new', false, now() - interval '1 day'),
  ('eeeeeeee-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000004', 'Pekka Mäkinen', '044 555 0104', null,
   'Leppävaarankatu 5', 'Espoo', 'Latausaseman asennus autokatokseen.', 'phone', 'accepted', false, now() - interval '10 days'),
  ('eeeeeeee-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'cccccccc-0000-0000-0000-000000000001', 'Isännöitsijä Helmi', '09 123 4501', 'isannointi@helmi.example',
   'Mannerheimintie 100', 'Helsinki', 'Porraskäytävien valaistuksen uusiminen LED-valaisimiin ja liiketunnistimiin.', 'email', 'quoted', false, now() - interval '4 days');

insert into public.customers (id, organization_id, name, phone, email, address, city, lat, lng) values
  ('cccccccc-0000-0000-0000-000000000008', '11111111-1111-1111-1111-111111111111', 'Matti Nieminen', '040 777 0201', 'matti@example.com', 'Kauppakartanonkatu 7', 'Helsinki', 60.2100, 25.0800);

insert into public.quotes (id, organization_id, quote_request_id, customer_id, title, description, address, city, status, valid_until, estimated_hours, sent_at, created_by) values
  ('ffffffff-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000001',
   'Porraskäytävien LED-valaistus', 'Porraskäytävien A ja B valaisimien vaihto LED-valaisimiin (12 kpl) ja liiketunnistimet (4 kpl).',
   'Mannerheimintie 100', 'Helsinki', 'sent', current_date + 30, 8, now() - interval '3 days', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('ffffffff-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'eeeeeeee-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000008',
   'Kylpyhuoneen putkityöt', 'Suihkutermostaatin, WC-istuimen ja lattiakaivon vaihto.',
   'Kauppakartanonkatu 7', 'Helsinki', 'draft', current_date + 30, 7, null, 'aaaaaaaa-0000-0000-0000-000000000001');

update public.quote_requests set status = 'in_progress', customer_id = 'cccccccc-0000-0000-0000-000000000008'
where id = 'eeeeeeee-0000-0000-0000-000000000001';
update public.jobs set quote_id = null where id = 'dddddddd-0000-0000-0000-000000000006';

insert into public.quote_lines (organization_id, quote_id, kind, product_id, description, qty, unit, unit_price, sort)
select '11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000001', 'product', id, name, q, unit, price, s
from (values ('4100040', 12, 1), ('4100042', 4, 2), ('4100050', 30, 3), ('4100002', 20, 4)) v(sku, q, s)
join public.products p on p.sku = v.sku;
insert into public.quote_lines (organization_id, quote_id, kind, description, qty, unit, unit_price, sort) values
  ('11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000001', 'labor', 'Asennustyö', 8, 'h', 65, 10);

insert into public.quote_lines (organization_id, quote_id, kind, product_id, description, qty, unit, unit_price, sort)
select '11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000002', 'product', id, name, q, unit, price, s
from (values ('1500031', 1, 1), ('1500032', 1, 2), ('1500040', 1, 3), ('1500022', 2, 4)) v(sku, q, s)
join public.products p on p.sku = v.sku;
insert into public.quote_lines (organization_id, quote_id, kind, description, qty, unit, unit_price, sort) values
  ('11111111-1111-1111-1111-111111111111', 'ffffffff-0000-0000-0000-000000000002', 'labor', 'Asennustyö', 7, 'h', 65, 10);

-- Vuorot ja sijainnit (Mikko ja Sanna töissä, Olli ei vielä aloittanut) ----------
insert into public.shifts (id, organization_id, user_id, started_at) values
  ('99999999-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', now() - interval '2 hours'),
  ('99999999-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', now() - interval '3 hours');
insert into public.location_pings (organization_id, user_id, shift_id, lat, lng, accuracy, recorded_at) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 60.1950, 24.8800, 15, now() - interval '20 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', '99999999-0000-0000-0000-000000000002', 60.1800, 24.8200, 12, now() - interval '2 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000003', 60.2580, 24.8600, 20, now() - interval '25 minutes');
