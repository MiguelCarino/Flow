// Your workflows: the ones kept in this browser.
//
// A card is { id, name, doc (the file's envelope), created, updated }. Cards
// live in IndexedDB, or in localStorage where IndexedDB is not there (some
// private windows). Nothing here leaves the browser.
//
// A workflow is kept only when its owner says so. Once kept, every change is
// written to its card (noteChanged), so there is no Save to forget.

const LIB_DB = 'flow_library', LIB_STORE = 'cards', LIB_FALLBACK = 'flow_library', LIB_ID_KEY = 'flow_live_card';
let _libDb = null, _libDbTried = false;
function libDb() {
    if (_libDbTried) return Promise.resolve(_libDb);
    _libDbTried = true;
    return new Promise((done) => {
        let req;
        try { req = window.indexedDB ? indexedDB.open(LIB_DB, 1) : null; } catch (e) { req = null; }
        if (!req) { done(null); return; }
        req.onupgradeneeded = () => req.result.createObjectStore(LIB_STORE, { keyPath: 'id' });
        req.onsuccess = () => { _libDb = req.result; done(_libDb); };
        req.onerror = req.onblocked = () => done(null);
    });
}
const idbDone = (req) => new Promise((ok, bad) => { req.onsuccess = () => ok(req.result); req.onerror = () => bad(req.error); });
const fallbackCards = () => { try { return JSON.parse(localStorage.getItem(LIB_FALLBACK) || '[]'); } catch (e) { return []; } };
const fallbackWrite = (cards) => { try { localStorage.setItem(LIB_FALLBACK, JSON.stringify(cards)); return true; } catch (e) { return false; } };

// -> every card, the most recently changed first.
async function libList() {
    const db = await libDb();
    const cards = db ? await idbDone(db.transaction(LIB_STORE).objectStore(LIB_STORE).getAll()) : fallbackCards();
    return cards.sort((a, b) => b.updated - a.updated);
}
async function libGet(id) {
    const db = await libDb();
    return db ? (await idbDone(db.transaction(LIB_STORE).objectStore(LIB_STORE).get(id))) || null : fallbackCards().find((c) => c.id === id) || null;
}
async function libPut(card) {
    const db = await libDb();
    if (db) { await idbDone(db.transaction(LIB_STORE, 'readwrite').objectStore(LIB_STORE).put(card)); return true; }
    return fallbackWrite(fallbackCards().filter((c) => c.id !== card.id).concat(card));
}
async function libDelete(id) {
    const db = await libDb();
    if (db) await idbDone(db.transaction(LIB_STORE, 'readwrite').objectStore(LIB_STORE).delete(id));
    else fallbackWrite(fallbackCards().filter((c) => c.id !== id));
    if (state.cardId === id) setCard('');
}

// Which card the open workflow is, remembered across a reload.
function setCard(id) {
    state.cardId = id || '';
    try { if (id) localStorage.setItem(LIB_ID_KEY, id); else localStorage.removeItem(LIB_ID_KEY); } catch (e) { /* no storage */ }
    const tag = $('keptTag');
    if (tag) tag.hidden = !state.cardId;
}
const cardOf = (id, created) => ({ id, name: state.doc.name || 'Untitled', doc: fileEnvelope(state.doc), created: created || Date.now(), updated: Date.now() });
// Keep the open workflow. From now on it saves itself.
async function keepWorkflow() {
    // A live room's workflow is the room's; a copy of it is saved as a file.
    if (state.cardId || state.readOnly || state.live) return state.cardId;
    const id = 'card_' + Date.now().toString(36) + idRandom();
    if (!await libPut(cardOf(id))) { say('This browser has no room to keep it. Save a copy as a file instead.', true); return ''; }
    setCard(id);
    return id;
}
// A kept workflow changed: write its card, a moment after the last change.
let _cardTimer = null, _cardWrite = Promise.resolve();
function noteChanged() {
    if (!state.cardId || state.readOnly) return;
    clearTimeout(_cardTimer);
    _cardTimer = setTimeout(flushCard, 400);
}
function flushCard() {
    clearTimeout(_cardTimer); _cardTimer = null;
    const id = state.cardId;
    if (!id) return _cardWrite;
    const card = cardOf(id);
    _cardWrite = _cardWrite.then(async () => { const was = await libGet(id); if (was) card.created = was.created; await libPut(card); }).catch(() => {});
    return _cardWrite;
}
// Open a kept workflow. The one that was open is safe: it is either kept, or
// it comes back with Undo... which a fresh history cannot do, so an unkept
// workflow with something in it is kept first.
async function openCard(id) {
    const card = await libGet(id);
    if (!card) return false;
    const res = openFileText(JSON.stringify(card.doc));
    if (res.error) { say(res.error, true); return false; }
    if (state.live) liveLeave();
    await flushCard();
    if (!state.cardId && !state.readOnly && KINDS.some((k) => state.doc[k].length)) await keepWorkflow();
    await flushCard();
    loadDoc(res.doc, res.readOnly);
    setCard(res.readOnly ? '' : id);
    return true;
}

async function renderLibrary() {
    const box = $('libList'), cards = await libList();
    const n = (doc, k) => (doc && doc.doc && Array.isArray(doc.doc[k]) ? doc.doc[k].length : 0);
    box.innerHTML = cards.length ? cards.map((c) => `<div class="lib-card${c.id === state.cardId ? ' on' : ''}" data-card="${esc(c.id)}">`
        + `<div class="lib-main"><p class="lib-name">${esc(c.name || tr('Untitled'))}${c.id === state.cardId ? ` <span class="size-on">${esc(tr('open'))}</span>` : ''}</p>`
        + `<p class="pf-note" data-raw>${esc([tn(n(c.doc, 'screens'), '1 screen', '{n} screens'), tn(n(c.doc, 'links'), '1 link', '{n} links')].join(', ') + '. ' + tr('Changed {x}.', { x: new Date(c.updated).toLocaleString() }))}</p></div>`
        + `<div class="lib-acts">${c.id === state.cardId ? '' : `<button type="button" class="btn btn-ghost sm" data-act="lib-open" data-id="${esc(c.id)}">Open</button>`}`
        + `<button type="button" class="btn btn-ghost sm danger" data-act="lib-del" data-id="${esc(c.id)}">Delete</button></div></div>`).join('')
        : '<p class="pf-note">Nothing is kept yet. A workflow you keep saves itself here on every change, in this browser only.</p>';
    translateChrome(box);
    $('libKeep').hidden = !!state.cardId || state.readOnly || !!state.live;
    $('libKeptNote').hidden = !state.cardId;
}
