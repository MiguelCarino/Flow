// Play: the workflow clicked through, one stop at a time, from the start.
// Nothing here changes the document; where Play is, is how this visitor is
// looking at it (state.play).

// The ways out of a stop, in the order they are offered.
function playWays(stopId) {
    const doc = state.doc;
    return linksFrom(doc, stopId).map((l) => {
        const el = l.fromEl ? recOf(doc, l.fromEl) : null, to = recOf(doc, l.to);
        return { link: l, el, to, text: linkLabel(l) || (el ? elementTitle(el, doc) : t('Go on')) };
    });
}
function playStart(from) {
    const doc = state.doc, sel = soleSelected();
    const picked = from || (sel && isStopId(sel.id) ? sel.id : '');
    const start = picked && recOf(doc, picked) ? picked : (doc.screens.find((s) => s.start) || doc.screens[0] || {}).id;
    if (!start) { say(t('There is no screen to start from yet.'), true); return false; }
    state.test = null;
    state.play = { at: start, first: start, history: [] };
    render();
    return true;
}
function playGo(linkId) {
    const p = state.play, l = p ? recOf(state.doc, linkId) : null;
    if (!l || l.from !== p.at) return false;
    p.history.push(p.at); p.at = l.to;
    render();
    return true;
}
function playBack() {
    const p = state.play;
    if (!p || !p.history.length) return false;
    p.at = p.history.pop();
    render();
    return true;
}
function playRestart() { const p = state.play; if (p) { p.at = p.first; p.history = []; render(); } }
function playExit() { if (state.play) { state.play = null; render(); } }

function renderPlay() {
    const pane = $('playPane'), p = state.play, doc = state.doc;
    if (p && !recOf(doc, p.at)) state.play = null;
    pane.hidden = !state.play;
    if (!state.play) { pane.innerHTML = ''; return; }
    const stop = recOf(doc, p.at), ways = playWays(p.at), isScreen = kindOfId(p.at) === 'screens';
    const crumbs = p.history.concat(p.at).map((id) => recOf(doc, id)).filter(Boolean).map((s) => esc(stopName(s))).join(' <span class="pl-sep">›</span> ');
    let stage;
    if (isScreen) {
        const size = shownSize(stop), H = sizeHeight(size);
        // An element that leads one way is pressed directly. One that leads
        // several ways is only marked: the list beside it says which.
        const hot = new Map();
        ways.forEach((w) => { if (w.el && w.el.size === size.id) hot.set(w.el.id, (hot.get(w.el.id) || []).concat(w)); });
        let marks = '';
        hot.forEach((list, id) => {
            const e = recOf(doc, id), one = list.length === 1;
            marks += `<rect class="pl-hot" x="${e.x - 4}" y="${e.y - 4}" width="${e.w + 8}" height="${e.h + 8}" rx="8" fill="#2563eb" fill-opacity="0.08" stroke="#2563eb" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"`
                + (one ? ` data-act="play-go" data-id="${list[0].link.id}" tabindex="0" role="button" aria-label="${esc(list[0].text)}"><title>${esc(list[0].text)}</title></rect>` : `><title>${esc(t('Leads several ways: choose one in the list'))}</title></rect>`);
        });
        stage = `<svg class="pl-screen" viewBox="-6 -6 ${size.w + 12} ${H + 12}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(stopName(stop))}">`
            + `<rect width="${size.w}" height="${H}" rx="${n1(Math.min(12, size.w / 20))}" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
            + elementsOf(doc, size.id).map((e) => elementSvg(e, 1, true)).join('') + marks + '</svg>';
    } else {
        stage = `<div class="pl-decision"><p class="pl-kicker">${esc(t('The system decides'))}</p><p class="pl-question">${esc(stopName(stop))}</p></div>`;
    }
    let side = `<h2 class="rail-title">${esc(t(isScreen ? 'From here' : 'Which answer?'))}</h2>`;
    if (ways.length) {
        side += ways.map((w) => `<button type="button" class="pl-way" data-act="play-go" data-id="${w.link.id}"><span class="pl-what">${esc(w.text)}</span>`
            + `<span class="pl-to">→ ${esc(w.to ? stopName(w.to) : '?')}</span></button>`).join('');
    } else {
        side += `<p class="pf-note">${esc(t(isScreen && stop.end ? 'The workflow ends here.' : 'Nothing leads on from here.'))}</p>`;
    }
    pane.innerHTML = `<div class="pl-top"><div class="pl-crumbs" aria-label="${esc(t('Where you have been'))}">${crumbs}</div>`
        + `<div class="pl-btns"><button type="button" class="btn btn-ghost sm" data-act="play-back"${p.history.length ? '' : ' disabled'}>${esc(t('← Back'))}</button>`
        + `<button type="button" class="btn btn-ghost sm" data-act="play-restart">${esc(t('Start again'))}</button>`
        + `<button type="button" class="btn btn-primary sm" data-act="play-exit">${esc(t('Leave Play'))}</button></div></div>`
        + `<div class="pl-body"><div class="pl-stage">${stage}</div><aside class="pl-side">${side}</aside></div>`;
}
