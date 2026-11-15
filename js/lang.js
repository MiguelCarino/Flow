// The languages of the workflow that is open: its dictionaries, and which
// one the board shows.
//
// This is not Flow's own language. Flow's menus and labels are changed by the
// navbar's language setting; the drawn interface is changed here. The two
// never touch: choosing Spanish for the workflow leaves Flow as it was, and
// the other way round.
//
// An element's own text is in the document's language (doc.lang). An element
// with a key takes its text in another language from that language's
// dictionary: the words whose key is the element's.

// Every language's words by key, built once per saved change.
let _words = null, _wordsSeq = -1;
function wordMap() {
    if (_words && _wordsSeq === state.seq) return _words;
    _words = new Map(); _wordsSeq = state.seq;
    state.doc.words.forEach((w) => {
        if (!_words.has(w.lang)) _words.set(w.lang, new Map());
        _words.get(w.lang).set(w.key, w);
    });
    return _words;
}
const wordOf = (langId, key) => { const m = wordMap().get(langId); return m ? m.get(key) : undefined; };
// What an element says in the language on show. No key, or no word for it:
// its own text, so a half-translated workflow still reads.
function shownText(e) {
    if (!state.lang || !e.key) return e.text;
    const w = wordOf(state.lang, e.key);
    return w && w.text !== '' ? w.text : e.text;
}
const langLabel = (l) => (l.name || l.code);

// A key for an element that has none: where it is, then what it is
// (cart.pay), made different from every key already on an element.
function autoKey(el) {
    const doc = state.doc, at = placeOf(el), taken = keysInUse(doc);
    const where = at ? slugKey(at.holder.name) : '', what = slugKey(el.name || el.text) || el.type;
    const base = (where ? where + '.' : '') + what;
    let key = base, n = 2;
    while (taken.has(key)) key = base + '_' + n++;
    return key;
}
// What an element says in a language, set from its Text field while that
// language is on show. The element gets a key if it had none.
function setWord(elId, langId, text) {
    const doc = state.doc, el = recOf(doc, elId), lang = recOf(doc, langId);
    if (!el || !lang) return false;
    const word = el.key ? wordOf(langId, el.key) : null;
    if (word) return typed('words', word.id, 'text', text);
    return batch(() => {
        const key = el.key || autoKey(el);
        if (!el.key) setF(elId, 'key', key);
        return change({ op: 'add', kind: 'words', rec: { id: nextId('words'), lang: langId, key, text } });
    });
}

function addLang(code, name = '') {
    const doc = state.doc, c = fCode(code, '');
    if (!c) return '';
    const have = doc.langs.find((l) => l.code.toLowerCase() === c.toLowerCase());
    if (have) return have.id;
    const id = nextId('langs');
    return change({ op: 'add', kind: 'langs', rec: { id, code: c, name } }) ? id : '';
}
function showLang(langId) {
    state.lang = langId && recOf(state.doc, langId) ? langId : '';
    render();
}

