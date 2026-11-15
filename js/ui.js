// Drawing: the board (one SVG, redrawn whole) and the rail beside it.
// Nothing in this file changes the document; js/app.js does.

const $ = (id) => document.getElementById(id);
const esc = escapeHtml;

// Colours are written as attributes, not left to the stylesheet, so a later
// export of this SVG carries them with it. The board is a light document in
// both of the site's themes.
const INK = {
    frame: '#ffffff', frameLine: '#94a3b8', name: '#0f172a', dim: '#64748b',
    box: '#f1f5f9', boxLine: '#cbd5e1', text: '#0f172a',
    button: '#0f172a', buttonText: '#ffffff',
    input: '#ffffff', inputLine: '#94a3b8', placeholder: '#94a3b8',
    image: '#e2e8f0', imageLine: '#cbd5e1',
    decision: '#fffbeb', decisionLine: '#d97706', block: '#7c3aed',
    link: '#334155', linkBack: '#94a3b8', sel: '#2563eb',
    // A selected link, and a way marked in Walk: Topo's gold.
    linkSel: '#eab308',
    linkText: '#1d4ed8', alert: '#fef3c7', alertLine: '#f59e0b',
    err: '#dc2626', warn: '#d97706', chip: '#e2e8f0', chipOn: '#0f172a'
};
const FONT = '"IBM Plex Sans", system-ui, sans-serif';

// Set while a picture of some stops is being made (js/export.js): the stops drawn.
let _only = null;

// ---- Findings, worked out once per saved change ----
let _findings = null, _findingsSeq = -1;
function findingsSorted() {
    // Findings are written in Flow's language, so a change of it is a reason to work them out again.
    const key = state.seq + flowLocale();
    if (!_findings || _findingsSeq !== key) { _findings = sortFindings(state.doc, findFindings(state.doc)); _findingsSeq = key; }
    return _findings;
}
// The findings still to be dealt with: what the badges and the count show.
// An accepted finding is in neither.
const findingsNow = () => findingsSorted().open;

// ---- Which drawing of a screen is on the board ----
function shownSize(screen) {
    const sizes = sizesOf(state.doc, screen.id);
    return sizes.find((s) => s.id === state.sizeShown[screen.id]) || sizes[0];
}
const boxOfStop = (stop) => (state.view === 'flow' && isStopId(stop.id) ? flowLayout().get(stop.id)
    : kindOfId(stop.id) === 'blocks' ? { x: stop.x, y: stop.y, w: stop.w, h: stop.h, diamond: false }
    : stopBox(stop, kindOfId(stop.id) === 'screens' ? shownSize(stop) : null));
// Where an element is: what holds it on the board (its screen, or its block),
// that holder's corner, and whether its size is the one on show.
function placeOf(el) {
    const doc = state.doc, owner = recOf(doc, el.size);
    if (!owner) return null;
    if (kindOfId(owner.id) === 'blocks') return { owner, holder: owner, x: owner.x, y: owner.y, shown: true };
    const screen = recOf(doc, owner.screen);
    return screen ? { owner, holder: screen, x: screen.x, y: screen.y, shown: shownSize(screen).id === owner.id } : null;
}
// What elements are drawn on, for a screen (its size on show) or a block (itself).
const drawnOn = (holder) => (kindOfId(holder.id) === 'blocks' ? holder : shownSize(holder));
// Everything on the board that has a box, for framing the whole board.
function boardBounds() {
    const boxes = state.doc.screens.concat(state.doc.decisions).map(boxOfStop).concat(state.view === 'flow' ? [] : state.doc.blocks.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h })));
    if (!boxes.length) return null;
    const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- Measuring text ----
let _measure = null;
const _widths = new Map();
function textWidth(text, px, weight = 400) {
    if (!_measure) { try { _measure = document.createElement('canvas').getContext('2d'); } catch (e) { _measure = null; } }
    if (!_measure) return String(text).length * px * 0.55;
    // Measured once per text, size and weight: a board of thousands of
    // elements asks for the same widths on every redraw.
    const key = weight + '|' + px + '|' + text;
    let width = _widths.get(key);
    if (width === undefined) {
        _measure.font = `${weight} ${px}px ${FONT}`;
        width = _measure.measureText(text).width;
        if (_widths.size > 20000) _widths.clear();
        _widths.set(key, width);
    }
    return width;
}
// Text broken into lines no wider than maxW. A word longer than a line stays whole.
function wrapLines(text, px, weight, maxW) {
    const lines = [];
    String(text).split('\n').forEach((para) => {
        let line = '';
        para.split(/\s+/).filter(Boolean).forEach((word) => {
            const next = line ? line + ' ' + word : word;
            if (line && textWidth(next, px, weight) > maxW) { lines.push(line); line = word; }
            else line = next;
        });
        lines.push(line);
    });
    return lines;
}
const n1 = (v) => Math.round(v * 10) / 10;

// ---- The board ----
// u is one screen pixel in board units, so names, badges and handles keep
// their size on screen at any zoom while the screens themselves scale.
function drawBoard() {
    const svg = $('board'), doc = state.doc, cam = state.camera, u = 1 / cam.zoom;
    const parts = [];
    _trail = walkTrail();
    if (state.view === 'flow') parts.push(flowStopsSvg(u));
    else {
        doc.screens.forEach((s) => parts.push(screenSvg(s, u)));
        doc.decisions.forEach((d) => parts.push(decisionSvg(d, u)));
        doc.blocks.forEach((b) => parts.push(blockSvg(b, u)));
    }
    parts.push(linksSvg(u));
    parts.push(badgesSvg(u));
    parts.push(selectionSvg(u));
    // The others in a live room: their pointers and what they have selected.
    parts.push(presenceSvg(u));
    // Where a tile being dragged from the Add grid would land.
    if (state.dropOn) { const h = recOf(doc, state.dropOn); if (h) { const b = boxOfStop(h); parts.push(`<rect class="drop-on" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${n1(Math.min(12, b.w / 20))}" fill="#16a34a" fill-opacity="0.08" stroke="#16a34a" stroke-width="3" vector-effect="non-scaling-stroke" pointer-events="none"/>`); } }
    if (state.linking) {
        const l = state.linking;
        parts.push(`<line x1="${n1(l.x0)}" y1="${n1(l.y0)}" x2="${n1(l.x)}" y2="${n1(l.y)}" stroke="${INK.sel}" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`);
    }
    if (state.marquee) {
        const m = state.marquee;
        parts.push(`<rect x="${n1(Math.min(m.x0, m.x1))}" y="${n1(Math.min(m.y0, m.y1))}" width="${n1(Math.abs(m.x1 - m.x0))}" height="${n1(Math.abs(m.y1 - m.y0))}" fill="${INK.sel}" fill-opacity="0.08" stroke="${INK.sel}" stroke-width="1" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`);
    }
    svg.innerHTML = `<g id="world" transform="translate(${n1(cam.x)} ${n1(cam.y)}) scale(${cam.zoom})">${parts.join('')}</g>`;
    const empty = !doc.screens.length && !doc.decisions.length && (state.view === 'flow' || !doc.blocks.length);
    $('boardEmpty').hidden = !empty;
    $('zoomLabel').textContent = Math.round(cam.zoom * 100) + '%';
}

