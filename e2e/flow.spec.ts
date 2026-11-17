// Päästä päähän: johtaja luo ja delegoi työn -> asentaja aloittaa, kerää tarvikkeen,
// raportoi ja merkitsee valmiiksi -> johtaja hyväksyy laskutukseen ja vie CSV:n.
// Lisäksi: ajanotto säilyy verkkokatkon ja sivun päivityksen yli.
// Vaatii: npx supabase db reset (tuore demodata) + npm run dev.
import { expect, test, type Page } from '@playwright/test'

const TITLE = `E2E-vikakeikka ${Date.now()}`

async function login(page: Page, email: string) {
  await page.goto('/kirjaudu')
  await page.getByLabel('Sähköposti').fill(email)
  await page.getByLabel('Salasana').fill('huolto123')
  await page.getByRole('button', { name: 'Kirjaudu', exact: true }).click()
  await page.waitForURL(/\/(hallinta|asentaja)/)
}

test.describe.configure({ mode: 'serial' })

test('johtaja luo suoran työn ja delegoi sen Mikolle', async ({ page }) => {
  await login(page, 'johtaja@demo.fi')
  await expect(page.getByRole('heading', { name: 'Tilannekuva' })).toBeVisible()
  await page.goto('/hallinta/tyot/uusi')
  await page.getByLabel('Otsikko *').fill(TITLE)
  await page.getByRole('button', { name: 'Kiireellinen' }).click()
  await page.getByLabel('Asiakas / yhteyshenkilö').fill('E2E Asiakas')
  await page.getByLabel('Osoite').fill('Testikatu 1')
  await page.getByLabel('Kaupunki').fill('Helsinki')
  await page.getByPlaceholder('Lisää tuote').fill('Pistorasia 2-os')
  await page.getByRole('button', { name: /Pistorasia 2-os/ }).click()
  await page.getByLabel('Asentaja').selectOption({ label: 'Mikko Virtanen' })
  await page.getByRole('button', { name: 'Luo työ' }).click()
  await expect(page.getByRole('heading', { name: TITLE })).toBeVisible()
  await expect(page.getByText('Suunniteltu').first()).toBeVisible()
  await expect(page.getByText('Mikko Virtanen', { exact: true })).toBeVisible()
})

test('asentaja tekee työn alusta loppuun (ilman tekoälyä)', async ({ page, context }) => {
  await login(page, 'mikko@demo.fi')
  await expect(page.getByText(TITLE)).toBeVisible()

  // Tukku: kuittaa pistorasia käsin tälle työlle
  await page.getByRole('link', { name: /Tukku/ }).click()
  await page.getByRole('button', { name: /Pistorasia 2-os/ }).click()
  await page.getByRole('button', { name: new RegExp(TITLE) }).click()
  await page.getByRole('button', { name: /Kuittaa haetuksi/ }).click()
  await expect(page.getByText(new RegExp(`→ ${TITLE}`))).toBeVisible()

  // Aloita työ, katkaise verkko, päivitä: ajanotto säilyy
  await page.getByRole('link', { name: /Tänään/ }).click()
  await page.getByText(TITLE).click()
  await page.getByRole('button', { name: /Aloita työ/ }).click()
  await expect(page.getByText('Työaika käynnissä')).toBeVisible()
  await context.setOffline(true)
  await page.reload().catch(() => undefined)
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByText('Työaika käynnissä')).toBeVisible()

  // Valmis: kesto, tarvikkeet, kirjoitettu raportti
  await page.getByRole('button', { name: /Valmis – kirjaa/ }).click()
  await page.getByRole('button', { name: '+15' }).click()
  await page.getByPlaceholder('Miksi kesto korjattiin?').fill('Unohdin käynnistää ajanoton heti')
  await page.locator('textarea').first().fill('Vaihdettiin pistorasia, testattu toimii.')
  await page.getByRole('button', { name: /Muotoile/ }).click()
  await expect(page.getByText(/Raporttia ei muotoiltu/)).toBeVisible()
  await page.getByRole('button', { name: /Vahvista ja merkitse valmiiksi/ }).click()
  await page.waitForURL(/\/asentaja$/)
  // Palvelimen tila: avataan työ uudelleen ja tarkistetaan tila + vahvistettu raportti
  await page.getByText(TITLE).click()
  await expect(page.getByText('Valmis', { exact: true })).toBeVisible()
  await expect(page.getByText(/vahvistettu/)).toBeVisible()
  await expect(page.getByText('Vaihdettiin pistorasia, testattu toimii.')).toBeVisible()
})

test('johtaja hyväksyy laskutukseen ja vie CSV:n', async ({ page }) => {
  await login(page, 'johtaja@demo.fi')
  await page.goto('/hallinta/laskutus')
  const row = page.locator('div', { hasText: TITLE }).filter({ has: page.getByRole('button', { name: 'Hyväksy laskutettavaksi' }) }).last()
  await expect(row).toContainText('Raportti ✓')
  await row.getByRole('button', { name: 'Hyväksy laskutettavaksi' }).click()
  await expect(page.getByRole('link', { name: TITLE })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /Vie CSV/ }).click()
  const file = await download
  const csv = await (await file.createReadStream()).toArray()
  const text = Buffer.concat(csv).toString('utf-8')
  expect(text).toContain(TITLE)
  expect(text).toContain('Pistorasia 2-os. maadoitettu uppo')
  expect(text).toContain('Asennustyö')
})
