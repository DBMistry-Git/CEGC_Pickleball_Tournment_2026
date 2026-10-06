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

## One-click publish (optional)

In editor mode, **Publish to site** writes `state.json` straight to this repo with the GitHub API, so no download or upload is needed.

1. GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.
2. Limit it to this one repository, set **Contents** to **Read and write**, and use a short expiry.
3. Open the page with `#edit`, press **Set token** and paste it. It is kept only in that browser.
4. Press **Publish to site**. GitHub Pages updates in about a minute.

Delete the token on GitHub when the event is over.

## Single-elimination styles

- **Fewest byes (default):** every round pairs as many teams as possible, so only an odd count gives a bye. That is at most one per round, drawn at random, and a team is not given two. 13 teams need 2 byes (classic: 3), 18 need 3 (classic: 14). A bye late in the bracket is worth more than one in round 1.
- **Second chance:** a team without a round-1 game plays a round-1 loser.
- **Classic:** pads to a power of two; byes go to the top seeds.

## Double elimination

- **Fewest byes (default):** the winners bracket uses the fewest-byes layout, and the losers bracket is built round by round so that only an odd count gives a bye. 13 teams have 3 bye games (classic: 6); 18 have 6 (classic: 28). Everyone is out after exactly two losses.
- **Classic:** pads to a power of two, so small fields get many byes.

## Doubles first, then rolling singles

The intended flow for the day:

1. **Doubles tab:** build the teams, pick Single elimination (fewest byes) and press Start tournament.
2. **Singles tab:** leave the format on Rolling single elimination and press Open singles. Anyone who is not on a doubles team is free straight away, so they can start playing on spare courts.
3. As soon as a doubles team loses, its players appear under **Free players** (Singles tab) and under **Free for singles** (Schedule tab). Press Add on one player or Add all. Each new player is paired with the next free player at once, winners meet winners, and new matches appear for the scheduler. Doubles partners are not paired with each other while another opponent is waiting.
4. Tick the box to add knocked-out players automatically if you would rather not press anything. Press the x on a chip for anyone who is not playing singles.
5. When nobody else will join, press **Close entries**. The bracket finishes itself. A player waiting without an opponent goes straight into a later round, which is the fewest byes possible (the same count as the fewest-byes bracket). Reopen entries works until a closing-stage match has been played.

Editing on the go: adding players, adding teams, naming courts or marking someone as not playing singles never touches a running bracket. Anything that would restart a bracket that already has results (removing a team in the bracket, clearing players, changing team size) asks first.

### Scheduler

Doubles matches are placed first, then singles on whatever courts are left, and nobody is booked twice in a slot. Because singles matches appear during the event, **Fill open courts** puts newly ready matches into empty courts of slots that are not finished, and **Schedule next slot** adds a new row. A player who just played gets a rest slot when the courts allow it.

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
