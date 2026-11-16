// Changing the document, undo, keeping it, and the pointer and keyboard.

// ---- The one way a document changes ----
// change(op) is the funnel: every edit, from a field, a drag, a file opened
// or an undo, is a list of operations (js/model.js applyOp) that goes through
// here. A step is what one undo takes back: one operation, or everything
// done inside one batch(). Each step keeps its operations and the ones that
// reverse them, not a copy of the document, so in a live room an undo takes
// back this person's change and leaves everyone else's alone.
const UNDO_LIMIT = 200;
const _undo = [], _redo = [];
let _batchDepth = 0, _stepOps = [], _stepInv = [], _typingKey = '';

function change(op) {
    if (state.readOnly) return false;
    const inv = applyOp(state.doc, op);
    if (!inv) return false;
    _stepOps.push(op); _stepInv.push(inv);
    if (_batchDepth === 0) commitStep();
    return true;
}
function batch(fn) {
    _batchDepth++;
    try { return fn(); }
    finally { if (--_batchDepth === 0) commitStep(); }
}
function commitStep() {
    const ops = _stepOps, inv = _stepInv, typing = _typingKey;
    _stepOps = []; _stepInv = []; _typingKey = '';
    if (!ops.length) return;
    const last = _undo[_undo.length - 1];
    // Typing in one field is one step: each key after the first only moves
    // the step's final value, and the value to go back to stays the first.
    if (typing && last && last.typing === typing && ops.length === 1) last.ops[0] = ops[0];
    else {
        _undo.push({ ops, inv, typing });
        if (_undo.length > UNDO_LIMIT) _undo.shift();
    }
    _redo.length = 0;
    save(ops, { typing: !!typing });
}
// A field being typed in. Ends when the field is left (commitTyping).
function typed(kind, id, field, value) {
    if (_batchDepth === 0) _typingKey = kind + ':' + id + ':' + field;
    const made = change({ op: 'set', kind, id, field, value });
    if (!made && _batchDepth === 0) _typingKey = '';
    return made;
}
function commitTyping() {
    const last = _undo[_undo.length - 1];
    if (last) last.typing = '';
}

const canUndo = () => _undo.length > 0;
const canRedo = () => _redo.length > 0;
function undo() {
    if (state.readOnly || !_undo.length) return false;
    const step = _undo.pop(), done = [];
    for (let i = step.inv.length - 1; i >= 0; i--) if (applyOp(state.doc, step.inv[i])) done.push(step.inv[i]);
    _redo.push(step);
    dropMissingSelection();
    save(done, {});
    return true;
}
function redo() {
    if (state.readOnly || !_redo.length) return false;
    const step = _redo.pop(), inv = [], done = [];
    step.ops.forEach((op) => { const back = applyOp(state.doc, op); if (back) { inv.push(back); done.push(op); } });
    step.inv = inv; step.typing = '';
    _undo.push(step);
    dropMissingSelection();
    save(done, {});
    return true;
}
function clearHistory() { _undo.length = 0; _redo.length = 0; }

// Every change ends here: the browser's copy is written, whoever listens for
// operations is told, and the page is drawn again.
const LIVE_KEY = 'flow_live';
// True while a change comes from a field that is being left: the rail's
// fields are rebuilt after the focus has settled, not under it.
let _holdProps = false;
function keep() {
    try { localStorage.setItem(LIVE_KEY, JSON.stringify(fileEnvelope(state.doc))); } catch (e) { /* private mode or full: the page still works */ }
}
function save(ops, opts = {}) {
    state.seq++;
    keep();
    noteChanged();
    state.opSinks.forEach((fn) => fn(ops));
    render({ typing: opts.typing || _holdProps });
}

// ---- Selection ----
function selectId(id) {
    // Choosing something else lets the Add grid fold again (see addFromGrid).
    state.libHeld = false;
    const rec = id ? recOf(state.doc, id) : null;
    if (!rec) { setSelection([]); render(); return; }
    // An element on a size that is not on show: show that size.
    if (kindOfId(id) === 'elements') { const size = recOf(state.doc, rec.size); if (size && size.screen) state.sizeShown[size.screen] = size.id; }
    setSelection([selEntry(kindOfId(id), id)]);
    render();
}
function dropMissingSelection() {
    setSelection(Array.from(state.selection).filter((e) => recOf(state.doc, e.id)));
}

// ---- Adding ----
const setF = (id, field, value) => change({ op: 'set', kind: kindOfId(id), id, field, value });

// Where the next stop goes: to the right of everything on the board.
function nextStopPlace() {
    const b = boardBounds();
    return b ? { x: snap(b.x + b.w + 200), y: snap(b.y) } : { x: 0, y: 0 };
}
function addScreen(presetKey, templateKey = 'blank') {
    const p = sizePreset(presetKey), tpl = screenTemplate(templateKey), at = nextStopPlace(), id = nextId('screens'), sid = nextId('sizes');
    const n = state.doc.screens.length + 1;
    const ok = batch(() => {
        const made = change({ op: 'add', kind: 'screens', rec: { id, name: tpl.key === 'blank' ? 'Screen ' + n : tpl.name, x: at.x, y: at.y, start: state.doc.screens.length === 0 } });
        change({ op: 'add', kind: 'sizes', rec: { id: sid, screen: id, name: p.name, w: p.w, h: p.h, input: p.input, distance: p.distance, z: 1 } });
        tpl.build(p.w, p.h).forEach((e, i) => change({ op: 'add', kind: 'elements', rec: Object.assign({ id: nextId('elements'), size: sid, z: i + 1 }, e) }));
        return made;
    });
    if (!ok) return '';
    selectId(id); showStop(id);
    return id;
}
// Another size of a screen starts as a copy of the size on show, each element
// placed by what it is pinned to. The copies keep their names, which is how
// the same control is recognised across sizes.
function addSize(screenId, presetKey) {
    const doc = state.doc, screen = recOf(doc, screenId);
    if (!screen) return '';
    const p = sizePreset(presetKey), id = nextId('sizes'), from = shownSize(screen);
    const ok = batch(() => {
        if (!change({ op: 'add', kind: 'sizes', rec: { id, screen: screenId, name: p.name, w: p.w, h: p.h, input: p.input, distance: p.distance, z: topZ(sizesOf(doc, screenId)) } })) return false;
        elementsOf(doc, from.id).forEach((e) => change({ op: 'add', kind: 'elements', rec: Object.assign(writeRec('elements', e), { id: nextId('elements'), size: id }, pinnedBox(e, from.w, sizeHeight(from), p.w, p.h)) }));
        return true;
    });
    if (!ok) return '';
    state.sizeShown[screenId] = id;
    render();
    return id;
}
function addDecision() {
    const at = nextStopPlace(), id = nextId('decisions');
    if (!change({ op: 'add', kind: 'decisions', rec: { id, name: '', x: at.x, y: at.y } })) return '';
    selectId(id); showStop(id);
    return id;
}
// drop: where a tile was let go on the board { owner, x, y } (the size or
// block it landed on, and the point inside it). Without one, the element
// goes on what is selected, under what is already there.
function addElement(type, drop) {
    const size = drop ? drop.owner : addTargetSize();
    // 'block:<id>' places that block. It goes on a screen, never inside a block.
    const block = type.startsWith('block:') ? recOf(state.doc, type.slice(6)) : null;
    if (block) type = 'block';
    const kit = block ? { w: block.w, h: block.h, text: '', fs: 16 } : ELEMENT_KIT[type];
    if (!size || !kit || (type === 'block' && (!block || kindOfId(size.id) === 'blocks'))) return '';
    const others = elementsOf(state.doc, size.id);
    const low = others.reduce((m, e) => Math.max(m, e.y + e.h), 0);
    const bar = type === 'topbar' || type === 'tabbar';
    const w = bar ? size.w : block ? block.w : Math.min(kit.w, Math.max(GRID, snap(size.w - 64)));
    const id = nextId('elements');
    // Dropped: centred on where it was let go, on the grid, kept inside. A bar
    // goes to its edge wherever it is dropped.
    const within = (v, len, room) => Math.max(0, Math.min(snap(v - len / 2), Math.floor((room - len) / GRID) * GRID));
    const x = bar ? 0 : drop ? within(drop.x, w, size.w) : block ? Math.max(0, Math.min(32, size.w - block.w)) : 32;
    const y = type === 'tabbar' ? sizeHeight(size) - kit.h : type === 'topbar' ? 0 : drop ? within(drop.y, kit.h, sizeHeight(size)) : snap(others.length ? low + 16 : 32);
    if (!change({ op: 'add', kind: 'elements', rec: { id, size: size.id, type, block: block ? block.id : '', name: block ? block.name : '', x, y, w, h: kit.h, text: kit.text, fs: kit.fs, pinH: bar ? 'both' : 'left', pinV: type === 'tabbar' ? 'bottom' : 'top', z: topZ(others) } })) return '';
    selectId(id);
    return id;
}
function addLink(from, to, fromEl = '') {
    if (!isStopId(from) || !isStopId(to) || !recOf(state.doc, from) || !recOf(state.doc, to)) return '';
    const id = nextId('links');
    const kind = kindOfId(from) === 'decisions' ? 'system' : 'action';
    if (!change({ op: 'add', kind: 'links', rec: { id, from, to, fromEl, kind } })) return '';
    selectId(id);
    return id;
}
function addStyle(kind) {
    const id = nextId('styles'), n = state.doc.styles.filter((y) => y.kind === kind).length + 1;
    return change({ op: 'add', kind: 'styles', rec: { id, kind, name: (kind === 'text' ? 'Text ' : 'Colour ') + n } }) ? id : '';
}
// An empty block, to draw in.
function addBlock() {
    const at = nextStopPlace(), id = nextId('blocks');
    if (!change({ op: 'add', kind: 'blocks', rec: { id, name: 'Block ' + (state.doc.blocks.length + 1), x: at.x, y: at.y } })) return '';
    selectId(id); showStop(id);
    return id;
}
// What can become a block: two or more selected elements of one screen size,
// none of them a placing already.
function blockGroup() {
    const doc = state.doc, list = Array.from(state.selection).map((e) => recOf(doc, e.id)).filter(Boolean);
    if (!list.length || !list.every((r) => kindOfId(r.id) === 'elements' && r.type !== 'block' && r.size === list[0].size)) return [];
    return kindOfId(list[0].size) === 'sizes' ? list : [];
}
// The selected elements become a block, and one placing of it takes their
// place, so the screen looks the same and the block can be placed elsewhere.
function makeBlock() {
    const doc = state.doc, list = blockGroup();
    if (!list.length || state.readOnly) return '';
    const x0 = Math.min(...list.map((e) => e.x)), y0 = Math.min(...list.map((e) => e.y));
    const w = Math.max(...list.map((e) => e.x + e.w)) - x0, h = Math.max(...list.map((e) => e.y + e.h)) - y0;
    const at = nextStopPlace(), bid = nextId('blocks'), pid = nextId('elements'), name = 'Block ' + (doc.blocks.length + 1);
    batch(() => {
        change({ op: 'add', kind: 'blocks', rec: { id: bid, name, x: at.x, y: at.y, w, h } });
        list.forEach((e) => change({ op: 'add', kind: 'elements', rec: Object.assign(writeRec('elements', e), { id: nextId('elements'), size: bid, x: e.x - x0, y: e.y - y0 }) }));
        change({ op: 'add', kind: 'elements', rec: { id: pid, size: list[0].size, type: 'block', block: bid, name, x: x0, y: y0, w, h, z: Math.min(...list.map((e) => e.z)) } });
        // A link that started at one of them now starts at the placing.
        list.forEach((e) => {
            doc.links.filter((l) => l.fromEl === e.id).forEach((l) => setF(l.id, 'fromEl', pid));
            removalOps(doc, e.id).forEach(change);
        });
    });
    selectId(pid);
    return bid;
}
// A finding accepted as it is, with the reason. It leaves the count and the
// badges; the reason stays with the workflow for whoever reads it next.
function acceptFinding(key, reason) {
    const doc = state.doc, why = String(reason || '').trim();
    if (!key || !why || doc.accepts.some((a) => a.finding === key)) return '';
    const id = nextId('accepts');
    const ok = batch(() => {
        doc.pins.filter((p) => p.finding === key).forEach((p) => change({ op: 'del', kind: 'pins', id: p.id }));
        return change({ op: 'add', kind: 'accepts', rec: { id, finding: key, reason: why } });
    });
    state.accepting = '';
    render();
    return ok ? id : '';
}
// A finding marked to come back to, or unmarked.
function pinFinding(key) {
    const doc = state.doc, have = doc.pins.find((p) => p.finding === key);
    if (have) return change({ op: 'del', kind: 'pins', id: have.id }) ? '' : have.id;
    const id = nextId('pins');
    return change({ op: 'add', kind: 'pins', rec: { id, finding: key } }) ? id : '';
}
function addSource() {
    const id = nextId('sources');
    return change({ op: 'add', kind: 'sources', rec: { id, kind: 'vector' } }) ? id : '';
}
function removeId(id) {
    if (state.readOnly) return false;
    const ops = removalOps(state.doc, id);
    if (!ops.length) return false;
    batch(() => ops.forEach(change));
    dropMissingSelection();
    render();
    return !recOf(state.doc, id);
}
// Only one screen is the start: marking one unmarks the others, as one step.
function setStart(id, on) {
    batch(() => {
        if (on) state.doc.screens.forEach((s) => { if (s.start && s.id !== id) setF(s.id, 'start', false); });
        setF(id, 'start', on);
    });
}