// A dictionary loaded into the workflow, as one step.
//
// For the document's own language: an element with a key in the dictionary
// takes its text; an element with no key whose text is one of the
// dictionary's takes that key. So loading the interface's own en.json names
// every element the dictionary already knows.
//
// For any other language: its words are added or changed; the language is
// added if it is new. Keys no element uses are kept: the dictionary is the
// whole interface's, and the workflow may not draw all of it yet.
// -> { lang, added, changed, matched, unused }
function loadDictionary(code, data) {
    const doc = state.doc, dict = flattenDictionary(data), c = fCode(code, '');
    const res = { lang: '', added: 0, changed: 0, matched: 0, unused: 0, error: '' };
    if (!c) { res.error = 'That is not a language code.'; return res; }
    if (!dict.size) { res.error = 'This file has no texts in it.'; return res; }
    if (state.readOnly) { res.error = 'This workflow is open to read only.'; return res; }
    const own = c.toLowerCase() === doc.lang.toLowerCase();
    batch(() => {
        if (own) {
            const byText = new Map();
            dict.forEach((text, key) => { if (!byText.has(text)) byText.set(text, key); });
            doc.elements.forEach((e) => {
                if (e.type === 'block') return;
                if (e.key && dict.has(e.key)) { if (setF(e.id, 'text', dict.get(e.key))) res.changed++; }
                else if (!e.key && e.text && byText.has(e.text)) { if (setF(e.id, 'key', byText.get(e.text))) res.matched++; }
            });
        } else {
            res.lang = addLang(c);
            dict.forEach((text, key) => {
                const word = doc.words.find((w) => w.lang === res.lang && w.key === key);
                if (!word) { if (change({ op: 'add', kind: 'words', rec: { id: nextId('words'), lang: res.lang, key, text } })) res.added++; }
                else if (setF(word.id, 'text', text)) res.changed++;
            });
        }
    });
    const used = keysInUse(doc);
    dict.forEach((_, key) => { if (!used.has(key)) res.unused++; });
    return res;
}
// The language a dictionary file is in, read from its name: es.json,
// messages_pt-BR.json, locale.zh-Hans.json.
function langOfFileName(name) {
    const m = /(?:^|[._-])([a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})?)\.json$/.exec(String(name || ''));
    return m ? fCode(m[1], '') : '';
}
// A dictionary as a file: flat, keys in order.
function dictionaryText(langId) {
    return JSON.stringify(Object.fromEntries(dictionaryOf(state.doc, langId)), null, 2) + '\n';
}
function saveDictionary(langId) {
    const lang = langId ? recOf(state.doc, langId) : null, code = lang ? lang.code : state.doc.lang;
    saveBlob(new Blob([dictionaryText(langId)], { type: 'application/json' }), code + '.json');
    say(tr('Saved the dictionary as {x}.', { x: code + '.json' }));
}
function openDictionaryFrom(name, text) {
    const code = langOfFileName(name);
    if (!code) { say('Name the file after its language, like es.json, so Flow knows which one it is.', true); return null; }
    let data;
    try { data = JSON.parse(text); } catch (e) { say('This file is not JSON.', true); return null; }
    const res = loadDictionary(code, data);
    if (res.error) { say(res.error, true); return res; }
    say(res.lang
        ? tr('{x}: {n} texts added, {n2} changed. {n3} of its keys are on no element yet.', { x: code, n: res.added, n2: res.changed, n3: res.unused })
        : tr('{x} is the workflow\'s own language: {n} elements were given their key, {n2} texts changed.', { x: code, n: res.matched, n2: res.changed }));
    render();
    return res;
}

// ---- In the rail ----
function langsHtml() {
    const doc = state.doc, used = keysInUse(doc);
    let s = '<div class="pf-group"><div class="pf-head">Languages</div>'
        + '<p class="pf-note">The languages of the interface you are drawing. Give elements a key and load a dictionary, and the whole workflow can be shown in that language. This is separate from the language of Flow itself.</p>';
    s += pf('Written in', `<input class="input" type="text" data-id="" data-f="lang" value="${esc(doc.lang)}" placeholder="en" data-raw autocomplete="off" spellcheck="false"${ro()}>`);
    doc.langs.forEach((l) => {
        const have = Array.from(used).filter((k) => { const w = wordOf(l.id, k); return w && w.text !== ''; }).length;
        s += `<div class="size-card" data-lang="${l.id}"><div class="pf-inline">`
            + `<input class="input code" type="text" data-id="${l.id}" data-f="code" value="${esc(l.code)}" aria-label="Language code" autocomplete="off" spellcheck="false"${ro()}>`
            + inText(l.id, 'name', l.name, 'placeholder="Español" aria-label="Language name"')
            + actBtn('del', '✕', `data-id="${l.id}" title="Remove this language and its dictionary" aria-label="Remove this language"`) + '</div>'
            + `<p class="pf-note" data-raw>${esc(tr('{n} of {n2} keys have a text.', { n: have, n2: used.size }))}</p>`
            + `<div class="pf-inline"><button type="button" class="btn btn-ghost sm" data-act="show-lang" data-id="${state.lang === l.id ? '' : l.id}">${state.lang === l.id ? esc(tr('Show the original')) : esc(tr('Show the workflow in it'))}</button>`
            + `<button type="button" class="btn btn-ghost sm" data-act="save-dict" data-id="${l.id}">Save</button></div></div>`;
    });
    if (!state.readOnly) s += `<div class="pf-inline">${actBtn('load-dict', 'Load a dictionary…', 'title="A JSON file named after its language, like es.json"')}</div>`;
    s += `<div class="pf-inline"><button type="button" class="btn btn-ghost sm" data-act="save-dict" data-id="" data-raw>${esc(tr('Save {x}', { x: doc.lang + '.json' }))}</button></div>`;
    return s + '</div>';
}
// The switch over the board. Shown once there is a language to switch to.
function renderLangBar() {
    const doc = state.doc, bar = $('langBar'), list = $('flowLang');
    if (state.lang && !recOf(doc, state.lang)) state.lang = '';
    bar.hidden = !doc.langs.length;
    const options = `<option value="">${esc(t('{code} (as written)', { code: doc.lang }))}</option>` + doc.langs.map((l) => `<option value="${l.id}">${esc(langLabel(l))}</option>`).join('');
    if (list.dataset.for !== options) { list.innerHTML = options; list.dataset.for = options; }
    list.value = state.lang;
}
