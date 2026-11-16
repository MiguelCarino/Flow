# Scope

What Flow is, what was decided, and the order it is built in.

## Goal

A register of a user interface's workflow that you draw. Put down the
screens, the decisions between them and what takes the user from one to the
next. Flow checks the workflow as you go and, later, turns it into a hand-off
report and a set of test cases.

The workflow is the product. Screens are the stops on it; drawing their
detail is optional.

Flow is built on the same core and principles as Topo: static files, one
document, every change through one funnel, checks while drawing, a published
format, and nothing leaving the page.

## Decisions

| | Decision |
|---|---|
| D1 | The core is copied from Topo, not shared with it. Topo is untouched. |
| D2 | A fixed kit of typed elements drawn in plain SVG. Mid-fidelity. No free drawing. |
| D3 | Elements sit at fixed positions on an 8 px grid, each pinned to an edge, both edges, the centre or its share of the screen. Full auto-layout later. |
| D4 | No embedded images. An image is a box with a description. |
| D5 | A performance budget of 60 screens and 3,000 elements, held by a test. |
| D6 | The name is Flow, at flow.carino.systems. |
| D7 | A screen is the logical stop; its sizes are drawings of it. Links belong to the screen, so the workflow is drawn once for every size. |
| D8 | A screen can be empty: a name is enough to map a workflow. |
| D9 | A link carries the decision: what triggers it, the condition and its kind. A decision point is a record of its own. |
| D10 | Sources: the document saves where the vector file, the code and the live board are kept. Flow only links to them. http(s) only, opened with no referrer, never fetched. |
| D11 | The document is flat lists of records with ids, and drawing order is a field, so two people can change it at once later. |
| D12 | Undo steps are operations (forward and inverse), not copies of the document. This differs from Topo. In a live room it undoes only your own change. |
| D13 | View state (camera, selection, which size is shown) and findings are never in the document. |
| D14 | Real-time collaboration is not on the website. A self-hosted server (step 7) serves the same static app and adds live rooms. |
| D16 | Another size of a screen starts as a copy of the size on show. The copies keep their names, which is how the same control is recognised across sizes. |
| D17 | A size's width and height change when the field is left, not on each key, so its elements are re-placed once from the size it really had. |
| D18 | A block is drawn once on the board and placed on screens. A placing is an element that points at the block; the block's elements are drawn inside it by their pins, not copied, so a change to the block shows everywhere. A block cannot be placed inside a block. |
| D19 | A style is a named colour or text size. An element points at up to three: fill, text colour and text style. Removing a style returns its elements to the usual look. |
| D20 | The drawn interface has languages of its own. An element's text is in the document's language; an element with a dictionary key takes its text in another language from that language's dictionary. Dictionaries load and save as the JSON files an app already has (es.json), flat or nested. |
| D21 | The language the workflow is shown in is a way of looking: it is not stored and is not a change. It is separate from Flow's own language, which the navbar sets (step 7). Neither changes the other. |
| D22 | Loading the dictionary of the workflow's own language gives each element whose text it contains that text's key, so an existing dictionary names the elements. |
| D23 | Where a card sits in the flow view is worked out from the links each time and never stored. Cards cannot be dragged. |
| D24 | A finding is accepted with a reason, which is required. An accepted finding is counted nowhere and stays listed with its reason. If the finding goes away and comes back, it is still accepted. |
| D25 | What is said about a finding (accepted, pinned) is a record in the document, named by the check and the record it is about. It goes when that record is removed. |
| D26 | Contrast is checked only where a style sets the colour. The kit's own colours pass and are not the designer's choice. |
| D27 | A new element starts big enough to press on a touch screen (44 px), so adding one is not a finding. |
| D28 | There is no "two primary actions" check: an element has no way yet to say it is the primary one. |
| D29 | A part of a workflow keeps the far end of a link that leaves it as a stub, so the reader sees the workflow goes on. Merging back matches by id, ignores stubs, and removes from the part's own screens what was removed in the part. |
| D30 | Pictures are the board's own SVG drawn again with nothing of the editor in it. A PNG carries the fonts as data, read from this site. Nothing is sent anywhere to be converted. |
| D31 | A zip is written here, stored and not compressed, so no library is needed. |
| D32 | A share link is sealed: AES-GCM with a key from the sender's passphrase (PBKDF2), in the link's fragment. The fragment is taken out of the address bar as soon as the page sees it. There are no unsealed links. |
| D33 | A workflow is kept in the browser only when its owner says so; then every change is written to its card. Opening another workflow while a kept one is open starts fresh, since the kept one is safe. |
| D34 | The report is one HTML file with no script and nothing loaded, opened in a tab to print. PDF is the browser's print. |
| D35 | A test case is worked out from the workflow (a way from a start to an end) and never stored. A run and its steps are stored. |
| D36 | A step writes down the screen's name and what led to it when the run starts, so a run still reads after the workflow has changed or the screen is gone. |
| D37 | Flow never opens a live address itself. It is a link the tester clicks, opened in another tab with no referrer; the real page is not embedded. |
| D38 | An address typed for one step of a run is used and never saved. |
| D39 | A step is a screen. A decision on the way is part of what leads to the next screen: its question and the answer taken. |
| D40 | The Simple view is another way of looking at the same document: it reads, opens and plays, and changes nothing. Going to the full editor and back loses nothing. The address says which view it is (`?simple`). |
| D41 | A phone with something to read opens in the Simple view. `?full` opens the editor there. |
| D42 | Flow's own words are looked up by their English, so a word with no translation is correct English. Every language must be whole: a test drives the editor through its states in each one and fails on any word asked for that has no translation. |
| D45 | The panels the scripts draw are built in English and their own words swapped afterwards (labels, headings, notes, buttons, hints). A sentence with one of the workflow's names in it is put together where it is made. The workflow's names and texts are never looked up. |
| D46 | Findings and the report are written in Flow's language, with the workflow's names left as they are. |
| D43 | Flow's language comes from `?lang=`, then the fleet's choice (the navbar's Language tab), then the browser. It never touches the workflow's language, and the workflow's never touches it. |
| D44 | In the flow view on a screen taller than it is wide, the workflow runs down the page. |
| D47 | The server is standard-library Go and keeps a room as a folder of files, not a database: a room is small, and a folder is backed up by copying it. |
| D48 | A room is reached by its link: the room, the key (in the fragment, never sent) and a token for what the link may do. The server stores only hashes of tokens. There are no accounts yet. |
| D49 | Every browser applies changes in the server's order, its own included. A browser shows its own change at once and, when it comes back after someone else's, applies it again. No CRDT library. |
| D50 | A change that arrives from someone else is not an undo step here. Undo sends the reverse of your own change. |
| D51 | Presence (pointers, selections, names) is sealed, relayed and never kept. |
| D52 | Opening another workflow while in a room leaves the room; it is never a change to the room's workflow. |
| D53 | The page asks its own host once whether it is a Flow server. The Live menu appears only then. |
| D54 | The elements to add are a grid of tiles, each a small drawing of the element made by the code that draws it on a screen, as in Topo's library. The grid folds to one row while an element, a link, a decision or several things are selected, so what is selected has the rail; with a screen or a block selected it stays open, since that is when it is used. A click on the row keeps it open. |
| D55 | The board's background is light, dark, blueprint or circuit green (the blueprint's ruled paper in green). Only the board changes: a screen stays on white paper with everything on it drawn as it is, since it is a picture of the interface. What is written on the board around the screens (names, links, decisions) takes a light ink. A picture or a report is always on paper. The choice is kept in the browser, not in the workflow. |
| D56 | A tile can be dragged from the grid onto a screen or a block, with nothing selected: the element lands where it is dropped, on the grid, kept inside. A click on a tile still adds to what is selected. After either, the grid is held open until something else is chosen, so the next element can follow. |
| D57 | A selected link, and the links of a marked way, are drawn in gold on every background, as a selected link is in Topo. A link that is not selected takes the ink of the background it is on. |
| D58 | Whatever is selected (a screen, an element, a decision, a link, or several things) carries a small red ✕ beside it that deletes it, as in Topo. It is not drawn on a workflow that cannot be changed. Delete is an ordinary change, so Undo brings it back. |
| D59 | The page opens on a start page laid out as Topo's: the mark centred with one piece of motion under it, the claim, a short lede, one target to start a new workflow (also where a file is dropped), the example as a chip, and the workflows kept in this browser. The editor is at `#editor`; File, All workflows goes back. A share link, a room link and the Simple view skip it. |
| D60 | The example is a shop from both sides: the customer's way from signing in to the receipt, its main screens drawn for a phone and a desktop, and the staff's back office, which is desktop windows only. Eleven screens, four decisions, two ends. It has no findings. The tests keep their own three-screen fixture. |
| D61 | A link can also be plain, as in Topo: the workflow, deflated, after the `#` (`#~…`), and the address alone builds it again. The Share dialog locks by default; plain is one tick away and says that whoever gets the link has the workflow. A plain link is taken out of the address as soon as the page sees it, and opening it is an ordinary change. |
| D62 | The drop zone is an element of the kit: a dashed box that says what to drop. It is a control, so it is checked for size, text and a name like the others. |
| D63 | Every finding has a class, finer than its heading: unchanged since it was added, decisions that lead nowhere, dead ends, and so on (`CHECK_CLASSES`). The Findings list is sorted into them, each with its count, and a class can be folded shut. Pinned findings come first under a heading of their own. |
| D64 | Two more checks: a screen that still has the name it was given and nothing drawn on it, and a decision whose branches all lead to the same place. A decision with no branch at all is classed as leading nowhere; with one, as not finished. |
| D65 | The element last added from the grid can be added again with one press, or the A key: on the same screen, under what is there. It is on offer while the grid is folded. |
| D66 | The kept workflows are cards on the start page, not a dialog: a press opens one, and each can be saved as a file or deleted (asked twice). With none kept, the target says so and offers to make the first: a name and a button, and it is kept and opened. With some, the list goes above the target and the pitch shrinks to the claim. The workflow that is open and not kept is the first card, with Keep beside it; there is no Continue button. |
| D72 | A kept workflow's card has the tools Topo's has: rename (the name is typed on the card; Enter keeps it, Esc does not), duplicate (a second card under the next free name, its records keeping their ids), merge into another workflow, save as a file, and delete (asked twice). Merge takes what both workflows share by id, the one merged in winning, and adds what only it has below everything the other has drawn, so two different workflows end up one under the other; the target keeps its name and the source card stays. Into the workflow that is open it is an ordinary change, one undo step; into one that is not, its card is rewritten. |
| D71 | A binder is every kept workflow in one file (`.flowbinder.json`), made with Back up all. Opening or dropping one adds its workflows to the ones kept here; one that is here already, the same to the letter, is not added twice, and the workflow that is open is left alone. |
| D67 | The report comes in the fleet's document designs (Branding `documents/`): letter pages with the mark and wordmark at the head, the kicker, the title, a row of cards, numbered sections, ruled tables and a numbered foot, in white, black and blue. Plain, the report with no design, stays as a fourth choice. |
| D68 | A design is fixed pages, so Flow lays the report out itself: it is cut into pieces that are never split, each is measured as it will be drawn, and they are packed into pages; a heading goes over the page with what follows it. Screens and the map are pictures written into the page. |
| D69 | A report is looked at before it is saved, in the fleet's report preview: the design, the sources, the PDF or HTML switch, the file's name, Print and Download. The file is made by the fleet's report engine (`carino-pdf.js`): the PDF is pictures of the pages, so its text cannot be searched (Print, Save as PDF gives text); the HTML is one file with its fonts and pictures written in. html2canvas is loaded only when a PDF is made. |
| D70 | The start page carries the fleet's short hero. It does not repeat that Flow runs in the tab with no upload: About says so, in its disclaimer. |
| D15 | New, Open and the example are ordinary changes, so Undo brings back what was open and nothing asks "are you sure?". |