// ---- From the Add grid ----
// An element added from the grid, by a click or by a drop. It is selected,
// which would fold the grid; the grid is held open instead until something
// else is chosen, so the next element can follow at once.
function addFromGrid(type, drop) {
    if (!drop && !addTargetSize()) { say('Drag an element onto a screen, or select a screen and click one.', true); return ''; }
    const id = addElement(type, drop);
    if (id) { state.libHeld = true; state.lastAdded = type; renderPalette(); }
    return id;
}
// The element last added from the grid, once more: on the same screen, under
// what is there. The button above the grid and the A key.
function lastAddedLabel() {
    const type = state.lastAdded;
    if (!type) return '';
    if (type.startsWith('block:')) { const b = recOf(state.doc, type.slice(6)); return b ? b.name || tr('Block') : ''; }
    return ELEMENT_KIT[type] ? tr(ELEMENT_KIT[type].label) : '';
}
function addAgain() {
    if (state.readOnly || !lastAddedLabel()) return '';
    return addFromGrid(state.lastAdded);
}
// Where the pointer is over the board: the screen or block under it, what
// elements are drawn on there, and the point inside it. null over anything
// else, and in the flow view, where screens are cards.
function dropTarget(ev) {
    if (state.view === 'flow' || state.readOnly) return null;
    const over = document.elementFromPoint(ev.clientX, ev.clientY);
    const hit = over && over.closest ? over.closest('#board [data-id]') : null;
    const holder = hit ? screenOfId(hit.dataset.id) : null;
    if (!holder) return null;
    const p = boardPoint(ev);
    return { holder, owner: drawnOn(holder), x: p.x - holder.x, y: p.y - holder.y };
}
// A tile picked up from the grid follows the pointer as a small copy of its
// drawing; the screen under it lights up; letting go there adds the element
// where it was dropped. A press that does not move is the tile's click.
let _tileDrag = null, _skipTileClick = false;
function onTileDown(ev) {
    const tile = ev.target.closest ? ev.target.closest('.lib-tile') : null;
    if (!tile || ev.button !== 0 || state.readOnly) return;
    _tileDrag = { type: tile.dataset.type, tile, sx: ev.clientX, sy: ev.clientY, on: false, ghost: null };
}
function onTileMove(ev) {
    const d = _tileDrag;
    if (!d) return;
    if (!d.on) {
        if (Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) < 6) return;
        d.on = true;
        d.ghost = document.createElement('div');
        d.ghost.className = 'lib-ghost';
        d.ghost.appendChild(d.tile.querySelector('.lib-pic').cloneNode(true));
        document.body.appendChild(d.ghost);
        document.body.classList.add('tile-dragging');
    }
    d.ghost.style.left = ev.clientX + 'px'; d.ghost.style.top = ev.clientY + 'px';
    const drop = dropTarget(ev), on = drop && !(d.type.startsWith('block:') && kindOfId(drop.holder.id) === 'blocks') ? drop.holder.id : '';
    d.ghost.classList.toggle('ok', !!on);
    if (on !== state.dropOn) { state.dropOn = on; drawSoon(); }
}
function onTileUp(ev) {
    const d = _tileDrag;
    _tileDrag = null;
    if (!d || !d.on) return;
    d.ghost.remove();
    document.body.classList.remove('tile-dragging');
    // Let go over its own tile, the browser would also send a click.
    _skipTileClick = true; setTimeout(() => { _skipTileClick = false; }, 0);
    const drop = ev.type === 'pointercancel' ? null : dropTarget(ev), was = state.dropOn;
    state.dropOn = '';
    if (drop && was) { addFromGrid(d.type, drop); return; }
    drawBoard();
    if (ev.type !== 'pointercancel') say('Drop it on a screen or a block.', true);
}

