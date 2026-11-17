# Huoltoputki

Sähkö- ja LVI-huoltoyrityksen työnohjaus PWA-sovelluksena: tarjouspyyntö → tarjous → työ → asentaja → tukkukeräily (viivakoodit) → ääniraportti ja tunnit → laskutus. Työnjohto seuraa töitä kartalla ja asentajien päivälistoilla.

**Tila: toimiva prototyyppi.** Ennen tuotantokäyttöä tarvitaan testaus oikeilla laitteilla, tietoturvakatselmus ja sijaintiseurannan tietosuojadokumentaatio (ks. alla).

## Käynnistys paikallisesti

Tarvitset Node 20+ ja Docker Desktopin.

```bash
npm install
npx supabase start          # paikallinen tietokanta + migraatio + demodata
cp .env.example .env.local  # täytä VITE_SUPABASE_ANON_KEY `supabase start` -tulosteesta (ANON_KEY)
npm run dev                 # http://localhost:5173
```

Demotunnukset (salasana `huolto123`): `johtaja@demo.fi` (työnjohto), `mikko@demo.fi`, `sanna@demo.fi`, `olli@demo.fi` (asentajat).

Edge Functionit (tekoäly, geokoodaus, julkinen lomake, käyttäjien lisäys):

```bash
cp supabase/functions/.env.example supabase/functions/.env   # lisää ANTHROPIC_API_KEY halutessasi
npx supabase functions serve --env-file supabase/functions/.env
```

### Puhelimella testaus

Kamera, mikrofoni ja sijainti vaativat HTTPS-yhteyden. Käynnistä `HTTPS=1 npm run dev -- --host` ja avaa näytetty verkko-osoite puhelimessa (hyväksy itse allekirjoitettu varmenne). Supabasen osoitteen pitää myös näkyä puhelimelle: vaihda `.env.local`-tiedostoon koneen lähiverkko-IP. Vaihtoehtoisesti julkaise sovellus esimerkiksi Verceliin.

Testiviivakoodit: `/testikoodit` (tulosta tai näytä toiselta näytöltä).

## Testit

```bash
npm test           # yksikkötestit (skannauksen kohdistus, EAN, CSV)
npm run test:db    # pgTAP: RLS-rajat, idempotenssi, tilasiirtymät (22 testiä)
npm run test:e2e   # Playwright: koko ketju johtajalta asentajalle ja laskutukseen + verkkokatko
```

## Arkkitehtuuri lyhyesti

- **Frontend:** Vite + React + TypeScript + Tailwind, PWA. `src/installer` = asentajan mobiilinäkymä, `src/admin` = työnjohto.
- **Tietokanta:** `supabase/migrations/…_init.sql`. Jokaisessa rivissä on `organization_id`, ja RLS rajaa näkyvyyden yrityksen ja roolin mukaan. Kriittiset tapahtumat ajetaan idempotentteina RPC-funktioina (`event_id`), esim. `create_job_from_quote`, `record_pick`, `start_work`, `complete_job` ja `approve_billing`.
- **Materiaalit:** tarve (`job_materials`), haettu (`material_picks`) ja käytetty (`material_usage`) ovat erillisiä. Skannaus on tapahtuma, ja pakkauskoodin kerroin hoitaa laatikot.
- **Offline:** ajanotto, raporttiluonnos ja kirjaukset tallentuvat IndexedDB:hen (`src/lib/offline.ts`), ja jono lähettää ne, kun yhteys palaa.
- **Tekoäly on lisäominaisuus:** `structure-report`, `parse-request` ja `suggest-quote` kutsuvat Claudea. Ilman avainta kaikki toimii, ja raportti tallentuu raakatekstinä. Malli asetetaan `CLAUDE_MODEL`-muuttujalla.
- **Puhe → teksti:** selaimen Web Speech API (`src/lib/transcriber.ts`). Vaihdettavissa esim. Whisperiin saman rajapinnan takana.

## Julkaisu omaan Supabase-projektiin

```bash
npx supabase login
npx supabase link --project-ref <projektin-ref>
npx supabase db push                          # migraatio (EI demodataa)
npx supabase functions deploy
npx supabase secrets set ANTHROPIC_API_KEY=... NOMINATIM_USER_AGENT="Huoltoputki/1.0 (oma@sahkoposti.fi)"
```

Luo sen jälkeen yritys ja ensimmäinen työnjohtaja SQL-editorissa:

```sql
insert into organizations (name, slug) values ('Yrityksen Nimi Oy', 'yritys') returning id;
-- luo käyttäjä Authentication-välilehdellä, sitten:
insert into organization_members (organization_id, user_id, role) values ('<org-id>', '<user-id>', 'admin');
```

Muut käyttäjät työnjohto lisää sovelluksen Tiimi-sivulta. Aseta frontendin `.env`-tiedostoon projektin URL ja anon/publishable key. Lisää lisäksi Authentication → URL Configuration -kohtaan sovelluksen osoite.

## Tunnetut rajoitukset

- **Sijainti** päivittyy vain, kun sovellus on auki (PWA, etenkin iOS). Kartta näyttää sijainnin iän ja merkitsee vanhan sijainnin. Taustaseuranta vaatisi natiivikääreen (Capacitor).
- **Tietosuoja:** sijaintia kerätään vain vuoron aikana, ja historia poistetaan 30 päivän jälkeen (`maintenance_cleanup`, pg_cron). Ennen käyttöönottoa dokumentoi käyttötarkoitus ja hoida työelämän tietosuojalain mukainen menettely. Juristin arvio on suositeltava.
- **Web Speech API** käsittelee äänen selaimen valmistajan palvelimella, ja suomen kielen laatu vaihtelee. Selaintuki: Chrome/Edge/Android ja Safari.
- **Laskutus** on CSV-vienti, ei integraatiota laskutusohjelmaan.
- **Tuotekatalogi** on demodataa. Oikeat sähkö- ja LVI-numerot sekä EAN-koodit tuodaan tukun hinnastosta.
