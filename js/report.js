// The report, in the fleet's document designs, as a PDF or an HTML file.
//
// The designs are Branding's document templates (Branding/documents): letter
// pages with the mark and the wordmark at the head, the kicker, the title,
// the row of cards, numbered sections, ruled tables, dotted lists and a foot
// with the page number, in three themes: white, black and blue. A fourth
// choice, plain, is the report as it was before the designs (reportHtml,
// js/export.js): one flowing page with no design at all.
//
// A design is made of fixed pages, so the report is laid out here: it is cut
// into pieces that are never split (a heading, a row, a list item, a row of
// screens), each is measured as it will be drawn, and the pieces are packed
// into pages. A heading stays with what follows it.
//
// The file is made by the fleet's report engine (carino-pdf.js): the PDF is
// the pages as pictures, the HTML is one file with its fonts and pictures
// written in. Nothing is uploaded.

const REPORT_DESIGNS = [['white', 'White'], ['black', 'Black'], ['blue', 'Blue'], ['plain', 'Plain']];
const REPORT_KEY = 'flow_report_design';
// A letter page in CSS px, and the padding the designs give it.
const REPORT_PAGE = { w: 816, h: 1056, top: 59.52, bottom: 72 };
const REPORT_MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Carino"><path d="M 81.07 25.82 A 34.81 34.81 0 1 0 81.07 74.18" fill="none" stroke="#eab308" stroke-width="16.38" stroke-linecap="butt"/></svg>';