// ---- Replacing the whole document ----
// New, Open and the example are ordinary changes too: everything there is
// removed and the new records added, as one step. So Undo brings back the
// workflow that was open, and nothing has to ask "are you sure?".
function replaceDoc(next) {
    const doc = state.doc;
    // Every list, so nothing of the workflow that was open stays behind:
    // what hangs off other records goes first and comes back last.
    const order = ['styles', 'sources', 'bases', 'langs', 'blocks', 'screens', 'decisions', 'sizes', 'elements', 'links', 'words', 'accepts', 'pins', 'runs', 'steps'];
    batch(() => {
        order.slice().reverse().forEach((kind) => doc[kind].slice().forEach((r) => change({ op: 'del', kind, id: r.id })));
        Object.keys(DOC_FIELDS).forEach((field) => change({ op: 'set', kind: 'doc', id: '', field, value: next[field] }));
        order.forEach((kind) => next[kind].forEach((rec) => change({ op: 'add', kind, rec })));
    });
    resetLooking();
    render();
    fitBoard();
}
// Another document is open: how the last one was being looked at goes.
function resetLooking() {
    state.sizeShown = {};
    state.lang = '';
    state.walk = { from: '', to: '', pick: -1 };
    state.play = null;
    state.test = null;
    state.base = '';
    state.accepting = '';
    setSelection([]);
}
// A document that must not be changed (written by a newer Flow), or the first
// one of this visit: put in place as it is, with no history behind it.
function loadDoc(doc, readOnly) {
    state.doc = doc; state.readOnly = !!readOnly;
    dropIndex(); clearHistory();
    resetLooking();
    state.seq++;
    // A read-only document is not kept: the browser's copy stays the last
    // workflow this build could save.
    if (!readOnly) keep();
    render();
    fitBoard();
}
function openDoc(doc, readOnly) {
    // In a live room, another workflow is not a change to the room's: the
    // room is left, and keeps its own.
    if (state.live) liveLeave();
    // A kept workflow is safe in its card, and what replaces it is another
    // workflow, not a change to it: it opens fresh and is not kept.
    if (state.cardId) { flushCard(); setCard(''); loadDoc(doc, readOnly); }
    else if (readOnly || state.readOnly) loadDoc(doc, readOnly);
    else replaceDoc(doc);
}
function loadExample() {
    const doc = newDoc('Shop checkout');
    exampleOps().forEach((op) => applyOp(doc, op));
    openDoc(normalizeDoc(serializeDoc(doc)), false);
}
// The sample a visitor is offered: a whole shop, on a phone and on a desktop.
function loadSample() {
    const doc = newDoc('Shop');
    sampleOps().forEach((op) => applyOp(doc, op));
    openDoc(normalizeDoc(serializeDoc(doc)), false);
}

// ---- The landing page ----
// A bare address opens on it: what Flow is, and the ways in. Going in puts
// #editor in the address, so a reload stays in the editor. A link that says
// which view it wants (?simple, ?full), a sealed link and a room's link go
// straight in.
function landingAtStart() {
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return false; }
    if (location.hash === '#editor' || q.has('simple') || q.has('full')) return false;
    if (location.hash.startsWith('#' + SEAL_MARK) || location.hash.startsWith('#' + LIVE_MARK) || isPlainFragment(location.hash)) return false;
    return true;
}
function showLanding(on) {
    state.landing = !!on;
    document.body.classList.toggle('on-landing', state.landing);
    $('landing').hidden = !state.landing;
    if (state.landing) renderLanding();
}
function renderLanding() {
    if (!state.landing) return;
    // What is kept in this browser is read a moment later.
    const turn = ++_landingTurn;
    libList().then((cards) => { if (turn === _landingTurn && state.landing) paintLanding(cards); }, () => { if (turn === _landingTurn && state.landing) paintLanding([]); });
}
// The workflows kept here, each a card, and before them the one that is open
// when it is not kept yet. With any, the list goes above the way to start a
// new one and the pitch shrinks to the claim (css/app.css, .has-saved).
let _landingTurn = 0;
function paintLanding(cards) {
    const doc = state.doc, draft = !state.cardId && KINDS.some((k) => doc[k].length), any = cards.length > 0 || draft;
    $('landing').classList.toggle('has-saved', any);
    $('landingNone').hidden = cards.length > 0;
    $('landingMore').hidden = !cards.length;
    $('landingSaved').hidden = !any;
    $('landingEmpty').hidden = any;
    $('binderExport').hidden = !cards.length;
    const count = (d, k) => (d && Array.isArray(d[k]) ? d[k].length : 0);
    const stats = (d) => `${tn(count(d, 'screens'), '1 screen', '{n} screens')} · ${tn(count(d, 'links'), '1 link', '{n} links')}`;
    const badge = (text, cls = '') => `<span class="landing-badge ${cls}">${esc(tr(text))}</span>`;
    let h = '';
    // Open, with something in it, and not kept: it is here until it is kept or replaced.
    if (draft) {
        h += `<div class="landing-card draft on"><button type="button" class="landing-card-open" data-act="enter"><span class="landing-card-name">${esc(doc.name || tr('Untitled'))}</span>`
            + `<span class="landing-card-stats">${esc(stats(doc))}</span><span class="landing-card-badges">${badge('open', 'good')}${badge('not kept', 'warn')}</span><span class="landing-card-when">${esc(tr('Only in this tab until it is kept.'))}</span></button>`
            + (state.readOnly || state.live ? '' : `<div class="landing-card-tools"><button type="button" class="landing-tool wide" data-act="lib-keep" title="${esc(tr('Keep it in this browser; it saves itself from then on'))}">${esc(tr('Keep'))}</button></div>`) + '</div>';
    }
    const tool = (act, id, glyph, label, name, cls = '') => `<button type="button" class="landing-tool${cls}" data-act="${act}" data-id="${esc(id)}" title="${esc(tr(label))}" aria-label="${esc(tr(label) + ' — ' + name)}">${glyph}</button>`;
    h += cards.map((c) => {
        const on = c.id === state.cardId, d = on ? doc : c.doc && c.doc.doc, sure = state.libSure === c.id, name = c.name || tr('Untitled');
        // Its name being typed: the card is a field until Enter, Esc or a press elsewhere.
        if (state.libRename === c.id) {
            return `<div class="landing-card renaming${on ? ' on' : ''}" data-card="${esc(c.id)}"><div class="landing-card-open"><input class="input landing-card-rename" type="text" maxlength="120" value="${esc(on ? doc.name || name : name)}" data-rename="${esc(c.id)}" aria-label="${esc(tr('Name of the workflow'))}">`
                + `<span class="landing-card-stats">${esc(stats(d))}</span><span class="landing-card-when">${esc(tr('Enter keeps the name, Esc leaves it as it was.'))}</span></div></div>`;
        }
        return `<div class="landing-card${on ? ' on' : ''}${sure ? ' sure' : ''}" data-card="${esc(c.id)}"><button type="button" class="landing-card-open" data-act="lib-open" data-id="${esc(c.id)}">`
            + `<span class="landing-card-name">${esc(on ? doc.name || name : name)}</span><span class="landing-card-stats">${esc(stats(d))}</span>`
            + `<span class="landing-card-badges">${on ? badge('open', 'good') : ''}</span><span class="landing-card-when">${esc(tr('Changed {x}.', { x: new Date(c.updated).toLocaleString() }))}</span></button>`
            + `<div class="landing-card-tools">${sure ? '' : (on && state.readOnly ? '' : tool('lib-rename', c.id, '✎', 'Rename', name)) + tool('lib-duplicate', c.id, '⧉', 'Duplicate', name)
                + (cards.length > 1 ? tool('lib-merge', c.id, '⇄', 'Merge into another workflow…', name) : '') + tool('lib-save', c.id, '⤓', 'Save a copy as a file', name)}`
            + `<button type="button" class="landing-tool${sure ? ' wide danger' : ''}" data-act="lib-del" data-id="${esc(c.id)}" title="${esc(tr(sure ? 'Delete for good' : 'Delete'))}" aria-label="${esc(tr(sure ? 'Delete for good' : 'Delete') + ' — ' + name)}">${sure ? esc(tr('Delete for good')) : '✕'}</button></div></div>`;
    }).join('');
    $('landingCards').innerHTML = h;
    const field = $('landingCards').querySelector('.landing-card-rename');
    if (field && document.activeElement !== field) { field.focus(); field.select(); }
}
// The name typed on a card: kept, or left as it was.
async function endCardRename(keep) {
    const field = $('landingCards').querySelector('.landing-card-rename'), id = state.libRename;
    if (!id) return false;
    state.libRename = '';
    const done = keep && field ? await renameCard(id, field.value) : false;
    render();
    return done;
}
// Which workflow a card is merged into: every other one, a press each.
async function openCardMerge(id) {
    const cards = await libList(), from = cards.find((c) => c.id === id);
    if (!from || cards.length < 2) return false;
    state.libMerge = id;
    $('mergeAsk').textContent = tr('Merge "{name}" into which workflow?', { name: from.name || tr('Untitled') });
    $('mergeList').innerHTML = cards.filter((c) => c.id !== id).map((c) => `<button type="button" class="btn btn-ghost merge-into" data-act="merge-into" data-id="${esc(c.id)}">${esc(c.name || tr('Untitled'))}${c.id === state.cardId ? ` <span class="size-on">${esc(tr('open'))}</span>` : ''}</button>`).join('');
    openDlg('mergeDlg');
    return true;
}
async function runCardMerge(intoId) {
    const fromId = state.libMerge;
    state.libMerge = '';
    closeDlg('mergeDlg');
    const from = await libGet(fromId), res = await mergeCardInto(fromId, intoId);
    if (res.error) say(res.error, true);
    else say(res.changes ? tr('Merged "{a}" into "{b}": {n}.', { a: (from && from.name) || tr('Untitled'), b: res.into, n: tn(res.changes, '1 change', '{n} changes') })
        : tr('Nothing in "{a}" differs from "{b}".', { a: (from && from.name) || tr('Untitled'), b: res.into }));
    render();
    return res;
}
// A new workflow from the start page: named, kept in this browser, opened.
async function landingNew() {
    const name = $('landingName').value.trim();
    if (state.live) liveLeave();
    // What is open and not kept would be lost with the history: it is kept first.
    await flushCard();
    if (!state.cardId && !state.readOnly && KINDS.some((k) => state.doc[k].length)) await keepWorkflow();
    await flushCard();
    loadDoc(newDoc(name), false);
    setCard('');
    await keepWorkflow();
    $('landingName').value = '';
    say('A new workflow, kept in this browser. It saves itself on every change.');
    enterEditor();
}
// Back to the start page, where every kept workflow is.
function goHome() {
    commitTyping();
    flushCard();
    state.libSure = '';
    try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* a file: page keeps its address */ }
    showLanding(true);
}
// A file that was picked or dropped: a workflow opens in the editor, a
// binder's workflows are added to the ones kept here.
async function openAnyFile(text) {
    let data = null;
    try { data = JSON.parse(text); } catch (e) { /* openFileFrom says so */ }
    if (isBinder(data)) {
        const res = await importBinder(data);
        say(res.added ? tr('Brought in {n} from the binder.', { n: tn(res.added, '1 workflow', '{n} workflows') }) + (res.same ? ' ' + tr('{n} were here already.', { n: res.same }) : '')
            : res.same ? tr('Every workflow of that binder is here already.') : tr('That binder has no workflow in it.'), !res.added && !res.same);
        goHome();
        return 'binder';
    }
    if (!openFileFrom(text)) return '';
    enterEditor();
    return 'doc';
}
function enterEditor() {
    if (!state.landing) return;
    showLanding(false);
    try { history.replaceState(history.state, '', location.pathname + location.search + '#editor'); } catch (e) { /* a file: page keeps its address */ }
    render();
    fitBoard();
}

