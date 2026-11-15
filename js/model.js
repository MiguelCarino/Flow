// The document and the rules that change it. No DOM in this file.
//
// A document is flat lists of records. Every record has an id of its own and
// refers to others by id, never by position in a list:
//
//   screens     a stop in the workflow that the user sees
//   sizes       one drawing of a screen at one width and height
//   elements    a control or a piece of content drawn on a size
//   decisions   a stop that is a question, with a branch per answer
//   links       a way from one stop to another, and what takes the user there
//   sources     an outside address where the real work is kept
//   blocks      a group of elements drawn once and placed on many screens
//   styles      a named colour or text size that elements take their look from
//   langs       a language the drawn interface is written in, besides its first
//   words       one text of one language's dictionary: a key and what it says
//   accepts     a finding someone accepted, and why
//   pins        a finding someone marked to come back to
//   bases       a base address the screens' live addresses hang off (staging)
//   runs        one test of one way through the workflow against the real thing
//   steps       one screen of a run: what was expected, and whether it was so
//
// The lists are flat and the order of drawing is a field (z) so that two
// people can change the same document at once later: a change names one
// record and one field, and never depends on where a record sits in a list.

const DOC_VERSION = 1;
const GRID = 8;
const KINDS = ['screens', 'sizes', 'elements', 'decisions', 'links', 'sources', 'blocks', 'styles', 'langs', 'words', 'accepts', 'pins', 'bases', 'runs', 'steps'];
const PREFIX = { screens: 'scr', sizes: 'siz', elements: 'el', decisions: 'dec', links: 'lnk', sources: 'src', blocks: 'blk', styles: 'sty', langs: 'lng', words: 'wrd', accepts: 'acc', pins: 'pin', bases: 'bas', runs: 'run', steps: 'stp' };
const KIND_OF_PREFIX = Object.fromEntries(Object.entries(PREFIX).map(([k, p]) => [p, k]));
const DECISION_W = 280, DECISION_H = 160;

const SCREEN_STATUS = ['drawn', 'designed', 'built'];
const SIZE_INPUT = ['touch', 'pointer', 'remote'];
const SIZE_DISTANCE = ['near', 'far'];
const ELEMENT_TYPES = ['box', 'text', 'heading', 'link', 'image', 'icon', 'avatar', 'divider',
    'button', 'input', 'textarea', 'select', 'checkbox', 'radio', 'toggle', 'slider',
    'card', 'list', 'table', 'topbar', 'tabbar', 'tabs', 'chip', 'progress', 'alert',
    // One placing of a block (its `block` field says which).
    'block'];
const STYLE_KINDS = ['color', 'text'];
const STYLE_WEIGHTS = [400, 500, 600, 700];
// What an element holds on to when its screen changes size, across and down:
// one edge, both edges (it stretches), the centre, or its share of the screen.
const PIN_H = ['left', 'right', 'both', 'center', 'scale'];
const PIN_V = ['top', 'bottom', 'both', 'center', 'scale'];
const LINK_KINDS = ['action', 'system', 'auto', 'back'];
const SOURCE_KINDS = ['vector', 'code', 'board', 'other'];
const STEP_RESULTS = ['', 'pass', 'fail', 'skip'];

// ---- Ids ----
// Opaque: a prefix, the time, a counter and four random characters, so two
// browsers adding at the same moment cannot mint the same id. Tests fix the
// clock (withFixedIds) to get ids they can predict.
let _idSeq = 0, _idClock = null;
const idRandom = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => (n % 36).toString(36)).join('');
const nextId = (kind) => (_idClock !== null
    ? `${PREFIX[kind]}_${_idClock.toString(36)}${(_idSeq++).toString(36)}`
    : `${PREFIX[kind]}_${Date.now().toString(36)}${(_idSeq++).toString(36)}${idRandom()}`);
function withFixedIds(fn, clock = 1) {
    const was = [_idClock, _idSeq];
    _idClock = clock; _idSeq = 0;
    try { return fn(); } finally { [_idClock, _idSeq] = was; }
}
const ID_RE = /^[a-z]{2,3}_[a-z0-9]{2,40}$/;
// -> which list an id belongs to, read from its prefix; '' for no id at all.
const kindOfId = (id) => (typeof id === 'string' && KIND_OF_PREFIX[id.split('_')[0]]) || '';
const isStopId = (id) => { const k = kindOfId(id); return k === 'screens' || k === 'decisions'; };

const cloneData = (v) => JSON.parse(JSON.stringify(v));
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const snap = (n) => Math.round(n / GRID) * GRID;