// Branding's document stylesheet (documents/plantilla-documento-*.html), with
// what a workflow report adds to it: the pieces, a stop's title, the pictures
// of the screens, tags and findings.
const REPORT_CSS = `
@page { size: 8.5in 11in; margin: 0; }
:root, [data-theme="black"] {
  --page: radial-gradient(9in 4in at 50% -10%, rgba(234,179,8,0.10) 0%, transparent 62%), linear-gradient(180deg, #0b0b0b 0%, #050505 100%);
  --paper: #050505;
  --card: #0b0b0b; --card-hi: linear-gradient(180deg, rgba(234,179,8,0.07), rgba(234,179,8,0.02));
  --border: #262626; --row: #1a1a1a; --stripe: rgba(255,255,255,0.018); --rule: #525252;
  --text: #ffffff; --body: #e5e5e5; --sec: #a3a3a3; --muted: #8a8a8a;
  --accent: #eab308; --accent-line: rgba(234,179,8,0.30);
  --neg: #fca5a5; --pos: #86efac; --warn: #fcd34d;
  --wm: #eab308; --wm-o: 0.095;
}
[data-theme="white"] {
  --page: radial-gradient(9in 4in at 50% -10%, rgba(234,179,8,0.13) 0%, transparent 62%), #ffffff;
  --paper: #ffffff;
  --card: #fafafa; --card-hi: linear-gradient(180deg, rgba(234,179,8,0.16), rgba(234,179,8,0.05));
  --border: #e2e2e2; --row: #ececec; --stripe: rgba(0,0,0,0.022); --rule: #8a8a8a;
  --text: #0a0a0a; --body: #262626; --sec: #525252; --muted: #6b6b6b;
  --accent: #a15c07; --accent-line: rgba(202,138,4,0.55);
  --neg: #b91c1c; --pos: #15803d; --warn: #b45309;
  --wm: #eab308; --wm-o: 0.125;
}
[data-theme="blue"] {
  --page: radial-gradient(8in 3.6in at 18% -14%, rgba(66,133,244,0.20) 0%, transparent 70%), #eef3fc;
  --paper: #eef3fc;
  --card: #ffffff; --card-hi: linear-gradient(180deg, #ffffff, #e8f0fe);
  --border: #d2dcec; --row: #dbe4f3; --stripe: rgba(11,87,208,0.035); --rule: #7b8aa3;
  --text: #1f1f1f; --body: #2b2f33; --sec: #444746; --muted: #5f6368;
  --accent: #0b57d0; --accent-line: rgba(11,87,208,0.40);
  --neg: #c5221f; --pos: #137333; --warn: #b06000;
  --wm: #0b57d0; --wm-o: 0.05;
}
:root {
  --sans: 'IBM Plex Sans', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
  --display: 'Red Hat Display', 'IBM Plex Sans', sans-serif;
}
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html, body { margin: 0; padding: 0; background: var(--paper); }
body { font-family: var(--sans); color: var(--text); font-size: 10.2pt; line-height: 1.45; }
.page { position: relative; width: 8.5in; height: 11in; overflow: hidden; padding: 0.62in 0.7in 0.75in; background: var(--page); page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.watermark { position: absolute; right: -1.5in; bottom: -1.6in; width: 6.4in; height: 6.4in; opacity: var(--wm-o); }
.watermark svg { width: 100%; height: 100%; }
.watermark path { stroke: var(--wm); }
header { position: relative; display: flex; align-items: center; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: 12px; }
.brand svg { width: 40px; height: 40px; }
.wordmark { font-family: var(--display); font-weight: 900; font-size: 19pt; letter-spacing: -0.01em; color: var(--accent); line-height: 1; }
.wordmark span { color: var(--text); font-weight: 700; }
.meta { text-align: right; font-family: var(--mono); font-size: 7.6pt; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; line-height: 1.6; }
.meta b { color: var(--sec); font-weight: 500; }
.atom { position: relative; display: flow-root; }
.kicker { font-family: var(--mono); font-size: 7.6pt; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin: 22px 0 6px; }
h1 { font-family: var(--display); font-weight: 800; font-size: 23pt; line-height: 1.12; margin: 0 0 6px; letter-spacing: -0.015em; overflow-wrap: anywhere; }
.lede { color: var(--sec); font-size: 10.4pt; margin: 0; max-width: 6.2in; }
.cards { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 10px; margin: 18px 0 6px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 11px 13px; }
.card .l { font-family: var(--mono); font-size: 6.8pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.card .v { font-family: var(--display); font-weight: 800; font-size: 14.5pt; margin-top: 3px; line-height: 1.15; }
.card.hi { border-color: var(--accent-line); background: var(--card-hi); }
.card.hi .v { color: var(--accent); }
.card .s { font-size: 8pt; color: var(--sec); margin-top: 3px; line-height: 1.3; }
h2 { font-family: var(--display); font-weight: 800; font-size: 12.5pt; margin: 20px 0 8px; display: flex; align-items: baseline; gap: 9px; }
h2 i { font-family: var(--mono); font-style: normal; font-weight: 500; font-size: 8pt; color: var(--accent); letter-spacing: 0.08em; }
table { width: 100%; border-collapse: collapse; font-size: 9pt; table-layout: fixed; }
th { font-family: var(--mono); font-weight: 500; font-size: 6.9pt; letter-spacing: 0.11em; text-transform: uppercase; color: var(--muted); text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--accent-line); }
td { padding: 3.4px 10px; border-bottom: 1px solid var(--row); vertical-align: top; overflow-wrap: anywhere; color: var(--body); }
td.c { font-family: var(--mono); color: var(--muted); }
tr.alt td { background: var(--stripe); }
td code, p code { font-family: var(--mono); font-size: 8.2pt; color: var(--sec); }
.neg { color: var(--neg); } .pos { color: var(--pos); }
ul { margin: 0; padding: 0; list-style: none; }
li { position: relative; padding: 3px 0 3px 16px; color: var(--body); overflow-wrap: anywhere; }
li::before { content: ''; position: absolute; left: 2px; top: 10px; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); }
li b { color: var(--text); font-weight: 600; }
li em { color: var(--muted); }
li.err::before { background: var(--neg); }
li.warn::before { background: var(--warn); }
.note { font-size: 8pt; color: var(--muted); margin: 8px 0 0; }
.stop { display: flex; align-items: baseline; gap: 9px; margin: 14px 0 4px; padding-top: 10px; border-top: 1px solid var(--border); font-family: var(--display); font-weight: 700; font-size: 11pt; }
.stop .num { font-family: var(--mono); font-weight: 500; font-size: 8pt; color: var(--accent); letter-spacing: 0.08em; }
.stop .name { overflow-wrap: anywhere; }
.tag { display: inline-block; font-family: var(--mono); font-weight: 500; font-size: 6.6pt; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; vertical-align: middle; white-space: nowrap; }
.tag.hi { color: var(--accent); border-color: var(--accent-line); }
.facts { margin: 0 0 4px; font-size: 9pt; color: var(--sec); }
.sub { font-family: var(--mono); font-size: 6.9pt; letter-spacing: 0.11em; text-transform: uppercase; color: var(--muted); margin: 10px 0 3px; }
.map { margin: 4px 0 2px; padding: 8px; background: #ffffff; border: 1px solid var(--border); border-radius: 10px; text-align: center; }
.map img { display: block; margin: 0 auto; max-width: 100%; max-height: 4.4in; }
.shots { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 16px; margin: 8px 0 4px; }
.shots figure { margin: 0; }
.shots img { display: block; border: 1px solid var(--border); background: #ffffff; }
.shots figcaption { font-family: var(--mono); font-size: 6.9pt; letter-spacing: 0.06em; color: var(--muted); margin-top: 4px; }
a { color: var(--accent); overflow-wrap: anywhere; }
footer { position: absolute; left: 0.7in; right: 0.7in; bottom: 0.36in; display: flex; justify-content: space-between; gap: 12px; font-family: var(--mono); font-size: 7pt; color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase; border-top: 1px solid var(--border); padding-top: 8px; }
footer span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media screen {
  html, body { background: #d6d8dc; }
  .page { margin: 18px auto; box-shadow: 0 2px 14px rgba(0,0,0,0.28); }
}
`;

