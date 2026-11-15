// The checks. One pass over the document gives every finding; the board's
// badges and the Findings list both read this one result. A finding is never
// stored: it is worked out again from the document each time.
//
//   { key, level: 'err' | 'warn', id, text, group }
//
// id is the record the finding is about ('' for the whole document). key
// names the finding for good (the check and the record), which is what an
// accepted or pinned finding is remembered by. group is the heading it is
// listed under.

function findFindings(doc) {
    // Findings are written in Flow's own language (js/i18n.js). The names in
    // them are the workflow's and are left as they are.
    const T = (key, params) => (typeof window !== 'undefined' && window.t ? window.t(key, params) : Object.keys(params || {}).reduce((x, k) => x.split('{' + k + '}').join(String(params[k])), key));
    const out = [];
    const add = (check, level, id, text) => out.push({ key: check + ':' + id, level, id, text, group: checkGroup(check) });
    const stops = doc.screens.concat(doc.decisions);
    const stopById = new Map(stops.map((s) => [s.id, s]));

    // ---- Where the workflow starts ----
    const starts = doc.screens.filter((s) => s.start);
    if (doc.screens.length && !starts.length) add('no-start', 'err', '', T('No screen is marked as the start of the workflow.'));
    if (starts.length > 1) starts.forEach((s) => add('two-starts', 'warn', s.id, T('"{name}" is one of {n} screens marked as the start.', { name: stopName(s), n: starts.length })));

    // ---- What can be reached ----
    const out_ = new Map(stops.map((s) => [s.id, []]));
    doc.links.forEach((l) => { if (out_.has(l.from)) out_.get(l.from).push(l); });
    if (starts.length) {
        const seen = new Set(starts.map((s) => s.id)), queue = starts.map((s) => s.id);
        while (queue.length) {
            const at = queue.shift();
            out_.get(at).forEach((l) => { if (stopById.has(l.to) && !seen.has(l.to)) { seen.add(l.to); queue.push(l.to); } });
        }
        stops.forEach((s) => { if (!seen.has(s.id) && !s.stub) add('unreached', 'err', s.id, T('Nothing leads to "{name}" from the start.', { name: stopName(s) })); });
    }

    // ---- Where it stops ----
    doc.screens.forEach((s) => {
        // A stub stands for a stop that is drawn elsewhere: nothing about it is judged here.
        if (s.stub) return;
        const leaving = out_.get(s.id).filter((l) => l.to !== s.id);
        if (!leaving.length && !s.end) add('dead-end', 'warn', s.id, T('"{name}" leads nowhere and is not marked as an end.', { name: stopName(s) }));
        if (leaving.length && s.end) add('end-leads-on', 'warn', s.id, T('"{name}" is marked as an end but leads on.', { name: stopName(s) }));
    });

    // ---- Decisions ----
    doc.decisions.forEach((d) => {
        if (d.stub) return;
        const branches = out_.get(d.id);
        if (!d.name.trim()) add('decision-unnamed', 'warn', d.id, T('A decision has no question written on it.'));
        if (branches.length < 2) add('decision-branches', 'err', d.id, branches.length ? T('"{name}" has one branch; a decision needs at least two.', { name: stopName(d) }) : T('"{name}" has no branches; a decision needs at least two.', { name: stopName(d) }));
        const seen = new Map();
        branches.forEach((l) => {
            const cond = l.cond.trim().toLowerCase();
            if (!cond) { add('branch-unnamed', 'warn', l.id, T('A branch of "{name}" does not say which answer it is.', { name: stopName(d) })); return; }
            if (seen.has(cond)) add('branch-twice', 'err', l.id, T('Two branches of "{name}" have the same answer, "{x}".', { name: stopName(d), x: l.cond.trim() }));
            seen.set(cond, l.id);
        });
    });

    // ---- Links ----
    doc.links.forEach((l) => {
        if (kindOfId(l.from) === 'screens' && l.kind === 'action' && !l.label.trim() && !l.fromEl) {
            add('link-unnamed', 'warn', l.id, T('The way from "{name}" to "{name2}" does not say what the user does.', { name: stopName(stopById.get(l.from)), name2: stopName(stopById.get(l.to)) }));
        }
    });

    // ---- Elements ----
    const holderById = new Map(doc.sizes.concat(doc.blocks).map((s) => [s.id, s]));
    doc.elements.forEach((e) => {
        const size = holderById.get(e.size);
        if (!size) return;
        if (e.x < 0 || e.y < 0 || e.x + e.w > size.w || e.y + e.h > sizeHeight(size)) {
            const screen = stopById.get(size.screen);
            add('outside', 'warn', e.id, screen ? T('{what} reaches outside "{name}" ({n}).', { what: elementTitle(e, doc), name: stopName(screen), n: size.name || size.w + '×' + size.h })
                : T('{what} reaches outside the block "{n}".', { what: elementTitle(e, doc), n: size.name || T('Block') }));
        }
    });
    // ---- Elements: size, text, layout, names ----
    // How each type draws its text: [weight, padding] for text that wraps,
    // [space before, space after] for text on one line. The same numbers as
    // the drawing in js/ui.js.
    const WRAPS = { text: [400, 0], heading: [700, 0], link: [500, 0], button: [600, 8], card: [600, 16], chip: [500, 8], alert: [400, 14], image: [400, 8], box: [400, 8] };
    const ONE_LINE = { input: [12, 12], select: [12, 34], checkbox: [30, 0], radio: [30, 0], toggle: [53, 0], topbar: [30, 30] };
    const USUAL_TEXT = new Set(Object.values(ELEMENT_KIT).map((k) => k.text).filter((t) => t && !t.includes('\n')).concat(['Lorem ipsum', 'Label']).map((t) => t.toLowerCase()));
    const styleOf = new Map(doc.styles.map((y) => [y.id, y]));
    const widthOf = (text, px, weight) => (typeof textWidth === 'function' ? textWidth(text, px, weight) : text.length * px * 0.55);
    const linesOf = (text, px, weight, maxW) => (typeof wrapLines === 'function' ? wrapLines(text, px, weight, maxW) : text.split('\n'));
    const drawsText = (e) => (WRAPS[e.type] || ONE_LINE[e.type] || ELEMENT_KIT[e.type].lines) && e.type !== 'image';
    // Does this text fit this element's box, at the size it is drawn?
    const fits = (e, text) => {
        const ts = styleOf.get(e.textStyle), fs = ts ? ts.fs : e.fs;
        if (!text) return true;
        if (WRAPS[e.type]) {
            const [weight, pad] = WRAPS[e.type], w = Math.max(8, e.w - pad * 2), wt = ts ? ts.weight : weight;
            const lines = linesOf(text, fs, wt, w), top = e.type === 'card' || e.type === 'alert' ? pad : 0;
            return top + lines.length * fs * 1.25 <= e.h + 1 && lines.every((l) => widthOf(l, fs, wt) <= w + 1);
        }
        if (ONE_LINE[e.type]) {
            const [before, after] = ONE_LINE[e.type];
            return widthOf(text.split('\n')[0], fs, ts ? ts.weight : e.type === 'topbar' ? 600 : 400) <= e.w - before - after + 1;
        }
        return true;
    };
    const lum = (hex) => {
        const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const SURFACE = { button: '#0f172a', chip: '#f1f5f9', alert: '#fef3c7', topbar: '#f1f5f9', box: '#f1f5f9' };
    const TEXT_ON = { button: '#ffffff', link: '#1d4ed8', box: '#64748b' };
    const wordsByLang = doc.langs.map((l) => [l, new Map(doc.words.filter((w) => w.lang === l.id).map((w) => [w.key, w.text]))]);
    const sizeUse = new Map();
    doc.elements.forEach((e) => { if (drawsText(e) && e.text && !e.textStyle) sizeUse.set(e.fs, (sizeUse.get(e.fs) || 0) + 1); });
    const hasTextStyles = doc.styles.some((y) => y.kind === 'text');
    const byHolder = new Map();
    doc.elements.forEach((e) => { if (!byHolder.has(e.size)) byHolder.set(e.size, []); byHolder.get(e.size).push(e); });

    byHolder.forEach((list, holderId) => {
        const holder = holderById.get(holderId);
        if (!holder) return;
        const touch = holder.input === 'touch', far = holder.distance === 'far';
        const minText = far ? 24 : 12;
        list.forEach((e) => {
            const kit = ELEMENT_KIT[e.type], title = elementTitle(e, doc), ts = styleOf.get(e.textStyle), fs = ts ? ts.fs : e.fs;
            if (e.type === 'block') return;
            // Size: something the user presses must be big enough to hit.
            if (kit.control) {
                const small = Math.min(e.w, e.h);
                if (small < 24) add('target-small', 'err', e.id, T('{what} is {n}×{n2}: too small to press. A target needs 24 px each way at least.', { what: title, n: e.w, n2: e.h }));
                else if (touch && small < 44) add('target-touch', 'warn', e.id, T('{what} is {n}×{n2}. On a touch screen a target should be 44 px each way.', { what: title, n: e.w, n2: e.h }));
            }
            // Text.
            if (drawsText(e) && e.text) {
                if (fs < minText) add('text-small', 'warn', e.id, far ? T('{what} has {n} px text. Seen from across a room, text needs 24 px at least.', { what: title, n: fs }) : T('{what} has {n} px text. Text under 12 px is hard to read.', { what: title, n: fs }));
                if (!fits(e, e.text)) add('text-fit', 'warn', e.id, T('The text of {what} does not fit its box.', { what: title }));
                wordsByLang.forEach(([l, words]) => {
                    const t = e.key ? words.get(e.key) : '';
                    if (t && !fits(e, t)) add('text-fit-' + l.code, 'warn', e.id, T('In {lang}, the text of {what} does not fit its box.', { lang: l.name || l.code, what: title }));
                });
                if (USUAL_TEXT.has(e.text.trim().toLowerCase())) add('placeholder', 'warn', e.id, T('{what} still says what it said when it was added.', { what: title }));
                if (hasTextStyles && !e.textStyle && sizeUse.get(e.fs) === 1) add('size-once', 'warn', e.id, T('{what} uses {n} px text, which no other element uses and no style names.', { what: title, n: e.fs }));
                if ((e.fill || e.ink) && (WRAPS[e.type] || e.type === 'topbar')) {
                    const fill = styleOf.get(e.fill), ink = styleOf.get(e.ink);
                    const bg = fill ? fill.color : SURFACE[e.type] || '#ffffff', fg = ink ? ink.color : TEXT_ON[e.type] || '#0f172a';
                    const ratio = contrast(fg, bg), need = fs >= 24 ? 3 : 4.5;
                    if (ratio < need) add('contrast', 'err', e.id, T('The text of {what} is hard to read on its background: contrast {x} to 1, and it needs {n}.', { what: title, x: ratio.toFixed(1), n: need }));
                }
            }
            // Names: what a screen reader says, and what the hand-off calls it.
            const named = e.name.trim() !== '';
            if (e.type === 'image' && !e.text.trim()) add('image-no-desc', 'warn', e.id, T('An image does not say what it shows.'));
            if (['input', 'textarea', 'select', 'slider'].includes(e.type) && !named) add('no-label', 'warn', e.id, T('{what} has no name. A field needs a label.', { what: title }));
            if (['button', 'link', 'checkbox', 'radio', 'toggle'].includes(e.type) && !named && !e.text.trim()) add('control-unnamed', 'warn', e.id, T('{x}: it has no text and no name.', { x: T(kit.label) }));
            if (e.type === 'icon' && !named && doc.links.some((l) => l.fromEl === e.id)) add('control-unnamed', 'warn', e.id, T('An icon that leads somewhere has no name.'));
        });
        // Layout: controls on top of each other or, on a touch screen, too close.
        const controls = list.filter((e) => ELEMENT_KIT[e.type].control);
        const gap = (a, b) => Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), a.y - (b.y + b.h), b.y - (a.y + a.h));
        controls.forEach((a, i) => controls.slice(i + 1).forEach((b) => {
            const g = gap(a, b);
            if (g < 0) add('overlap', 'warn', a.id < b.id ? b.id : a.id, T('{what} and {what2} overlap.', { what: elementTitle(a, doc), what2: elementTitle(b, doc) }));
            else if (touch && g < 8) add('targets-close', 'warn', a.id < b.id ? b.id : a.id, T('{what} and {what2} are {n} px apart. On a touch screen, leave 8 px between targets.', { what: elementTitle(a, doc), what2: elementTitle(b, doc), n: g }));
        }));
        // An edge 1 to 3 px off another element's is almost always a slip.
        const seen = new Set();
        list.forEach((a, i) => list.slice(0, i).forEach((b) => {
            if (seen.has(a.id)) return;
            const off = [['left', a.x - b.x], ['right', a.x + a.w - b.x - b.w], ['top', a.y - b.y]].find(([, d]) => Math.abs(d) >= 1 && Math.abs(d) <= 3);
            if (off) { seen.add(a.id); add('near-miss', 'warn', a.id, T('The {x} edge of {what} is {n} px off {what2}.', { x: T(off[0]), what: elementTitle(a, doc), n: Math.abs(off[1]), what2: elementTitle(b, doc) })); }
        }));
    });

    // ---- Blocks ----
    doc.blocks.forEach((b) => {
        if (!doc.elements.some((e) => e.size === b.id)) add('block-empty', 'warn', b.id, T('The block "{x}" has nothing in it.', { x: b.name || T('Block') }));
        else if (!doc.elements.some((e) => e.type === 'block' && e.block === b.id)) add('block-unused', 'warn', b.id, T('The block "{x}" is not placed on any screen.', { x: b.name || T('Block') }));
    });

    // ---- Languages ----
    const keys = keysInUse(doc);
    const textOfKey = new Map();
    doc.elements.forEach((e) => {
        if (!e.key) return;
        if (textOfKey.has(e.key) && textOfKey.get(e.key) !== e.text) add('key-clash', 'warn', e.id, T('The key "{x}" is on elements that say different things. A key has one text per language.', { x: e.key }));
        else textOfKey.set(e.key, e.text);
    });
    doc.langs.forEach((l) => {
        const have = new Set(doc.words.filter((w) => w.lang === l.id && w.text !== '').map((w) => w.key));
        const missing = Array.from(keys).filter((k) => !have.has(k));
        if (missing.length) add('lang-missing', 'warn', l.id, T('{lang} has no text for {n} of {n2} keys: {n3}', { lang: l.name || l.code, n: missing.length, n2: keys.size, n3: missing.slice(0, 3).join(', ') + (missing.length > 3 ? '…' : '') }));
        if (l.code.toLowerCase() === doc.lang.toLowerCase()) add('lang-same', 'warn', l.id, T('{lang} is the language the workflow is written in already.', { lang: l.name || l.code }));
    });
    const codes = new Map();
    doc.langs.forEach((l) => { const c = l.code.toLowerCase(); if (codes.has(c)) add('lang-twice', 'warn', l.id, T('The language {lang} is listed twice.', { lang: l.code })); codes.set(c, l.id); });

    // ---- Testing ----
    doc.bases.forEach((b) => {
        const name = b.name || T('A base address');
        if (!b.url) add('base-no-url', 'warn', b.id, T('{x} has no address.', { x: name }));
        else {
            if (/^http:/i.test(b.url) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(b.url)) add('base-http', 'warn', b.id, T('{x} uses http, which is not private on the way.', { x: name }));
            if (urlCarriesSecret(b.url)) add('base-secret', 'err', b.id, T('The address of {x} seems to carry a key or a password. Anyone who gets this file gets it too.', { x: name }));
        }
    });
    if (doc.bases.length) doc.screens.forEach((s) => { if (!s.stub && !s.path.trim()) add('no-live-address', 'warn', s.id, T('"{name}" has no live address, so a test cannot open it.', { name: stopName(s) })); });
    // What the latest test of each screen found.
    const runAt = new Map(doc.runs.map((r) => [r.id, r])), latest = new Map();
    doc.steps.forEach((st) => {
        const run = runAt.get(st.run);
        if (!st.stop || !st.result || st.result === 'skip' || !run) return;
        const had = latest.get(st.stop);
        if (!had || run.at > had.run.at || (run.at === had.run.at && st.id > had.st.id)) latest.set(st.stop, { st, run });
    });
    latest.forEach(({ st, run }, stopId) => {
        if (st.result === 'fail' && stopById.has(stopId)) add('test-failed', 'err', stopId, T('"{name}" failed its last test ({x}).', { name: stopName(stopById.get(stopId)), x: run.name || T('a run') }) + (st.note ? ' ' + st.note : ''));
    });

    // ---- Sources ----
    const used = new Set();
    ['screens', 'elements', 'links'].forEach((kind) => doc[kind].forEach((r) => {
        if (r.source) used.add(r.source);
        else if (r.at.trim()) add('at-no-source', 'warn', r.id, T('"{x}" names a place in a source, but no source is chosen.', { x: r.at.trim() }));
    }));
    doc.sources.forEach((s) => {
        const name = s.label || T('A source');
        if (!s.url) add('source-no-url', 'warn', s.id, T('{x} has no address.', { x: name }));
        else {
            if (/^http:/i.test(s.url) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(s.url)) add('source-http', 'warn', s.id, T('{x} uses http, which is not private on the way.', { x: name }));
            if (urlCarriesSecret(s.url)) add('source-secret', 'err', s.id, T('The address of {x} seems to carry a key or a password. Anyone who gets this file gets it too.', { x: name }));
        }
    });
    doc.screens.forEach((s) => {
        if (s.status === 'built' && !(s.source && doc.sources.some((x) => x.id === s.source && x.kind === 'code'))) {
            add('built-no-code', 'warn', s.id, T('"{name}" is marked Built but points at no code source.', { name: stopName(s) }));
        }
    });

    return out;
}

