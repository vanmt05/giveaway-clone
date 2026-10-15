// End-to-end smoke test: drives the real Electron app via playwright-core.
// Usage: npm run build && node scripts/e2e.mjs <outDir>
import { _electron as electron } from 'playwright-core'
import { mkdtempSync, existsSync, statSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const out = resolve(process.argv[2] ?? join(tmpdir(), 'sorteos-e2e'))
mkdirSync(out, { recursive: true })
const userData = mkdtempSync(join(tmpdir(), 'sorteos-ud-'))

const people = (prefix, n, subs) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i + 1).padStart(3, '0')}\tPersona ${prefix}${i + 1}\t${subs[i % subs.length]}`)

// IDs S001..S006 are shared by the three groups on purpose (cross-group rule)
const shared = (n) => Array.from({ length: n }, (_, i) => `S${String(i + 1).padStart(3, '0')}\tCompartido ${i + 1}\tTI`)
const g1 = ['ID\tNombre\tSubgrupo', ...shared(6), ...people('A', 8, ['TI', 'Ventas']), 'A999\tSin Subgrupo\t'].join('\n')
const g2 = ['ID\tNombre\tSubgrupo', ...shared(6), ...people('B', 8, ['Ventas', 'Legal'])].join('\n')
const g3 = ['ID\tNombre\tSubgrupo', ...shared(6), ...people('C', 8, ['TI', 'Legal'])].join('\n')

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
  await page.setViewportSize({ width: 1280, height: 820 }).catch(() => {})
  const shot = (n) => page.screenshot({ path: join(out, `${n}.png`) })

  // stub native save dialog
  const saved = {}
  await app.evaluate(({ dialog }, dir) => {
    dialog.showSaveDialog = async (_w, o) => ({ canceled: false, filePath: `${dir}\\${o.defaultPath}` })
  }, out)

  // 1. create event
  await page.getByRole('textbox', { name: 'Nombre del evento' }).fill('Evento E2E')
  await page.getByRole('button', { name: 'Crear evento' }).click()

  const loadPaste = async (text, mode = 'Reemplazar lista') => {
    await page.locator('#paste').fill(text)
    await page.getByRole('button', { name: `Cargar lo pegado — ${mode}` }).click()
    await page.getByRole('dialog', { name: 'Asignar columnas' }).getByRole('button', { name: 'Importar' }).click()
  }

  // 2. group 1 (has one rejected row)
  await loadPaste(g1)
  await page.getByRole('heading', { name: /Filas rechazadas/ }).waitFor()
  assert.ok(await page.getByText('falta Subgrupo').isVisible(), 'rejected reason shown')
  assert.ok(await page.getByRole('button', { name: /Revisar y sortear/ }).isDisabled(), 'draw blocked while errors')
  await shot('01-group1-errors')
  // fix inline
  await page.getByLabel('Fila 15 subgroup').fill('Ventas').catch(async () => {
    // row number differs: take first subgroup input in the errors table
    await page.locator('table.t input').nth(2).fill('Ventas')
  })
  await page.getByRole('button', { name: 'Corregir' }).click()
  await page.getByRole('heading', { name: /Filas rechazadas/ }).waitFor({ state: 'detached' })
  assert.ok(await page.getByRole('button', { name: /Revisar y sortear/ }).isEnabled(), 'draw enabled after fix')

  // 3. groups 2 and 3
  for (const [name, text] of [['Grupo B', g2], ['Grupo C', g3]]) {
    await page.getByRole('button', { name: /Nuevo grupo/ }).click()
    await page.getByLabel('Nombre del grupo').fill(name)
    await loadPaste(text)
  }
  await shot('02-three-groups')

  // 4. event defaults: 2 winners + 1 alternate, spinner animation
  await page.getByText('⚙ Ajustes por defecto del evento').click()
  await page.getByLabel('Ganadores', { exact: true }).fill('2')
  await page.getByLabel('Suplentes', { exact: true }).fill('1')
  await page.getByRole('button', { name: 'Nombres giratorios' }).click()
  await page.getByLabel('Ganadores', { exact: true }).blur()
  await shot('03-defaults-overlap')
  assert.ok(await page.getByText('IDs repetidos entre grupos').isVisible())

  // 5. draw group 1 with its animation (spinner, 4s)
  await page.getByText('1. Grupo 1').click()
  await page.getByRole('button', { name: /Revisar y sortear/ }).click()
  await page.getByRole('button', { name: 'Comenzar sorteo' }).click()
  await page.getByText('Ganadores').first().waitFor({ timeout: 40_000 })
  await shot('04-group1-result')
  const g1Text = await page.locator('.winner-card').allInnerTexts()
  assert.equal(g1Text.length, 3, 'group 1: 2 winners + 1 alternate')

  // 6. draw all pending
  await page.getByRole('button', { name: 'Volver al evento' }).click()
  await page.getByRole('button', { name: /Sortear todos/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Solo los pendientes' }).click()
  await page.getByText('Resumen de ganadores').waitFor()
  await shot('05-summary')

  const cardText = await page.locator('.cards .card').allInnerTexts()
  assert.equal(cardText.length, 3)
  const ids = [...cardText.join('\n').matchAll(/\(([A-Z]\d{3}) ·/g)].map((m) => m[1])
  assert.equal(ids.length, 9, `9 people drawn, got ${ids.length}`)
  assert.equal(new Set(ids).size, ids.length, `no repeated person across groups: ${ids}`)

  // 7. exports
  for (const [btn, file] of [['CSV', 'Evento E2E.csv'], ['Excel', 'Evento E2E.xlsx'], ['Certificado PDF', 'Evento E2E.pdf'], ['Certificado PNG', 'Evento E2E.png']]) {
    await page.getByRole('button', { name: btn, exact: true }).click()
    await page.getByText(/Guardado en/).waitFor()
    const p = join(out, file)
    for (let i = 0; i < 40 && !(existsSync(p) && statSync(p).size > 100); i++) await page.waitForTimeout(250)
    assert.ok(existsSync(p) && statSync(p).size > 100, `${file} written; message: ${await page.locator('.banner.ok').innerText()}`)
    await page.waitForTimeout(300)
  }
  const csv = readFileSync(join(out, 'Evento E2E.csv'), 'utf8')
  assert.ok(csv.includes('grupo,subgrupo,posición,id,nombre,rol,premio'))
  assert.equal(csv.trim().split(/\r?\n/).length, 1 + 9)

  // 8. verify view
  await page.getByRole('button', { name: 'Volver', exact: true }).first().click()
  await page.getByRole('button', { name: 'Verificar' }).click()
  await page.getByText('Verificar sorteos').waitFor()
  assert.equal(await page.getByText('✓ Verificado').count(), 3)
  await shot('06-verify')

  // 9. present window
  await page.getByRole('button', { name: 'Volver', exact: true }).first().click()
  await page.getByRole('button', { name: 'Resumen' }).click()
  const [present] = await Promise.all([app.waitForEvent('window'), page.getByRole('button', { name: /Presentar/ }).click()])
  await present.getByText('Presentación').waitFor()
  await present.keyboard.press('ArrowRight')
  await present.getByRole('heading', { name: 'Grupo 1' }).waitFor()
  await present.screenshot({ path: join(out, '07-present.png') })

  console.log('E2E OK', { people: ids, errors })
} finally {
  await app.close()
}
if (errors.length) console.log('console/page errors:', errors)
