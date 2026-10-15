// E2E #2: subgroup quota mode + wheel animation + replace winner + English UI.
import { _electron as electron } from 'playwright-core'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const out = resolve(process.argv[2] ?? join(tmpdir(), 'sorteos-e2e'))
mkdirSync(out, { recursive: true })
const userData = mkdtempSync(join(tmpdir(), 'sorteos-ud-'))
const rows = (p, n, s) => Array.from({ length: n }, (_, i) => `${p}${i + 1}\tNombre ${p}${i + 1}\t${s}`)
const data = ['ID\tNombre\tSubgrupo', ...rows('T', 6, 'TI'), ...rows('V', 6, 'Ventas'), ...rows('L', 2, 'Legal')].join('\n')

// Set E2E_EXE to a packaged Sorteos.exe to test the packaged app; otherwise the built out/ runs via electron.
const app = await electron.launch(
  process.env.E2E_EXE
    ? { executablePath: process.env.E2E_EXE, args: [`--user-data-dir=${userData}`] }
    : { args: ['.', `--user-data-dir=${userData}`], cwd: resolve('.') }
)
const errors = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.getByRole('textbox', { name: 'Nombre del evento' }).fill('Cuotas')
  await page.getByRole('button', { name: 'Crear evento' }).click()
  await page.locator('#paste').fill(data)
  await page.getByRole('button', { name: 'Cargar lo pegado — Reemplazar lista' }).click()
  await page.getByRole('dialog', { name: 'Asignar columnas' }).getByRole('button', { name: 'Importar' }).click()
  assert.ok(!(await page.getByText(/Origen:/).isVisible()), 'pasted data has no source file')

  // customize this group: quota mode 1 winner + 1 alternate per subgroup, wheel, 3 s
  await page.getByText('Personalizar ajustes de este grupo').click()
  await page.getByLabel('Ganadores por subgrupo').check()
  await page.locator('input[name=a]').fill('1')
  await page.getByRole('button', { name: 'Aplicar a todos' }).click()
  await page.getByRole('button', { name: 'Ruleta', exact: true }).click()
  await page.locator('input[type=range]').fill('3')
  await page.screenshot({ path: join(out, 'q1-quota-settings.png') })

  await page.getByRole('button', { name: /Revisar y sortear/ }).click()
  await page.getByRole('button', { name: 'Comenzar sorteo' }).click()
  await page.locator('canvas').waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(out, 'q2-wheel.png') })
  await page.getByRole('heading', { name: /Ganadores/ }).waitFor({ timeout: 40_000 })

  const cards = await page.locator('.winner-card').allInnerTexts()
  assert.equal(cards.length, 6, `3 winners + 3 alternates, got ${cards.length}`)
  const winnersText = cards.slice(0, 3).join('|')
  for (const s of ['TI', 'Ventas', 'Legal']) assert.ok(winnersText.includes(s), `a winner from ${s}`)
  await page.screenshot({ path: join(out, 'q3-result.png') })

  // replace the winner from "Ventas": the promoted alternate must be from Ventas too
  const idx = cards.slice(0, 3).findIndex((c) => c.includes('Ventas'))
  await page.getByRole('button', { name: 'Reemplazar' }).nth(idx).click()
  await page.getByLabel('Motivo (queda registrado en el certificado)').fill('no se presentó')
  await page.getByRole('dialog').getByRole('button', { name: 'Reemplazar' }).click()
  await page.getByRole('heading', { name: 'Reemplazos' }).waitFor()
  const after = await page.locator('.winner-card').allInnerTexts()
  assert.equal(after.slice(0, 3).filter((c) => c.includes('Ventas')).length, 1, 'still one Ventas winner')
  assert.equal(after.length, 5, 'alternate was promoted (one fewer alternate)')

  // English UI
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en')
  await page.getByRole('heading', { name: 'Winners' }).waitFor()
  await page.getByRole('heading', { name: 'Replacements' }).waitFor()
  await page.screenshot({ path: join(out, 'q4-english.png') })

  console.log('E2E QUOTA OK', { errors })
} finally {
  await app.close()
}