// Which heading a check is listed under.
const CHECK_GROUPS = [
    ['Flow', ['no-start', 'two-starts', 'unreached', 'dead-end', 'end-leads-on', 'decision-unnamed', 'decision-branches', 'branch-unnamed', 'branch-twice', 'link-unnamed']],
    ['Size', ['target-small', 'target-touch', 'targets-close']],
    ['Text', ['text-small', 'text-fit', 'placeholder', 'contrast']],
    ['Layout', ['outside', 'overlap', 'near-miss']],
    ['Names', ['image-no-desc', 'no-label', 'control-unnamed']],
    ['Styles', ['size-once']],
    ['Blocks', ['block-empty', 'block-unused']],
    ['Languages', ['key-clash', 'lang-missing', 'lang-same', 'lang-twice']],
    ['Testing', ['base-no-url', 'base-http', 'base-secret', 'no-live-address', 'test-failed']],
    ['Sources', ['at-no-source', 'source-no-url', 'source-http', 'source-secret', 'built-no-code']]
];
const checkGroup = (check) => (check.startsWith('text-fit') ? 'Text' : (CHECK_GROUPS.find(([, list]) => list.includes(check)) || ['Other'])[0]);
const checkOfKey = (key) => key.slice(0, key.lastIndexOf(':'));

