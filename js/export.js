// Export: the whole workflow or some of it, as a document, pictures, a
// report or a copy sheet. Everything is made here, in the page: nothing is
// sent anywhere to be converted.
//
//   buildExport({ what, as, format, scale }) -> Promise<{ name, blob }>
//
// what: 'all' | 'selected' | 'path' | 'screen'
// as:   'doc' | 'map' | 'screens' | 'storyboard' | 'report' | 'sheet'
// format (pictures): 'svg' | 'png';  scale (png): 1 | 2 | 3

// ---- What is exported ----
// The stops each choice means, in reading order. '' when the choice is not
// on offer right now (nothing selected, no way marked).
function exportStops(what) {
    const doc = state.doc, all = doc.screens.concat(doc.decisions);
    const inOrder = (ids) => all.filter((s) => ids.has(s.id)).sort((a, b) => (boxOfStop(a).x - boxOfStop(b).x) || (boxOfStop(a).y - boxOfStop(b).y)).map((s) => s.id);
    if (what === 'all') return inOrder(new Set(all.map((s) => s.id)));
    if (what === 'path') { const p = walkPaths()[state.walk.pick]; return p ? p.stops.slice() : []; }
    const picked = new Set();
    state.selection.forEach((e) => { const h = isStopId(e.id) ? recOf(doc, e.id) : screenOfId(e.id); if (h && isStopId(h.id)) picked.add(h.id); });
    if (what === 'screen') return picked.size === 1 && kindOfId(Array.from(picked)[0]) === 'screens' ? Array.from(picked) : [];
    return what === 'selected' ? inOrder(picked) : [];
}
const safeName = (s) => (String(s || '').trim().replace(/[^\p{L}\p{N} _.-]+/gu, '').trim() || 'workflow');

