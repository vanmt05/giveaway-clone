# Sorteos (Electron, Windows)

Offline desktop app for group draws, modeled on app-sorteos.com "Listado de Nombres"
(see `docs/app-sorteos-teardown.md` for the evidence behind that analysis).

## Model
- **Event** -> **Groups** -> participants. Each row requires **ID, Nombre, Subgrupo**.
- ID is the person's identity: dedupe, exclusions, bonus tickets, the cross-group rule and verification all match by ID.
- A person can never win (or be an alternate) in more than one group; the group drawn first has priority.
- Per group: winners/alternates, dedupe, prizes, excluded IDs, bonus tickets, subgroup filter, winners per subgroup (quota mode), animation.
- Each draw stores a CSPRNG seed, so it can be recomputed (Verificar). Exports: CSV, Excel, PDF/PNG certificate, fullscreen presentation.

## Commands
```
npm install
npm run dev          # development
npm test             # unit tests (vitest)
npm run typecheck
npm run build:win    # installer in dist/ (unsigned)
node scripts/e2e.mjs <outDir>        # end-to-end run on the built app (after npm run build)
node scripts/e2e-quota.mjs <outDir>
E2E_EXE=dist\win-unpacked\Sorteos.exe node scripts/e2e.mjs <outDir>   # same, on the packaged app
```
Events are stored as JSON in `%APPDATA%/sorteos-desktop/events`.