// ---- Files ----
const fileName = (doc) => (doc.name.trim().replace(/[^\p{L}\p{N} _.-]+/gu, '').trim() || 'workflow') + '.flow.json';
function saveFile() {
    const text = JSON.stringify(fileEnvelope(state.doc), null, 2) + '\n';
    saveBlob(new Blob([text], { type: 'application/json' }), fileName(state.doc));
    say(tr('Saved a copy as {x}.', { x: fileName(state.doc) }));
}
function openFileFrom(text) {
    const res = openFileText(text);
    if (res.error) { say(res.error, true); return false; }
    const kept = !!state.cardId;
    openDoc(res.doc, res.readOnly);
    say(res.readOnly ? 'This file was made by a newer Flow. It is open to read only.' : kept ? 'Opened. The workflow that was open is in Your workflows.' : 'Opened. Undo brings back what was here.');
    return true;
}
// A part of this workflow, worked on elsewhere, brought back in.
function mergeFileFrom(text) {
    const res = openFileText(text);
    if (res.error) { say(res.error, true); return false; }
    if (res.readOnly) { say('This file was made by a newer Flow and cannot be merged by this one.', true); return false; }
    const n = mergeDoc(res.doc);
    say(n ? tn(n, 'Merged: 1 change. Undo takes it back.', 'Merged: {n} changes. Undo takes them all back.') : 'Nothing in that file differs from this workflow.');
    return true;
}
function sheetFileFrom(text) {
    const r = bringInSheet(text);
    if (r.error) { say(r.error, true); return false; }
    say(tr('Copy sheet: {n} texts changed, {n2} translations, {n3} keys. Undo takes them back.', { n: r.texts, n2: r.words, n3: r.keys }) + (r.unknown ? ' ' + tr('{n} rows matched no element.', { n: r.unknown }) : ''));
    render();
    return true;
}

// ---- Dialogs ----
const openDlg = (id) => { const d = $(id); if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); } };
const closeDlg = (id) => { const d = $(id); if (d.open) { if (d.close) d.close(); else d.removeAttribute('open'); } };
const exportChoice = () => ({
    what: (document.querySelector('input[name="exportWhat"]:checked') || {}).value || 'all',
    as: $('exportAs').value,
    format: $('exportFormat').value === 'svg' ? 'svg' : 'png',
    scale: Number($('exportFormat').value.replace('png', '')) || 1,
    noSources: $('exportNoSources').checked
});
// What the Export dialog offers follows what is selected and what is marked.
function renderExport() {
    const c = exportChoice();
    document.querySelectorAll('input[name="exportWhat"]').forEach((r) => {
        const n = exportStops(r.value).length;
        r.disabled = !n;
        if (r.disabled && r.checked) document.querySelector('input[name="exportWhat"][value="all"]').checked = true;
    });
    const picture = c.as === 'map' || c.as === 'screens' || c.as === 'storyboard';
    $('exportPicOpts').hidden = !picture;
    $('exportLinkOpts').hidden = c.as !== 'link';
    const locked = $('exportSeal').checked;
    $('exportPassRow').hidden = !locked;
    $('exportLinkNote').textContent = tr(locked ? 'The workflow is encrypted here with this passphrase and put after the # of the link, which a browser never sends to a server. Whoever has both the link and the passphrase can open it.'
        : 'The workflow is put after the # of the link as it is, and the link alone builds it again. Anyone who gets the link can read the whole workflow; chats, mail and browser history keep links.');
    $('exportLinkNote').classList.toggle('bad', !locked);
    $('exportSourcesRow').hidden = !(c.as === 'doc' || c.as === 'report' || c.as === 'link') || !state.doc.sources.length;
    // A report is looked at first: its design, PDF or HTML, Print and Download are in its preview.
    $('exportPrint').hidden = true;
    $('exportGo').textContent = t(c.as === 'link' ? 'Make the link' : c.as === 'report' ? 'Preview the report…' : 'Export');
}
async function runExport(print) {
    const c = exportChoice(), msg = $('exportMsg');
    msg.textContent = tr('Working…'); msg.classList.remove('bad');
    try {
        if (c.as === 'link') {
            const locked = $('exportSeal').checked;
            const link = await makeShareLink(c.what, $('exportPass').value, c.noSources, $('exportSimple').checked, !locked);
            $('exportLink').value = link; $('exportLinkOut').hidden = false;
            $('exportShare').hidden = typeof navigator.share !== 'function';
            msg.textContent = tr(locked ? 'The link is {n} characters. Send the passphrase some other way than the link.' : 'The link is {n} characters. Anyone who gets it can open the workflow.', { n: link.length.toLocaleString() });
            return link;
        }
        const out = await buildExport(c);
        if (print) { const url = URL.createObjectURL(out.blob); window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), SAVE_REVOKE_MS); msg.textContent = tr('Opened in another tab. Print it from there.'); }
        else { saveBlob(out.blob, out.name); msg.textContent = tr('Saved as {x}.', { x: out.name }); }
        return out;
    } catch (e) {
        msg.textContent = tr((e && e.message) || 'That could not be exported.'); msg.classList.add('bad');
        return null;
    }
}
async function runUnseal() {
    const msg = $('passMsg');
    msg.textContent = t('Opening…'); msg.classList.remove('bad');
    try {
        const res = await openSealed($('passInput').value);
        $('passInput').value = '';
        closeDlg('passDlg');
        say(res.part ? 'Opened a part of a workflow from a link. Undo brings back what was here.' : 'Opened from a link. Undo brings back what was here.');
        return true;
    } catch (e) { msg.textContent = t((e && e.message) || 'The link could not be opened.'); msg.classList.add('bad'); return false; }
}
// A plain link: the workflow is built from the address itself.
async function runPlain(fragment) {
    try {
        const res = await openPlain(fragment);
        say(res.part ? 'Opened a part of a workflow from a link. Undo brings back what was here.' : 'Opened from a link. Undo brings back what was here.');
        enterEditor(); fitBoard();
        return true;
    } catch (e) { say((e && e.message) || 'The link could not be opened.', true); return false; }
}
// A link pasted over the address of a page that is already open.
function onHashChange() {
    if (takeSealFromAddress()) { enterEditor(); $('passMsg').textContent = ''; openDlg('passDlg'); return; }
    const plain = takePlainFromAddress();
    if (plain) runPlain(plain);
}
function pickFile(then) {
    const pick = $('anyPick');
    pick.onchange = () => { const file = pick.files && pick.files[0]; pick.value = ''; if (file) file.text().then(then); };
    pick.click();
}
let _sayTimer = null;
function say(text, bad) {
    const el = $('status');
    el.textContent = t(text); el.classList.toggle('bad', !!bad); el.hidden = false;
    clearTimeout(_sayTimer);
    _sayTimer = setTimeout(() => { el.hidden = true; }, 6000);
}