## Build order

1. **Done.** Repo, fleet files, the core (document, operations, undo), the
   board (screens, sizes, decisions, links, five elements), sources, the
   first checks, the file format and its schema, the test harness.
2. **Done.** Edge pinning (a size changed from the rail re-places its
   elements; a new size starts as a pinned copy of the one on show),
   multi-select with a selection box, line up and space evenly, duplicate,
   the full kit of 25 elements (26 since the drop zone), six screen templates, blocks, styles, and
   the performance budget held by `tests/suites/perf.js`.
3. **Done.** The flow view (every screen a card, laid out from the links
   and never stored), Walk (every way from one stop to another, marked on
   the board) and Play (the workflow clicked through from the start). Also
   the languages of the drawn interface: dictionary keys on elements,
   dictionaries loaded and saved as JSON, and a switch that shows the whole
   workflow in one language.
4. **Done.** The checks on elements: size (targets under 24 px, under 44 px
   on a touch screen, closer than 8 px), text (under 12 px, or 24 px seen
   from across a room; not fitting its box, in any language; still saying
   what it said when added; contrast), layout (overlapping controls, an edge
   1 to 3 px off), names (a field with no label, an image with no
   description, a control with no text and no name) and styles (a text size
   used once). Findings are listed under headings and can be accepted with a
   reason or pinned.
