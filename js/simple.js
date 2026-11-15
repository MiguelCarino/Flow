// The Simple view: the workflow for someone who reads it, not draws it.
//
// A client or a reviewer sees every screen as a card, opens one with a tap,
// and walks through the workflow in Play. Nothing can be changed from here,
// and going to the full editor and back loses nothing: this is only another
// way of looking at the same document.

function setSimple(on) {
    on = !!on;
    if (on === state.simple) return;
    state.simple = on;
    if (on) { state.viewBefore = state.view; state.view = 'flow'; state.test = null; setSelection([]); }
    else { state.view = state.viewBefore || 'board'; state.play = null; }
    // The address says which view it is, so a reload or a shared link opens the same one.
    try {
        const q = new URLSearchParams(location.search);
        if (on) { q.set('simple', ''); q.delete('full'); } else { q.delete('simple'); q.set('full', ''); }
        const s = q.toString().replace(/=(&|$)/g, '$1');
        history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
    } catch (e) { /* a file: page keeps its address */ }
    render();
    fitBoard();
}
// Which view a visit starts in: what the address says; else, on a phone with
// something to read, the Simple view, since a phone is for reading it.
function simpleAtStart() {
    let q;
    try { q = new URLSearchParams(location.search); } catch (e) { return false; }
    if (q.has('simple')) return true;
    if (q.has('full')) return false;
    const phone = window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    return phone && state.doc.screens.length > 0;
}
function renderSimple() {
    const doc = state.doc, on = state.simple, n = doc.screens.filter((s) => !s.stub).length;
    document.body.classList.toggle('simple', on);
    const btn = $('simpleBtn');
    btn.textContent = on ? t('Full editor') : t('Simple view');
    btn.title = on ? t('Everything: drawing, checking, exporting.') : t('A view for reading the workflow and walking through it. Nothing here changes it.');
    const bar = $('simpleBar');
    bar.hidden = !on;
    if (!on) { bar.innerHTML = ''; return; }
    bar.innerHTML = `<div class="sb-text"><h1 class="sb-name">${esc(doc.name || t('Untitled workflow'))}</h1>`
        + `<p class="sb-note">${n ? esc(n === 1 ? t('1 screen') : t('{n} screens', { n })) + '. ' + esc(t('Tap a screen to open it, or walk through the workflow from the start.')) : esc(t('There is nothing in this workflow yet.'))}</p></div>`
        + (n ? `<button type="button" class="btn btn-primary" data-act="play">▶ ${esc(t('Walk through it'))}</button>` : '');
}