// ---- Outside addresses ----
// A source is only ever pointed at: Flow never fetches it. An address is kept
// only when it is a plain http(s) one, so a saved document cannot carry a
// javascript: or data: link that runs when someone clicks it.
function safeUrl(v) {
    if (typeof v !== 'string') return '';
    const t = v.trim().slice(0, 2000);
    if (!t) return '';
    try {
        const u = new URL(t);
        return (u.protocol === 'https:' || u.protocol === 'http:') ? t : '';
    } catch (e) { return ''; }
}
// -> why an address someone typed is not kept, or '' when it is fine.
function urlProblem(v) {
    const t = String(v || '').trim();
    if (!t) return '';
    if (!safeUrl(t)) return 'Only http and https addresses are kept.';
    return '';
}
// An address that seems to carry a key. Anyone who gets the file gets the key.
const URL_SECRET_RE = /[?&#](access_?token|token|key|api_?key|secret|password|pwd|sig|signature|auth)=|:\/\/[^/@\s]+:[^/@\s]+@/i;
const urlCarriesSecret = (v) => URL_SECRET_RE.test(String(v || ''));

// ---- Fields ----
// Every field of every kind: [how a value is made valid, the value when
// absent]. A value read from a file, typed in a field or sent by someone else
// goes through here, so the document only ever holds what these allow.
// Only a number, or text that is one, counts: null, '' and true do not.
const toNumber = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
const fStr = (max) => (v) => (typeof v === 'string' ? v.slice(0, max) : '');
const fInt = (min, max) => (v, d) => {
    const n = toNumber(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};
const fNum = (min, max) => (v, d) => {
    const n = toNumber(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};
const fOne = (list) => (v) => (list.includes(v) ? v : list[0]);
const fBool = (v) => v === true;
const fColor = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const fWeight = (v, d) => (STYLE_WEIGHTS.includes(Number(v)) && typeof v !== 'boolean' ? Number(v) : d);
// A language code as dictionaries are named: es, pt-BR, zh-Hans.
const fCode = (v, d) => (typeof v === 'string' && /^[a-z]{2,3}([-_][a-z0-9]{2,8})*$/i.test(v.trim()) ? v.trim().replace(/_/g, '-') : d);
// A dictionary key: no spaces, as code writes them (cart.pay, CART_PAY).
const fKey = (v) => (typeof v === 'string' ? v.trim().replace(/\s+/g, '_').slice(0, 120) : '');
const fRef = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : '');
const POS = fInt(-1000000, 1000000);
const LEN = fInt(1, 20000);
const Z = fNum(-1e9, 1e9);

const FIELDS = {
    screens: {
        name: [fStr(80), ''], x: [POS, 0], y: [POS, 0],
        start: [fBool, false], end: [fBool, false],
        // stub: in a part of a workflow, a stop that was left out and is here
        // only so the links to it still have somewhere to point.
        stub: [fBool, false],
        status: [fOne(SCREEN_STATUS), 'drawn'],
        path: [fStr(300), ''], note: [fStr(2000), ''],
        source: [fRef, ''], at: [fStr(300), '']
    },
    sizes: {
        screen: [fRef, ''], name: [fStr(40), ''],
        w: [LEN, 390], h: [LEN, 844], contentH: [fInt(0, 100000), 0],
        input: [fOne(SIZE_INPUT), 'touch'], distance: [fOne(SIZE_DISTANCE), 'near'],
        z: [Z, 0]
    },
    elements: {
        size: [fRef, ''], type: [fOne(ELEMENT_TYPES), 'box'],
        name: [fStr(80), ''], text: [fStr(2000), ''],
        x: [POS, 0], y: [POS, 0], w: [LEN, 96], h: [LEN, 48],
        fs: [fInt(6, 400), 16],
        on: [fBool, false], value: [fInt(0, 100), 50],
        pinH: [fOne(PIN_H), 'left'], pinV: [fOne(PIN_V), 'top'],
        block: [fRef, ''], fill: [fRef, ''], ink: [fRef, ''], textStyle: [fRef, ''],
        key: [fKey, ''],
        z: [Z, 0], source: [fRef, ''], at: [fStr(300), '']
    },
    decisions: {
        name: [fStr(120), ''], x: [POS, 0], y: [POS, 0], note: [fStr(2000), ''], stub: [fBool, false]
    },
    links: {
        from: [fRef, ''], fromEl: [fRef, ''], to: [fRef, ''],
        kind: [fOne(LINK_KINDS), 'action'],
        label: [fStr(120), ''], cond: [fStr(120), ''], note: [fStr(2000), ''],
        source: [fRef, ''], at: [fStr(300), '']
    },
    sources: {
        kind: [fOne(SOURCE_KINDS), 'vector'], label: [fStr(80), ''],
        url: [safeUrl, ''], note: [fStr(2000), '']
    },
    blocks: {
        name: [fStr(80), ''], x: [POS, 0], y: [POS, 0], w: [LEN, 240], h: [LEN, 120]
    },
    styles: {
        kind: [fOne(STYLE_KINDS), 'color'], name: [fStr(60), ''],
        color: [fColor, '#0f172a'], fs: [fInt(6, 400), 16], weight: [fWeight, 400]
    },
    langs: {
        code: [fCode, 'xx'], name: [fStr(40), '']
    },
    words: {
        lang: [fRef, ''], key: [fKey, ''], text: [fStr(2000), '']
    },
    // finding: the finding's key, the check and the record it is about
    // ('dead-end:scr_...'), as js/diagnostics.js makes it.
    accepts: {
        finding: [fStr(200), ''], reason: [fStr(500), '']
    },
    pins: {
        finding: [fStr(200), ''], note: [fStr(500), '']
    },
    bases: {
        name: [fStr(40), ''], url: [safeUrl, '']
    },
    // at: when the run was started, in milliseconds since 1970.
    runs: {
        name: [fStr(120), ''], base: [fRef, ''], at: [fInt(0, 8640000000000000), 0]
    },
    // name and via are written down when the run starts (what the screen was
    // called, and what led to it), so a run still reads after the workflow
    // has changed or the screen is gone.
    steps: {
        run: [fRef, ''], n: [fInt(0, 10000), 0], stop: [fRef, ''],
        name: [fStr(80), ''], via: [fStr(400), ''],
        result: [fOne(STEP_RESULTS), ''], note: [fStr(1000), '']
    }
};
// The document's own fields. lang: the language the elements' own text is
// written in; the other languages are in langs, their texts in words.
const DOC_FIELDS = { name: [fStr(120), ''], lang: [fCode, 'en'] };

const fieldSpec = (kind, field) => (kind === 'doc' ? DOC_FIELDS[field] : FIELDS[kind] && FIELDS[kind][field]) || null;
const normField = (kind, field, value) => {
    const spec = fieldSpec(kind, field);
    return spec[0](value, spec[1]);
};

// A record as the document holds it: every field present and valid.
function readRec(kind, raw) {
    const rec = { id: raw.id };
    for (const [field, spec] of Object.entries(FIELDS[kind])) rec[field] = spec[0](raw[field], spec[1]);
    return rec;
}
// A record as a file holds it: the id and the fields that are not at their
// usual value, so a file says only what someone decided.
function writeRec(kind, rec) {
    const out = { id: rec.id };
    for (const [field, spec] of Object.entries(FIELDS[kind])) if (rec[field] !== spec[1]) out[field] = rec[field];
    return out;
}

// ---- Documents ----
function newDoc(name = '') {
    const doc = { v: DOC_VERSION, name, lang: DOC_FIELDS.lang[1] };
    KINDS.forEach((k) => { doc[k] = []; });
    return doc;
}

// Any value -> a document this build can hold. Records with no usable id, or
// an id used twice, are dropped; then anything that points at a record that
// is not there is dropped or cleared (repairRefs).
function normalizeDoc(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const doc = newDoc(DOC_FIELDS.name[0](src.name));
    doc.lang = DOC_FIELDS.lang[0](src.lang, DOC_FIELDS.lang[1]);
    const seen = new Set();
    KINDS.forEach((kind) => {
        (Array.isArray(src[kind]) ? src[kind] : []).forEach((r) => {
            if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !ID_RE.test(r.id)) return;
            if (kindOfId(r.id) !== kind || seen.has(r.id)) return;
            seen.add(r.id);
            doc[kind].push(readRec(kind, r));
        });
    });
    repairRefs(doc);
    return doc;
}

function repairRefs(doc) {
    const ids = (kind) => new Set(doc[kind].map((r) => r.id));
    const screens = ids('screens');
    doc.sizes = doc.sizes.filter((s) => screens.has(s.screen));
    const sizes = ids('sizes'), blocks = ids('blocks');
    // An element sits on a size or inside a block. A placing of a block needs
    // its block, and cannot sit inside a block (a block inside itself has no end).
    doc.elements = doc.elements.filter((e) => (sizes.has(e.size) || blocks.has(e.size))
        && (e.type !== 'block' || (blocks.has(e.block) && sizes.has(e.size))));
    const styles = new Map(doc.styles.map((s) => [s.id, s.kind]));
    doc.elements.forEach((e) => {
        if (e.type !== 'block') e.block = '';
        if (styles.get(e.fill) !== 'color') e.fill = '';
        if (styles.get(e.ink) !== 'color') e.ink = '';
        if (styles.get(e.textStyle) !== 'text') e.textStyle = '';
    });
    const elements = ids('elements'), decisions = ids('decisions'), sources = ids('sources');
    const stop = (id) => screens.has(id) || decisions.has(id);
    doc.links = doc.links.filter((l) => stop(l.from) && stop(l.to));
    doc.links.forEach((l) => { if (l.fromEl && !elements.has(l.fromEl)) l.fromEl = ''; });
    ['screens', 'elements', 'links'].forEach((kind) => doc[kind].forEach((r) => {
        if (r.source && !sources.has(r.source)) r.source = '';
    }));
    // A word belongs to a language and has a key; one text per language and key.
    const langs = ids('langs'), had = new Set();
    doc.words = doc.words.filter((w) => {
        const k = w.lang + '\n' + w.key;
        if (!langs.has(w.lang) || !w.key || had.has(k)) return false;
        had.add(k);
        return true;
    });
    // A step belongs to a run; a run may outlive its base and its screens.
    const bases = ids('bases'), runs = ids('runs');
    doc.runs.forEach((r) => { if (r.base && !bases.has(r.base)) r.base = ''; });
    doc.steps = doc.steps.filter((s) => runs.has(s.run));
    doc.steps.forEach((s) => { if (s.stop && !screens.has(s.stop)) s.stop = ''; });
    // One say per finding, and only about a record that is still there.
    const all = new Set(KINDS.flatMap((k) => doc[k].map((r) => r.id)));
    ['accepts', 'pins'].forEach((kind) => {
        const said = new Set();
        doc[kind] = doc[kind].filter((r) => {
            const about = r.finding.slice(r.finding.lastIndexOf(':') + 1);
            if (!r.finding.includes(':') || said.has(r.finding) || (about && !all.has(about))) return false;
            said.add(r.finding);
            return true;
        });
    });
    // A screen with no drawing cannot be shown; give it the usual one.
    const drawn = new Set(doc.sizes.map((s) => s.screen));
    doc.screens.forEach((s) => {
        if (drawn.has(s.id)) return;
        let id = 'siz_' + s.id.slice(4);
        while (sizes.has(id)) id += 'x';
        sizes.add(id);
        doc.sizes.push(readRec('sizes', { id, screen: s.id, name: 'Phone' }));
    });
}

// The document as plain data, the same bytes for the same content: lists
// sorted by id, fields in FIELDS order. This is what a file and the browser's
// own copy hold, and what the tests compare.
function serializeDoc(doc) {
    const out = { v: DOC_VERSION, name: doc.name, lang: doc.lang };
    KINDS.forEach((kind) => {
        out[kind] = doc[kind].slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((r) => writeRec(kind, r));
    });
    return out;
}

// ---- Files ----
const FILE_KIND = 'flowdoc';
const FILE_SCHEMA = 'https://flow.carino.systems/schema/flow-v1.json';
const FILE_TYPE = 'application/vnd.carino.flow+json';
// part: the document is some screens of a larger workflow (partOfDoc), made
// to be worked on apart and merged back.
function fileEnvelope(doc, part) {
    const env = { $schema: FILE_SCHEMA, kind: FILE_KIND, version: 1, name: doc.name, doc: serializeDoc(doc) };
    if (part) env.part = true;
    return env;
}
// The text of a file -> { doc, readOnly } or { error }. A bare document (no
// envelope) opens too. A document from a newer Flow opens read-only.
function openFileText(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { return { error: 'This file is not JSON.' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'This file is not a Flow document.' };
    let raw = data;
    if ('kind' in data || 'doc' in data) {
        if (data.kind !== FILE_KIND || !data.doc || typeof data.doc !== 'object') return { error: 'This file is not a Flow document.' };
        raw = data.doc;
    }
    if (!Number.isInteger(raw.v) || raw.v < 1) return { error: 'This file is not a Flow document.' };
    return { doc: normalizeDoc(raw), readOnly: raw.v > DOC_VERSION, part: data.part === true };
}

// ---- Looking records up ----
// One Map of every record by id, rebuilt when a record is added or removed.
let _index = null, _indexDoc = null;
function docIndex(doc) {
    if (_index && _indexDoc === doc) return _index;
    _index = new Map(); _indexDoc = doc;
    KINDS.forEach((kind) => doc[kind].forEach((r) => _index.set(r.id, r)));
    return _index;
}
const dropIndex = () => { _index = null; _indexDoc = null; };
const recOf = (doc, id) => docIndex(doc).get(id);

const byZ = (a, b) => (a.z - b.z) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const sizesOf = (doc, screenId) => doc.sizes.filter((s) => s.screen === screenId).sort(byZ);
const elementsOf = (doc, sizeId) => doc.elements.filter((e) => e.size === sizeId).sort(byZ);
const linksFrom = (doc, stopId) => doc.links.filter((l) => l.from === stopId);
const linksTo = (doc, stopId) => doc.links.filter((l) => l.to === stopId);
// The z for a record added on top of its siblings.
const topZ = (list) => list.reduce((m, r) => Math.max(m, r.z), 0) + 1;
// How tall a size is drawn: its content when that is taller than what shows.
const sizeHeight = (size) => Math.max(size.h, size.contentH || 0);
const stopName = (stop) => stop.name || (kindOfId(stop.id) === 'decisions' ? 'Decision' : 'Screen');

// ---- Operations ----
// Every change to a document is a list of these, and nothing changes one any
// other way:
//
//   { op: 'add', kind, rec }                a new record
//   { op: 'del', kind, id }                 a record removed
//   { op: 'set', kind, id, field, value }   one field of one record
//                                           (kind 'doc', id '': the document's own)
//
// applyOp makes the change and returns the operation that takes it back, or
// null when there was nothing to do: the record is already there, already
// gone, or already holds that value. Returning null instead of failing is
// what lets an operation arrive late, after someone else removed its record.
function applyOp(doc, op) {
    if (!op || typeof op !== 'object') return null;
    if (op.kind === 'doc') {
        if (op.op !== 'set' || !DOC_FIELDS[op.field]) return null;
        const value = normField('doc', op.field, op.value), was = doc[op.field];
        if (value === was) return null;
        doc[op.field] = value;
        return { op: 'set', kind: 'doc', id: '', field: op.field, value: was };
    }
    const list = doc[op.kind];
    if (!FIELDS[op.kind] || !Array.isArray(list)) return null;
    if (op.op === 'add') {
        const r = op.rec;
        if (!r || typeof r.id !== 'string' || !ID_RE.test(r.id) || kindOfId(r.id) !== op.kind) return null;
        if (recOf(doc, r.id)) return null;
        list.push(readRec(op.kind, r));
        dropIndex();
        return { op: 'del', kind: op.kind, id: r.id };
    }
    const i = list.findIndex((r) => r.id === op.id);
    if (i < 0) return null;
    if (op.op === 'del') {
        const [gone] = list.splice(i, 1);
        dropIndex();
        return { op: 'add', kind: op.kind, rec: cloneData(gone) };
    }
    if (op.op === 'set') {
        if (!FIELDS[op.kind][op.field]) return null;
        const value = normField(op.kind, op.field, op.value), was = list[i][op.field];
        if (value === was) return null;
        list[i][op.field] = value;
        return { op: 'set', kind: op.kind, id: op.id, field: op.field, value: was };
    }
    return null;
}

// The operations that remove a record and everything that cannot stay without
// it, dependents first, so taking them back in reverse puts the owner back
// before what hangs off it.
function removalOps(doc, id) {
    const kind = kindOfId(id), ops = [], gone = new Set();
    const del = (k, rid) => { if (!gone.has(rid)) { gone.add(rid); ops.push({ op: 'del', kind: k, id: rid }); } };
    const dropElement = (el) => {
        doc.links.filter((l) => l.fromEl === el.id && !gone.has(l.id)).forEach((l) => ops.push({ op: 'set', kind: 'links', id: l.id, field: 'fromEl', value: '' }));
        del('elements', el.id);
    };
    const dropSize = (size) => { elementsOf(doc, size.id).forEach(dropElement); del('sizes', size.id); };
    const dropLinksOf = (stopId) => doc.links.filter((l) => l.from === stopId || l.to === stopId).forEach((l) => del('links', l.id));
    const rec = recOf(doc, id);
    if (!rec) return ops;
    if (kind === 'screens') { dropLinksOf(id); sizesOf(doc, id).forEach(dropSize); del('screens', id); }
    else if (kind === 'decisions') { dropLinksOf(id); del('decisions', id); }
    else if (kind === 'sizes') {
        // A screen keeps at least one drawing.
        if (sizesOf(doc, rec.screen).length < 2) return ops;
        dropSize(rec);
    }
    else if (kind === 'elements') dropElement(rec);
    else if (kind === 'links') del('links', id);
    else if (kind === 'blocks') {
        // Its placings go with it, then what is drawn inside it.
        doc.elements.filter((e) => e.type === 'block' && e.block === id).forEach(dropElement);
        elementsOf(doc, id).forEach(dropElement);
        del('blocks', id);
    }
    else if (kind === 'langs') {
        doc.words.filter((w) => w.lang === id).forEach((w) => del('words', w.id));
        del('langs', id);
    }
    else if (kind === 'words') del('words', id);
    else if (kind === 'styles') {
        ['fill', 'ink', 'textStyle'].forEach((f) => doc.elements.filter((e) => e[f] === id).forEach((e) => ops.push({ op: 'set', kind: 'elements', id: e.id, field: f, value: '' })));
        del('styles', id);
    }
    else if (kind === 'sources') {
        ['screens', 'elements', 'links'].forEach((k) => doc[k].filter((r) => r.source === id).forEach((r) => ops.push({ op: 'set', kind: k, id: r.id, field: 'source', value: '' })));
        del('sources', id);
    }
    else if (kind === 'accepts' || kind === 'pins') del(kind, id);
    else if (kind === 'bases') {
        doc.runs.filter((r) => r.base === id).forEach((r) => ops.push({ op: 'set', kind: 'runs', id: r.id, field: 'base', value: '' }));
        del('bases', id);
    }
    else if (kind === 'runs') { doc.steps.filter((s) => s.run === id).forEach((s) => del('steps', s.id)); del('runs', id); }
    else if (kind === 'steps') del('steps', id);
    // A run keeps its steps when a screen goes: they say what was tested then.
    doc.steps.forEach((s) => { if (s.stop && gone.has(s.stop)) ops.push({ op: 'set', kind: 'steps', id: s.id, field: 'stop', value: '' }); });
    // What was said about a finding goes with the record the finding was about.
    ['accepts', 'pins'].forEach((k) => doc[k].forEach((r) => { if (gone.has(r.finding.slice(r.finding.lastIndexOf(':') + 1))) del(k, r.id); }));
    return ops;
}

// ---- Dictionaries ----
// A dictionary file is JSON, flat or nested: { "cart": { "pay": "Pay" } } is
// the key cart.pay. -> Map of key -> text, the texts that are strings only.
function flattenDictionary(data, prefix = '', out = new Map()) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return out;
    Object.keys(data).forEach((k) => {
        const key = prefix ? prefix + '.' + k : k, v = data[k];
        if (typeof v === 'string') { const kk = fKey(key); if (kk) out.set(kk, v.slice(0, 2000)); }
        else flattenDictionary(v, key, out);
    });
    return out;
}
// A language's texts by key. lang '': the document's own language, read from
// the elements that have a key.
function dictionaryOf(doc, langId) {
    const out = new Map();
    if (langId) doc.words.filter((w) => w.lang === langId).forEach((w) => out.set(w.key, w.text));
    else doc.elements.forEach((e) => { if (e.key && !out.has(e.key)) out.set(e.key, e.text); });
    return new Map(Array.from(out).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}
// The keys the drawn interface uses.
const keysInUse = (doc) => new Set(doc.elements.filter((e) => e.key).map((e) => e.key));
const slugKey = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);

// ---- Paths ----
// The ways from one stop to another, shortest first, no stop visited twice.
// -> [{ stops: [id...], links: [id...] }], at most `limit` of them.
function findPaths(doc, from, to, limit = 12) {
    const out = [];
    if (!from || !to || from === to || !recOf(doc, from) || !recOf(doc, to)) return out;
    const next = new Map();
    doc.links.forEach((l) => { if (!next.has(l.from)) next.set(l.from, []); next.get(l.from).push(l); });
    let queue = [{ stops: [from], links: [] }], looked = 0;
    while (queue.length && out.length < limit && looked < 20000) {
        const grown = [];
        for (const p of queue) {
            const at = p.stops[p.stops.length - 1];
            for (const l of next.get(at) || []) {
                looked++;
                if (p.stops.includes(l.to)) continue;
                const q = { stops: p.stops.concat(l.to), links: p.links.concat(l.id) };
                if (l.to === to) { out.push(q); if (out.length >= limit) return out; } else grown.push(q);
            }
        }
        queue = grown;
    }
    return out;
}

// ---- Testing against the real thing ----
// A screen's live address on a base: the base's address and the screen's
// path, joined. A path that is a whole address stands by itself. '' when
// there is nothing usable to open.
function liveUrl(base, screen) {
    const path = screen ? screen.path.trim() : '';
    if (/^https?:\/\//i.test(path)) return safeUrl(path);
    if (!base || !base.url || !path) return '';
    return safeUrl(base.url.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, ''));
}
// A way through the workflow as a tester follows it: one step per screen,
// with what has to happen to get there from the screen before. A decision
// on the way is part of that: its question and the answer taken.
function caseSteps(doc, path) {
    const out = [];
    let via = [];
    path.stops.forEach((id, i) => {
        const stop = recOf(doc, id);
        if (i > 0) {
            const l = recOf(doc, path.links[i - 1]), el = l.fromEl ? recOf(doc, l.fromEl) : null, cond = l.cond.trim();
            const from = recOf(doc, l.from), asked = kindOfId(l.from) === 'decisions';
            const said = [l.label.trim() || (asked || !el ? '' : 'Use ' + (el.name || el.text || 'the control').trim()), cond ? (asked ? `${stopName(from)} ${cond}` : 'if ' + cond) : (asked ? stopName(from) : '')].filter(Boolean).join(', ');
            via.push(said || 'Go on');
        }
        if (kindOfId(id) === 'screens') { out.push({ stop: id, name: stopName(stop), via: via.join(' · ') }); via = []; }
    });
    return out;
}
// Every way from a start to an end, as test cases. An end is a screen marked
// as one, or one that leads nowhere. -> [{ name, path }], at most `limit`.
function testCases(doc, limit = 40) {
    const starts = doc.screens.filter((s) => s.start && !s.stub);
    const ends = doc.screens.filter((s) => !s.stub && (s.end || !doc.links.some((l) => l.from === s.id && l.to !== s.id)));
    const out = [];
    starts.forEach((a) => ends.forEach((b) => {
        const paths = findPaths(doc, a.id, b.id, 6);
        paths.forEach((path, i) => { if (out.length < limit) out.push({ name: `${stopName(a)} to ${stopName(b)}${paths.length > 1 ? `, way ${i + 1}` : ''}`, path }); });
    }));
    return out;
}
const stepsOf = (doc, runId) => doc.steps.filter((s) => s.run === runId).sort((a, b) => (a.n - b.n) || (a.id < b.id ? -1 : 1));
// -> { pass, fail, skip, todo, total, verdict: 'pass' | 'fail' | 'open' }
function runTally(doc, runId) {
    const t = { pass: 0, fail: 0, skip: 0, todo: 0, total: 0 };
    stepsOf(doc, runId).forEach((s) => { t.total++; t[s.result || 'todo']++; });
    t.verdict = t.fail ? 'fail' : t.todo ? 'open' : 'pass';
    return t;
}

// ---- A part of a workflow, and merging one back ----
// The stops named, as a document that opens on its own: their sizes and
// elements, the links that leave them, and only the blocks, styles, sources
// and words they use. A link that leaves the part keeps its far end as a
// stub, so the reader sees that the workflow goes on.
function partOfDoc(doc, stopIds) {
    const want = new Set(stopIds.filter((id) => isStopId(id) && recOf(doc, id)));
    const out = newDoc(doc.name); out.lang = doc.lang;
    const copy = (kind, rec, changes) => out[kind].push(Object.assign(cloneData(rec), changes || {}));
    const stubs = new Set();
    doc.links.forEach((l) => {
        if (!want.has(l.from)) return;
        copy('links', l);
        if (!want.has(l.to)) stubs.add(l.to);
    });
    const sizeIds = new Set(), holders = new Set();
    doc.screens.forEach((s) => {
        if (want.has(s.id)) { copy('screens', s); sizesOf(doc, s.id).forEach((z) => { copy('sizes', z); sizeIds.add(z.id); holders.add(z.id); }); }
        else if (stubs.has(s.id)) { copy('screens', s, { stub: true, start: false, source: '', at: '' }); const z = sizesOf(doc, s.id)[0]; if (z) copy('sizes', z); }
    });
    doc.decisions.forEach((d) => { if (want.has(d.id)) copy('decisions', d); else if (stubs.has(d.id)) copy('decisions', d, { stub: true }); });
    const blocks = new Set(doc.elements.filter((e) => sizeIds.has(e.size) && e.type === 'block').map((e) => e.block));
    doc.blocks.forEach((b) => { if (blocks.has(b.id)) { copy('blocks', b); holders.add(b.id); } });
    doc.elements.forEach((e) => { if (holders.has(e.size)) copy('elements', e); });
    const used = (fields) => new Set(out.screens.concat(out.elements, out.links).flatMap((r) => fields.map((f) => r[f]).filter(Boolean)));
    const styles = used(['fill', 'ink', 'textStyle']), sources = used(['source']), keys = new Set(out.elements.map((e) => e.key).filter(Boolean));
    doc.styles.forEach((y) => { if (styles.has(y.id)) copy('styles', y); });
    doc.sources.forEach((s) => { if (sources.has(s.id)) copy('sources', s); });
    doc.langs.forEach((l) => copy('langs', l));
    doc.bases.forEach((b) => copy('bases', b));
    doc.words.forEach((w) => { if (keys.has(w.key)) copy('words', w); });
    const ids = new Set(KINDS.flatMap((k) => out[k].filter((r) => !r.stub).map((r) => r.id)));
    ['accepts', 'pins'].forEach((k) => doc[k].forEach((r) => { if (ids.has(r.finding.slice(r.finding.lastIndexOf(':') + 1))) copy(k, r); }));
    return normalizeDoc(out);
}

// The operations that bring a part back into the workflow it came from.
// Records are matched by id: one in both takes the part's values, one only in
// the part is added. Of the part's own screens (not its stubs), a size,
// element or link that is in the workflow but no longer in the part was
// removed there, and is removed here. Nothing else is touched.
function mergeOps(doc, part) {
    const ops = [];
    const own = new Set(part.screens.concat(part.decisions).filter((s) => !s.stub).map((s) => s.id));
    const stubSizes = new Set(part.sizes.filter((z) => !own.has(z.screen)).map((z) => z.id));
    const order = ['styles', 'sources', 'bases', 'langs', 'blocks', 'screens', 'decisions', 'sizes', 'elements', 'links', 'words', 'accepts', 'pins'];
    order.forEach((kind) => part[kind].forEach((rec) => {
        const have = recOf(doc, rec.id);
        // A stub stands for a stop that is here already; it adds or changes nothing
        // unless the workflow has lost that stop, when it keeps the link's end.
        const stub = rec.stub === true || (kind === 'sizes' && stubSizes.has(rec.id));
        if (!have) { if (kind === 'words' && doc.words.some((w) => w.lang === rec.lang && w.key === rec.key)) return; ops.push({ op: 'add', kind, rec: cloneData(rec) }); return; }
        if (stub) return;
        Object.keys(FIELDS[kind]).forEach((f) => { if (have[f] !== rec[f]) ops.push({ op: 'set', kind, id: rec.id, field: f, value: rec[f] }); });
    }));
    // What the part's own screens no longer have.
    const inPart = new Set(KINDS.flatMap((k) => part[k].map((r) => r.id)));
    const ownSizes = new Set(), gone = new Set();
    const drop = (id) => removalOps(doc, id).forEach((op) => { const key = op.op + op.kind + op.id + (op.field || ''); if (!gone.has(key)) { gone.add(key); ops.push(op); } });
    doc.sizes.forEach((z) => { if (own.has(z.screen)) { if (inPart.has(z.id)) ownSizes.add(z.id); else if (part.sizes.some((p) => p.screen === z.screen)) drop(z.id); } });
    doc.elements.forEach((e) => { if (ownSizes.has(e.size) && !inPart.has(e.id)) drop(e.id); });
    doc.links.forEach((l) => { if (own.has(l.from) && !inPart.has(l.id)) drop(l.id); });
    return ops;
}

// ---- Pinning ----
// Where an element sits after its screen goes from ow by oh to nw by nh.
function pinnedBox(e, ow, oh, nw, nh) {
    const axis = (pin, pos, len, o, n, far) => {
        const d = n - o;
        if (pin === far) return [pos + d, len];
        if (pin === 'both') return [pos, Math.max(GRID, len + d)];
        if (pin === 'center') return [Math.round(pos + d / 2), len];
        if (pin === 'scale' && o > 0) return [Math.round((pos * n) / o), Math.max(1, Math.round((len * n) / o))];
        return [pos, len];
    };
    const [x, w] = axis(e.pinH, e.x, e.w, ow, nw, 'right'), [y, h] = axis(e.pinV, e.y, e.h, oh, nh, 'bottom');
    return { x, y, w, h };
}
const boxesMeet = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---- Geometry ----
// A stop's box on the board. A screen's depends on which of its sizes is
// drawn, so the caller says which.
function stopBox(stop, size) {
    if (kindOfId(stop.id) === 'decisions') return { x: stop.x, y: stop.y, w: DECISION_W, h: DECISION_H, diamond: true };
    return { x: stop.x, y: stop.y, w: size ? size.w : 0, h: size ? sizeHeight(size) : 0, diamond: false };
}
// Where the line from a box's centre towards (tx, ty) leaves the box.
function edgePoint(box, tx, ty) {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const hw = box.w / 2 || 1, hh = box.h / 2 || 1;
    const t = box.diamond ? 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh) : Math.min(hw / (Math.abs(dx) || 1e-9), hh / (Math.abs(dy) || 1e-9));
    return { x: cx + dx * t, y: cy + dy * t };
}