// ---- The pictures ----
// A screen or the map as a PNG written into the page: the same picture in the
// preview, the PDF and the HTML file, with its text in the right font. Kept
// while the workflow does not change, so another design is drawn at once.
let _reportPics = new Map(), _reportPicsFor = '';
async function reportPic(key, svg, boxW, boxH) {
    const stamp = state.seq + '|' + state.lang;
    if (_reportPicsFor !== stamp) { _reportPics = new Map(); _reportPicsFor = stamp; }
    if (_reportPics.has(key)) return _reportPics.get(key);
    const m = /width="(\d+)" height="(\d+)"/.exec(svg), w = Number(m[1]), h = Number(m[2]);
    // Shown inside boxW × boxH; drawn at twice that, and never above twice its own size.
    const k = Math.min(1, boxW / w, boxH / h), showW = Math.max(1, Math.round(w * k)), showH = Math.max(1, Math.round(h * k));
    const blob = await svgToPng(svg, Math.min(2, k * 2));
    const url = await new Promise((ok, bad) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = () => bad(new Error('The picture could not be drawn.')); fr.readAsDataURL(blob); });
    const pic = { url, w: showW, h: showH };
    _reportPics.set(key, pic);
    return pic;
}

// ---- The pieces ----
// -> { head, foot, atoms: [{ html, keep }] }. keep: it stays on the page of
// the piece after it. Everything is in Flow's language; the workflow's own
// names and texts are left as they are.
async function reportPieces(stopIds, opts = {}) {
    const doc = state.doc, only = new Set(stopIds), h = escapeHtml;
    const stops = stopIds.map((id) => recOf(doc, id)).filter(Boolean);
    const { open, accepted } = sortFindings(doc, findFindings(doc));
    const about = (f) => { const stop = findingStop(doc, f); return !f.id || !stop || only.has(stop); };
    const mine = open.filter(about), fine = accepted.filter(about);
    const src = (r) => { const s = r.source ? recOf(doc, r.source) : null; return s && !opts.noSources ? `${h(s.label || tr(SOURCE_KIND_LABEL[s.kind]))}${r.at ? ', ' + h(r.at) : ''}` : ''; };
    const atoms = [];
    const A = (html, keep) => atoms.push({ html, keep: !!keep });
    let sec = 0;
    const H2 = (title) => A(`<h2><i>${String(++sec).padStart(2, '0')}</i> ${h(tr(title))}</h2>`, true);
    const sub = (text) => A(`<div class="sub">${h(text)}</div>`, true);
    const cols = (ws) => `<colgroup>${ws.map((w) => `<col style="width:${w}%">`).join('')}</colgroup>`;
    const thead = (ws, names) => A(`<table>${cols(ws)}<thead><tr>${names.map((n) => `<th>${h(tr(n))}</th>`).join('')}</tr></thead></table>`, true);
    const row = (ws, cells, i) => A(`<table>${cols(ws)}<tbody><tr${i % 2 ? ' class="alt"' : ''}>${cells.map((c, j) => `<td${j === 0 && /^\d+$/.test(c) ? ' class="c"' : ''}>${c}</td>`).join('')}</tr></tbody></table>`);
    const item = (html, cls = '') => A(`<ul><li${cls ? ` class="${cls}"` : ''}>${html}</li></ul>`);
    const tag = (text, hi) => `<span class="tag${hi ? ' hi' : ''}">${h(tr(text))}</span>`;
    const way = (l) => { const to = recOf(doc, l.to), el = l.fromEl ? recOf(doc, l.fromEl) : null; return `${h(linkLabel(l) || (el ? elementTitle(el, doc) : tr('Goes on')))} → <b>${h(to ? stopName(to) : '?')}</b>${only.has(l.to) ? '' : ` <em>${h(tr('(not in this report)'))}</em>`}`; };

    // The first piece: what the report is, and its numbers.
    const screens = stops.filter((x) => kindOfId(x.id) === 'screens'), decisions = stops.filter((x) => kindOfId(x.id) === 'decisions');
    const nAll = doc.screens.length + doc.decisions.length, ways = doc.links.filter((l) => only.has(l.from)).length;
    const date = new Date().toISOString().slice(0, 10);
    const lede = [stops.length < nAll ? tr('{n} of {n2} stops of the workflow.', { n: stops.length, n2: nAll }) : '',
        tr('Written in {x}.', { x: doc.lang }) + (doc.langs.length ? ' ' + tr('Also in {x}.', { x: doc.langs.map(langLabel).join(', ') }) : '')].filter(Boolean).join(' ');
    const card = (label, value, note, hi) => `<div class="card${hi ? ' hi' : ''}"><div class="l">${h(tr(label))}</div><div class="v">${h(value)}</div><div class="s">${h(note)}</div></div>`;
    const sizes = screens.reduce((n, s) => n + sizesOf(doc, s.id).length, 0), errs = mine.filter((f) => f.level === 'err').length;
    A(`<div class="kicker">${h(tr('Workflow report'))}</div><h1>${h(doc.name || tr('Untitled workflow'))}</h1><p class="lede">${h(lede)}</p><div class="cards">`
        + card('Screens', String(screens.length), tn(sizes, '1 size drawn', '{n} sizes drawn'), true)
        + card('Decisions', String(decisions.length), tn(decisions.reduce((n, d) => n + linksFrom(doc, d.id).length, 0), '1 branch', '{n} branches'))
        + card('Ways', String(ways), tr('between the stops'))
        + card('Findings', String(mine.length), mine.length ? tn(errs, '1 to put right', '{n} to put right') : tr('Nothing to report.'))
        + '</div>');

    // The workflow as a map.
    H2('The workflow');
    const map = await reportPic('map:' + stopIds.join(), svgOfStops(stopIds, 'flow'), 664, 422);
    A(`<div class="map"><img src="${map.url}" width="${map.w}" height="${map.h}" alt="${h(tr('The workflow, every stop a card'))}"></div>`);

    // Every stop.
    H2('Stops');
    for (let i = 0; i < stops.length; i++) {
        const s = stops[i], out = linksFrom(doc, s.id), num = String(i + 1).padStart(2, '0');
        if (kindOfId(s.id) === 'decisions') {
            A(`<div class="stop"><span class="num">${num}</span><span class="name">${h(stopName(s))}</span> ${tag('decision', true)}</div>`, true);
            if (s.note) A(`<p class="facts">${h(s.note)}</p>`, true);
            if (out.length) out.forEach((l) => item(way(l))); else item(h(tr('No branches.')));
            continue;
        }
        const tags = [s.start ? tag('start', true) : '', s.end ? tag('end', true) : '', tag(STATUS_LABEL[s.status].toLowerCase())].filter(Boolean).join(' ');
        A(`<div class="stop"><span class="num">${num}</span><span class="name">${h(stopName(s))}</span> ${tags}</div>`, true);
        const facts = [s.path ? `${h(tr('Live address:'))} <code>${h(s.path)}</code>` : '', src(s) ? `${h(tr('Kept in:'))} ${src(s)}` : '', s.note ? h(s.note) : ''].filter(Boolean);
        if (facts.length) A(`<p class="facts">${facts.join('<br>')}</p>`, true);
        const zs = sizesOf(doc, s.id);
        // Every size of the screen, side by side: a phone beside its desktop.
        let shots = '';
        for (const z of zs) {
            const pic = await reportPic('size:' + z.id, svgOfSize(z), zs.length > 2 ? 200 : 310, 250);
            shots += `<figure><img src="${pic.url}" width="${pic.w}" height="${pic.h}" alt="${h(stopName(s) + ', ' + (z.name || tr('Size')))}"><figcaption>${h(z.name || tr('Size'))} ${z.w}×${z.h} · ${h(tr(INPUT_LABEL[z.input]).toLowerCase())}</figcaption></figure>`;
        }
        if (shots) A(`<div class="shots">${shots}</div>`);
        zs.forEach((z) => {
            const els = elementsOf(doc, z.id), W = opts.noSources ? [30, 46, 24] : [24, 36, 18, 22], names = ['Element', 'Text', 'Key'].concat(opts.noSources ? [] : ['Kept in']);
            if (!els.length) return;
            sub(`${z.name || tr('Size')} ${z.w}×${z.h}`);
            thead(W, names);
            els.forEach((e, n) => row(W, [h(elementTitle(e, doc)), h(e.type === 'block' ? '' : e.text), e.key ? `<code>${h(e.key)}</code>` : ''].concat(opts.noSources ? [] : [src(e)]), n));
        });
        sub(tr('Leads to'));
        if (out.length) out.forEach((l) => item(way(l))); else item(h(s.end ? tr('The workflow ends here.') : tr('Nothing.')));
    }

    // The findings, by what kind each is.
    H2('Findings');
    if (!mine.length) A(`<p class="facts">${h(tr('Nothing to report.'))}</p>`);
    CHECK_CLASSES.concat([['other', 'Other']]).forEach(([key, label]) => {
        const list = mine.filter((f) => f.cls === key);
        if (!list.length) return;
        sub(`${tr(label)} · ${list.length}`);
        list.forEach((f) => item(`${f.pin ? '★ ' : ''}${h(f.text)}`, f.level));
    });
    if (fine.length) {
        sub(tr('Accepted as they are'));
        fine.forEach((f) => item(`${h(f.text)}<br><em>${h(f.accept.reason)}</em>`));
    }

    // Test cases are the whole workflow's: a case runs from a start to an end.
    const cases = stops.length === nAll ? testCases(doc) : [];
    if (cases.length) {
        H2('Test cases');
        const W = [8, 34, 30, 28];
        cases.forEach((c, i) => {
            sub(`${i + 1}. ${c.name}`);
            thead(W, ['Step', 'Do', 'Expect', 'Live address']);
            caseSteps(doc, c.path).forEach((st, n) => row(W, [String(n + 1), h(st.via || tr('Open the workflow')), h(st.name), `<code>${h(recOf(doc, st.stop).path)}</code>`], n));
        });
    }
    const runs = doc.runs.slice().sort((a, b) => b.at - a.at);
    if (runs.length) {
        H2('Test runs');
        const W = [8, 24, 28, 14, 26];
        runs.forEach((r) => {
            const t = runTally(doc, r.id), b = r.base ? recOf(doc, r.base) : null;
            const verdict = t.verdict === 'pass' ? tr('passed') : t.verdict === 'fail' ? tr('{n} failed', { n: t.fail }) : tr('not finished');
            sub(`${r.name} · ${verdict} · ${new Date(r.at).toISOString().slice(0, 10)}${b ? ' · ' + tr('against {x}', { x: b.name || b.url }) : ''}`);
            thead(W, ['Step', 'Screen', 'To get there', 'Result', 'Note']);
            stepsOf(doc, r.id).forEach((st, n) => row(W, [String(st.n + 1), h(st.name), h(st.via), `<span class="${st.result === 'pass' ? 'pos' : st.result === 'fail' ? 'neg' : ''}">${h(tr(RESULT_LABEL[st.result]))}</span>`, h(st.note)], n));
        });
    }
    if (doc.sources.length && !opts.noSources) {
        H2('Where it is kept');
        const W = [28, 16, 56];
        thead(W, ['Source', 'Kind', 'Address']);
        doc.sources.forEach((s, n) => row(W, [h(s.label), h(tr(SOURCE_KIND_LABEL[s.kind])), s.url ? `<a href="${h(s.url)}" rel="noopener noreferrer">${h(s.url)}</a>` : ''], n));
    }
    A(`<p class="note">${h(tr('Made with Flow in a browser. Nothing in this report was uploaded.'))}</p>`);

    const head = `<header><div class="brand">${REPORT_MARK}<div class="wordmark">Carino <span>Flow</span></div></div>`
        + `<div class="meta"><b>${h(tr('Workflow report'))}</b><br>${date}<br>${h(doc.name || tr('Untitled workflow'))}</div></header>`;
    const foot = (i, n) => `<footer><span>flow.carino.systems</span><span>${h(tr('Workflow report'))} · ${h(doc.name || tr('Untitled workflow'))}</span><span>${i} / ${n}</span></footer>`;
    return { head, foot, atoms };
}

