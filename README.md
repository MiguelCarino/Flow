# Flow

Draw the workflow of a user interface: its screens at any size, the decisions
between them, and what takes the user from one to the next. Flow checks the
workflow as you draw.

It runs in the browser. Nothing you add is uploaded.

**Status: all eight steps are built.** The core, the board, the full kit, blocks, styles,
the flow view, Walk, Play, languages, the checks and the file format are
here. See [docs/SCOPE.md](docs/SCOPE.md) for what comes next.

## What it does today

- **Screens of any size.** A screen can be drawn at several sizes (phone,
  laptop, TV, anything typed in). Its links belong to the screen, so the
  workflow is drawn once.
- **Links that say why.** A link records what the user does and under which
  condition. It can start at one element, such as a button.
- **Decisions.** A question the system answers, with one branch per answer.
- **A board in light, dark, blueprint or circuit green,** with the screens
  always on white paper, and a grid of element tiles you drag onto a
  screen. The grid folds away while an element is selected.
- **Twenty-five elements,** from text and buttons to lists, tables, tab bars
  and alerts, and six screen templates to start from.
- **Pinning.** Each element holds on to an edge, both edges, the centre or
  its share of the screen. Change a size, or add another size of a screen,
  and the layout follows.
- **Blocks.** Draw a group of elements once and place it on many screens.
  Change the block and every placing follows.
- **Styles.** Named colours and text sizes that elements point at. Change
  the style and every element that uses it follows.
- **Flow view.** Every screen as a card, laid out from the links.
- **Walk.** Every way from one stop to another, marked on the board.
- **Play.** Click through the workflow from the start.
- **Languages.** Give elements a dictionary key, load the interface's
  dictionaries (`es.json`, flat or nested) and show the whole workflow in
  any of them. This is the language of the workflow you are drawing; the
  language of Flow itself is set apart from it.
- **Several at once.** Shift-click or drag a box, then move, line up, space
  evenly, duplicate or delete together.
- **Sources.** Save the address of the vector file, the code or the live
  board, and point screens, elements and links at it. Flow only links to
  them; it never opens them itself.
- **Checks while you draw.** The workflow: no start, a screen nothing leads
  to, a dead end, a decision with one branch. The screens: a target too
  small to press, text that does not fit (in any language), poor contrast,
  a field with no label, controls that overlap. A finding can be accepted
  with a reason, or pinned to come back to.
- **Undo for everything**, including New and Open.
- **Files.** Save a copy as `.flow.json` and open it again. The format is
  published: [docs/FORMAT.md](docs/FORMAT.md).
- **Export.** The whole workflow, the selected screens, one way or one
  screen: as a document that merges back, pictures, a storyboard, a report,
  a copy sheet, or a sealed link that only its passphrase opens.
- **Testing.** Give the workflow a live address (staging, say) and each
  screen its path. Flow lists every way from the start to an end as a test
  case; run one, open each real screen in another tab, and say whether it
  is as drawn. A screen that failed its last test is a finding.
- **Simple view.** For whoever reads the workflow: every screen a card, a
  tap opens it, Play walks through it, nothing can be changed. A phone
  opens in it.
- **Five languages for Flow itself** (English, Spanish, Portuguese,
  Japanese, Russian), set from the navbar and kept apart from the language
  of the workflow. Everything is translated, the findings and the report
  included.
- **Live rooms, on your own server.** Several people change one workflow
  at once and see where the others point. Encrypted in the browsers; the
  server only orders and relays. See [docs/SERVER.md](docs/SERVER.md).
- **Your workflows.** Kept in the browser, saving themselves on every change.

## What it is not

- Not a vector illustrator and not a code generator. It points at where those
  are kept (Sources).
- Not real-time collaboration on the website. The self-hosted server in
  `server/` adds it: see [docs/SERVER.md](docs/SERVER.md).

## Development

Static files. No build step, no framework, nothing loaded from another host.

```bash
python3 -m http.server 8742
```

Scripts load in this order: `state -> i18n -> model -> data -> diagnostics -> ui -> lang -> flowview -> play -> simple -> test -> export -> share -> library -> live -> app`.

| File | What it holds |
|---|---|
| `js/state.js` | What the page holds while it runs. Only `state.doc` is saved. |
| `js/i18n.js` | Flow's own language: the lookup, and the words a client sees. |
| `js/words-*.js` | The rest of Flow's words, a file per language. |
| `js/model.js` | The document, its fields and the operations that change it. No DOM. |
| `js/data.js` | The kit: size presets, the elements, the example, and the tests' small fixture. |
| `js/diagnostics.js` | The checks. |
| `js/ui.js` | Drawing the board and the rail. |
| `js/lang.js` | The workflow's languages and dictionaries. |
| `js/flowview.js` | The flow view and Walk. |
| `js/play.js` | Play. |
| `js/simple.js` | The Simple view. |
| `js/test.js` | Test cases and runs against live addresses. |
| `js/export.js` | Parts and merging, pictures, zip, copy sheet, report. |
| `js/share.js` | Sealed share links. |
| `js/library.js` | Your workflows, kept in the browser. |
| `js/live.js` | Live rooms, when served by `server/`. |
| `server/` | The Flow server (Go): static files and live rooms. |
| `js/app.js` | Editing, undo, files, the pointer and the keyboard. |

Every change to a document is a list of operations that goes through
`change()` in `js/app.js`. Undo steps keep operations, not copies of the
document.

## Tests

```bash
./tests/run.sh
```

See [tests/README.md](tests/README.md).

## Licence

AGPL-3.0-or-later. The fonts keep their own licence (`fonts/OFL.txt`).
