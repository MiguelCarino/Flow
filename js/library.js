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
    const keep = $('keepMenu');
    if (keep) keep.hidden = !!state.cardId || state.readOnly || !!state.live;
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

// ---- The binder ----
// Every kept workflow in one file: to keep safe, or to move to another
// browser. A binder is opened like any file (openAnyFile, js/app.js) and its
// workflows are added to the ones kept here; one that is here already, the
// same to the letter, is not added twice.
//
//   { kind: 'flowbinder', version: 1, made, workflows: [ a file's envelope, ... ] }
const BINDER_KIND = 'flowbinder';
const isBinder = (data) => !!data && typeof data === 'object' && data.kind === BINDER_KIND && Array.isArray(data.workflows);
async function binderEnvelope() {
    await flushCard();
    const cards = await libList();
    return { kind: BINDER_KIND, version: 1, made: new Date().toISOString(), workflows: cards.map((c) => c.doc) };
}
async function exportBinder() {
    const env = await binderEnvelope();
    if (!env.workflows.length) { say('There is no kept workflow to back up yet.', true); return null; }
    const name = `Flow binder ${env.made.slice(0, 10)}.flowbinder.json`;
    saveBlob(new Blob([JSON.stringify(env, null, 2) + '\n'], { type: 'application/json' }), name);
    say(tr('Saved {n} as {x}.', { n: tn(env.workflows.length, '1 workflow', '{n} workflows'), x: name }));
    return { name, count: env.workflows.length };
}
// -> { added, same, bad }: how many were added, were here already, or were not workflows.
async function importBinder(data) {
    const out = { added: 0, same: 0, bad: 0 };
    const have = new Set((await libList()).map((c) => JSON.stringify(c.doc && c.doc.doc)));
    for (const env of data.workflows) {
        const res = openFileText(JSON.stringify(env));
        if (res.error || res.part) { out.bad++; continue; }
        // A newer Flow's workflow is kept as it came; this build would trim it.
        const kept = res.readOnly ? env : fileEnvelope(res.doc), text = JSON.stringify(kept.doc);
        if (have.has(text)) { out.same++; continue; }
        const now = Date.now();
        if (!await libPut({ id: 'card_' + now.toString(36) + idRandom(), name: (kept.doc && kept.doc.name) || kept.name || 'Untitled', doc: kept, created: now, updated: now })) { out.bad++; continue; }
        have.add(text); out.added++;
    }
    return out;
}
// One kept workflow as a file of its own.
async function saveCardFile(id) {
    if (id === state.cardId) await flushCard();
    const card = await libGet(id);
    if (!card) return false;
    saveBlob(new Blob([JSON.stringify(card.doc, null, 2) + '\n'], { type: 'application/json' }), safeName(card.name) + '.flow.json');
    return true;
}