// ---- Pictures ----
// A picture is the board's own SVG, drawn again with nothing of the editor in
// it: no selection, no handles, no badges, no faded stops.
function cleanDraw(fn, opts = {}) {
    const was = { selection: state.selection, view: state.view, only: _only, trail: _trail, linking: state.linking };
    state.selection = new Set(); state.linking = null; _trail = null;
    if (opts.view) state.view = opts.view;
    _only = opts.only || null;
    try { return fn(); } finally { state.selection = was.selection; state.view = was.view; _only = was.only; _trail = was.trail; state.linking = was.linking; }
}
const svgDoc = (w, h, x, y, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="${n1(x)} ${n1(y)} ${Math.ceil(w)} ${Math.ceil(h)}">`
    + `<rect x="${n1(x)}" y="${n1(y)}" width="${Math.ceil(w)}" height="${Math.ceil(h)}" fill="#ffffff"/>${inner}</svg>`;
// The stops given, with the links between them, as they are in a view.
function svgOfStops(ids, view) {
    return cleanDraw(() => {
        const doc = state.doc, only = new Set(ids), stops = doc.screens.concat(doc.decisions).filter((s) => only.has(s.id));
        if (!stops.length) return svgDoc(320, 120, 0, 0, `<text x="160" y="60" font-family='${FONT}' font-size="14" fill="${INK.dim}" text-anchor="middle">Nothing to show</text>`);
        const boxes = stops.map(boxOfStop), pad = 48;
        const x0 = Math.min(...boxes.map((b) => b.x)) - pad, y0 = Math.min(...boxes.map((b) => b.y)) - pad - 16;
        const x1 = Math.max(...boxes.map((b) => b.x + b.w)) + pad, y1 = Math.max(...boxes.map((b) => b.y + b.h)) + pad + 24;
        let inner = '';
        if (state.view === 'flow') {
            const L = flowLayout();
            stops.forEach((s) => { const b = L.get(s.id); inner += kindOfId(s.id) === 'screens' ? cardSvg(s, b, 1) : decisionSvg(Object.assign({}, s, { x: b.x, y: b.y }), 1); });
        } else stops.forEach((s) => { inner += kindOfId(s.id) === 'screens' ? screenSvg(s, 1) : decisionSvg(s, 1); });
        return svgDoc(x1 - x0, y1 - y0, x0, y0, inner + linksSvg(1));
    }, { view, only: new Set(ids) });
}
// One size of one screen, at its real size, with nothing around it.
function svgOfSize(size) {
    return cleanDraw(() => {
        const H = sizeHeight(size);
        return svgDoc(size.w + 2, H + 2, -1, -1, `<rect width="${size.w}" height="${H}" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1"/>`
            + elementsOf(state.doc, size.id).map((e) => elementSvg(e, 1, true)).join(''));
    });
}
// A way through the workflow as one strip: each stop in order, and between
// two stops what takes the user on.
function svgOfStoryboard(path) {
    return cleanDraw(() => {
        const doc = state.doc, TALL = 420, GAP = 190, TOP = 56;
        let x = 40, inner = '';
        const steps = pathSteps(path);
        path.stops.forEach((id, i) => {
            const stop = recOf(doc, id);
            let w;
            if (kindOfId(id) === 'screens') {
                const size = shownSize(stop), H = sizeHeight(size), k = Math.min(TALL / H, 1);
                w = size.w * k;
                inner += `<g transform="translate(${n1(x)} ${n1(TOP + (TALL - H * k) / 2)}) scale(${k.toFixed(4)})"><rect width="${size.w}" height="${H}" rx="${n1(Math.min(12, size.w / 20))}" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
                    + elementsOf(doc, size.id).map((e) => elementSvg(e, 1, true)).join('') + '</g>';
            } else {
                w = DECISION_W;
                inner += decisionSvg(Object.assign({}, stop, { x, y: TOP + (TALL - DECISION_H) / 2 }), 1);
            }
            inner += `<text x="${n1(x + w / 2)}" y="${TOP - 18}" font-family='${FONT}' font-size="15" font-weight="600" fill="${INK.name}" text-anchor="middle">${i + 1}. ${esc(stopName(stop))}</text>`;
            x += w;
            if (i < path.links.length) {
                const via = steps[i * 2 + 1].via, lines = wrapLines(via, 13, 500, GAP - 40), my = TOP + TALL / 2;
                inner += `<path d="M ${n1(x + 14)} ${my} H ${n1(x + GAP - 22)}" stroke="${INK.link}" stroke-width="1.75" fill="none"/>`
                    + `<polygon points="${n1(x + GAP - 12)},${my} ${n1(x + GAP - 24)},${my - 5} ${n1(x + GAP - 24)},${my + 5}" fill="${INK.link}"/>`
                    + lines.map((l, j) => `<text x="${n1(x + GAP / 2)}" y="${n1(my - 14 - (lines.length - 1 - j) * 17)}" font-family='${FONT}' font-size="13" font-weight="500" fill="${INK.name}" text-anchor="middle">${esc(l)}</text>`).join('');
                x += GAP;
            }
        });
        return svgDoc(x + 40, TOP + TALL + 40, 0, 0, inner);
    });
}

// The fonts the drawing uses, as data, for a picture that must carry them:
// an SVG drawn into a canvas cannot load a font file. Read once from this
// site's own fonts folder.
let _fontCss = null;
async function fontCss() {
    if (_fontCss !== null) return _fontCss;
    const parts = await Promise.all([400, 500, 600, 700].map(async (wt) => {
        try {
            const buf = new Uint8Array(await (await fetch(`fonts/IBMPlexSans-${wt}-latin.woff2`)).arrayBuffer());
            let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
            return `@font-face{font-family:"IBM Plex Sans";font-weight:${wt};src:url(data:font/woff2;base64,${btoa(bin)}) format("woff2");}`;
        } catch (e) { return ''; }
    }));
    _fontCss = parts.join('');
    return _fontCss;
}
const PNG_MAX = 8192;
async function svgToPng(svg, scale) {
    const css = await fontCss();
    const m = /width="(\d+)" height="(\d+)"/.exec(svg), w = Number(m[1]), h = Number(m[2]);
    const k = Math.min(scale, PNG_MAX / w, PNG_MAX / h);
    const withFonts = svg.replace(/(<svg[^>]*>)/, `$1<defs><style>${css}</style></defs>`);
    const url = URL.createObjectURL(new Blob([withFonts], { type: 'image/svg+xml' }));
    try {
        const img = new Image();
        await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('The picture could not be drawn.')); img.src = url; });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('The picture could not be saved.'))), 'image/png'));
    } finally { URL.revokeObjectURL(url); }
}
const svgBlob = (svg) => new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + svg + '\n'], { type: 'image/svg+xml' });

// ---- A zip, for several files at once ----
// Stored, not compressed: a hundred lines here instead of a library, and PNG
// is compressed already. files: [{ name, bytes: Uint8Array }]
let _crcTable = null;
function crc32(bytes) {
    if (!_crcTable) { _crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; _crcTable[n] = c >>> 0; } }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = _crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function zipBlob(files) {
    const enc = new TextEncoder(), chunks = [], central = [];
    let offset = 0;
    const header = (sig, fields) => { const b = new Uint8Array(4 + fields.reduce((n, [size]) => n + size, 0)), v = new DataView(b.buffer); v.setUint32(0, sig, true); let o = 4; fields.forEach(([size, val]) => { if (size === 2) v.setUint16(o, val, true); else v.setUint32(o, val, true); o += size; }); return b; };
    files.forEach((f) => {
        const name = enc.encode(f.name), crc = crc32(f.bytes), n = f.bytes.length;
        // version, flags (bit 11: the name is UTF-8), method 0, time, date, crc, sizes, name length, extra length
        const common = [[2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0x21], [4, crc], [4, n], [4, n], [2, name.length], [2, 0]];
        chunks.push(header(0x04034b50, common), name, f.bytes);
        central.push(header(0x02014b50, [[2, 20]].concat(common, [[2, 0], [2, 0], [2, 0], [4, 0], [4, offset]])), name);
        offset += 30 + name.length + n;
    });
    const size = central.reduce((n, c) => n + c.length, 0);
    return new Blob(chunks.concat(central, [header(0x06054b50, [[2, 0], [2, 0], [2, files.length], [2, files.length], [4, size], [4, offset], [2, 0]])]), { type: 'application/zip' });
}

// ---- The copy sheet ----
// Every text of the interface, one row per element: who it belongs to, its
// key, what it says, and what it says in each language. Sent to whoever
// writes or translates the words, and brought back with bringInSheet.
const csvCell = (v) => { const s = String(v === undefined || v === null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function sheetRows(stopIds) {
    const doc = state.doc, only = new Set(stopIds), rows = [];
    doc.elements.forEach((e) => {
        if (e.type === 'block') return;
        const at = placeOf(e);
        if (!at || (kindOfId(at.holder.id) === 'screens' && !only.has(at.holder.id))) return;
        // A block's elements are listed once, with the block as where they are.
        if (kindOfId(at.holder.id) === 'blocks' && !doc.elements.some((p) => p.type === 'block' && p.block === at.holder.id && only.has((placeOf(p) || { holder: {} }).holder.id))) return;
        if (!ELEMENT_KIT[e.type].lines && !e.text && !e.key) return;
        rows.push({ e, where: kindOfId(at.holder.id) === 'blocks' ? 'Block: ' + (at.holder.name || 'Block') : stopName(at.holder), size: kindOfId(at.holder.id) === 'blocks' ? '' : (at.owner.name || at.owner.w + '×' + at.owner.h) });
    });
    return rows;
}
function sheetCsv(stopIds) {
    const doc = state.doc;
    const head = ['id', 'screen', 'size', 'type', 'name', 'key', doc.lang].concat(doc.langs.map((l) => l.code));
    const lines = [head.map(csvCell).join(',')];
    sheetRows(stopIds).forEach(({ e, where, size }) => {
        lines.push([e.id, where, size, ELEMENT_KIT[e.type].label, e.name, e.key, e.text].concat(doc.langs.map((l) => { const w = e.key ? wordOf(l.id, e.key) : null; return w ? w.text : ''; })).map(csvCell).join(','));
    });
    // The mark at the start tells a spreadsheet the file is UTF-8.
    return '﻿' + lines.join('\r\n') + '\r\n';
}
function parseCsv(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    const s = String(text).replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quoted) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c; }
        else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c !== ''));
}
// A copy sheet brought back, as one step. Rows are matched by id; the text,
// the key and each language's text are taken; a language column that is new
// adds the language. Nothing is added or removed besides.
// -> { texts, keys, words, unknown, error }
function bringInSheet(text) {
    const doc = state.doc, rows = parseCsv(text), res = { texts: 0, keys: 0, words: 0, unknown: 0, error: '' };
    const head = rows.shift() || [], col = (name) => head.indexOf(name);
    if (col('id') < 0 || col(doc.lang) < 0) { res.error = tr('This is not a copy sheet of this workflow: it needs the columns "id" and "{x}".', { x: doc.lang }); return res; }
    if (state.readOnly) { res.error = 'This workflow is open to read only.'; return res; }
    const fixed = new Set(['id', 'screen', 'size', 'type', 'name', 'key', doc.lang]);
    const langCols = head.map((h, i) => [h, i]).filter(([h]) => !fixed.has(h) && fCode(h, ''));
    batch(() => {
        const langIds = new Map(langCols.map(([code]) => [code, addLang(code)]));
        rows.forEach((r) => {
            const e = recOf(doc, r[col('id')]);
            if (!e || kindOfId(e.id) !== 'elements') { res.unknown++; return; }
            if (setF(e.id, 'text', r[col(doc.lang)] || '')) res.texts++;
            if (col('key') >= 0 && setF(e.id, 'key', r[col('key')] || '')) res.keys++;
            langCols.forEach(([code, i]) => {
                const t = r[i] || '', langId = langIds.get(code);
                if (!t && !e.key) return;
                if (!e.key) { setF(e.id, 'key', autoKey(e)); res.keys++; }
                const word = doc.words.find((w) => w.lang === langId && w.key === e.key);
                if (word) { if (setF(word.id, 'text', t)) res.words++; }
                else if (t && change({ op: 'add', kind: 'words', rec: { id: nextId('words'), lang: langId, key: e.key, text: t } })) res.words++;
            });
        });
    });
    return res;
}

// ---- The report ----
// One page of HTML with everything in it, to read, send or print: the
// workflow as a map, each screen with what is on it and where it leads, the
// findings, and where the real work is kept. No script, nothing loaded.
function reportHtml(stopIds, opts = {}) {
    const doc = state.doc, only = new Set(stopIds), h = escapeHtml;
    const stops = stopIds.map((id) => recOf(doc, id)).filter(Boolean);
    const { open, accepted } = sortFindings(doc, findFindings(doc));
    const about = (f) => { const stop = findingStop(doc, f); return !f.id || !stop || only.has(stop); };
    const src = (r) => { const s = r.source ? recOf(doc, r.source) : null; return s && !opts.noSources ? `${h(s.label || SOURCE_KIND_LABEL[s.kind])}${r.at ? ', ' + h(r.at) : ''}` : ''; };
    const way = (l) => { const to = recOf(doc, l.to), el = l.fromEl ? recOf(doc, l.fromEl) : null; return `<li>${h(linkLabel(l) || (el ? elementTitle(el, doc) : tr('Goes on')))} → <strong>${h(to ? stopName(to) : '?')}</strong>${only.has(l.to) ? '' : ` <em>${h(tr('(not in this report)'))}</em>`}</li>`; };
    const nScreens = stops.filter((x) => kindOfId(x.id) === 'screens').length, nDec = stops.filter((x) => kindOfId(x.id) === 'decisions').length, nAll = doc.screens.length + doc.decisions.length;
    const meta = [tn(nScreens, '1 screen', '{n} screens') + ', ' + tn(nDec, '1 decision', '{n} decisions') + (stops.length < nAll ? ' ' + tr('of {n} stops in the workflow', { n: nAll }) : '') + '.',
        tr('Written in {x}.', { x: doc.lang }) + (doc.langs.length ? ' ' + tr('Also in {x}.', { x: doc.langs.map(langLabel).join(', ') }) : ''), new Date().toISOString().slice(0, 10) + '.'].join(' ');
    let body = `<header><p class="kick">Workflow report</p><h1>${h(doc.name || tr('Untitled workflow'))}</h1><p class="meta">${h(meta)}</p></header>`;
    body += `<section><h2>The workflow</h2><div class="map">${svgOfStops(stopIds, 'flow')}</div></section>`;
    body += '<section><h2>Stops</h2>';
    stops.forEach((s, i) => {
        const ways = linksFrom(doc, s.id);
        if (kindOfId(s.id) === 'decisions') {
            body += `<article><h3>${i + 1}. ${h(stopName(s))} <span class="tag">decision</span></h3>${s.note ? `<p>${h(s.note)}</p>` : ''}<ul>${ways.map(way).join('') || `<li>${h(tr('No branches.'))}</li>`}</ul></article>`;
            return;
        }
        const tags = [s.start ? 'start' : '', s.end ? 'end' : '', STATUS_LABEL[s.status].toLowerCase()].filter(Boolean).map((t) => `<span class="tag">${t}</span>`).join(' ');
        body += `<article><h3>${i + 1}. ${h(stopName(s))} ${tags}</h3>`;
        const facts = [s.path ? `${h(tr('Live address:'))} <code>${h(s.path)}</code>` : '', src(s) ? `${h(tr('Kept in:'))} ${src(s)}` : '', s.note ? h(s.note) : ''].filter(Boolean);
        if (facts.length) body += `<p>${facts.join('<br>')}</p>`;
        sizesOf(doc, s.id).forEach((z) => {
            const els = elementsOf(doc, z.id);
            body += `<div class="size"><figure>${svgOfSize(z)}<figcaption>${h(z.name || tr('Size'))} ${z.w}×${z.h}, ${h(tr(INPUT_LABEL[z.input]).toLowerCase())}</figcaption></figure>`
                + (els.length ? '<table><thead><tr><th>Element</th><th>Text</th><th>Key</th><th>Kept in</th></tr></thead><tbody>'
                    + els.map((e) => `<tr><td>${h(elementTitle(e, doc))}</td><td>${h(e.type === 'block' ? '' : e.text)}</td><td><code>${h(e.key)}</code></td><td>${src(e)}</td></tr>`).join('') + '</tbody></table>' : `<p class="meta">${h(tr('Nothing drawn on it.'))}</p>`) + '</div>';
        });
        body += `<h4>Leads to</h4><ul>${ways.map(way).join('') || `<li>${h(s.end ? tr('The workflow ends here.') : tr('Nothing.'))}</li>`}</ul></article>`;
    });
    body += '</section>';
    const mine = open.filter(about), fine = accepted.filter(about);
    body += `<section><h2>Findings</h2>${mine.length ? '<ul class="find">' + mine.map((f) => `<li class="${f.level}"><span class="tag">${h(f.group)}</span> ${f.pin ? '★ ' : ''}${h(f.text)}</li>`).join('') + '</ul>' : `<p>${h(tr('Nothing to report.'))}</p>`}`
        + (fine.length ? '<h4>Accepted as they are</h4><ul class="find">' + fine.map((f) => `<li><span class="tag">${h(f.group)}</span> ${h(f.text)}<br><em>${h(f.accept.reason)}</em></li>`).join('') + '</ul>' : '') + '</section>';
    // Test cases are the whole workflow's: a case runs from a start to an end.
    const cases = stops.length === doc.screens.length + doc.decisions.length ? testCases(doc) : [];
    if (cases.length) {
        body += '<section><h2>Test cases</h2>' + cases.map((c, i) => `<article><h3>${i + 1}. ${h(c.name)}</h3><table><thead><tr><th>Step</th><th>Do</th><th>Expect</th><th>Live address</th></tr></thead><tbody>`
            + caseSteps(doc, c.path).map((s, n) => `<tr><td>${n + 1}</td><td>${h(s.via || tr('Open the workflow'))}</td><td>${h(s.name)}</td><td><code>${h(recOf(doc, s.stop).path)}</code></td></tr>`).join('') + '</tbody></table></article>').join('') + '</section>';
    }
    const runs = doc.runs.slice().sort((a, b) => b.at - a.at);
    if (runs.length) {
        body += '<section><h2>Test runs</h2>' + runs.map((r) => {
            const t = runTally(doc, r.id), b = r.base ? recOf(doc, r.base) : null;
            return `<article><h3>${h(r.name)} <span class="tag" data-raw>${h(t.verdict === 'pass' ? tr('passed') : t.verdict === 'fail' ? tr('{n} failed', { n: t.fail }) : tr('not finished'))}</span></h3>`
                + `<p class="meta">${new Date(r.at).toISOString().slice(0, 10)}${b ? ', ' + h(tr('against {x}', { x: b.name || b.url })) : ''}</p><table><thead><tr><th>Step</th><th>Screen</th><th>To get there</th><th>Result</th><th>Note</th></tr></thead><tbody>`
                + stepsOf(doc, r.id).map((s) => `<tr><td>${s.n + 1}</td><td>${h(s.name)}</td><td>${h(s.via)}</td><td data-tr>${h(RESULT_LABEL[s.result])}</td><td>${h(s.note)}</td></tr>`).join('') + '</tbody></table></article>';
        }).join('') + '</section>';
    }
    if (doc.sources.length && !opts.noSources) {
        body += '<section><h2>Where it is kept</h2><table><thead><tr><th>Source</th><th>Kind</th><th>Address</th></tr></thead><tbody>'
            + doc.sources.map((s) => `<tr><td>${h(s.label)}</td><td>${h(SOURCE_KIND_LABEL[s.kind])}</td><td>${s.url ? `<a href="${h(s.url)}" rel="noopener noreferrer">${h(s.url)}</a>` : ''}</td></tr>`).join('') + '</tbody></table></section>';
    }
    const css = 'body{font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;max-width:960px;margin:0 auto;padding:32px 24px}h1{font-size:30px;margin:0 0 4px}h2{font-size:20px;margin:36px 0 12px;padding-bottom:6px;border-bottom:2px solid #0f172a}h3{font-size:17px;margin:0 0 6px}h4{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#475569;margin:14px 0 4px}'
        + '.kick{font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#475569;margin:0}.meta{color:#475569;margin:4px 0}article{padding:16px 0;border-bottom:1px solid #e2e8f0;break-inside:avoid}.tag{display:inline-block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#475569;border:1px solid #cbd5e1;border-radius:4px;padding:0 5px;vertical-align:middle}'
        + '.map svg{max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:8px}.size{display:flex;gap:20px;align-items:flex-start;margin:12px 0;break-inside:avoid}figure{margin:0;flex:none}figure svg{display:block;width:auto;height:auto;max-width:240px;max-height:360px;border:1px solid #cbd5e1}figcaption{font-size:12px;color:#475569;margin-top:4px}'
        + 'table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#475569}code{font:12px ui-monospace,Menlo,monospace}ul{margin:4px 0;padding-left:20px}.find{list-style:none;padding:0}.find li{padding:6px 10px;margin:4px 0;border-left:3px solid #d97706;background:#f8fafc}.find li.err{border-left-color:#dc2626}a{color:#1d4ed8}@media print{body{padding:0}a{color:inherit}}';
    // The report is in Flow's language: its headings, labels and tags are
    // swapped here; the workflow's own names and texts are left as they are.
    const box = document.createElement('div');
    box.innerHTML = body;
    translateChrome(box, 'h2, h4, th, .tag, .kick, [data-tr]');
    body = box.innerHTML;
    return `<!DOCTYPE html>\n<html lang="${flowLocale()}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><title>${h(doc.name || 'Workflow')} · report</title><style>${css}</style></head><body>${body}</body></html>\n`;
}

// A copy of a document that says nothing of where the real work is kept: a
// private repository's address tells a stranger a lot.
function withoutSources(doc) {
    const raw = serializeDoc(doc);
    raw.sources = [];
    ['screens', 'elements', 'links'].forEach((k) => raw[k].forEach((r) => { delete r.source; delete r.at; }));
    return normalizeDoc(raw);
}
// The document a choice of stops means, whole or a part, with or without sources.
function exportDoc(what, noSources) {
    const ids = exportStops(what), part = what !== 'all';
    const doc = part ? partOfDoc(state.doc, ids) : state.doc;
    return { doc: noSources ? withoutSources(doc) : doc, part, ids };
}

// ---- One way in ----
async function buildExport(o) {
    const doc = state.doc, ids = exportStops(o.what), base = safeName(doc.name);
    if (!ids.length) throw new Error(o.what === 'path' ? 'Mark a way in Walk first.' : o.what === 'all' ? 'There is nothing in this workflow yet.' : 'Select a screen first.');
    const part = o.what !== 'all', tail = part ? (ids.length === 1 ? ' ' + safeName(stopName(recOf(doc, ids[0]))) : ' part') : '';
    const text = (s, type) => new Blob([s], { type });
    const picture = async (svg, name) => (o.format === 'png' ? { name: name + '.png', blob: await svgToPng(svg, o.scale || 1) } : { name: name + '.svg', blob: svgBlob(svg) });
    if (o.as === 'doc') return { name: base + tail + '.flow.json', blob: text(JSON.stringify(fileEnvelope(exportDoc(o.what, o.noSources).doc, part), null, 2) + '\n', 'application/json') };
    if (o.as === 'cases') return { name: base + ' test cases.csv', blob: text(casesCsv(), 'text/csv') };
    if (o.as === 'sheet') return { name: base + tail + ' copy.csv', blob: text(sheetCsv(ids), 'text/csv') };
    if (o.as === 'report') return { name: base + tail + ' report.html', blob: text(reportHtml(ids, { noSources: !!o.noSources }), 'text/html') };
    if (o.as === 'map') return picture(svgOfStops(ids, state.view), base + tail + (state.view === 'flow' ? ' flow' : ' board'));
    if (o.as === 'storyboard') {
        const p = o.what === 'path' ? walkPaths()[state.walk.pick] : null;
        if (!p) throw new Error('A storyboard follows one way: mark it in Walk first.');
        return picture(svgOfStoryboard(p), base + ' storyboard');
    }
    if (o.as === 'screens') {
        const files = [];
        for (const id of ids.filter((i) => kindOfId(i) === 'screens')) {
            const screen = recOf(doc, id), sizes = o.what === 'screen' || o.allSizes ? sizesOf(doc, id) : [shownSize(screen)];
            for (const z of sizes) files.push(await picture(svgOfSize(z), `${safeName(stopName(screen))} ${safeName(z.name || 'size')} ${z.w}x${z.h}`));
        }
        if (!files.length) throw new Error('There is no screen in what you chose.');
        if (files.length === 1) return files[0];
        const seen = new Map(), packed = [];
        for (const f of files) { const n = seen.get(f.name) || 0; seen.set(f.name, n + 1); packed.push({ name: n ? f.name.replace(/(\.\w+)$/, ` ${n + 1}$1`) : f.name, bytes: new Uint8Array(await f.blob.arrayBuffer()) }); }
        return { name: base + tail + ' screens.zip', blob: zipBlob(packed) };
    }
    throw new Error('That is not something Flow can export.');
}

// Some of a workflow brought back into the one it came from, as one step.
function mergeDoc(part) {
    if (state.readOnly) return 0;
    const ops = mergeOps(state.doc, part);
    let done = 0;
    batch(() => ops.forEach((op) => { if (change(op)) done++; }));
    dropMissingSelection();
    render();
    return done;
}