// The selection's outline and handles, drawn last so nothing covers them: a
// link's label can sit right where a handle is. They carry the record's id,
// so a press on a handle is a press on that record.
function selectionSvg(u) {
    const doc = state.doc;
    let s = '';
    state.selection.forEach((entry) => {
        const rec = recOf(doc, entry.id);
        if (!rec || entry.type === 'sources' || entry.type === 'sizes') return;
        // A selected link has no box: its ✕ sits over the middle of it.
        if (entry.type === 'links') {
            const g = linkGeometry(rec, u);
            if (g && !state.readOnly) s += `<g class="sel-layer" data-id="${rec.id}">${deleteDisc(g.mid.x, g.mid.y - 24 * u, u)}</g>`;
            return;
        }
        if (entry.type === 'styles' || entry.type === 'langs' || entry.type === 'words') return;
        // The flow view shows stops and links only.
        if (state.view === 'flow' && !isStopId(rec.id)) return;
        let box, outline = true, resize = false, link = true;
        if (entry.type === 'elements') {
            const at = placeOf(rec);
            if (!at || !at.shown) return;
            box = { x: at.x + rec.x, y: at.y + rec.y, w: rec.w, h: rec.h }; resize = true;
            // Only what is on a screen can lead somewhere.
            link = kindOfId(at.holder.id) === 'screens';
        } else if (entry.type === 'blocks') {
            box = { x: rec.x, y: rec.y, w: rec.w, h: rec.h }; link = false;
        } else {
            box = boxOfStop(rec); outline = !box.diamond;
        }
        s += `<g class="sel-layer" data-id="${rec.id}" transform="translate(${box.x} ${box.y})">`;
        if (outline) s += `<rect class="sel-box" width="${box.w}" height="${box.h}" fill="none" stroke="${INK.sel}" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        if (!state.readOnly && state.selection.size === 1) {
            if (resize) s += `<rect data-h="resize" x="${n1(box.w - 5 * u)}" y="${n1(box.h - 5 * u)}" width="${n1(10 * u)}" height="${n1(10 * u)}" fill="#ffffff" stroke="${INK.sel}" stroke-width="1.5" vector-effect="non-scaling-stroke"><title>Drag to resize</title></rect>`;
            const cx = box.w + 18 * u, cy = box.h / 2, r = 9 * u;
            if (link) s += `<g data-h="link"><title>Drag to the stop this leads to</title><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(r)}" fill="${INK.sel}"/>`
                + `<path d="M ${n1(cx - 4 * u)} ${n1(cy)} H ${n1(cx + 4 * u)} M ${n1(cx + 1 * u)} ${n1(cy - 3 * u)} L ${n1(cx + 4 * u)} ${n1(cy)} L ${n1(cx + 1 * u)} ${n1(cy + 3 * u)}" fill="none" stroke="#ffffff" stroke-width="1.5" vector-effect="non-scaling-stroke" pointer-events="none"/></g>`;
        }
        // The ✕ that deletes what is selected, as on Topo's map.
        if (!state.readOnly) s += deleteDisc(box.w + 18 * u, box.h / 2 - 26 * u, u);
        s += '</g>';
    });
    return s;
}
// Topo's disc button: a red disc in a white ring with a white ✕.
function deleteDisc(x, y, u) {
    return `<g class="node-delete" data-h="del" transform="translate(${n1(x)} ${n1(y)})"><title>${esc(tr('Delete'))}</title>`
        + `<circle r="${n1(7.5 * u)}" fill="#dc2626" stroke="#ffffff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        + `<text y="${n1(3 * u)}" text-anchor="middle" font-size="${n1(9 * u)}" font-weight="900" fill="#ffffff" font-family="sans-serif" pointer-events="none">✕</text></g>`;
}

function screenSvg(screen, u) {
    const doc = state.doc, size = shownSize(screen), H = sizeHeight(size), sel = inSelection(screen.id);
    const tags = [screen.stub ? tr('not included') : '', screen.start ? tr('start') : '', screen.end ? tr('end') : '', screen.status !== 'drawn' ? tr(STATUS_LABEL[screen.status]).toLowerCase() : ''].filter(Boolean);
    let s = `<g class="stop screen${sel ? ' sel' : ''}" data-id="${screen.id}" data-stop="1" transform="translate(${screen.x} ${screen.y})"${dimAttr(screen.id)}>`;
    s += `<text class="stop-name" x="0" y="${n1(-10 * u)}" font-family='${FONT}' font-size="${n1(14 * u)}" font-weight="600" fill="${INK.name}">${esc(stopName(screen))}`
        + (tags.length ? `<tspan font-weight="400" fill="${INK.dim}"> · ${esc(tags.join(' · '))}</tspan>` : '') + '</text>';
    s += `<rect class="frame" width="${size.w}" height="${H}" rx="${n1(Math.min(12, size.w / 20))}" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1.5"${screen.stub ? ' stroke-dasharray="8 6"' : ''} vector-effect="non-scaling-stroke"/>`;
    if (size.contentH > size.h) {
        s += `<line x1="0" y1="${size.h}" x2="${size.w}" y2="${size.h}" stroke="${INK.frameLine}" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`
            + `<text x="${n1(size.w + 6 * u)}" y="${n1(size.h + 4 * u)}" font-family='${FONT}' font-size="${n1(11 * u)}" fill="${INK.dim}" pointer-events="none">fold</text>`;
    }
    elementsOf(doc, size.id).forEach((e) => { s += elementSvg(e, u); });
    // The sizes this screen is drawn at, under the frame; a click shows another.
    let cx = 0;
    sizesOf(doc, screen.id).forEach((z) => {
        const label = `${z.name || 'Size'} ${z.w}×${z.h}`, on = z.id === size.id;
        const w = textWidth(label, 11, 500) * u + 14 * u;
        s += `<g data-act="show-size" data-size="${z.id}" class="size-chip"><title>Show this size</title>`
            + `<rect x="${n1(cx)}" y="${n1(H + 8 * u)}" width="${n1(w)}" height="${n1(20 * u)}" rx="${n1(10 * u)}" fill="${on ? INK.chipOn : INK.chip}"/>`
            + `<text x="${n1(cx + 7 * u)}" y="${n1(H + 22 * u)}" font-family='${FONT}' font-size="${n1(11 * u)}" font-weight="500" fill="${on ? '#ffffff' : INK.name}">${esc(label)}</text></g>`;
        cx += w + 6 * u;
    });
    return s + '</g>';
}

