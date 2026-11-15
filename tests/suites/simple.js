// The Simple view: reading and walking through, changing nothing. And touch.
suite(async (ok, eq) => {
    const board = document.getElementById('board'), bar = document.getElementById('simpleBar'), btn = document.getElementById('simpleBtn');
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name), cart = by('Cart');
    const before = JSON.stringify(serializeDoc(state.doc));
    const sent = []; state.opSinks.push((ops) => sent.push(ops));
    selectId(cart.id);

    btn.click();
    eq('the Simple view button turns it on', [state.simple, document.body.classList.contains('simple'), btn.textContent, state.view], [true, true, 'Full editor', 'flow']);
    ok('the address says so, for a reload or a link', new URLSearchParams(location.search).has('simple'));
    ok('it shows the workflow\'s name, how big it is, and a way in', /Shop checkout/.test(bar.textContent) && /3 screens/.test(bar.textContent) && !!bar.querySelector('[data-act="play"]'));
    ok('the rail and the editing buttons are out of sight', getComputedStyle(document.querySelector('.flow-rail')).display === 'none' && document.getElementById('undoBtn').offsetParent === null && document.getElementById('fileMenuBtn').offsetParent === null && document.getElementById('viewBoard').offsetParent === null);
    ok('Play and the way back are not', document.getElementById('playBtn').offsetParent !== null && btn.offsetParent !== null);
    ok('every screen is a card, with nothing selected', board.querySelectorAll('.card').length === 3 && state.selection.size === 0 && !board.querySelector('.sel-layer'));

    // ---- nothing can be changed ----
    const frame = board.querySelector(`.card[data-id="${cart.id}"] .frame`), c = pointAt(frame);
    drag(frame, { x: c.x + 90, y: c.y + 60 });
    ok('a drag moves the view, not the card', sent.length === 0 && state.selection.size === 0 && !state.play);
    ['Delete', 'ArrowLeft'].forEach((k) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    ok('no key of the editor does anything', sent.length === 0 && state.selection.size === 0);
    drag({ x: 500, y: 300 }, { x: 700, y: 500 }, { shift: true });
    ok('there is no selection box', state.selection.size === 0 && state.marquee === null);

    // ---- a tap opens a screen ----
    fitBoard();
    const f2 = board.querySelector(`.card[data-id="${cart.id}"] .frame`);
    pointer('pointerdown', f2, f2); pointer('pointerup', board, f2);
    eq('a tap on a card opens that screen in Play', [!!state.play, state.play && state.play.at], [true, cart.id]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok('Escape comes back to the cards', !state.play && state.simple);
    bar.querySelector('[data-act="play"]').click();
    eq('Walk through it starts at the start', state.play && stopName(recOf(state.doc, state.play.at)), 'Sign in');
    playExit();
    ok('none of it changed the document', JSON.stringify(serializeDoc(state.doc)) === before && sent.length === 0);

    // ---- and back ----
    btn.click();
    eq('Full editor comes back to the board, as it was', [state.simple, state.view, btn.textContent, getComputedStyle(document.querySelector('.flow-rail')).display !== 'none', new URLSearchParams(location.search).has('simple')], [false, 'board', 'Simple view', true, false]);
    setView('flow'); setSimple(true); setSimple(false);
    eq('it comes back to whichever view was on', state.view, 'flow');
    setView('board');
    openDoc(newDoc(''), false); setSimple(true);
    ok('an empty workflow says so, with nothing to walk', /nothing in this workflow yet/.test(bar.textContent) && !bar.querySelector('[data-act="play"]'));
    setSimple(false); undo();

    // ---- a link that opens in the Simple view ----
    eq('where a visit starts: the address decides', [(() => { history.replaceState(null, '', location.pathname + '?simple'); return simpleAtStart(); })(), (() => { history.replaceState(null, '', location.pathname + '?full'); return simpleAtStart(); })(), (() => { history.replaceState(null, '', location.pathname); return simpleAtStart(); })()], [true, false, false]);

    // ---- touch: two fingers zoom ----
    const touch = (type, id, x, y) => board.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
    fitBoard(); sent.length = 0;
    const r = board.getBoundingClientRect(), mx = r.left + r.width / 2, my = r.top + r.height / 2, z0 = state.camera.zoom;
    const under = { x: (mx - r.left - state.camera.x) / z0, y: (my - r.top - state.camera.y) / z0 };
    touch('pointerdown', 11, mx - 50, my); touch('pointerdown', 12, mx + 50, my);
    touch('pointermove', 11, mx - 100, my); touch('pointermove', 12, mx + 100, my);
    eq('spreading two fingers to twice the gap doubles the zoom', Math.round((state.camera.zoom / z0) * 100) / 100, 2);
    const now = { x: (mx - r.left - state.camera.x) / state.camera.zoom, y: (my - r.top - state.camera.y) / state.camera.zoom };
    ok('and what was between the fingers stays there', Math.abs(now.x - under.x) < 1 && Math.abs(now.y - under.y) < 1);
    touch('pointerup', 11, mx - 100, my);
    touch('pointermove', 12, mx + 300, my + 200);
    touch('pointerup', 12, mx + 300, my + 200);
    ok('lifting one finger does not start a drag with the other', sent.length === 0 && state.selection.size === 0);
    const el = state.doc.elements.find((e) => e.name === 'Pay'); selectId(el.id);
    const g = board.querySelector(`.el[data-id="${el.id}"]`), p = pointAt(g);
    g.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 21, pointerType: 'touch', clientX: p.x, clientY: p.y }));
    touch('pointermove', 21, p.x + 40, p.y + 40);
    touch('pointerdown', 22, p.x + 120, p.y);
    touch('pointerup', 21, p.x + 40, p.y + 40); touch('pointerup', 22, p.x + 120, p.y);
    eq('a second finger gives up the move the first had started', [el.x, el.y, sent.length], [32, 400, 0]);
    board.querySelector(`.el[data-id="${el.id}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 31, pointerType: 'touch', clientX: p.x, clientY: p.y }));
    const z = state.camera.zoom;
    touch('pointermove', 31, p.x + 16 * z, p.y); touch('pointerup', 31, p.x + 16 * z, p.y);
    eq('one finger still moves an element', [recOf(state.doc, el.id).x, sent.length], [48, 1]);
});
