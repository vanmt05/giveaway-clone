// E2E #3: fullscreen button toggles the real window and the label follows the state.
import { _electron as electron } from 'playwright-core'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const userData = mkdtempSync(join(tmpdir(), 'sorteos-ud-'))
const app = await electron.launch(
  process.env.E2E_EXE
    ? { executablePath: process.env.E2E_EXE, args: [`--user-data-dir=${userData}`] }
    : { args: ['.', `--user-data-dir=${userData}`], cwd: resolve('.') }
)
const isFs = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())
const waitFs = async (want) => {
  for (let i = 0; i < 40; i++) {
    if ((await isFs()) === want) return
    await new Promise((r) => setTimeout(r, 150))
  }
  assert.fail(`window fullscreen never became ${want}`)
}
try {
  const page = await app.firstWindow()
  const btn = page.getByRole('button', { name: 'Pantalla completa' })
  await btn.waitFor()
  assert.equal(await isFs(), false)
  await btn.click()
  await waitFs(true)
  await page.getByRole('button', { name: 'Salir de pantalla completa' }).waitFor()
  await page.getByRole('button', { name: 'Salir de pantalla completa' }).click()
  await waitFs(false)
  await page.getByRole('button', { name: 'Pantalla completa' }).waitFor()

  // present window has the button too and starts fullscreen
  await page.getByRole('textbox', { name: 'Nombre del evento' }).fill('FS')
  await page.getByRole('button', { name: 'Crear evento' }).click()
  await page.locator('#paste').fill('ID\tNombre\tSubgrupo\n1\tAna\tTI\n2\tLuis\tTI')
  await page.getByRole('button', { name: 'Cargar lo pegado — Reemplazar lista' }).click()
  await page.getByRole('dialog', { name: 'Asignar columnas' }).getByRole('button', { name: 'Importar' }).click()
  await page.getByRole('button', { name: /Sortear todos/ }).click()
  await page.getByText('Resumen de ganadores').waitFor()
  const [present] = await Promise.all([app.waitForEvent('window'), page.getByRole('button', { name: /Presentar/ }).click()])
  await present.getByRole('button', { name: 'Salir de pantalla completa' }).waitFor()
  console.log('E2E FULLSCREEN OK')
} finally {
  await app.close()
}
