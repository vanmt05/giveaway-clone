# app-sorteos.com "Listado de Nombres": teardown


**Method.** I used the built-in browser to run a live test with fake names. Steps:
- Called `Function.toString()` on the live Vue instance methods to read their source.
- Fetched and searched the site's own JS bundles.
- Read the network log.

REA's CDP-based browser tools were not usable because the built-in pane exposes no loopback CDP endpoint. So no REA Evidence IDs exist. The citations below are bundle URL + method name.

**Test run.**
- Title: "Prueba REA".
- Entries: `Test A..F` plus a duplicate `Test A` (7 lines).
- Settings: 2 winners, 1 alternate, countdown animation.
- Result: winners Test F and Test C, alternate Test E.
- Public certificate: `app-sorteos.com/w/O933OL9`. It holds fake data only and is still live. The user can delete it from the success page with the trash icon.

### Flow (observed)
| Step | URL | Evidence |
|---|---|---|
| 1. Input | `/es/apps/sorteados` | Vue 2 app `#rpp-app` from `/js/apps/random-picker-pro.js`. `validate()` requires a title of at least 3 chars and at least 2 lines. `freeLimit: 20000` lines for paste. Import accepts `.txt`/`.csv`, read in 3 MB chunks (`readLargeTextFile`), and quotes are stripped (`/['"]+/g`). |
| 2. Submit | `POST /es/app` | `onContinue()` → `redirectPost("/es/app", {type:"random-name", title, participants})`. This is a full-page form POST. The server echoes the data back as `_sharedData.app.participants`; duplicates are kept. |
| 3. Settings | `/es/app` step 2 | `/js/all.app.compiled.js`, root Vue `#app`. Controls: winners ± (free plan max 50), alternates ± (max 100), "Filtrar Duplicados ⭐", prizes per winner, animation (countdown / spinning names / fortune wheel) with duration (default 10 s), brand color and logo ⭐, advanced filters: "Bonus & Chances Extra" ⭐ and "Excluir Participantes" ⭐. ⭐ means `canApplyFilters()` shows an upgrade modal on the free plan. That gate is client-side. |
| 4. Review | step 2b | Participant list with a shuffle button (`shuffleComments` re-shuffles the displayed list after 1.5 s; this does not affect the result) and a "Comenzar" button. |
| 5. Draw | same page | `initAnimation()` → `pickWinners()` → `selectWinners()`. **Winners are fixed before the animation starts.** The animation only reveals them. |
| 6. Save | `POST /api/save` → 200 | Fired from `selectWinners()` at draw start. Payload includes: type, title, `winners`, `alternates`, `total_participants`, `history`, `metadata.certificate_data` (10 random unique participants, decorative), lang, platform. The full list is **not** sent here. Response record is stored PHP-serialized (`a:2:{i:0;...}`): `id 19391114`, `hash O933OL9`, `long_hash`, `status: finalized`, `jwt`. When signed out, `long_hash` is pushed to `localStorage.gvs_as`. |
| 7. Result | same page | Winners and alternates lists, confetti, "Sortear de nuevo", "Compartir". Replacing a winner (`deleteWinner` / `confirmDelete`) asks for a reason, appends `{user, reason}` to `history`, and calls `/api/giveaways/update-winners`. |
| 8. Share | `/es/sweeps/success/{long_hash}` → public `/w/{hash}` | Public page shows title, type, date, participant count, winners, and alternates. **No list hash, seed, or other verifiable proof.** |

### Draw algorithm (observed, `all.app.compiled.js` `selectWinners` / `shuffle`)
```js
randomList = shuffle(filteredList.slice(0)).slice(0, 5000); // Fisher-Yates, Math.random
winners = randomList.filter(u => first time seeing u.id && u.username !== author);
winners = shuffle(winners);                                 // shuffled a second time
currentWinners    = winners.slice(0, winnersCount);
currentAlternates = winners.slice(winnersCount, winnersCount + alternatesCount);
```
- Each entry is `{id: name, name}`, as shown in the live `vm.comments` for the test run.
- The RNG is `Math.random`, not crypto. Searching the bundles for `crypto.getRandomValues` found 0 hits.
- **Duplicates (corrected):** the code shuffles, keeps the first appearance of each `id`, then **shuffles again** (`winners = shuffle(winners)`). The second shuffle makes every unique `id` equally likely, so repeating a name does **not** raise its odds; it only inflates the participant count. (My first reading, that k copies meant k tickets, was wrong; the clone's unit tests exposed it.) The clone deliberately differs: repeated rows and bonus IDs are extra tickets that raise the odds, and "Eliminar duplicados" resets each ID to one ticket.
- `applyFilters` is obfuscated. These parts are still readable:
  - keyword and mention filters (social only)
  - dedupe by `id`
  - exclude list (lower-cased, `@` stripped)
  - bonus entries (`filteredList = filtered.concat(manual_entries)`; each bonus is `{id:name, bonus:true}`)
- Animation libraries: Winwheel.js + TweenMax (wheel, which stops on the pre-picked winner's segment via `getRandomForSegment`), Howler / `new Audio` (`/media/tick.mp3`, `/media/wd-sound-fx-end.mp3`), confetti, anime.js counter.
- Backend: inferred PHP / CakePHP from PHP serialization, `AppController` comments, and `templates/element/*.php` paths.

### Inferences and unknowns
- **Inference:** the result is decided by client JS, and the server stores whatever winners the client sends. I did not observe any server-side re-draw. Whether the server validates winners against the list remains **unknown**.
- **Unknown:** the exact easing of the spinner and wheel (obfuscated). It is not needed for the clone.

---
