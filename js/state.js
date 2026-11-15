// Shared mutable state. Loaded first so nothing can touch it in the TDZ.
// Load order: state -> model -> data -> diagnostics -> ui -> app

const state = {
    // doc: the document, and the only part of this object that is ever saved.
    // Flat lists of records (js/model.js), changed only through change() in
    // js/app.js.
    doc: null,
    // readOnly: true while the open document was written by a newer Flow than
    // this one. Saving it through this build would drop what the newer build
    // added, so nothing may change it.
    readOnly: false,
    // selection: what is selected, a Set of frozen { type, id } entries
    // (selEntry below). View only: never saved, never part of an undo step,
    // and never sent to anyone else in a live room.
    selection: new Set(),
    // camera: where the board is looked at from. View only.
    camera: { x: 60, y: 90, zoom: 0.5 },
    // sizeShown: screen id -> the id of the size drawn on the board. A screen
    // has one drawing per size; which one is on show is how this visitor is
    // looking at it, not a fact about the screen. View only.
    sizeShown: {},
    // linking / marquee: a link or a selection box being dragged. View only.
    linking: null,
    marquee: null,
    // view: 'board' (screens at their real size, where they were put) or
    // 'flow' (every stop a card, laid out from the links). View only.
    view: 'board',
    // lang: the id of the language the drawn interface is shown in, or '' for
    // the one its elements are written in. This is the language of the
    // workflow that is open, not of Flow's own menus and labels, which the
    // navbar's language setting changes. View only.
    lang: '',
    // walk: the two stops whose ways are listed, and which way is marked.
    walk: { from: '', to: '', pick: -1 },
    // play: null, or { at, history } while the workflow is being clicked through.
    play: null,
    // accepting: the key of the finding whose reason is being typed. View only.
    accepting: '',
    acceptedOpen: false,
    // base: the base address tests are run against. test: null, or the run
    // that is open { run, at, once }; once is an address typed for one step,
    // which is used and never saved. View only.
    base: '',
    test: null,
    casesOpen: false,
    // simple: the Simple view is on (js/simple.js). View only.
    simple: false,
    viewBefore: 'board',
    // live: null, or the live room this tab is in (js/live.js). liveServer:
    // whether the page is served by a Flow server at all. Not the document.
    live: null,
    liveServer: false,
    liveSure: false,
    // libPinned: the Add grid is kept open while something is selected.
    // boardInk: the board's background, '' (light), 'dark' or 'blue'. View only.
    libPinned: false,
    libHeld: false,
    // dropOn: the screen or block a tile dragged from the grid is over.
    dropOn: '',
    boardInk: '',
    // cardId: the kept workflow (js/library.js) the open document is, or ''.
    // Not part of the document: where a workflow is kept is not an edit.
    cardId: '',
    libSure: '',
    // seq: goes up by one on every saved change. Anything that caches a view
    // of the document keys on it.
    seq: 0,
    // opSinks: functions called with the list of operations of every saved
    // change, undo and redo included. Nothing listens on the website; a live
    // room (the self-hosted server, a later step) sends them from here.
    opSinks: []
};

// ---- Selection ----
// One frozen object per (type, id), so a Set can hold them and has() works.
const _selEntries = new Map();
function selEntry(type, id) {
    const key = type + ':' + id;
    let e = _selEntries.get(key);
    if (!e) { e = Object.freeze({ type, id }); _selEntries.set(key, e); }
    return e;
}
// -> the one selected entry, or null when nothing or several are selected.
function soleSelected() {
    if (state.selection.size !== 1) return null;
    return state.selection.values().next().value;
}
const inSelection = (id) => {
    for (const e of state.selection) if (e.id === id) return true;
    return false;
};
function setSelection(entries) {
    state.selection = new Set(entries.filter(Boolean));
}

// ---- Saving a file ----
// One way to hand the visitor a file: a blob, an <a download> in the page, and
// the URL let go a minute later. WebKit reads the blob after click() returns,
// so a URL revoked at once saves an empty file.
const SAVE_REVOKE_MS = 60000;
function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), SAVE_REVOKE_MS);
    return url;
}