// ---- The camera ----
function boardRect() { return $('board').getBoundingClientRect(); }
function boardPoint(ev) {
    const r = boardRect(), cam = state.camera;
    return { x: (ev.clientX - r.left - cam.x) / cam.zoom, y: (ev.clientY - r.top - cam.y) / cam.zoom };
}
const ZOOM_MIN = 0.05, ZOOM_MAX = 4;
function zoomAt(factor, cx, cy) {
    const cam = state.camera, z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cam.zoom * factor));
    cam.x = cx - (cx - cam.x) * (z / cam.zoom);
    cam.y = cy - (cy - cam.y) * (z / cam.zoom);
    cam.zoom = z;
    drawBoard();
}
function zoomStep(factor) { const r = boardRect(); zoomAt(factor, r.width / 2, r.height / 2); }
// Frame every stop, with room for the names above and the size chips below.
function fitBoard() {
    const b = boardBounds(), r = boardRect(), cam = state.camera;
    if (!b || !r.width || !r.height) { cam.x = 60; cam.y = 90; cam.zoom = 0.5; drawBoard(); return; }
    // What sits over the board takes room from it: the Simple view's heading
    // at the top, the bars at the bottom.
    const narrow = r.width < 640, pad = narrow ? 28 : 70;
    const top = state.simple && !$('simpleBar').hidden ? $('simpleBar').offsetHeight + 12 : 0, bottom = narrow ? 120 : 0;
    const h = Math.max(120, r.height - top - bottom);
    cam.zoom = Math.min(1, Math.max(ZOOM_MIN, Math.min((r.width - pad * 2) / (b.w || 1), (h - pad * 2) / (b.h || 1))));
    cam.x = (r.width - b.w * cam.zoom) / 2 - b.x * cam.zoom;
    cam.y = top + (h - b.h * cam.zoom) / 2 - b.y * cam.zoom;
    drawBoard();
}
// A stop just added that is off the visible board: frame everything.
function showStop(id) {
    const stop = recOf(state.doc, id), r = boardRect(), cam = state.camera;
    if (!stop || !r.width) return;
    const b = boxOfStop(stop);
    const x0 = b.x * cam.zoom + cam.x, y0 = b.y * cam.zoom + cam.y, x1 = x0 + b.w * cam.zoom, y1 = y0 + b.h * cam.zoom;
    if (x0 < 0 || y0 < 40 || x1 > r.width || y1 > r.height) fitBoard();
}

// ---- The pointer on the board ----
// The board is redrawn whole while something is dragged, which replaces the
// element under the pointer; so the SVG itself holds the pointer and the
// drag lives here. A drag shows its result by writing the record directly;
// on release the record is put back and the change made once, through
// change(), so a whole drag is one step and one operation per field.
let _drag = null, _drawAsked = false;
// While something is dragged the board is drawn once per frame, not once per
// pointer event. Tests ask for it at once (window.FLOW_SYNC), so they can
// read the board right after a move.
function drawSoon() {
    if (window.FLOW_SYNC) { drawBoard(); return; }
    if (_drawAsked) return;
    _drawAsked = true;
    requestAnimationFrame(() => { _drawAsked = false; drawBoard(); });
}
const MOVABLE = { screens: true, decisions: true, elements: true, blocks: true };
// What a drag or an arrow key moves: the selection, without the elements
// whose screen is moving too (they go with it).
function movingIds() {
    const doc = state.doc, ids = Array.from(state.selection).filter((e) => MOVABLE[e.type] && recOf(doc, e.id)).map((e) => e.id);
    // In the flow view places are worked out, not chosen: nothing moves.
    if (state.view === 'flow') return [];
    const moving = new Set(ids.filter((id) => kindOfId(id) !== 'elements'));
    return ids.filter((id) => {
        if (kindOfId(id) !== 'elements') return true;
        const at = placeOf(recOf(doc, id));
        return !(at && moving.has(at.holder.id));
    });
}
function toggleSelected(id) {
    if (!recOf(state.doc, id)) return;
    const entry = selEntry(kindOfId(id), id), next = new Set(state.selection);
    if (next.has(entry)) next.delete(entry); else next.add(entry);
    state.selection = next;
    render();
}
// The screen a record is on or is: where a box drawn from it picks elements.
function screenOfId(id) {
    const kind = kindOfId(id), rec = recOf(state.doc, id);
    if (!rec) return null;
    if (kind === 'screens' || kind === 'blocks') return rec;
    if (kind === 'elements') { const at = placeOf(rec); return at ? at.holder : null; }
    return null;
}
// What a box drawn on the board selects: started on a screen, the elements
// of that screen it touches; started on the background, the stops it touches.
function marqueePicks(m) {
    const doc = state.doc, box = { x: Math.min(m.x0, m.x1), y: Math.min(m.y0, m.y1), w: Math.abs(m.x1 - m.x0), h: Math.abs(m.y1 - m.y0) };
    const screen = m.hitId && state.view !== 'flow' ? screenOfId(m.hitId) : null;
    if (screen) {
        return elementsOf(doc, drawnOn(screen).id).filter((e) => boxesMeet(box, { x: screen.x + e.x, y: screen.y + e.y, w: e.w, h: e.h })).map((e) => selEntry('elements', e.id));
    }
    return doc.screens.concat(doc.decisions).filter((s) => boxesMeet(box, boxOfStop(s))).map((s) => selEntry(kindOfId(s.id), s.id));
}

// Two fingers on the board: the gap between them is the zoom, their middle the
// place that stays under them.
const _touches = new Map();
function pinchState() {
    const [a, b] = Array.from(_touches.values()), r = boardRect();
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top };
}
function onBoardDown(ev) {
    if (ev.button !== 0 && ev.button !== 1) return;
    const svg = $('board'), t = ev.target;
    if (ev.pointerType === 'touch') {
        _touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        if (_touches.size === 2) {
            // What one finger had started is given up, and put back as it was.
            const d = _drag;
            if (d && d.mode === 'move') d.ids.forEach((id) => { const rec = recOf(state.doc, id); if (rec) Object.assign(rec, d.was.get(id)); });
            if (d && d.mode === 'resize') { const rec = recOf(state.doc, d.id); if (rec) Object.assign(rec, d.was); }
            state.linking = null; state.marquee = null;
            const p0 = pinchState();
            _drag = { mode: 'pinch', d0: p0.d, zoom0: state.camera.zoom, bx: (p0.mx - state.camera.x) / state.camera.zoom, by: (p0.my - state.camera.y) / state.camera.zoom };
            try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not a real pointer */ }
            return;
        }
    }
    // The Simple view reads: a drag moves the view, a tap on a screen opens it.
    if (state.simple) {
        const stop = t.closest('[data-stop]');
        try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* not a real pointer */ }
        _drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, cx: state.camera.x, cy: state.camera.y, moved: false, tap: stop ? stop.dataset.id : '' };
        return;
    }
    const chip = t.closest('[data-act="show-size"]');
    if (chip && ev.button === 0) { showSize(chip.dataset.size); return; }
    const hit = ev.button === 0 ? t.closest('[data-id]') : null;
    const handle = t.closest('[data-h]');
    const p = boardPoint(ev);
    try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* a synthetic event has no pointer to hold */ }
    // Shift: a box to select with; a press that does not move adds or removes
    // the one thing under it.
    if (ev.button === 0 && ev.shiftKey) {
        _drag = { mode: 'marquee', m: { x0: p.x, y0: p.y, x1: p.x, y1: p.y, hitId: hit ? hit.dataset.id : '' }, sx: ev.clientX, sy: ev.clientY, moved: false };
        return;
    }
    if (!hit) {
        _drag = { mode: 'pan', sx: ev.clientX, sy: ev.clientY, cx: state.camera.x, cy: state.camera.y, moved: false };
        return;
    }
    const id = hit.dataset.id, kind = kindOfId(id), rec = recOf(state.doc, id);
    if (!rec) return;
    // The ✕ on what is selected deletes it; with several selected, all of them.
    if (handle && handle.dataset.h === 'del') { if (!state.readOnly) { if (state.selection.size > 1) removeSelected(); else removeId(id); } return; }
    if (handle && handle.dataset.h === 'link' && !state.readOnly) {
        const from = kind === 'elements' ? placeOf(rec).holder.id : id;
        state.linking = { from, fromEl: kind === 'elements' ? id : '', x0: p.x, y0: p.y, x: p.x, y: p.y };
        _drag = { mode: 'link' };
        return;
    }
    if (ev.ctrlKey || ev.metaKey) { toggleSelected(id); return; }
    if (!inSelection(id)) selectId(id);
    if (state.readOnly) return;
    if (handle && handle.dataset.h === 'resize' && kind === 'elements') {
        _drag = { mode: 'resize', id, start: p, was: { w: rec.w, h: rec.h }, moved: false };
    } else if (MOVABLE[kind] && state.view !== 'flow') {
        const ids = movingIds();
        _drag = { mode: 'move', ids, start: p, was: new Map(ids.map((i) => [i, { x: recOf(state.doc, i).x, y: recOf(state.doc, i).y }])), moved: false };
    }
}
function onBoardMove(ev) {
    const d = _drag;
    if (_touches.has(ev.pointerId)) _touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (!d) return;
    if (d.mode === 'pinch') {
        if (_touches.size < 2) return;
        const p = pinchState(), cam = state.camera;
        cam.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, d.zoom0 * (p.d / d.d0)));
        cam.x = p.mx - d.bx * cam.zoom; cam.y = p.my - d.by * cam.zoom;
        drawSoon();
        return;
    }
    if (d.mode === 'done') return;
    if (d.mode === 'pan') {
        const dx = ev.clientX - d.sx, dy = ev.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        state.camera.x = d.cx + dx; state.camera.y = d.cy + dy;
        drawSoon();
        return;
    }
    const p = boardPoint(ev);
    if (d.mode === 'marquee') {
        if (Math.abs(ev.clientX - d.sx) + Math.abs(ev.clientY - d.sy) > 3) d.moved = true;
        d.m.x1 = p.x; d.m.y1 = p.y;
        if (d.moved) { state.marquee = d.m; drawSoon(); }
        return;
    }
    if (d.mode === 'link') { state.linking.x = p.x; state.linking.y = p.y; drawSoon(); return; }
    const dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (d.mode === 'move') {
        // The whole group moves by one snapped step, so its members keep
        // their places relative to each other.
        const sx = snap(dx), sy = snap(dy);
        let changed = false;
        d.ids.forEach((id) => {
            const rec = recOf(state.doc, id), was = d.was.get(id);
            if (!rec) return;
            const x = d.ids.length === 1 ? snap(was.x + dx) : was.x + sx, y = d.ids.length === 1 ? snap(was.y + dy) : was.y + sy;
            if (x !== rec.x || y !== rec.y) { rec.x = x; rec.y = y; changed = true; }
        });
        if (changed) { d.moved = true; drawSoon(); }
        return;
    }
    const rec = recOf(state.doc, d.id);
    if (!rec) { _drag = null; return; }
    const w = Math.max(GRID, snap(d.was.w + dx)), h = Math.max(GRID, snap(d.was.h + dy));
    if (w !== rec.w || h !== rec.h) { rec.w = w; rec.h = h; d.moved = true; drawSoon(); }
}
function onBoardUp(ev) {
    const d = _drag;
    _touches.delete(ev.pointerId);
    // A pinch ends when a finger lifts; the other finger starts nothing new.
    if (d && d.mode === 'pinch') { if (_touches.size < 2) { _drag = _touches.size ? { mode: 'done' } : null; drawBoard(); } return; }
    _drag = null;
    if (!d || d.mode === 'done') return;
    try { $('board').releasePointerCapture(ev.pointerId); } catch (e) { /* not held */ }
    if (d.mode === 'pan') {
        if (!d.moved && d.tap) playStart(d.tap);
        else if (!d.moved && state.selection.size) { setSelection([]); render(); }
        else drawBoard();
        return;
    }
    if (d.mode === 'marquee') {
        state.marquee = null;
        if (!d.moved) { if (d.m.hitId) toggleSelected(d.m.hitId); else drawBoard(); return; }
        setSelection(marqueePicks(d.m));
        render();
        return;
    }
    if (d.mode === 'link') {
        const l = state.linking;
        state.linking = null;
        const over = document.elementFromPoint(ev.clientX, ev.clientY);
        const stop = over && over.closest ? over.closest('[data-stop]') : null;
        if (stop && addLink(l.from, stop.dataset.id, l.fromEl)) return;
        drawBoard();
        return;
    }
    if (!d.moved) return;
    // Put every record back, then make the change once, through change().
    if (d.mode === 'move') {
        const now = new Map();
        d.ids.forEach((id) => { const rec = recOf(state.doc, id); if (rec) { now.set(id, { x: rec.x, y: rec.y }); Object.assign(rec, d.was.get(id)); } });
        batch(() => now.forEach((at, id) => { setF(id, 'x', at.x); setF(id, 'y', at.y); }));
        return;
    }
    const rec = recOf(state.doc, d.id);
    if (!rec) return;
    const now = { w: rec.w, h: rec.h };
    Object.assign(rec, d.was);
    batch(() => { setF(d.id, 'w', now.w); setF(d.id, 'h', now.h); });
}