// One element, drawn inside its size's frame. Every type is plain shapes and
// text: no foreignObject, so the same markup can be exported as it is.
function elementSvg(e, u, inside) {
    const doc = state.doc, sel = !inside && inSelection(e.id), w = e.w, h = e.h;
    // Its look comes from its styles when it has them: change the style and
    // every element that points at it changes.
    const style = (id, kind) => { const r = id ? recOf(doc, id) : null; return r && r.kind === kind ? r : null; };
    const fillS = style(e.fill, 'color'), inkS = style(e.ink, 'color'), textS = style(e.textStyle, 'text');
    const F = (usual) => (fillS ? fillS.color : usual), K = (usual) => (inkS ? inkS.color : usual), W = (usual) => (textS ? textS.weight : usual);
    const fs = textS ? textS.fs : e.fs;
    const thin = 'stroke-width="1.5" vector-effect="non-scaling-stroke"';
    // What it says, in the language of the workflow that is on show.
    const text = shownText(e);
    const items = text.split('\n').map((t) => t.trim()).filter(Boolean);
    const T = (x, y, str, o = {}) => `<text x="${n1(x)}" y="${n1(y)}" font-family='${FONT}' font-size="${o.fs || fs}" font-weight="${o.weight || W(400)}" fill="${o.fill || K(INK.text)}"`
        + ` text-anchor="${o.anchor || 'start'}" dominant-baseline="central"${o.deco ? ` text-decoration="${o.deco}"` : ''} pointer-events="none">${esc(str)}</text>`;
    // Wrapped text: centred in the box, or from its top-left corner.
    const block = (fill, weight, o = {}) => {
        const pad = o.pad === undefined ? 0 : o.pad, lines = wrapLines(text, fs, weight, Math.max(8, w - pad * 2)), lh = fs * 1.25;
        const y0 = o.centre ? h / 2 - ((lines.length - 1) * lh) / 2 : pad + lh / 2;
        return lines.map((l, i) => T(o.centre ? w / 2 : pad, y0 + i * lh, l, { fill, weight, anchor: o.centre ? 'middle' : 'start', deco: o.deco })).join('');
    };
    const rect = (fill, stroke, rx, extra = '') => `<rect width="${w}" height="${h}" rx="${rx}" fill="${fill}"${stroke ? ` stroke="${stroke}" ${thin}` : ''}${extra}/>`;
    const hit = `<rect width="${w}" height="${h}" fill="#000000" fill-opacity="0"/>`;
    const lineAt = (x1, y1, x2, y2, stroke = INK.boxLine) => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" stroke="${stroke}" ${thin} pointer-events="none"/>`;
    const mid = h / 2;
    let inner = '';
    switch (e.type) {
    case 'text': inner = hit + block(K(INK.text), W(400)); break;
    case 'heading': inner = hit + block(K(INK.text), W(700)); break;
    case 'link': inner = hit + block(K(INK.linkText), W(500), { deco: 'underline' }); break;
    case 'button': inner = rect(F(INK.button), '', 8) + block(K(INK.buttonText), W(600), { centre: true, pad: 8 }); break;
    case 'input': inner = rect(F(INK.input), INK.inputLine, 6) + T(12, mid, items[0] || '', { fill: INK.placeholder }); break;
    case 'textarea':
        inner = rect(INK.input, INK.inputLine, 6) + block(INK.placeholder, 400, { pad: 12 })
            + lineAt(w - 12, h - 4, w - 4, h - 12, INK.inputLine) + lineAt(w - 7, h - 4, w - 4, h - 7, INK.inputLine);
        break;
    case 'select':
        inner = rect(INK.input, INK.inputLine, 6) + T(12, mid, items[0] || '', { fill: INK.text })
            + `<path d="M ${w - 26} ${n1(mid - 3)} l 6 6 l 6 -6" fill="none" stroke="${INK.dim}" ${thin} pointer-events="none"/>`;
        break;
    case 'checkbox': case 'radio': {
        const s = Math.min(20, h), y = mid - s / 2, round = e.type === 'radio' ? s / 2 : 4;
        inner = hit + `<rect x="0" y="${n1(y)}" width="${s}" height="${s}" rx="${round}" fill="${e.on && e.type === 'checkbox' ? INK.button : INK.input}" stroke="${e.on ? INK.button : INK.inputLine}" ${thin}/>`;
        if (e.on) inner += e.type === 'radio' ? `<circle cx="${s / 2}" cy="${n1(mid)}" r="${n1(s / 4)}" fill="${INK.button}"/>`
            : `<path d="M ${n1(s * 0.25)} ${n1(mid)} l ${n1(s * 0.18)} ${n1(s * 0.18)} l ${n1(s * 0.32)} ${n1(-s * 0.36)}" fill="none" stroke="#ffffff" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
        inner += T(s + 10, mid, items[0] || '');
        break;
    }
    case 'toggle': {
        const th = Math.min(24, h), tw = th * 1.8, y = mid - th / 2, r = th / 2 - 3;
        inner = hit + `<rect x="0" y="${n1(y)}" width="${n1(tw)}" height="${th}" rx="${th / 2}" fill="${e.on ? F(INK.button) : INK.boxLine}"/>`
            + `<circle cx="${n1(e.on ? tw - th / 2 : th / 2)}" cy="${n1(mid)}" r="${n1(r)}" fill="#ffffff"/>` + T(tw + 10, mid, items[0] || '');
        break;
    }
    case 'slider': {
        const x = (w * e.value) / 100, r = Math.min(10, h / 2);
        inner = hit + lineAt(0, mid, w, mid, INK.boxLine).replace('stroke-width="1.5"', 'stroke-width="4"') + lineAt(0, mid, x, mid, INK.button).replace('stroke-width="1.5"', 'stroke-width="4"')
            + `<circle cx="${n1(Math.min(w - r, Math.max(r, x)))}" cy="${n1(mid)}" r="${n1(r)}" fill="#ffffff" stroke="${INK.button}" ${thin}/>`;
        break;
    }
    case 'dropzone': {
        // A dashed box, an arrow into a tray when there is room, and what it asks for.
        const th = wrapLines(text, fs, W(400), Math.max(8, w - 24)).length * fs * 1.25, pic = h >= th + 52, dy = pic ? 14 : 0, cy = mid + dy - th / 2 - 20;
        inner = rect(F('#f8fafc'), INK.inputLine, 10, ' stroke-dasharray="6 4"')
            + (pic ? `<path d="M ${n1(w / 2)} ${n1(cy + 8)} v -18 m -7 7 l 7 -7 l 7 7 M ${n1(w / 2 - 14)} ${n1(cy + 4)} v 8 h 28 v -8" fill="none" stroke="${INK.dim}" ${thin} stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>` : '')
            + `<g transform="translate(0 ${dy})">${block(K(INK.dim), W(400), { centre: true, pad: 12 })}</g>`;
        break;
    }
    case 'image':
        inner = rect(INK.image, INK.imageLine, 4) + `<path d="M0 0 L${w} ${h} M${w} 0 L0 ${h}" stroke="${INK.imageLine}" ${thin} pointer-events="none"/>` + block(INK.dim, 400, { centre: true, pad: 8 });
        break;
    case 'icon': {
        const r = Math.min(w, h) / 2;
        inner = hit + `<circle cx="${n1(w / 2)}" cy="${n1(mid)}" r="${n1(r - 1)}" fill="none" stroke="${INK.dim}" ${thin}/><circle cx="${n1(w / 2)}" cy="${n1(mid)}" r="${n1(r / 3)}" fill="${INK.dim}"/>`;
        break;
    }
    case 'avatar': {
        const r = Math.min(w, h) / 2;
        inner = hit + `<circle cx="${n1(w / 2)}" cy="${n1(mid)}" r="${n1(r)}" fill="${INK.image}" stroke="${INK.imageLine}" ${thin}/>` + T(w / 2, mid, (items[0] || '').slice(0, 3), { anchor: 'middle', weight: 600, fill: INK.dim });
        break;
    }
    case 'divider': inner = hit + lineAt(0, mid, w, mid); break;
    case 'card': inner = rect(F(INK.frame), INK.boxLine, 12) + block(K(INK.text), W(600), { pad: 16 }); break;
    case 'list': {
        const rows = items.length || 1, rh = h / rows;
        inner = rect(INK.frame, INK.boxLine, 6);
        items.forEach((t, i) => { inner += T(12, rh * i + rh / 2, t) + (i ? lineAt(0, rh * i, w, rh * i) : '') + `<path d="M ${w - 18} ${n1(rh * i + rh / 2 - 5)} l 5 5 l -5 5" fill="none" stroke="${INK.placeholder}" ${thin} pointer-events="none"/>`; });
        break;
    }
    case 'table': {
        const rows = (items.length ? items : ['']).map((r) => r.split('|').map((c) => c.trim())), cols = Math.max(...rows.map((r) => r.length)), rh = h / rows.length, cw = w / cols;
        inner = rect(INK.frame, INK.boxLine, 4) + `<rect width="${w}" height="${n1(rh)}" rx="4" fill="${INK.box}" pointer-events="none"/>`;
        rows.forEach((r, i) => { if (i) inner += lineAt(0, rh * i, w, rh * i); r.forEach((c, j) => { inner += T(cw * j + 10, rh * i + rh / 2, c, { weight: i ? 400 : 600 }); }); });
        for (let j = 1; j < cols; j++) inner += lineAt(cw * j, 0, cw * j, h);
        break;
    }
    case 'topbar':
        inner = rect(F(INK.box), '', 0) + lineAt(0, h, w, h) + `<path d="M 22 ${n1(mid - 7)} l -7 7 l 7 7" fill="none" stroke="${INK.text}" ${thin} pointer-events="none"/>` + T(w / 2, mid, items[0] || '', { anchor: 'middle', weight: 600 });
        break;
    case 'tabbar': {
        const n = items.length || 1, cw = w / n;
        inner = rect(INK.frame, '', 0) + lineAt(0, 0, w, 0);
        items.forEach((t, i) => {
            inner += `<circle cx="${n1(cw * i + cw / 2)}" cy="${n1(h * 0.36)}" r="${n1(Math.min(9, h * 0.16))}" fill="${i ? 'none' : INK.button}" stroke="${i ? INK.dim : INK.button}" ${thin}/>`
                + T(cw * i + cw / 2, h * 0.72, t, { anchor: 'middle', weight: i ? 400 : 700, fill: i ? INK.dim : INK.text });
        });
        break;
    }
    case 'tabs': {
        const n = items.length || 1, cw = w / n;
        inner = hit + lineAt(0, h, w, h);
        items.forEach((t, i) => { inner += T(cw * i + cw / 2, mid, t, { anchor: 'middle', weight: i ? 400 : 700, fill: i ? INK.dim : INK.text }); });
        inner += lineAt(0, h, cw, h, INK.button).replace('stroke-width="1.5"', 'stroke-width="3"');
        break;
    }
    case 'chip': inner = rect(F(INK.box), INK.boxLine, h / 2) + block(K(INK.text), W(500), { centre: true, pad: 8 }); break;
    case 'progress':
        inner = rect(INK.boxLine, '', h / 2) + `<rect width="${n1((w * e.value) / 100)}" height="${h}" rx="${h / 2}" fill="${F(INK.button)}" pointer-events="none"/>`;
        break;
    case 'alert': inner = rect(F(INK.alert), INK.alertLine, 8) + block(K(INK.text), W(400), { pad: 14 }); break;
    case 'block': {
        // A placing of a block: the block's own elements, each put where its
        // pins say for this placing's width and height. They are drawn, not
        // copied, so a change to the block shows in every placing.
        const b = e.block ? recOf(doc, e.block) : null;
        if (!b || inside) { inner = rect(INK.box, INK.boxLine, 4) + T(w / 2, mid, 'No block', { anchor: 'middle', fill: INK.dim }); break; }
        inner = hit + elementsOf(doc, b.id).map((c) => elementSvg(Object.assign({}, c, pinnedBox(c, b.w, b.h, w, h)), u, true)).join('');
        break;
    }
    default: inner = rect(F(INK.box), INK.boxLine, 4) + (text ? block(K(INK.dim), W(400), { centre: true, pad: 8 }) : '');
    }
    // Inside a placing it carries no id: a press on it is a press on the placing.
    if (inside) return `<g transform="translate(${e.x} ${e.y})">${inner}</g>`;
    return `<g class="el el-${e.type}${sel ? ' sel' : ''}" data-id="${e.id}" transform="translate(${e.x} ${e.y})">${inner}</g>`;
}

// A block's own drawing: where it is edited. It is not a stop, so nothing
// leads to it; it shows on screens through its placings.
function blockSvg(b, u) {
    const used = state.doc.elements.filter((e) => e.type === 'block' && e.block === b.id).length;
    let s = `<g class="block${inSelection(b.id) ? ' sel' : ''}" data-id="${b.id}" transform="translate(${b.x} ${b.y})">`
        + `<text class="stop-name" x="0" y="${n1(-10 * u)}" font-family='${FONT}' font-size="${n1(14 * u)}" font-weight="600" fill="${INK.block}">${esc(b.name || 'Block')}`
        + `<tspan font-weight="400" fill="${INK.dim}"> · ${esc(tr('block'))}, ${esc(tn(used, 'placed once', 'placed {n} times'))}</tspan></text>`
        + `<rect class="frame" width="${b.w}" height="${b.h}" rx="4" fill="${INK.frame}" stroke="${INK.block}" stroke-width="1.5" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
    elementsOf(state.doc, b.id).forEach((e) => { s += elementSvg(e, u); });
    return s + '</g>';
}

function decisionSvg(d, u) {
    const w = DECISION_W, h = DECISION_H, sel = inSelection(d.id);
    const lines = wrapLines(stopName(d), 18, 500, w * 0.58), lh = 22, y0 = h / 2 - ((lines.length - 1) * lh) / 2;
    let s = `<g class="stop decision${sel ? ' sel' : ''}" data-id="${d.id}" data-stop="1" transform="translate(${d.x} ${d.y})"${dimAttr(d.id)}>`
        + `<polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${INK.decision}" stroke="${sel ? INK.sel : INK.decisionLine}" stroke-width="${sel ? 2 : 1.5}" vector-effect="non-scaling-stroke"/>`
        + `<text font-family='${FONT}' font-size="18" font-weight="500" fill="${INK.name}" text-anchor="middle" dominant-baseline="central">`
        + lines.map((l, i) => `<tspan x="${w / 2}" y="${n1(y0 + i * lh)}">${esc(l)}</tspan>`).join('') + '</text>';
    return s + '</g>';
}

// What a link says on the board: what happens, then the answer or condition.
function linkLabel(link) {
    const fromDecision = kindOfId(link.from) === 'decisions', cond = link.cond.trim();
    return [link.label.trim(), cond ? (fromDecision ? cond : t('if {x}', { x: cond })) : ''].filter(Boolean).join(' · ');
}

// Where a link is drawn: from the element it starts at when that element is
// on show, else from its stop; curved apart from the other links between the
// same two stops. -> { d, mid, tip, dir } or null when an end is missing.
function linkGeometry(link, u) {
    const doc = state.doc, from = recOf(doc, link.from), to = recOf(doc, link.to);
    if (!from || !to) return null;
    let a = boxOfStop(from);
    const b = boxOfStop(to);
    const el = link.fromEl ? recOf(doc, link.fromEl) : null;
    if (el && state.view !== 'flow' && kindOfId(from.id) === 'screens' && shownSize(from).id === el.size) a = { x: from.x + el.x, y: from.y + el.y, w: el.w, h: el.h };
    if (link.from === link.to) {
        const x = a.x + a.w, y = a.y + a.h / 2, r = 60 * u;
        return { d: `M ${n1(x)} ${n1(y - 14 * u)} C ${n1(x + r)} ${n1(y - r)} ${n1(x + r)} ${n1(y + r)} ${n1(x)} ${n1(y + 14 * u)}`, mid: { x: x + r * 0.75, y }, tip: { x, y: y + 14 * u }, dir: { x: -1, y: 0.6 } };
    }
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const p1 = edgePoint(a, bc.x, bc.y), p2 = edgePoint(b, ac.x, ac.y);
    // Links between the same two stops, either way, fan out from the straight
    // line. The side is taken from the pair in id order, so A to B and B to A
    // bend away from each other.
    const pair = doc.links.filter((l) => (l.from === link.from && l.to === link.to) || (l.from === link.to && l.to === link.from));
    const i = pair.findIndex((l) => l.id === link.id), off = (i - (pair.length - 1) / 2) * 56 * u;
    const flip = link.from < link.to ? 1 : -1;
    const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * flip, ny = (dx / len) * flip;
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const c = { x: mx + nx * off * 2, y: my + ny * off * 2 };
    const tx = p2.x - c.x, ty = p2.y - c.y, tl = Math.hypot(tx, ty) || 1;
    return { d: `M ${n1(p1.x)} ${n1(p1.y)} Q ${n1(c.x)} ${n1(c.y)} ${n1(p2.x)} ${n1(p2.y)}`, mid: { x: mx + nx * off, y: my + ny * off }, tip: p2, dir: { x: tx / tl, y: ty / tl } };
}

function linksSvg(u) {
    let s = '';
    state.doc.links.forEach((link) => {
        // An export of some stops draws only the links between them.
        if (_only && !(_only.has(link.from) && _only.has(link.to))) return;
        const g = linkGeometry(link, u);
        if (!g) return;
        const marked = !!_trail && _trail.links.has(link.id);
        const sel = inSelection(link.id) || marked, colour = sel ? INK.linkSel : link.kind === 'back' ? INK.linkBack : INK.link;
        const dash = link.kind === 'system' ? ' stroke-dasharray="7 5"' : link.kind === 'auto' ? ' stroke-dasharray="2 5"' : '';
        const bx = g.tip.x - g.dir.x * 11 * u, by = g.tip.y - g.dir.y * 11 * u, px = -g.dir.y * 5 * u, py = g.dir.x * 5 * u;
        s += `<g class="link${sel ? ' sel' : ''}${marked ? ' marked' : ''}" data-id="${link.id}"${dimAttr(link.id)}>`
            + `<path d="${g.d}" fill="none" stroke="#000000" stroke-opacity="0" stroke-width="16" vector-effect="non-scaling-stroke"/>`
            + `<path d="${g.d}" fill="none" stroke="${colour}" stroke-width="${sel ? 2.5 : 1.75}"${dash} vector-effect="non-scaling-stroke" pointer-events="none"/>`
            + `<polygon points="${n1(g.tip.x)},${n1(g.tip.y)} ${n1(bx + px)},${n1(by + py)} ${n1(bx - px)},${n1(by - py)}" fill="${colour}" pointer-events="none"/>`;
        const label = linkLabel(link);
        if (label) {
            const w = textWidth(label, 12, 500) * u + 16 * u, h = 22 * u;
            s += `<rect x="${n1(g.mid.x - w / 2)}" y="${n1(g.mid.y - h / 2)}" width="${n1(w)}" height="${n1(h)}" rx="${n1(11 * u)}" fill="#ffffff" stroke="${colour}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
                + `<text x="${n1(g.mid.x)}" y="${n1(g.mid.y)}" font-family='${FONT}' font-size="${n1(12 * u)}" font-weight="500" fill="${INK.name}" text-anchor="middle" dominant-baseline="central" pointer-events="none">${esc(label)}</text>`;
        }
        s += '</g>';
    });
    return s;
}

// One badge per stop that has findings: how many, red when any is an error.
function badgesSvg(u) {
    const doc = state.doc, by = new Map();
    findingsNow().forEach((f) => {
        const stop = findingStop(doc, f);
        if (!stop) return;
        if (!by.has(stop)) by.set(stop, []);
        by.get(stop).push(f);
    });
    let s = '';
    by.forEach((list, stopId) => {
        const stop = recOf(doc, stopId);
        if (!stop) return;
        const box = boxOfStop(stop), err = list.some((f) => f.level === 'err');
        const x = box.diamond ? box.x + box.w * 0.75 : box.x + box.w, y = box.diamond ? box.y + box.h * 0.25 : box.y;
        s += `<g class="badge" data-badge="${stopId}" pointer-events="none"><title>${esc(list.map((f) => f.text).join('\n'))}</title>`
            + `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(10 * u)}" fill="${err ? INK.err : INK.warn}" stroke="#ffffff" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
            + `<text x="${n1(x)}" y="${n1(y)}" font-family='${FONT}' font-size="${n1(11 * u)}" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${list.length}</text></g>`;
    });
    return s;
}

// ---- The rail ----
const ro = () => (state.readOnly ? ' disabled' : '');
// label: English, or already in Flow's language (t() gave it; the walker knows).
const pf = (label, inner, cls = '') => `<label class="pf ${cls}"><span class="pf-l">${esc(label)}</span>${inner}</label>`;
const inText = (id, field, value, extra = '') => `<input class="input" type="text" data-id="${id}" data-f="${field}" value="${esc(value)}" autocomplete="off" spellcheck="false"${ro()} ${extra}>`;
const inNum = (id, field, value, extra = '') => `<input class="input num" type="number" data-id="${id}" data-f="${field}" value="${value}"${ro()} ${extra}>`;
const inArea = (id, field, value) => `<textarea class="textarea" rows="2" data-id="${id}" data-f="${field}"${ro()}>${esc(value)}</textarea>`;
const inCheck = (id, field, value, label) => `<label class="pf-check"><input type="checkbox" data-id="${id}" data-f="${field}"${value ? ' checked' : ''}${ro()}> <span>${esc(label)}</span></label>`;
const inSelect = (id, field, value, options) => `<select class="select" data-id="${id}" data-f="${field}"${options.tr ? ' data-tr' : ''}${ro()}>`
    + options.map(([v, l]) => `<option value="${esc(v)}"${v === value ? ' selected' : ''}>${esc(l)}</option>`).join('') + '</select>';
// The choices of a list whose words are Flow's own (data-tr: they are translated).
const opts = (labels) => Object.assign(Object.entries(labels), { tr: true });
const actBtn = (act, label, attrs = '', cls = 'btn-ghost') => `<button type="button" class="btn ${cls} sm" data-act="${act}" ${attrs}${ro()}>${label}</button>`;

// Where the real thing is kept: the source and the place in it.
function sourceFields(rec) {
    const doc = state.doc, src = rec.source ? recOf(doc, rec.source) : null;
    const options = [['', 'None']].concat(doc.sources.map((s) => [s.id, s.label || SOURCE_KIND_LABEL[s.kind]]));
    let s = '<div class="pf-group"><div class="pf-head">Where it is kept</div>';
    if (!doc.sources.length) return s + '<p class="pf-note">No sources yet. Select nothing on the board to add one.</p></div>';
    s += pf('Source', inSelect(rec.id, 'source', rec.source, options));
    s += pf('Place in it', inText(rec.id, 'at', rec.at, 'placeholder="A frame, a file path"'));
    if (src && src.url) s += `<a class="pf-open" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">Open ${esc(src.label || 'the source')} ↗</a>`;
    return s + '</div>';
}

function waysOut(stop) {
    const doc = state.doc, links = linksFrom(doc, stop.id);
    const stops = doc.screens.concat(doc.decisions);
    let s = '<div class="pf-group"><div class="pf-head">Leads to</div>';
    s += links.length ? '<ul class="pf-list">' + links.map((l) => {
        const to = recOf(doc, l.to), label = linkLabel(l);
        return `<li><button type="button" class="pf-row" data-act="select" data-id="${l.id}">→ ${esc(to ? stopName(to) : '?')}${label ? ` <span class="dim">${esc(label)}</span>` : ''}</button></li>`;
    }).join('') + '</ul>' : '<p class="pf-note">Nothing yet. Drag the blue arrow beside it to another stop, or choose one here.</p>';
    if (!state.readOnly) {
        s += `<div class="pf-inline"><select class="select" id="linkTo">${stops.map((t) => `<option value="${t.id}">${esc(stopName(t))}</option>`).join('')}</select>`
            + actBtn('add-link', 'Add', `data-id="${stop.id}"`) + '</div>';
    }
    return s + '</div>';
}

function propsHtml() {
    const doc = state.doc, sel = soleSelected(), rec = sel ? recOf(doc, sel.id) : null;
    if (state.selection.size > 1) return manyPropsHtml();
    if (!rec) return docPropsHtml();
    const kind = kindOfId(rec.id);
    const del = `<div class="pf-foot">${actBtn('del', 'Delete', `data-id="${rec.id}"`, 'btn-ghost danger')}</div>`;
    if (kind === 'screens') {
        let s = '<h2 class="rail-title">Screen</h2>' + pf('Name', inText(rec.id, 'name', rec.name));
        s += inCheck(rec.id, 'start', rec.start, 'The workflow starts here') + inCheck(rec.id, 'end', rec.end, 'The workflow can end here');
        s += pf('Status', inSelect(rec.id, 'status', rec.status, opts(STATUS_LABEL)));
        s += pf('Live address', inText(rec.id, 'path', rec.path, 'placeholder="/sign-in" data-raw-ph'));
        s += pf('Note', inArea(rec.id, 'note', rec.note));
        s += '<div class="pf-group"><div class="pf-head">Sizes</div>';
        const shown = shownSize(rec), sizes = sizesOf(doc, rec.id);
        sizes.forEach((z) => {
            s += `<div class="size-card${z.id === shown.id ? ' on' : ''}">`
                + `<div class="pf-inline">${inText(z.id, 'name', z.name, 'placeholder="Name" aria-label="Size name"')}`
                + (z.id === shown.id ? '<span class="size-on">shown</span>' : `<button type="button" class="btn btn-ghost sm" data-act="show-size" data-size="${z.id}">Show</button>`)
                + (sizes.length > 1 ? actBtn('del', '✕', `data-id="${z.id}" title="Remove this size" aria-label="Remove this size"`) : '') + '</div>'
                + `<div class="pf-cols">${pf('Width', inNum(z.id, 'w', z.w, 'min="1" data-lazy'))}${pf('Height', inNum(z.id, 'h', z.h, 'min="1" data-lazy'))}${pf('Content', inNum(z.id, 'contentH', z.contentH, 'min="0" data-lazy title="The full height of the content when it scrolls. 0: it does not scroll."'))}</div>`
                + `<div class="pf-cols two">${pf('Used with', inSelect(z.id, 'input', z.input, opts(INPUT_LABEL)))}${pf('Seen from', inSelect(z.id, 'distance', z.distance, opts(DISTANCE_LABEL)))}</div></div>`;
        });
        if (!state.readOnly) {
            s += `<div class="pf-inline"><select class="select" id="sizePreset">${SIZE_PRESETS.map((p) => `<option value="${p.key}">${esc(p.name)} ${p.w}×${p.h}</option>`).join('')}</select>`
                + actBtn('add-size', 'Add size', `data-id="${rec.id}"`) + '</div>';
        }
        s += '</div>';
        return s + waysOut(rec) + sourceFields(rec) + del;
    }
    if (kind === 'decisions') {
        return '<h2 class="rail-title">Decision</h2>' + pf('Question', inText(rec.id, 'name', rec.name, 'placeholder="Is the password right?"'))
            + pf('Note', inArea(rec.id, 'note', rec.note)) + waysOut(rec) + del;
    }
    if (kind === 'blocks') {
        const used = doc.elements.filter((e) => e.type === 'block' && e.block === rec.id).length;
        let s = '<h2 class="rail-title">Block</h2>' + pf('Name', inText(rec.id, 'name', rec.name, 'placeholder="Header"'));
        s += `<div class="pf-cols two">${pf('Width', inNum(rec.id, 'w', rec.w, 'min="1" data-lazy'))}${pf('Height', inNum(rec.id, 'h', rec.h, 'min="1" data-lazy'))}</div>`;
        s += `<p class="pf-note" data-raw>${esc(tr('Draw it here once, and place it from the Add list with a screen selected. A change here shows in every placing.') + ' ' + tn(used, 'Placed once.', 'Placed {n} times.'))}</p>`;
        return s + `<div class="pf-foot pf-inline">${actBtn('duplicate', 'Duplicate')}${actBtn('del', 'Delete', `data-id="${rec.id}"`, 'btn-ghost danger')}</div>`;
    }
    if (kind === 'elements') {
        const at = placeOf(rec), kit = ELEMENT_KIT[rec.type], placing = rec.type === 'block', block = placing ? recOf(doc, rec.block) : null;
        let s = `<h2 class="rail-title">${esc(kit.label)}</h2>`;
        // A sentence of Flow's with a name of the workflow's in it, as a button:
        // the sentence is translated around {name}, then the button put in.
        const named = (key, id, name, params) => `<p class="pf-note" data-raw>${esc(tr(key, params)).replace('{name}', `<button type="button" class="linklike" data-act="select" data-id="${id}">${esc(name)}</button>`)}</p>`;
        if (at && kindOfId(at.holder.id) === 'screens') s += named('On {name}, {x}', at.holder.id, stopName(at.holder), { x: `${at.owner.name || tr('Size')} ${at.owner.w}×${at.owner.h}` });
        else if (at) s += named('In the block {name}', at.holder.id, at.holder.name || tr('Block'));
        if (placing) {
            s += named('A placing of {name}. Change the block to change what it shows.', rec.block, block ? block.name || tr('Block') : '?');
        } else {
            const textLabel = rec.type === 'image' ? 'What it shows' : kit.lines ? (rec.type === 'table' ? 'Rows, one per line; cells split by |' : 'Items, one per line') : 'Text';
            const lang = state.lang ? recOf(doc, state.lang) : null, word = lang && rec.key ? wordOf(lang.id, rec.key) : null;
            // With another language on show, the field is that language's text.
            if (lang) s += pf(tr('{x}, in {x2}', { x: tr(textLabel), x2: langLabel(lang) }), `<textarea class="textarea" rows="2" data-word="${rec.id}" data-raw placeholder="${esc(rec.text)}"${ro()}>${esc(word ? word.text : '')}</textarea>`)
                + `<p class="pf-note" data-raw>${esc(tr('In {x}: {x2}', { x: doc.lang, x2: rec.text || '—' }))}</p>`;
            else s += pf(textLabel, inArea(rec.id, 'text', rec.text));
            s += pf('Dictionary key', inText(rec.id, 'key', rec.key, 'placeholder="cart.pay" data-raw-ph title="The name this text has in the interface\'s dictionaries. With a key, its text follows the language shown."'));
            if (kit.state) s += inCheck(rec.id, 'on', rec.on, 'Shown as on');
            if (kit.amount) s += pf('Shown at (0 to 100)', inNum(rec.id, 'value', rec.value, 'min="0" max="100"'));
        }
        s += pf('Name', inText(rec.id, 'name', rec.name, 'placeholder="What it is, for a list"'));
        s += `<div class="pf-cols four">${pf('X', inNum(rec.id, 'x', rec.x))}${pf('Y', inNum(rec.id, 'y', rec.y))}${pf('W', inNum(rec.id, 'w', rec.w, 'min="1"'))}${pf('H', inNum(rec.id, 'h', rec.h, 'min="1"'))}</div>`;
        if (!placing) {
            const pick = (field, label, styleKind) => pf(label, inSelect(rec.id, field, rec[field], [['', 'As usual']].concat(doc.styles.filter((y) => y.kind === styleKind).map((y) => [y.id, y.name || STYLE_KIND_LABEL[y.kind]]))));
            s += '<div class="pf-group"><div class="pf-head">Look</div>';
            if (doc.styles.length) s += `<div class="pf-cols two">${pick('fill', 'Fill', 'color')}${pick('ink', 'Text colour', 'color')}</div>` + pick('textStyle', 'Text style', 'text');
            else s += '<p class="pf-note">No styles yet. Select nothing on the board to add a colour or a text style.</p>';
            s += rec.textStyle ? '<p class="pf-note">Its text size comes from the text style.</p>' : pf('Text size', inNum(rec.id, 'fs', rec.fs, 'min="6"'));
            s += '</div>';
        }
        s += '<div class="pf-group"><div class="pf-head">When the screen changes size</div>'
            + `<div class="pf-cols two">${pf('Across, it keeps', inSelect(rec.id, 'pinH', rec.pinH, opts(PIN_H_LABEL)))}${pf('Down, it keeps', inSelect(rec.id, 'pinV', rec.pinV, opts(PIN_V_LABEL)))}</div></div>`;
        const links = doc.links.filter((l) => l.fromEl === rec.id);
        if (links.length) {
            s += '<div class="pf-group"><div class="pf-head">Leads to</div><ul class="pf-list">' + links.map((l) => {
                const to = recOf(doc, l.to);
                return `<li><button type="button" class="pf-row" data-act="select" data-id="${l.id}">→ ${esc(to ? stopName(to) : '?')}</button></li>`;
            }).join('') + '</ul></div>';
        }
        return s + sourceFields(rec) + `<div class="pf-foot pf-inline">${actBtn('duplicate', 'Duplicate')}${actBtn('del', 'Delete', `data-id="${rec.id}"`, 'btn-ghost danger')}</div>`;
    }
    if (kind === 'links') {
        const from = recOf(doc, rec.from), to = recOf(doc, rec.to), el = rec.fromEl ? recOf(doc, rec.fromEl) : null;
        const fromDecision = kindOfId(rec.from) === 'decisions';
        let s = '<h2 class="rail-title">Link</h2>';
        s += `<p class="pf-note"><button type="button" class="linklike" data-act="select" data-id="${rec.from}">${esc(stopName(from))}</button>`
            + (el ? ` (${esc(elementTitle(el, doc))})` : '') + ` → <button type="button" class="linklike" data-act="select" data-id="${rec.to}">${esc(stopName(to))}</button></p>`;
        s += pf('What takes them there', inSelect(rec.id, 'kind', rec.kind, opts(LINK_KIND_LABEL)));
        s += pf(fromDecision ? 'What happens' : 'What the user does', inText(rec.id, 'label', rec.label, fromDecision ? '' : 'placeholder="Taps Pay"'));
        s += pf(fromDecision ? 'Answer' : 'Only if', inText(rec.id, 'cond', rec.cond, fromDecision ? 'placeholder="Yes"' : 'placeholder="The card is accepted"'));
        s += pf('Note', inArea(rec.id, 'note', rec.note));
        return s + sourceFields(rec) + del;
    }
    return docPropsHtml();
}

// Several things selected: what can be done to all of them at once.
function manyPropsHtml() {
    const n = state.selection.size, group = alignGroup();
    const off = group.length < 2 ? ' disabled' : '', off3 = group.length < 3 ? ' disabled' : '';
    const b = (how, label, title, dis) => `<button type="button" class="btn btn-ghost sm" data-act="align" data-how="${how}" title="${title}"${dis}${ro()}>${label}</button>`;
    let s = `<h2 class="rail-title" data-raw>${esc(tr('{n} selected', { n }))}</h2>`;
    s += '<div class="pf-group"><div class="pf-head">Line up</div><div class="palette">'
        + b('left', 'Left', 'Line up the left edges', off) + b('hcenter', 'Centre', 'Line up the centres, across', off) + b('right', 'Right', 'Line up the right edges', off)
        + b('top', 'Top', 'Line up the top edges', off) + b('vcenter', 'Middle', 'Line up the centres, down', off) + b('bottom', 'Bottom', 'Line up the bottom edges', off)
        + '</div><div class="pf-head">Space evenly</div><div class="palette">'
        + b('hspace', 'Across', 'Equal gaps from the first to the last, across', off3) + b('vspace', 'Down', 'Equal gaps from the first to the last, down', off3) + '</div>';
    if (group.length < 2) s += '<p class="pf-note">Lining up works on elements of one screen, or on screens and decisions.</p>';
    s += '</div>';
    const blockable = blockGroup().length > 0;
    s += `<div class="pf-foot pf-inline">${actBtn('make-block', 'Make a block', blockable ? 'title="Turn these elements into a block, and leave one placing of it here"' : 'disabled')}${actBtn('duplicate', 'Duplicate')}${actBtn('del-selected', 'Delete', '', 'btn-ghost danger')}</div>`;
    return s;
}

// Nothing selected: the document itself and its sources.
function docPropsHtml() {
    const doc = state.doc;
    let s = '<h2 class="rail-title">Workflow</h2>';
    s += pf('Name', `<input class="input" type="text" data-id="" data-f="name" value="${esc(doc.name)}" placeholder="Untitled" autocomplete="off"${ro()}>`);
    s += `<p class="pf-note" data-raw>${esc([tn(doc.screens.length, '1 screen', '{n} screens'), tn(doc.decisions.length, '1 decision', '{n} decisions'), tn(doc.links.length, '1 link', '{n} links')].join(', '))}.</p>`;
    s += '<div class="pf-group"><div class="pf-head">Sources</div><p class="pf-note">Where the real work is kept: the vector file, the code, the live board. Flow only points at them and never opens them itself.</p>';
    doc.sources.forEach((src) => {
        const problem = src.url && urlCarriesSecret(src.url) ? '<p class="pf-warn">This address seems to carry a key or a password.</p>' : '';
        s += '<div class="size-card">'
            + `<div class="pf-inline">${inSelect(src.id, 'kind', src.kind, opts(SOURCE_KIND_LABEL))}${actBtn('del', '✕', `data-id="${src.id}" title="Remove this source" aria-label="Remove this source"`)}</div>`
            + pf('Name', inText(src.id, 'label', src.label, 'placeholder="Shop app repository"'))
            + pf('Address', `<input class="input" type="url" data-id="${src.id}" data-f="url" data-url value="${esc(src.url)}" placeholder="https://" autocomplete="off" spellcheck="false"${ro()}>`)
            + `<p class="pf-warn" data-url-msg="${src.id}" hidden></p>` + problem
            + (src.url ? `<a class="pf-open" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer">Open ↗</a>` : '') + '</div>';
    });
    if (!state.readOnly) s += actBtn('add-source', '+ Source');
    s += '</div>' + basesHtml() + langsHtml() + '<div class="pf-group"><div class="pf-head">Styles</div><p class="pf-note">Named colours and text sizes. An element that points at one changes when the style does.</p>';
    doc.styles.forEach((y) => {
        const used = doc.elements.filter((e) => e.fill === y.id || e.ink === y.id || e.textStyle === y.id).length;
        s += `<div class="size-card" data-style="${y.id}"><div class="pf-inline">`
            + (y.kind === 'color' ? `<input type="color" class="swatch" data-id="${y.id}" data-f="color" value="${esc(y.color)}" aria-label="Colour"${ro()}>` : '<span class="size-on">Text</span>')
            + inText(y.id, 'name', y.name, `placeholder="${y.kind === 'color' ? 'Brand' : 'Title'}" aria-label="Style name"`)
            + actBtn('del', '✕', `data-id="${y.id}" title="Remove this style" aria-label="Remove this style"`) + '</div>'
            + (y.kind === 'text' ? `<div class="pf-cols two">${pf('Size', inNum(y.id, 'fs', y.fs, 'min="6"'))}${pf('Weight', inSelect(y.id, 'weight', String(y.weight), opts(WEIGHT_LABEL)))}</div>` : '')
            + `<p class="pf-note" data-raw>${esc(tn(used, 'Used by 1 element.', 'Used by {n} elements.'))}</p></div>`;
    });
    if (!state.readOnly) s += `<div class="pf-inline">${actBtn('add-style', '+ Colour', 'data-kind="color"')}${actBtn('add-style', '+ Text style', 'data-kind="text"')}</div>`;
    return s + '</div>';
}

// Rebuilt whole. A select or a tick box that had the focus gets it back, so
// the keyboard stays where it was.
function renderProps() {
    const box = $('railProps'), was = document.activeElement;
    const key = was && box.contains(was) && was.dataset.f !== undefined ? [was.dataset.id, was.dataset.f] : null;
    box.innerHTML = propsHtml();
    translateChrome(box);
    if (!key) return;
    const again = Array.from(box.querySelectorAll('[data-f]')).find((el) => el.dataset.id === key[0] && el.dataset.f === key[1]);
    if (again) again.focus();
}

function renderFindings() {
    const { open, accepted, stale } = findingsSorted(), off = ro();
    const row = (f) => {
        const taking = state.accepting === f.key;
        let h = `<div class="finding ${f.level}${f.pin ? ' pinned' : ''}" data-key="${esc(f.key)}">`
            + `<button type="button" class="f-text"${f.id ? ` data-act="select" data-id="${f.id}"` : ''}><span class="f-group" data-raw>${f.pin ? '★ ' : ''}${esc(tr(f.group))}</span>${esc(f.text)}</button>`;
        if (f.accept) h += `<p class="f-why">${esc(tr('Accepted: {x}', { x: f.accept.reason }))}</p><div class="f-acts"><button type="button" class="f-btn" data-act="del" data-id="${f.accept.id}"${off}>Take back</button></div>`;
        else if (taking) h += `<div class="f-take"><input class="input" type="text" id="acceptReason" maxlength="500" placeholder="Why this is fine as it is" aria-label="Reason for accepting">`
            + `<div class="f-acts"><button type="button" class="f-btn on" data-act="accept-save" data-key="${esc(f.key)}">Accept</button><button type="button" class="f-btn" data-act="accept-cancel">Cancel</button></div></div>`;
        else h += `<div class="f-acts"><button type="button" class="f-btn${f.pin ? ' on' : ''}" data-act="pin-toggle" data-key="${esc(f.key)}" aria-pressed="${!!f.pin}" title="Mark it to come back to; pinned findings are listed first"${off}>${f.pin ? esc(tr('Pinned')) : esc(tr('Pin'))}</button>`
            + `<button type="button" class="f-btn" data-act="accept-start" data-key="${esc(f.key)}" title="It is fine as it is: say why, and it is no longer counted"${off}>Accept</button></div>`;
        return h + '</div>';
    };
    $('findingsCount').textContent = open.length ? String(open.length) : '';
    // Sorted into what kind of finding each is (CHECK_CLASSES, js/diagnostics.js),
    // the pinned ones first under a heading of their own.
    let h = '';
    if (!open.length) h = '<p class="pf-note">Nothing to report.</p>';
    else {
        const sec = (key, label, list) => `<details class="f-class" data-cls="${key}"${state.clsShut.has(key) ? '' : ' open'}><summary data-raw><span class="f-dot ${list.some((f) => f.level === 'err') ? 'err' : 'warn'}" aria-hidden="true"></span><span class="f-cname">${esc(label)}</span><span class="count">${list.length}</span></summary>${list.map(row).join('')}</details>`;
        const pinned = open.filter((f) => f.pin), rest = open.filter((f) => !f.pin);
        if (pinned.length) h += sec('pinned', tr('Pinned'), pinned);
        CHECK_CLASSES.concat([['other', 'Other']]).forEach(([key, label]) => { const list = rest.filter((f) => f.cls === key); if (list.length) h += sec(key, tr(label), list); });
    }
    if (accepted.length) h += `<details class="f-more"${state.acceptedOpen ? ' open' : ''} id="acceptedList"><summary data-raw>${esc(tr('Accepted ({n})', { n: accepted.length }))}</summary>${accepted.map(row).join('')}</details>`;
    if (stale.length) {
        h += `<details class="f-more"><summary data-raw>${esc(tr('No longer found ({n})', { n: stale.length }))}</summary>` + stale.map((r) => `<div class="finding gone"><p class="f-why">${esc(kindOfId(r.id) === 'accepts' ? tr('Accepted: {x}', { x: r.reason }) : tr('Pinned'))} <span class="dim">${esc(tr(checkGroup(checkOfKey(r.finding))))}</span></p>`
            + `<div class="f-acts"><button type="button" class="f-btn" data-act="del" data-id="${r.id}"${off}>Remove</button></div></div>`).join('') + '</details>';
    }
    const box = $('railFindings'), typing = document.activeElement && document.activeElement.id === 'acceptReason' ? document.activeElement.value : null;
    box.innerHTML = h;
    translateChrome(box);
    // The reason being typed survives a redraw, and gets the focus when it opens.
    const field = $('acceptReason');
    if (field) { if (typing !== null) field.value = typing; field.focus(); }
}

// ---- The Add grid ----
// One tile per element: a small drawing of it, made by the same code that
// draws it on a screen, and its name. Blocks follow, by their own names.
function tileSvg(type, block) {
    const kit = ELEMENT_KIT[type];
    // A block's tile is the block itself, small: what is drawn in it.
    if (block) return `<svg class="lib-pic" viewBox="-3 -3 ${block.w + 6} ${block.h + 6}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${elementsOf(state.doc, block.id).map((c) => elementSvg(c, 1, true)).join('')}</svg>`;
    // The element at a size that fits a tile, with a word or two in it.
    const w = block ? block.w : Math.min(kit.w, type === 'topbar' || type === 'tabbar' ? 150 : 120), h = block ? block.h : Math.min(kit.h, type === 'dropzone' ? 84 : 64);
    const text = kit.lines ? kit.text.split('\n').slice(0, type === 'table' ? 3 : 2).join('\n') : type === 'image' ? '' : kit.tile ? kit.tile : kit.text.split(' ').slice(0, 2).join(' ');
    const el = readRec('elements', { id: 'el_tile', size: 'siz_tile', type, block: block ? block.id : '', w, h: kit.lines && type !== 'tabs' ? Math.max(h, 44) : h, text, fs: Math.min(kit.fs, 14), on: true, value: 60 });
    return `<svg class="lib-pic" viewBox="-3 -3 ${el.w + 6} ${el.h + 6}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${elementSvg(Object.assign(el, { x: 0, y: 0 }), 1, true)}</svg>`;
}
function paletteHtml() {
    const blocks = state.doc.blocks;
    const tile = (value, label, pic) => `<button type="button" class="lib-tile" data-act="add-el" data-type="${esc(value)}" title="${esc(label)}" data-raw draggable="false">${pic}<span class="lib-name">${esc(label)}</span></button>`;
    return ELEMENT_GROUPS.map(([key, label]) => `<div class="pf-head">${esc(tr(label))}</div><div class="lib-grid">`
        + Object.entries(ELEMENT_KIT).filter(([, k]) => k.group === key).map(([type, k]) => tile(type, tr(k.label), tileSvg(type))).join('') + '</div>').join('')
        + (blocks.length ? `<div class="pf-head">${esc(tr('Blocks'))}</div><div class="lib-grid">` + blocks.map((b) => tile('block:' + b.id, b.name || tr('Block'), tileSvg('block', b))).join('') + '</div>' : '');
}
function buildPalette() { renderPalette(); }

// The grid follows the workflow's blocks and Flow's language, and is on
// offer only when there is a screen or a block to add to.
function renderPalette() {
    // What the tiles show: the kit, the blocks and what is in them, the language.
    const key = flowLocale() + '|' + state.doc.blocks.map((b) => b.id + b.name + b.w + b.h).join() + '|' + (state.doc.blocks.length ? state.seq : '');
    const box = $('palette');
    if (box.dataset.for !== key) { box.innerHTML = paletteHtml(); box.dataset.for = key; }
    // The templates' names are Flow's words, and follow its language.
    const tp = $('addTemplate'), tOpts = SCREEN_TEMPLATES.map((tpl) => `<option value="${tpl.key}">${esc(tr(tpl.name))}</option>`).join('');
    if (tp.dataset.for !== tOpts) { const was = tp.value; tp.innerHTML = tOpts; tp.dataset.for = tOpts; tp.value = was || 'blank'; }
    const target = addTargetSize(), inBlock = !!target && kindOfId(target.id) === 'blocks';
    // A tile can always be dragged onto a screen. 'off': a click has nowhere
    // to put it. 'no': it cannot go where a click would put it (a block
    // inside a block). Read only: nothing is added at all.
    box.querySelectorAll('[data-act="add-el"]').forEach((b) => {
        const no = inBlock && b.dataset.type.startsWith('block:');
        b.disabled = state.readOnly;
        b.classList.toggle('off', !target || no);
        b.classList.toggle('no', no);
        b.setAttribute('aria-disabled', String(!target || no || state.readOnly));
    });
    document.querySelectorAll('[data-act="add-screen"], [data-act="add-decision"], [data-act="add-block"]').forEach((b) => { b.disabled = state.readOnly; });
    $('addHint').hidden = !!target;
    // Add again: the element last added, whether or not the grid is folded.
    const again = $('addAgain'), last = lastAddedLabel();
    again.hidden = !last || state.readOnly;
    if (last) {
        again.querySelector('.aa-name').textContent = tr('{x} again', { x: last });
        again.title = tr('Add another {x} to the selected screen (A)', { x: last });
        again.classList.toggle('off', !target || (inBlock && state.lastAdded.startsWith('block:')));
    }
    updateRailWrap();
}
// The Add grid folds to one row while what is selected is not something to
// add to (an element, a link, a decision, several things), so its details
// have the rail. With a screen or a block selected, or nothing, it stays
// open: that is when it is used. A click on the row keeps it open; another
// lets it fold again.
function updateRailWrap() {
    const rail = document.querySelector('.flow-rail'), row = $('libWrapRow'), sel = soleSelected();
    const addsTo = !!sel && (sel.type === 'screens' || sel.type === 'blocks');
    const folds = state.selection.size > 0 && !addsTo;
    // Held open: something was just added from the grid (addFromGrid, js/app.js).
    const wrapped = folds && !state.libPinned && !state.libHeld;
    rail.classList.toggle('lib-wrapped', wrapped);
    row.hidden = !folds;
    row.setAttribute('aria-expanded', String(!wrapped));
    row.querySelector('.lw-caret').textContent = wrapped ? '▸' : '▾';
    row.querySelector('.lw-name').textContent = tr('Elements');
    row.querySelector('.lw-hint').textContent = tr(wrapped ? 'Keep open' : 'Fold');
    row.title = tr(wrapped ? 'Show the elements and keep them open' : 'Fold the elements while something is selected');
}

// ---- The board's background ----
// Light, dark, blueprint (ruled blue paper) or circuit (the same ruled paper
// in green), whatever the site's theme. Only the board changes: the
// screens stay on white paper, drawn as they are, and what is written on the
// board around them (names, links, decisions) takes a light ink. How this visitor likes to
// look at it: kept in this browser, never in the workflow. A picture or a
// report is always on paper, since it carries no stylesheet.
const BOARD_INKS = ['', 'dark', 'blue', 'pcb'], INK_KEY = 'flow_board_ink';
const INK_NEXT_TITLE = { '': 'Dark background', dark: 'Blueprint background', blue: 'Circuit background', pcb: 'Light background' };
function setBoardInk(mode) {
    const m = BOARD_INKS.includes(mode) ? mode : '';
    state.boardInk = m;
    const pane = $('boardPane'), btn = $('boardInkBtn');
    pane.classList.toggle('map-ink', m !== '');
    pane.classList.toggle('map-blue', m === 'blue');
    pane.classList.toggle('map-pcb', m === 'pcb');
    btn.setAttribute('aria-pressed', String(m !== ''));
    btn.dataset.ink = m;
    btn.title = tr(INK_NEXT_TITLE[m]); btn.setAttribute('aria-label', btn.title);
    try { if (m) localStorage.setItem(INK_KEY, m); else localStorage.removeItem(INK_KEY); } catch (e) { /* no storage: it lasts for this visit */ }
}
const nextBoardInk = () => BOARD_INKS[(BOARD_INKS.indexOf(state.boardInk) + 1) % BOARD_INKS.length];

// The size a new element goes on: the selected screen's shown one, or the
// size of the selected element.
function addTargetSize() {
    const sel = soleSelected(), rec = sel ? recOf(state.doc, sel.id) : null;
    if (!rec) return null;
    const kind = kindOfId(rec.id);
    if (kind === 'screens') return shownSize(rec);
    if (kind === 'blocks') return rec;
    if (kind === 'elements') return recOf(state.doc, rec.size) || null;
    return null;
}

// Everything, or everything but the fields (typing must not rebuild the
// field being typed in).
function render(opts = {}) {
    drawBoard();
    renderFindings();
    renderPalette();
    if (!opts.typing) renderProps();
    renderLangBar();
    if (!opts.typing) renderWalk();
    // The background button's hint is Flow's word, and follows its language.
    $('boardInkBtn').title = tr(INK_NEXT_TITLE[state.boardInk || '']);
    renderSimple();
    renderLanding();
    renderPlay();
    if (!opts.typing) renderTestRail();
    if (!opts.typing || !state.test) renderTest();
    $('viewBoard').setAttribute('aria-pressed', String(state.view === 'board'));
    $('viewFlow').setAttribute('aria-pressed', String(state.view === 'flow'));
    document.body.classList.toggle('flow-view', state.view === 'flow');
    $('undoBtn').disabled = !canUndo() || state.readOnly;
    $('redoBtn').disabled = !canRedo() || state.readOnly;
    $('roBanner').hidden = !state.readOnly;
    $('keepMenu').hidden = !!state.cardId || state.readOnly || !!state.live;
    $('roBanner').textContent = tr(state.live && state.live.role === 'view' ? 'You can look at this live workflow but not change it.' : 'This workflow was made by a newer Flow. It is open to read only.');
    renderLive();
    livePresenceSoon();
    document.title = (state.doc.name ? state.doc.name + ' · ' : '') + 'Flow';
}