// ---- Packing the pieces into pages ----
// heights[i], keeps[i] -> the pages, each a list of piece numbers. A piece
// that is kept with the next goes over the page with it, so no heading is
// left at the foot of a page. A piece taller than a page has one to itself.
function packPages(heights, keeps, room) {
    const pages = [[]];
    let used = 0;
    for (let i = 0; i < heights.length; i++) {
        let chain = heights[i];
        for (let j = i; keeps[j] && j + 1 < heights.length; j++) chain += heights[j + 1];
        // What is kept together and still too tall for a page starts one anyway.
        if (used > 0 && used + Math.min(chain, room) > room) { pages.push([]); used = 0; }
        pages[pages.length - 1].push(i);
        used += heights[i];
    }
    return pages;
}

const reportFontsUrl = () => new URL('fonts/carino-fonts.css', document.baseURI).href;
const reportShell = (theme, title, body) => `<!DOCTYPE html>\n<html lang="${flowLocale()}" data-theme="${theme}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer">`
    + `<title>${escapeHtml(title)}</title><link rel="stylesheet" href="${escapeHtml(reportFontsUrl())}"><style>${REPORT_CSS}</style></head><body>${body}</body></html>\n`;

// Each piece's height as it will be drawn: in a frame of the page's width,
// with the design's stylesheet and the fonts loaded.
async function measurePieces(theme, parts) {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = `position:fixed;left:-${REPORT_PAGE.w + 400}px;top:0;width:${REPORT_PAGE.w}px;height:${REPORT_PAGE.h}px;border:0;pointer-events:none;`;
    document.body.appendChild(f);
    try {
        const d = f.contentDocument;
        d.open();
        d.write(reportShell(theme, 'measure', `<section class="page" style="height:auto;overflow:visible">${parts.head}${parts.atoms.map((a) => `<div class="atom">${a.html}</div>`).join('')}</section>`));
        d.close();
        const waits = [];
        d.querySelectorAll('link[rel="stylesheet"]').forEach((l) => { if (!l.sheet) waits.push(new Promise((r) => { l.addEventListener('load', r); l.addEventListener('error', r); setTimeout(r, 4000); })); });
        Array.from(d.images).forEach((img) => { if (!img.complete) waits.push(new Promise((r) => { img.onload = img.onerror = r; })); });
        await Promise.all(waits);
        if (d.fonts && d.fonts.ready) await Promise.race([d.fonts.ready, new Promise((r) => setTimeout(r, 3000))]);
        return { head: d.querySelector('header').getBoundingClientRect().height, heights: Array.from(d.querySelectorAll('.atom')).map((e) => e.getBoundingClientRect().height) };
    } finally { f.remove(); }
}

