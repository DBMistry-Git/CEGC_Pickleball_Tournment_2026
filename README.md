# Courtside Brackets

A small tournament manager for the CEGC Pickleball Tournament: doubles and singles events, single and double elimination, round robin and Swiss, automatic knockout qualification, and a court-by-court schedule. It is a static site with no build step and no dependencies.

* **Public page (read-only):** the GitHub Pages site shows the published `state.json`: Bracket, Schedule and Teams, with every control disabled. It re-checks for updates every 30 seconds.
* **Editing:** open the same page with `#edit` on the end of the address. Changes are kept as a draft in your browser. When you are happy, download `state.json`, replace the file in this repo, and push.

## Run it locally

```bash
python -m http.server 8000     # or: npm start
```

* Viewer: <http://localhost:8000/>
* Editor: <http://localhost:8000/#edit>

Opening `index.html` straight from the disk also works for editing, but the browser blocks `fetch`, so it starts from the built-in roster instead of `state.json`. Use the local server.

## Publishing a change

1. Open `/#edit` locally and make your changes (scores, teams, schedule).
2. Press **Download state.json**.
3. Replace `state.json` in this folder with the downloaded file.
4. `git add state.json && git commit -m "Update scores" && git push`.
5. GitHub Pages redeploys in about a minute. Viewers see the update on their next refresh, or within 30 seconds if the page is open.

The status chip in the top bar tells you whether your draft matches the published file. **Discard draft** goes back to `state.json`.

## GitHub Pages

Settings, Pages, Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)`. The site is then at `https://<user>.github.io/<repo>/`.

## How it works

| File | What it is |
| --- | --- |
| `index.html` | Page shell |
| `styles.css` | Styles, light and dark |
| `engine.js` | Pure tournament logic: brackets, Swiss pairing, standings, knockout qualification |
| `app.js` | Views, scheduling, edit and view modes |
| `state.json` | The tournament data the public page shows |
| `tests/engine.test.js` | Engine tests (`npm test`) |

Notes on the logic:

* **Results** are keyed by the two entrants in the match, so changing an earlier result clears stale downstream scores.
* **Single elimination "second chance":** a team that has a first-round bye plays a first-round loser, and the winner moves on.
* **Swiss:** round 1 pairs the top half against the bottom half, later rounds avoid rematches, and an odd field gives one bye per round to a team that has not had one. Ranking is points, then Buchholz, score difference and points for.
* **Automatic knockout:** the top N from round robin or Swiss enter a single-elimination bracket as soon as every match has a score.
* **Court schedule:** doubles are placed first, free courts go to singles whose players are not already playing, a team keeps its court from the previous slot when it can, and no player is double-booked in a slot.

## Privacy

`state.json` contains player names. A public repository and a public Pages site expose them to anyone with the link. Make the repository private, or remove `state.json` from version control, if that matters.

## Tests

```bash
npm test      # node --test, Node 18 or newer
```