// ---- Several at once ----
// What "line up" works on: the selection when it is all elements of one
// size, or all screens and decisions. Otherwise nothing.
function alignGroup() {
    const doc = state.doc, list = Array.from(state.selection).map((e) => recOf(doc, e.id)).filter(Boolean);
    if (list.length < 2) return [];
    if (list.every((r) => kindOfId(r.id) === 'elements') && list.every((r) => r.size === list[0].size)) return list.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }));
    if (list.every((r) => isStopId(r.id))) return list.map((r) => Object.assign({ id: r.id }, boxOfStop(r)));
    return [];
}
function alignSelection(how) {
    const g = alignGroup();
    if (g.length < 2) return false;
    const x0 = Math.min(...g.map((b) => b.x)), x1 = Math.max(...g.map((b) => b.x + b.w));
    const y0 = Math.min(...g.map((b) => b.y)), y1 = Math.max(...g.map((b) => b.y + b.h));
    const set = new Map();
    if (how === 'left') g.forEach((b) => set.set(b.id, { x: x0 }));
    else if (how === 'right') g.forEach((b) => set.set(b.id, { x: x1 - b.w }));
    else if (how === 'hcenter') g.forEach((b) => set.set(b.id, { x: Math.round((x0 + x1) / 2 - b.w / 2) }));
    else if (how === 'top') g.forEach((b) => set.set(b.id, { y: y0 }));
    else if (how === 'bottom') g.forEach((b) => set.set(b.id, { y: y1 - b.h }));
    else if (how === 'vcenter') g.forEach((b) => set.set(b.id, { y: Math.round((y0 + y1) / 2 - b.h / 2) }));
    else if (how === 'hspace' || how === 'vspace') {
        if (g.length < 3) return false;
        const pos = how === 'hspace' ? 'x' : 'y', len = how === 'hspace' ? 'w' : 'h';
        const sorted = g.slice().sort((a, b) => a[pos] - b[pos] || (a.id < b.id ? -1 : 1));
        const span = (how === 'hspace' ? x1 - x0 : y1 - y0), used = sorted.reduce((n, b) => n + b[len], 0), gap = (span - used) / (sorted.length - 1);
        let at = how === 'hspace' ? x0 : y0;
        sorted.forEach((b) => { set.set(b.id, { [pos]: Math.round(at) }); at += b[len] + gap; });
    } else return false;
    batch(() => set.forEach((fields, id) => Object.keys(fields).forEach((f) => setF(id, f, fields[f]))));
    return true;
}
function removeSelected() {
    if (state.readOnly || !state.selection.size) return false;
    const ids = Array.from(state.selection).map((e) => e.id);
    batch(() => ids.forEach((id) => { if (recOf(state.doc, id)) removalOps(state.doc, id).forEach(change); }));
    dropMissingSelection();
    render();
    return true;
}
// A copy of each selected screen, decision or element, beside the original.
// A screen is copied with its sizes and elements. Links are not copied: a
// copy starts with no way in or out.
function duplicateSelected() {
    if (state.readOnly) return [];
    const doc = state.doc, made = [];
    const copyOf = (kind, rec, changes) => Object.assign(writeRec(kind, rec), changes);
    batch(() => movingIds().forEach((id) => {
        const kind = kindOfId(id), rec = recOf(doc, id);
        if (kind === 'elements') {
            const nid = nextId('elements');
            if (change({ op: 'add', kind, rec: copyOf(kind, rec, { id: nid, x: rec.x + GRID * 2, y: rec.y + GRID * 2, z: topZ(elementsOf(doc, rec.size)) }) })) made.push(nid);
        } else if (kind === 'blocks') {
            const nid = nextId('blocks');
            if (!change({ op: 'add', kind, rec: copyOf(kind, rec, { id: nid, name: (rec.name || 'Block') + ' copy', y: rec.y + rec.h + 120 }) })) return;
            elementsOf(doc, rec.id).forEach((e) => change({ op: 'add', kind: 'elements', rec: copyOf('elements', e, { id: nextId('elements'), size: nid }) }));
            made.push(nid);
        } else if (kind === 'decisions') {
            const nid = nextId('decisions');
            if (change({ op: 'add', kind, rec: copyOf(kind, rec, { id: nid, y: rec.y + DECISION_H + 80 }) })) made.push(nid);
        } else if (kind === 'screens') {
            const nid = nextId('screens'), box = boxOfStop(rec);
            if (!change({ op: 'add', kind, rec: copyOf(kind, rec, { id: nid, name: (rec.name || 'Screen') + ' copy', y: rec.y + box.h + 160, start: false }) })) return;
            sizesOf(doc, rec.id).forEach((size) => {
                const sid = nextId('sizes');
                change({ op: 'add', kind: 'sizes', rec: copyOf('sizes', size, { id: sid, screen: nid }) });
                elementsOf(doc, size.id).forEach((e) => change({ op: 'add', kind: 'elements', rec: copyOf('elements', e, { id: nextId('elements'), size: sid }) }));
            });
            made.push(nid);
        }
    }));
    if (made.length) { setSelection(made.map((id) => selEntry(kindOfId(id), id))); render(); }
    return made;
}
function selectAll() {
    const doc = state.doc, sel = soleSelected(), screen = sel ? screenOfId(sel.id) : null;
    // With a screen or one of its elements selected: that screen's elements.
    // Otherwise every stop.
    const picks = screen ? elementsOf(doc, drawnOn(screen).id).map((e) => selEntry('elements', e.id)) : [];
    setSelection(picks.length ? picks : doc.screens.concat(doc.decisions).map((s) => selEntry(kindOfId(s.id), s.id)));
    render();
}
// A size's width, height or content height changed from the rail: its
// elements follow by what each is pinned to, in the same step.
function resizeSize(id, field, value) {
    const doc = state.doc, size = recOf(doc, id);
    if (!size) return false;
    const ow = size.w, oh = sizeHeight(size);
    return batch(() => {
        if (!setF(id, field, value)) return false;
        const nw = size.w, nh = sizeHeight(size);
        if (nw !== ow || nh !== oh) elementsOf(doc, id).forEach((e) => { const b = pinnedBox(e, ow, oh, nw, nh); ['x', 'y', 'w', 'h'].forEach((f) => setF(e.id, f, b[f])); });
        return true;
    });
}

