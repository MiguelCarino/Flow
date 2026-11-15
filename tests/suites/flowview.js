// The flow view: every stop a card, laid out from the links.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    const q = (sel) => board.querySelector(sel), all = (sel) => Array.from(board.querySelectorAll(sel));
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = state.doc.decisions[0];
    const before = JSON.stringify(serializeDoc(state.doc));
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));

    document.getElementById('viewFlow').click();
    eq('the Flow button shows the flow view', [state.view, document.getElementById('viewFlow').getAttribute('aria-pressed'), document.getElementById('viewBoard').getAttribute('aria-pressed')], ['flow', 'true', 'false']);
    eq('every screen is a card, every decision and link is there', [all('.card').length, all('.decision').length, all('.link').length], [3, 1, 4]);
    ok('a card has the screen\'s name and a small drawing of it', q(`.card[data-id="${cart.id}"] .stop-name`).textContent === 'Cart' && q(`.card[data-id="${cart.id}"] .thumb`).querySelectorAll('rect').length > 2);
    ok('elements and blocks are not on show', all('.el').length === 0 && all('.block').length === 0);

    const L = flowLayout(), col = (s) => L.get(s.id).x + L.get(s.id).w / 2;
    ok('the start is on the left, each step to the right of what leads to it', col(signIn) < col(ask) && col(ask) < col(cart) && col(cart) < col(receipt));
    eq('cards are one size', [L.get(cart.id).w, L.get(cart.id).h, L.get(signIn.id).w], [CARD_W, CARD_H, CARD_W]);
    const boxes = Array.from(L.values());
    ok('nothing overlaps', boxes.every((a, i) => boxes.every((b, j) => i >= j || !boxesMeet(a, b))));
    const r = board.getBoundingClientRect();
    ok('and everything is in view', all('.card .frame, .decision polygon').every((el) => { const b = el.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom; }));

    // ---- it is a way of looking ----
    ok('switching views changes nothing in the document', JSON.stringify(serializeDoc(state.doc)) === before && sent.length === 0);
    const frame = q(`.card[data-id="${cart.id}"] .frame`), c = pointAt(frame);
    drag(frame, { x: c.x + 120, y: c.y + 90 });
    eq('a card is selected by a press', soleSelected(), { type: 'screens', id: cart.id });
    ok('but cannot be dragged: its place is worked out', sent.length === 0 && cart.x === 1152);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    ok('nor nudged', sent.length === 0);
    ok('the rail still shows the screen', document.querySelector('#railProps [data-f="name"]').value === 'Cart');

    // ---- the workflow can still be changed here ----
    drag(q('.sel-layer [data-h="link"]'), q(`.card[data-id="${signIn.id}"] .frame`));
    eq('a link can be drawn from card to card', [state.doc.links.length, recOf(state.doc, soleSelected().id).to], [5, signIn.id]);
    undo();
    const island = addScreen('phone');
    const L2 = flowLayout();
    ok('a screen nothing leads to sits in a row of its own, below', L2.get(island).y > Math.max(L2.get(signIn.id).y + CARD_H, L2.get(ask.id).y + DECISION_H));
    addLink(receipt.id, island);
    const L3 = flowLayout();
    ok('linked, it takes its place after what leads to it', L3.get(island).x > L3.get(receipt.id).x && Math.abs(L3.get(island).y - L3.get(receipt.id).y) < 1);
    undo(); undo();
    ok('badges sit on the cards', (() => { const s = addScreen('phone'); const b = q(`.badge[data-badge="${s}"] circle`); const box = flowLayout().get(s); undo(); return !!b && Math.abs(Number(b.getAttribute('cx')) - (box.x + box.w)) < 1; })());

    // ---- selection across views ----
    document.getElementById('viewBoard').click();
    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    selectId(pay.id);
    setView('flow');
    eq('an element selected on the board is not selected in the flow view', state.selection.size, 0);
    setView('board');
    eq('back on the board the screens are where they were put', [all('.el').length > 0, q(`.screen[data-id="${cart.id}"]`).getAttribute('transform')], [true, 'translate(1152 0)']);
    eq('and the document is as it was', JSON.stringify(serializeDoc(state.doc)), before);

    // ---- an empty and a start-less workflow ----
    openDoc(newDoc(''), false); setView('flow');
    ok('an empty workflow draws nothing and says so', !document.getElementById('boardEmpty').hidden && flowLayout().size === 0);
    const a = addScreen('phone'), b = addScreen('phone');
    setF(a, 'start', false); addLink(a, b); addLink(b, a);
    eq('with no start and a loop, every stop still has a place', flowLayout().size, 2);
    setView('board');
});
