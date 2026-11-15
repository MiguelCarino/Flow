// The flow view, and Walk.
//
// The flow view shows the same workflow with every screen as a small card,
// laid out from the links: the start on the left, each step to the right of
// what leads to it. Where a card sits is worked out from the document each
// time and never stored, so it cannot go stale and is not part of any change.

const CARD_W = 220, CARD_H = 290, CARD_HEAD = 46, FLOW_GAP_X = 200, FLOW_GAP_Y = 72, FLOW_COL = 280;

// -> Map of stop id -> box. Stops reached from a start are in columns by how
// many steps away they are; the rest are in a band of their own below.
let _layout = null, _layoutKey = '';
function flowLayout() {
    // On a board taller than it is wide (a phone held upright) the workflow
    // runs down the page instead of across it.
    const r = typeof document !== 'undefined' && $('board') ? $('board').getBoundingClientRect() : { width: 1, height: 0 };
    const down = r.width > 0 && r.width < r.height * 0.8, key = state.seq + (down ? 'd' : 'a');
    if (_layout && _layoutKey === key) return _layout;
    const doc = state.doc, stops = doc.screens.concat(doc.decisions), ids = new Set(stops.map((s) => s.id));
    const next = new Map(stops.map((s) => [s.id, []]));
    doc.links.forEach((l) => { if (ids.has(l.from) && ids.has(l.to)) next.get(l.from).push(l.to); });
    const boxes = new Map(), placed = new Set();
    const sizeOf = (id) => (kindOfId(id) === 'decisions' ? { w: DECISION_W, h: DECISION_H, diamond: true } : { w: CARD_W, h: CARD_H, diamond: false });
    // Along the way the workflow runs, every step takes the same room; across
    // it, the stops of one step sit side by side, centred.
    const STEP = down ? CARD_H + 120 : FLOW_COL + FLOW_GAP_X, GAP = down ? 56 : FLOW_GAP_Y;
    const across = (id) => (down ? sizeOf(id).w : sizeOf(id).h), along = (id) => (down ? sizeOf(id).h : sizeOf(id).w), ROOM = down ? CARD_H : FLOW_COL;
    let start = 0;
    // One band: the stops reached from `roots`, in steps by distance.
    const band = (roots) => {
        const cols = [], queue = [];
        roots.forEach((id) => { if (!placed.has(id)) { placed.add(id); queue.push([id, 0]); } });
        while (queue.length) {
            const [id, depth] = queue.shift();
            (cols[depth] = cols[depth] || []).push(id);
            next.get(id).forEach((to) => { if (!placed.has(to)) { placed.add(to); queue.push([to, depth + 1]); } });
        }
        if (!cols.length) return;
        const span = (col) => col.reduce((n, id) => n + across(id), 0) + (col.length - 1) * GAP;
        const wide = Math.max(...cols.map(span));
        cols.forEach((col, i) => {
            let c = (down ? 0 : start) + (wide - span(col)) / 2;
            col.forEach((id) => {
                const z = sizeOf(id), a = (down ? start : 0) + i * STEP + (ROOM - along(id)) / 2;
                boxes.set(id, { x: Math.round(down ? c : a), y: Math.round(down ? a : c), w: z.w, h: z.h, diamond: z.diamond });
                c += across(id) + GAP;
            });
        });
        // The next band goes after this one: below it either way.
        start += down ? cols.length * STEP + GAP : wide + FLOW_GAP_Y * 2;
    };
    band(doc.screens.filter((s) => s.start).map((s) => s.id));
    stops.forEach((s) => band([s.id]));
    _layout = boxes; _layoutKey = key;
    return boxes;
}

