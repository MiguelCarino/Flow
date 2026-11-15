# Tests

    ./tests/run.sh              # every suite
    ./tests/run.sh model undo   # named suites

Needs Chromium or Chrome (found on PATH or in /Applications; override with
`CHROME=...`). No npm, no build step: the app is static files and the tests
run it as the browser would.

## How it works

`run.sh` injects one suite into a copy of `index.html`, with
`tests/harness.js` ahead of everything else, renders it in a headless browser
and reads the results back out of the dumped DOM. A suite reports
`PASS :: name` / `FAIL :: name` lines. Any FAIL, or a suite that reports
nothing, exits non-zero.

The copy is written to the repo root as `.testrun.html`, because `index.html`
pulls `css/` and `js/` by relative path.

## Real-clock suites

A suite whose first line says `@realtime` waits on Web Crypto or IndexedDB.
Those run off the main thread, so under the virtual clock the page looks
idle and is dumped before they finish. `run.sh` runs them on the real clock
for a fixed time instead.

## Writing a suite

```js
suite(async (ok, eq) => {
    loadExample();
    eq('three screens', state.doc.screens.length, 3);
    ok('something is true', canUndo());
});
```

Each suite starts on an empty document with no history, in English, in the
full editor. `eq` compares as
JSON. `pointer(type, target, at)` and `drag(from, to)` send pointer events to
the board as a browser would; both take `{ shift: true }` or `{ ctrl: true }`.

## The server

    cd server && go test -race ./...

Live rooms end to end need the server running: start it (see
`docs/SERVER.md`) and open `/tests/live-e2e.html` from it. Three copies of
the app join one room; the page prints PASS and FAIL lines.

## Suites

| Suite | What it holds |
|---|---|
| `model` | ids, field rules, repairing a document, the same bytes for the same content |
| `ops` | every operation returns its undo; removing takes dependents first |
| `undo` | one step per action, per batch and per field typed in; the limit |
| `checks` | the workflow's checks: each finding appears for its cause and goes when fixed |
| `checks2` | the checks on elements: size, text, layout, names, styles |
| `accept` | accepting a finding with a reason, pinning, and what happens after |
| `sources` | only http(s) addresses are kept; links open apart with no referrer |
| `file` | the envelope, what is refused, a newer document opens read-only |
| `formatschema` | the published schema names every field and no other |
| `privacy` | the content policy is never broken; nothing loads from another host |
| `board` | what is drawn; selecting, moving, resizing, linking, keys |
| `palette` | the grid of element tiles, dragging one onto a screen, its fold, and the board's backgrounds |
| `kit` | every element type draws; the templates fit every size |
| `pinning` | what an element holds on to when its screen changes size |
| `multi` | picking several; moving, lining up, copying and removing together |
| `blocks` | making, placing, editing and removing blocks; placings follow the block |
| `styles` | colours and text styles; elements follow the style they point at |
| `lang` | dictionaries, keys, and showing the whole workflow in a language |
| `flowview` | cards laid out from the links; nothing stored, nothing dragged |
| `walk` | every way between two stops; marking one on the board |
| `play` | clicking through the workflow; it changes nothing |
| `export` | parts that merge back, pictures, storyboard, zip, copy sheet, report |
| `share` | sealed and plain links: making, opening, arriving by one (real clock) |
| `library` | keeping workflows in the browser; they save themselves; the cards on the start page; the binder, out and back in (real clock) |
| `testing` | live addresses, test cases, runs with pass and fail |
| `i18n` | Flow's five languages; apart from the workflow's; whole for a client |
| `i18ncover` | every state of the editor in every language: no word without a translation (real clock) |
| `simple` | the Simple view changes nothing; a tap opens a screen; pinch to zoom |
| `perf` | the budget: 60 screens and 3,000 elements stay usable |
| `classes` | what kind of finding each is; the drop zone; Add again; a first workflow from the start page (real clock) |
| `report` | the report in the fleet's designs: packing into pages, the three themes, the preview, the PDF and the HTML file (real clock) |
| `landing` | the landing page and when it is skipped; the example; the ✕ that deletes; link colours |