function onBoardWheel(ev) {
    ev.preventDefault();
    const r = boardRect();
    if (ev.ctrlKey || ev.metaKey) { zoomAt(Math.exp(-ev.deltaY * 0.01), ev.clientX - r.left, ev.clientY - r.top); return; }
    state.camera.x -= ev.deltaX; state.camera.y -= ev.deltaY;
    drawBoard();
}
function showSize(sizeId) {
    const size = recOf(state.doc, sizeId);
    if (!size) return;
    state.sizeShown[size.screen] = sizeId;
    // An element selected on the size that was on show is no longer on the board.
    setSelection(Array.from(state.selection).filter((e) => { const r = recOf(state.doc, e.id); return !(e.type === 'elements' && r && r.size !== sizeId && (recOf(state.doc, r.size) || {}).screen === size.screen); }));
    if (!state.selection.size) setSelection([selEntry('screens', size.screen)]);
    render();
}

// ---- Fields ----
// A field carries data-id (the record; '' for the document) and data-f (the
// field). Typing changes the document on every key, as one undo step.
function fieldValue(el) {
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return el.value;
    return el.value;
}
function onFieldInput(ev) {
    const el = ev.target;
    // An element's text in the language on show.
    // The first key may add the word and give the element its key; the rail
    // is rebuilt when the field is left, not under the typing.
    if (el.dataset && el.dataset.word) {
        _holdProps = true;
        try { setWord(el.dataset.word, state.lang, el.value); } finally { _holdProps = false; }
        return;
    }
    if (!el.dataset || el.dataset.f === undefined || el.tagName === 'SELECT' || el.type === 'checkbox' || el.hasAttribute('data-lazy')) return;
    const id = el.dataset.id, kind = id ? kindOfId(id) : 'doc', field = el.dataset.f;
    if (el.type === 'number' && el.value.trim() === '') return;
    if (el.hasAttribute('data-url')) {
        const msg = document.querySelector(`[data-url-msg="${id}"]`), problem = urlProblem(el.value);
        if (msg) { msg.textContent = problem; msg.hidden = !problem; }
        if (problem) return;
    }
    typed(kind, id, field, fieldValue(el));
}
function onFieldChange(ev) {
    const el = ev.target;
    // Choices that are a way of looking, not a change to the document.
    if (el.id === 'flowLang') { showLang(el.value); return; }
    if (el.id === 'testBase') { state.base = el.value; render(); return; }
    // An address for one step of a run: used, never saved.
    if (el.id === 'testOnce') { if (state.test) { state.test.once = urlProblem(el.value) ? '' : el.value.trim(); renderTest(); } return; }
    if (el.id === 'walkFrom' || el.id === 'walkTo') { state.walk[el.id === 'walkFrom' ? 'from' : 'to'] = el.value; state.walk.pick = -1; render(); return; }
    if (el.dataset && el.dataset.word) {
        commitTyping();
        setTimeout(() => { if (!$('railProps').contains(document.activeElement)) renderProps(); }, 0);
        return;
    }
    if (!el.dataset || el.dataset.f === undefined) return;
    const id = el.dataset.id, field = el.dataset.f;
    if (el.tagName === 'SELECT' || el.type === 'checkbox') {
        if (field === 'start') setStart(id, el.checked);
        else setF(id, field, fieldValue(el));
        return;
    }
    // A size's own measures change when the field is left, not on each key,
    // so its elements are re-placed once, from the size it really had.
    if (el.hasAttribute('data-lazy')) {
        _holdProps = true;
        try { if (el.value.trim() !== '') resizeSize(id, field, el.value); } finally { _holdProps = false; }
    }
    // Leaving a field ends its typing step and shows the value as it was kept
    // (a width typed as 0 was kept as 1). The rest of the rail is rebuilt only
    // once the focus has left it: rebuilding now would remove the field the
    // focus is on its way to.
    commitTyping();
    const rec = id ? recOf(state.doc, id) : state.doc;
    if (rec && !el.hasAttribute('data-url')) el.value = rec[field];
    setTimeout(() => { if (!$('railProps').contains(document.activeElement)) renderProps(); }, 0);
}

// ---- Buttons ----
function onAct(ev) {
    const b = ev.target.closest('[data-act]');
    if (!b || b.disabled || b.closest('#board')) return;
    const act = b.dataset.act, id = b.dataset.id || '';
    if (act === 'add-el' && _skipTileClick) return;
    if (act === 'new') { openDoc(newDoc(''), false); say('A new workflow. Undo brings back what was here.'); }
    else if (act === 'open') $('filePick').click();
    else if (act === 'save') saveFile();
    else if (act === 'example') { loadSample(); say('An example workflow. Undo brings back what was here.'); enterEditor(); }
    else if (act === 'enter') enterEditor();
    else if (act === 'undo') undo();
    else if (act === 'redo') redo();
    else if (act === 'add-screen') addScreen($('addPreset').value, $('addTemplate').value);
    else if (act === 'add-decision') addDecision();
    else if (act === 'add-el') { if (!b.classList.contains('no')) addFromGrid(b.dataset.type); }
    else if (act === 'add-again') addAgain();
    else if (act === 'lib-wrap') { state.libPinned = !state.libPinned; updateRailWrap(); }
    else if (act === 'board-ink') setBoardInk(nextBoardInk());
    else if (act === 'add-size') addSize(id, $('sizePreset').value);
    else if (act === 'add-link') addLink(id, $('linkTo').value);
    else if (act === 'add-source') addSource();
    else if (act === 'live') { state.liveSure = false; openDlg('liveDlg'); renderLive(); }
    else if (act === 'live-start' || act === 'live-leave' || act === 'live-end') liveAct(act);
    else if (act === 'simple') setSimple(!state.simple);
    else if (act === 'add-base') addBase();
    else if (act === 'test-walk') startRun(walkPaths()[state.walk.pick]);
    else if (act === 'test-case') { const c = testCases(state.doc)[Number(b.dataset.i)]; if (c) startRun(c.path, c.name); }
    else if (act === 'test-open') openRun(id);
    else if (act === 'test-at') { state.test.at = Number(b.dataset.i); state.test.once = ''; render(); }
    else if (act === 'test-mark') markStep(b.dataset.result);
    else if (act === 'test-close') closeRun();
    else if (act === 'export-open') { $('exportMsg').textContent = ''; $('exportLinkOut').hidden = true; renderExport(); openDlg('exportDlg'); }
    else if (act === 'share-open') { $('exportMsg').textContent = ''; $('exportLinkOut').hidden = true; $('exportAs').value = 'link'; renderExport(); openDlg('exportDlg'); }
    else if (act === 'export-share') { const url = $('exportLink').value; if (url && navigator.share) navigator.share({ title: state.doc.name || 'Flow', url }).catch(() => {}); }
    else if (act === 'landing-new') landingNew();
    else if (act === 'export-go') { const c = exportChoice(); if (c.as === 'report') { closeDlg('exportDlg'); openReport(c.what, c.noSources); } else runExport(false); }
    else if (act === 'report-open') openReport('all', false);
    else if (act === 'report-close') { _rp.turn++; closeDlg('reportDlg'); }
    else if (act === 'report-print') printReport();
    else if (act === 'report-download') downloadReport();
    else if (act === 'export-print') runExport(true);
    else if (act === 'export-copy') { const t = $('exportLink'); t.select(); if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => { $('exportMsg').textContent = tr('Copied.'); }, () => {}); }
    else if (act === 'dlg-close') closeDlg(b.dataset.dlg);
    else if (act === 'merge') pickFile(mergeFileFrom);
    else if (act === 'sheet-in') pickFile(sheetFileFrom);
    else if (act === 'pass-go') runUnseal();
    else if (act === 'home') goHome();
    else if (act === 'binder-export') exportBinder();
    else if (act === 'lib-rename') { state.libSure = ''; state.libRename = id; renderLanding(); }
    else if (act === 'lib-duplicate') duplicateCard(id).then((copy) => { if (copy) say(tr('Duplicated as "{name}".', { name: copy.name })); else say('This browser has no room to keep it. Save a copy as a file instead.', true); render(); });
    else if (act === 'lib-merge') openCardMerge(id);
    else if (act === 'merge-into') runCardMerge(id);
    else if (act === 'lib-save') saveCardFile(id).then((ok) => { if (ok) say('Saved a copy as a file.'); });
    else if (act === 'lib-keep') keepWorkflow().then((kept) => { if (kept) say('Kept. It saves itself in this browser from now on.'); render(); });
    else if (act === 'lib-open') (id === state.cardId ? Promise.resolve(true) : openCard(id)).then((ok) => { if (ok) { state.libSure = ''; say('Opened from Your workflows.'); enterEditor(); } });
    else if (act === 'lib-del') { if (state.libSure === id) { state.libSure = ''; libDelete(id).then(() => render()); } else { state.libSure = id; renderLanding(); } }
    else if (act === 'pin-toggle') pinFinding(b.dataset.key);
    else if (act === 'accept-start') { state.accepting = b.dataset.key; renderFindings(); }
    else if (act === 'accept-cancel') { state.accepting = ''; renderFindings(); }
    else if (act === 'accept-save') acceptFinding(b.dataset.key, $('acceptReason').value);
    else if (act === 'view-board') setView('board');
    else if (act === 'view-flow') setView('flow');
    else if (act === 'walk-pick') { state.walk.pick = Number(b.dataset.i); render(); }
    else if (act === 'play') playStart();
    else if (act === 'play-go') playGo(id);
    else if (act === 'play-back') playBack();
    else if (act === 'play-restart') playRestart();
    else if (act === 'play-exit') playExit();
    else if (act === 'show-lang') showLang(id);
    else if (act === 'load-dict') $('dictPick').click();
    else if (act === 'save-dict') saveDictionary(id);
    else if (act === 'add-style') addStyle(b.dataset.kind);
    else if (act === 'add-block') addBlock();
    else if (act === 'make-block') makeBlock();
    else if (act === 'del') removeId(id);
    else if (act === 'del-selected') removeSelected();
    else if (act === 'duplicate') duplicateSelected();
    else if (act === 'align') alignSelection(b.dataset.how);
    else if (act === 'select') selectId(id);
    else if (act === 'show-size') showSize(b.dataset.size);
    else if (act === 'zoom-in') zoomStep(1.25);
    else if (act === 'zoom-out') zoomStep(0.8);
    else if (act === 'fit') fitBoard();
}