// A screen as a card: its name, then a small drawing of the size on show.
function cardSvg(screen, box, u) {
    const doc = state.doc, size = shownSize(screen), H = sizeHeight(size), sel = inSelection(screen.id);
    const tags = [screen.stub ? t('not included') : '', screen.start ? t('start') : '', screen.end ? t('end') : '', screen.status !== 'drawn' ? t(STATUS_LABEL[screen.status]).toLowerCase() : ''].filter(Boolean);
    const room = { w: CARD_W - 24, h: CARD_H - CARD_HEAD - 12 }, k = Math.min(room.w / size.w, room.h / H);
    const tx = (CARD_W - size.w * k) / 2, ty = CARD_HEAD + (room.h - H * k) / 2;
    let name = stopName(screen);
    while (name.length > 3 && textWidth(name, 15, 600) > CARD_W - 28) name = name.slice(0, -2).trimEnd() + '…';
    return `<g class="stop screen card${sel ? ' sel' : ''}" data-id="${screen.id}" data-stop="1" transform="translate(${box.x} ${box.y})"${dimAttr(screen.id)}>`
        + `<rect class="frame" width="${CARD_W}" height="${CARD_H}" rx="12" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        + `<text class="stop-name" x="14" y="20" font-family='${FONT}' font-size="15" font-weight="600" fill="${INK.name}" dominant-baseline="central" pointer-events="none">${esc(name)}</text>`
        + `<text x="14" y="36" font-family='${FONT}' font-size="11" fill="${INK.dim}" dominant-baseline="central" pointer-events="none">${esc(tags.concat(`${size.w}×${size.h}`).join(' · '))}</text>`
        + `<g class="thumb" transform="translate(${n1(tx)} ${n1(ty)}) scale(${k.toFixed(4)})" pointer-events="none">`
        + `<rect width="${size.w}" height="${H}" fill="${INK.box}" stroke="${INK.boxLine}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
        + elementsOf(doc, size.id).map((e) => elementSvg(e, u, true)).join('') + '</g></g>';
}
function flowStopsSvg(u) {
    const doc = state.doc, boxes = flowLayout();
    return doc.screens.map((s) => cardSvg(s, boxes.get(s.id), u)).join('')
        + doc.decisions.map((d) => { const b = boxes.get(d.id); return decisionSvg(Object.assign({}, d, { x: b.x, y: b.y }), u); }).join('');
}
function setView(view) {
    state.view = view === 'flow' ? 'flow' : 'board';
    // What only the board shows cannot stay selected in the flow view.
    if (state.view === 'flow') setSelection(Array.from(state.selection).filter((e) => e.type === 'screens' || e.type === 'decisions' || e.type === 'links'));
    render();
    fitBoard();
}

// ---- Walk: how do I get from A to B? ----
function walkPaths() {
    return findPaths(state.doc, state.walk.from, state.walk.to);
}
// The way that is marked on the board, or null.
function walkTrail() {
    const paths = walkPaths(), p = paths[state.walk.pick];
    return p ? { stops: new Set(p.stops), links: new Set(p.links) } : null;
}
// With a way marked, everything off it is drawn faint.
let _trail = null;
const dimAttr = (id) => (_trail && !_trail.stops.has(id) && !_trail.links.has(id) ? ' opacity="0.25"' : '');
// A way in words: each stop, and between two stops what takes the user on.
function pathSteps(path) {
    const doc = state.doc, out = [];
    path.stops.forEach((id, i) => {
        out.push({ stop: stopName(recOf(doc, id)) });
        if (i < path.links.length) {
            const l = recOf(doc, path.links[i]), el = l.fromEl ? recOf(doc, l.fromEl) : null;
            out.push({ via: linkLabel(l) || (el ? tr('Uses {what}', { what: elementTitle(el, doc) }) : tr('Goes on')) });
        }
    });
    return out;
}
function renderWalk() {
    const doc = state.doc, stops = doc.screens.concat(doc.decisions), w = state.walk;
    if (w.from && !recOf(doc, w.from)) w.from = '';
    if (w.to && !recOf(doc, w.to)) w.to = '';
    if (!w.from) { const start = doc.screens.find((s) => s.start); w.from = start ? start.id : ''; }
    const options = (value) => `<option value="">${esc(tr('Choose a stop'))}</option>` + stops.map((s) => `<option value="${s.id}"${s.id === value ? ' selected' : ''}>${esc(stopName(s))}</option>`).join('');
    let s = `<div class="pf-cols two"><label class="pf"><span class="pf-l">From</span><select class="select" id="walkFrom">${options(w.from)}</select></label>`
        + `<label class="pf"><span class="pf-l">To</span><select class="select" id="walkTo">${options(w.to)}</select></label></div>`;
    if (!w.from || !w.to) s += '<p class="pf-note">Choose where to start and where to arrive, and Flow lists every way between them.</p>';
    else if (w.from === w.to) s += '<p class="pf-note">Choose two different stops.</p>';
    else {
        const paths = walkPaths();
        if (w.pick >= paths.length) w.pick = -1;
        if (!paths.length) s += `<p class="pf-warn" data-raw>${esc(tr('There is no way from "{name}" to "{name2}".', { name: stopName(recOf(doc, w.from)), name2: stopName(recOf(doc, w.to)) }))}</p>`;
        else {
            s += `<p class="pf-note" data-raw>${esc(tn(paths.length, 'One way. Choose it to mark it on the board.', '{n} ways, shortest first. Choose one to mark it on the board.'))}</p>`;
            s += paths.map((p, i) => `<button type="button" class="walk-path${i === w.pick ? ' on' : ''}" data-act="walk-pick" data-i="${i}" aria-pressed="${i === w.pick}">`
                + pathSteps(p).map((st) => (st.stop !== undefined ? `<span class="wp-stop">${esc(st.stop)}</span>` : `<span class="wp-via">${esc(st.via)}</span>`)).join('') + '</button>').join('');
            if (w.pick >= 0) s += actBtn('walk-pick', 'Clear the mark', 'data-i="-1"');
        }
    }
    const box = $('railWalk'), was = document.activeElement, keep = was && box.contains(was) ? was.id : '';
    box.innerHTML = s;
    translateChrome(box);
    if (keep && $(keep)) $(keep).focus();
}