5. **Done.** Export of the whole workflow, the selected stops, one marked
   way or one screen: as a document (a part merges back by id), as pictures
   (SVG or PNG; several screens in a zip), as a storyboard of a way, as a
   report (one HTML file), as a copy sheet (CSV, brought back in), and as a
   sealed share link. Your workflows: kept in the browser, saving themselves.
6. **Done.** Testing against the real thing: base addresses (staging and so
   on) that each screen's path hangs off, test cases worked out as every way
   from a start to an end, runs where each real screen is opened in another
   tab and marked as drawn or not, an address typed for one step only, a
   finding for a screen that failed its last test, and the cases and runs
   in the report and as a sheet.
7. **Done.** The Simple view (the workflow as cards, a tap opens a screen,
   Play walks through it, nothing can be changed). Flow's own language in
   five languages, for all of it: the Simple view, Play, the editor's
   panels, the findings, the report, the dialogs and the How-to. Phones:
   pinch to zoom, the flow running down a tall screen, the Simple view as
   the way in.
8. **Done, without accounts.** The self-hosted server (`server/`,
   [SERVER.md](SERVER.md)): live rooms reached by link, encrypted end to
   end, changes ordered by the server, presence, and owner, editor and
   viewer links. Not built: sign-in and accounts, so a room is reached by
   its link alone.

## Collaboration, as built

`flow-server` serves these same files and adds rooms. Each change is a list
of operations (`state.opSinks` receives every one); `js/live.js` seals and
sends them, the server orders and relays them, and every browser applies
them in that order. See [SERVER.md](SERVER.md).