// A document's findings with what someone has said about them:
//   open       to be dealt with (pinned ones first)
//   accepted   someone accepted it, with a reason; it is counted nowhere
//   stale      accepted or pinned findings that are no longer found
function sortFindings(doc, findings) {
    const byKey = new Map(findings.map((f) => [f.key, f]));
    const accept = new Map(doc.accepts.map((a) => [a.finding, a])), pin = new Map(doc.pins.map((p) => [p.finding, p]));
    const open = [], accepted = [], stale = [];
    findings.forEach((f) => {
        if (accept.has(f.key)) accepted.push(Object.assign({ accept: accept.get(f.key) }, f));
        else open.push(Object.assign({ pin: pin.get(f.key) || null }, f));
    });
    open.sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0));
    doc.accepts.concat(doc.pins).forEach((r) => { if (!byKey.has(r.finding)) stale.push(r); });
    return { open, accepted, stale };
}

function elementTitle(e, doc) {
    const kit = ELEMENT_KIT[e.type];
    const block = e.type === 'block' && doc ? recOf(doc, e.block) : null;
    const name = (e.name || (block ? block.name : e.text) || '').trim();
    const kind = typeof window !== 'undefined' && window.t ? window.t(kit.label) : kit.label;
    return name ? `${kind} "${name.length > 32 ? name.slice(0, 31) + '…' : name}"` : kind;
}

// The finding's record, and the stop its badge is drawn on: an element's
// finding shows on its screen, a link's on the stop it leaves.
function findingStop(doc, f) {
    const kind = kindOfId(f.id), rec = f.id ? recOf(doc, f.id) : null;
    if (!rec) return '';
    if (kind === 'screens' || kind === 'decisions') return rec.id;
    if (kind === 'links') return rec.from;
    if (kind === 'elements') { const size = recOf(doc, rec.size); return size && size.screen ? size.screen : ''; }
    return '';
}