// -> { html, pages }: the report in one of the designs, as letter pages.
async function reportDesigned(stopIds, opts = {}) {
    const theme = ['white', 'black', 'blue'].includes(opts.theme) ? opts.theme : 'white';
    const parts = await reportPieces(stopIds, opts);
    const m = await measurePieces(theme, parts);
    const room = REPORT_PAGE.h - REPORT_PAGE.top - REPORT_PAGE.bottom - m.head - 2;
    const pages = packPages(m.heights, parts.atoms.map((a) => a.keep), room);
    const body = pages.map((list, i) => `<section class="page"><div class="watermark" aria-hidden="true">${REPORT_MARK}</div>${parts.head}`
        + list.map((n) => `<div class="atom">${parts.atoms[n].html}</div>`).join('') + parts.foot(i + 1, pages.length) + '</section>').join('\n');
    return { html: reportShell(theme, (state.doc.name || 'Workflow') + ' · ' + tr('report'), body), pages: pages.length };
}

// ---- The preview ----
// The fleet's report preview (carino-ui.css 18b): the choices, the PDF | HTML
// switch, the file's name, Print and Download on the left, the report itself
// on the right.
const _rp = { what: 'all', html: '', turn: 0, sw: null, busy: false };
const reportEngine = () => (window.CarinoPdf && typeof window.CarinoPdf.download === 'function' ? window.CarinoPdf : null);
const reportChoice = () => ({
    design: (document.querySelector('input[name="reportDesign"]:checked') || {}).value || 'white',
    noSources: $('reportNoSources').checked
});
function reportBaseName() {
    const doc = state.doc, ids = exportStops(_rp.what);
    const tail = _rp.what !== 'all' ? (ids.length === 1 ? ' ' + safeName(stopName(recOf(doc, ids[0]))) : ' part') : '';
    return safeName(doc.name) + tail + ' report';
}
function reportFormat() { return _rp.sw ? _rp.sw.get() : 'html'; }
function reportFileName() {
    const eng = reportEngine(), format = reportFormat();
    return eng ? eng.fileName(reportBaseName(), format) : reportBaseName() + '.' + format;
}
function paintReportSide() {
    const eng = reportEngine(), format = reportFormat();
    if (_rp.sw) _rp.sw.relabel();
    $('reportName').textContent = reportFileName();
    $('reportGo').textContent = eng ? eng.label(format) : tr('Download HTML');
    $('reportGo').disabled = _rp.busy || !_rp.html;
    $('reportPrint').disabled = _rp.busy || !_rp.html;
    $('reportSourcesRow').hidden = !state.doc.sources.length;
}
const reportSay = (text, bad) => { const p = $('reportStatus'); p.textContent = text; p.classList.toggle('bad', !!bad); };
// The page is shown at its own width, made smaller when the stage is narrower.
function fitReportFrame() {
    const stage = $('reportStage'), frame = $('reportFrame'), plain = reportChoice().design === 'plain';
    const want = plain ? Math.min(1000, Math.max(320, stage.clientWidth)) : REPORT_PAGE.w + 52, k = Math.min(1, stage.clientWidth / want);
    frame.style.width = want + 'px';
    frame.style.height = Math.max(200, stage.clientHeight / k) + 'px';
    frame.style.transformOrigin = '0 0';
    frame.style.transform = k < 1 ? `scale(${k})` : '';
    frame.style.marginLeft = k < 1 ? '0' : Math.max(0, (stage.clientWidth - want) / 2) + 'px';
    stage.classList.add('rpv-fit');
}
async function drawReport() {
    const turn = ++_rp.turn, c = reportChoice();
    _rp.busy = true; _rp.html = '';
    reportSay(tr('Laying out the pages…'));
    paintReportSide();
    try {
        const ids = exportStops(_rp.what);
        if (!ids.length) throw new Error(_rp.what === 'path' ? 'Mark a way in Walk first.' : _rp.what === 'all' ? 'There is nothing in this workflow yet.' : 'Select a screen first.');
        const out = c.design === 'plain' ? { html: reportHtml(ids, { noSources: c.noSources }), pages: 0 } : await reportDesigned(ids, { theme: c.design, noSources: c.noSources });
        if (turn !== _rp.turn) return false;
        _rp.html = out.html;
        $('reportFrame').srcdoc = out.html;
        reportSay(out.pages ? tn(out.pages, '1 page', '{n} pages') + ' · ' + tr('Letter') : tr('One flowing page, with no design.'));
    } catch (e) {
        if (turn !== _rp.turn) return false;
        $('reportFrame').srcdoc = '';
        reportSay(tr((e && e.message) || 'The report could not be made.'), true);
    }
    _rp.busy = false;
    paintReportSide(); fitReportFrame();
    return !!_rp.html;
}
// what: 'all', 'selected', 'path' or 'screen' (exportStops, js/export.js).
async function openReport(what, noSources) {
    _rp.what = what || 'all';
    const eng = reportEngine();
    if (eng) eng.t = tr;
    if (eng && !_rp.sw) {
        _rp.sw = eng.formatSwitch({ onChange: paintReportSide });
        _rp.sw.el.id = 'reportFormat';
        $('reportName').before(_rp.sw.el);
    }
    let design = 'white';
    try { design = localStorage.getItem(REPORT_KEY) || 'white'; } catch (e) { /* no storage */ }
    if (!REPORT_DESIGNS.some(([k]) => k === design)) design = 'white';
    document.querySelectorAll('input[name="reportDesign"]').forEach((r) => { r.checked = r.value === design; });
    $('reportNoSources').checked = !!noSources;
    openDlg('reportDlg');
    return drawReport();
}
function onReportChange(ev) {
    if (ev.target && ev.target.name === 'reportDesign') { try { localStorage.setItem(REPORT_KEY, ev.target.value); } catch (e) { /* it lasts for this visit */ } }
    drawReport();
}
function printReport() {
    const w = $('reportFrame').contentWindow;
    if (!_rp.html || !w) return;
    w.focus(); w.print();
}
async function downloadReport() {
    if (!_rp.html || _rp.busy) return null;
    const eng = reportEngine(), format = reportFormat(), name = reportFileName();
    // Without the engine there is still the HTML, as it is.
    if (!eng) { saveBlob(new Blob([_rp.html], { type: 'text/html' }), name); reportSay(tr('Saved as {x}.', { x: name })); return { ok: true, name, format: 'html' }; }
    _rp.busy = true; paintReportSide();
    reportSay(tr(format === 'pdf' ? 'Creating the PDF…' : 'Working…'));
    const res = await eng.download({ html: _rp.html, name: reportBaseName(), format, title: (state.doc.name || 'Workflow') + ' · ' + tr('report'), fonts: 'fonts/carino-fonts.css', producer: 'Carino Flow', save: saveBlob });
    _rp.busy = false; paintReportSide();
    reportSay(res.ok ? tr('Saved as {x}.', { x: res.name }) : tr(format === 'pdf' ? 'Could not create the PDF.' : 'That could not be exported.'), !res.ok);
    return res;
}