// ---- Keys ----
function onKey(ev) {
    const t = ev.target, inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const mod = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase();
    if (mod && key === 's') { ev.preventDefault(); saveFile(); return; }
    // On the landing page the editor's keys do nothing.
    if (state.landing) return;
    // An open dialog owns the keys (Escape closes it by itself).
    if (document.querySelector('dialog[open]')) return;
    // The Simple view changes nothing, so no key of the editor works in it.
    if (state.simple && !state.play) return;
    // A run that is open owns the keys too: Escape leaves it.
    if (state.test) { if (key === 'escape' && !inField) closeRun(); return; }
    // In Play the keys are Play's: Escape leaves, Backspace goes back, Enter
    // presses what has the focus.
    if (state.play) {
        if (key === 'escape') playExit();
        else if (key === 'backspace') { ev.preventDefault(); playBack(); }
        else if (key === 'enter' && t && t.dataset && t.dataset.act === 'play-go') playGo(t.dataset.id);
        return;
    }
    // In the reason for accepting a finding: Enter accepts, Escape gives up.
    if (t && t.id === 'acceptReason') {
        if (key === 'enter') { ev.preventDefault(); acceptFinding(state.accepting, t.value); }
        else if (key === 'escape') { state.accepting = ''; renderFindings(); }
        return;
    }
    if (inField) return;
    if (mod && key === 'z') { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
    if (mod && key === 'y') { ev.preventDefault(); redo(); return; }
    if (mod && key === 'a') { ev.preventDefault(); selectAll(); return; }
    if (mod && key === 'd') { ev.preventDefault(); duplicateSelected(); return; }
    if (mod || ev.altKey) return;
    if (key === 'escape') { if (state.selection.size) { setSelection([]); render(); } return; }
    // A: the element last added, again.
    if (key === 'a' && !ev.shiftKey && lastAddedLabel() && !state.readOnly) { ev.preventDefault(); addAgain(); return; }
    if (!state.selection.size || state.readOnly) return;
    if (key === 'delete' || key === 'backspace') { ev.preventDefault(); removeSelected(); return; }
    const step = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[key];
    const ids = step ? movingIds() : [];
    if (ids.length) {
        ev.preventDefault();
        const by = GRID * (ev.shiftKey ? 4 : 1);
        batch(() => ids.forEach((id) => { const rec = recOf(state.doc, id); setF(id, 'x', rec.x + step[0] * by); setF(id, 'y', rec.y + step[1] * by); }));
    }
}

// ---- Start ----
function boot() {
    let doc = null, readOnly = false;
    try {
        const kept = localStorage.getItem(LIVE_KEY);
        if (kept) { const res = openFileText(kept); if (!res.error) { doc = res.doc; readOnly = res.readOnly; } }
    } catch (e) { /* no storage: start empty */ }
    state.doc = doc || newDoc('');
    state.readOnly = readOnly;

    const svg = $('board');
    svg.addEventListener('pointerdown', onBoardDown);
    svg.addEventListener('pointermove', onBoardMove);
    svg.addEventListener('pointerup', onBoardUp);
    svg.addEventListener('pointercancel', onBoardUp);
    svg.addEventListener('wheel', onBoardWheel, { passive: false });
    document.addEventListener('click', onAct);
    $('palette').addEventListener('pointerdown', onTileDown);
    document.addEventListener('pointermove', onTileMove);
    document.addEventListener('pointerup', onTileUp);
    document.addEventListener('pointercancel', onTileUp);
    document.addEventListener('input', onFieldInput);
    document.addEventListener('change', onFieldChange);
    document.addEventListener('keydown', onKey);
    $('filePick').addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (file) file.text().then(openAnyFile);
    });
    $('dictPick').addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (file) file.text().then((text) => openDictionaryFrom(file.name, text));
    });
    $('exportDlg').addEventListener('change', renderExport);
    $('reportOpts').addEventListener('change', onReportChange);
    window.addEventListener('resize', () => { if ($('reportDlg').open) fitReportFrame(); });
    // A file let go over the start page's target is opened like a picked one.
    const dropBox = $('landingDrop');
    dropBox.addEventListener('dragover', (ev) => { ev.preventDefault(); dropBox.classList.add('drag'); });
    dropBox.addEventListener('dragleave', () => dropBox.classList.remove('drag'));
    dropBox.addEventListener('drop', (ev) => {
        ev.preventDefault(); dropBox.classList.remove('drag');
        const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (file) file.text().then(openAnyFile);
    });
    // A card's name being typed: Enter keeps it, Esc gives up, a press elsewhere keeps it.
    $('landingCards').addEventListener('keydown', (ev) => {
        if (!ev.target.classList || !ev.target.classList.contains('landing-card-rename')) return;
        if (ev.key === 'Enter') { ev.preventDefault(); endCardRename(true); }
        else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); endCardRename(false); }
    });
    $('landingCards').addEventListener('focusout', (ev) => { if (ev.target.classList && ev.target.classList.contains('landing-card-rename') && state.libRename) endCardRename(true); });
    $('landingName').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); landingNew(); } });
    $('passInput').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); runUnseal(); } });
    // Whether a folded list is open is remembered across redraws.
    document.addEventListener('toggle', (ev) => {
        if (ev.target && ev.target.id === 'acceptedList') state.acceptedOpen = ev.target.open;
        if (ev.target && ev.target.classList && ev.target.classList.contains('f-class') && ev.target.isConnected) { if (ev.target.open) state.clsShut.delete(ev.target.dataset.cls); else state.clsShut.add(ev.target.dataset.cls); }
        if (ev.target && ev.target.id === 'casesList') state.casesOpen = ev.target.open;
    }, true);
    window.addEventListener('resize', drawBoard);

    buildPalette();
    try { setBoardInk(localStorage.getItem(INK_KEY) || ''); } catch (e) { setBoardInk(''); }
    // The kept workflow this one is, if it was one before the reload.
    try { state.cardId = (!readOnly && doc && localStorage.getItem(LIB_ID_KEY)) || ''; } catch (e) { state.cardId = ''; }
    if (state.cardId) libGet(state.cardId).then((card) => { if (!card) setCard(''); });
    $('keptTag').hidden = !state.cardId;
    state.simple = simpleAtStart();
    showLanding(landingAtStart());
    if (state.simple) { state.viewBefore = state.view; state.view = 'flow'; }
    applyStaticI18n();
    render();
    fitBoard();
    // A live room, when this page is served by a Flow server.
    liveBoot();
    // A sealed link: ask for its passphrase.
    if (takeSealFromAddress()) openDlg('passDlg');
    // A plain link: the address builds the workflow.
    const plain = takePlainFromAddress();
    if (plain) runPlain(plain);
    window.addEventListener('hashchange', onHashChange);
    window.dispatchEvent(new Event('flow:ready'));
}
boot();
