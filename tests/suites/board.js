// The board: what is drawn, and the pointer and keys on it.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    const q = (sel) => board.querySelector(sel), all = (sel) => Array.from(board.querySelectorAll(sel));
    const text = () => JSON.stringify(serializeDoc(state.doc));

    ok('an empty board says so', !document.getElementById('boardEmpty').hidden);
    ok('a click on an element tile waits for a screen', document.querySelector('[data-act="add-el"]').classList.contains('off'));
    loadExample();
    ok('and stops saying so', document.getElementById('boardEmpty').hidden);
    eq('every stop and link is drawn', [all('.screen').length, all('.decision').length, all('.link').length], [3, 1, 4]);
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt');
    const frame = (s) => q(`.screen[data-id="${s.id}"] .frame`);
    eq('a screen shows the elements of one size', all(`.screen[data-id="${signIn.id}"] .el`).length, 4);
    ok('the name says where the workflow starts', q(`.screen[data-id="${signIn.id}"] .stop-name`).textContent === 'Sign in · start');
    eq('a link says what happens and the answer', all('.link text').map((t) => t.textContent).sort(), ['Shows the error · No', 'Taps Pay', 'Taps Sign in', 'Yes']);

    // ---- sizes ----
    const chips = all(`.screen[data-id="${signIn.id}"] .size-chip`);
    eq('a screen lists its sizes', chips.map((c) => c.querySelector('text').textContent), ['Phone 390×844', 'Laptop 1366×768']);
    const before = text();
    pointer('pointerdown', all(`.screen[data-id="${signIn.id}"] .size-chip`)[1], all(`.screen[data-id="${signIn.id}"] .size-chip`)[1]);
    eq('a click shows the other size', [frame(signIn).getAttribute('width'), all(`.screen[data-id="${signIn.id}"] .el`).length], ['1366', 2]);
    ok('which is a way of looking, not a change', text() === before && !canRedo());
    ok('the link no longer starts at a button that is not shown', all('.link').length === 4);
    showSize(sizesOf(state.doc, signIn.id)[0].id);

    // ---- selecting ----
    pointer('pointerdown', frame(cart), frame(cart)); pointer('pointerup', board, frame(cart));
    eq('a press selects', soleSelected(), { type: 'screens', id: cart.id });
    ok('the rail shows it', document.querySelector('#railProps [data-f="name"]').value === 'Cart');
    ok('and elements can be added', !document.querySelector('[data-act="add-el"]').classList.contains('off'));
    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    const payEl = q(`.el[data-id="${pay.id}"]`);
    pointer('pointerdown', payEl, payEl); pointer('pointerup', board, payEl);
    eq('a press on an element selects the element', soleSelected(), { type: 'elements', id: pay.id });
    ok('with a handle to resize and one to link', !!q('.sel-layer [data-h="resize"]') && !!q('.sel-layer [data-h="link"]'));
    pointer('pointerdown', board, { x: board.getBoundingClientRect().right - 5, y: board.getBoundingClientRect().top + 5 });
    pointer('pointerup', board, { x: board.getBoundingClientRect().right - 5, y: board.getBoundingClientRect().top + 5 });
    eq('a press on the background selects nothing', state.selection.size, 0);

    // ---- moving ----
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));
    const z = state.camera.zoom, c = pointAt(frame(receipt));
    drag(frame(receipt), { x: c.x + 80 * z, y: c.y - 160 * z });
    eq('a drag moves a screen, on the grid', [recOf(state.doc, receipt.id).x, recOf(state.doc, receipt.id).y], [receipt.x, receipt.y].map(snap));
    eq('by what the pointer moved', [recOf(state.doc, receipt.id).x - 1784, recOf(state.doc, receipt.id).y], [80, -160]);
    eq('as one change', sent.length, 1);
    eq('of one operation per field', sent[0].map((o) => o.field).sort(), ['x', 'y']);
    undo();
    eq('and one undo', [recOf(state.doc, receipt.id).x, recOf(state.doc, receipt.id).y], [1784, 0]);
    sent.length = 0;
    pointer('pointerdown', frame(receipt), frame(receipt)); pointer('pointerup', board, frame(receipt));
    eq('a press that does not move changes nothing', sent.length, 0);

    // ---- resizing ----
    selectId(pay.id);
    const handle = q('.sel-layer [data-h="resize"]'), h = pointAt(handle);
    drag(handle, { x: h.x - 40 * z, y: h.y + 16 * z });
    eq('the corner resizes an element', [recOf(state.doc, pay.id).w, recOf(state.doc, pay.id).h], [288, 64]);
    undo();

    // ---- linking ----
    selectId(receipt.id);
    const links = state.doc.links.length;
    drag(q('.sel-layer [data-h="link"]'), frame(signIn));
    eq('dragging the arrow onto a stop links them', state.doc.links.length, links + 1);
    const made = recOf(state.doc, soleSelected().id);
    eq('from the one to the other, and it is selected', [made.from, made.to, soleSelected().type], [receipt.id, signIn.id, 'links']);
    undo();
    selectId(pay.id);
    drag(q('.sel-layer [data-h="link"]'), q('.decision polygon'));
    const fromEl = state.doc.links[state.doc.links.length - 1];
    eq('from an element, the link remembers which', [fromEl.from, fromEl.fromEl, kindOfId(fromEl.to)], [cart.id, pay.id, 'decisions']);
    undo();
    selectId(receipt.id);
    drag(q('.sel-layer [data-h="link"]'), { x: board.getBoundingClientRect().right - 5, y: board.getBoundingClientRect().top + 5 });
    eq('dropped on nothing, no link', state.doc.links.length, links);

    // ---- keys ----
    const key = (k, more = {}) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true }, more)));
    selectId(pay.id);
    key('ArrowRight'); key('ArrowDown', { shiftKey: true });
    eq('the arrows move the selection by the grid', [recOf(state.doc, pay.id).x, recOf(state.doc, pay.id).y], [40, 432]);
    key('z', { ctrlKey: true }); key('z', { ctrlKey: true });
    eq('Ctrl+Z undoes', [recOf(state.doc, pay.id).x, recOf(state.doc, pay.id).y], [32, 400]);
    key('Delete');
    ok('Delete removes it', !recOf(state.doc, pay.id));
    key('z', { metaKey: true });
    ok('and it comes back', !!recOf(state.doc, pay.id));
    selectId(cart.id);
    const name = document.querySelector('#railProps [data-f="name"]');
    name.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    ok('a key pressed in a field is the field\'s', !!recOf(state.doc, cart.id));

    // ---- adding from the rail ----
    selectId(cart.id);
    document.querySelector('#palette [data-act="add-el"][data-type="button"]').click();
    const added = recOf(state.doc, soleSelected().id);
    eq('a new element goes under the lowest one, inside the screen', [added.type, added.size, added.y > 448, added.x + added.w <= 390], ['button', sizesOf(state.doc, cart.id)[0].id, true, true]);
    document.querySelector('[data-act="add-screen"]').click();
    eq('a new screen goes to the right of everything', [state.doc.screens.length, recOf(state.doc, soleSelected().id).x > 1784 + 390], [4, true]);
    document.querySelector('[data-act="add-decision"]').click();
    eq('and so does a decision', [state.doc.decisions.length, soleSelected().type], [2, 'decisions']);

    // ---- typing in the rail ----
    selectId(cart.id);
    const field = document.querySelector('#railProps [data-f="name"]');
    field.focus(); field.value = 'Basket'; field.dispatchEvent(new Event('input', { bubbles: true }));
    eq('typing changes the document at once', recOf(state.doc, cart.id).name, 'Basket');
    ok('and the board', q(`.screen[data-id="${cart.id}"] .stop-name`).textContent === 'Basket');
    ok('without rebuilding the field being typed in', document.activeElement === field && document.body.contains(field));
    const tick = document.querySelector('#railProps [data-f="start"]');
    tick.checked = true; tick.dispatchEvent(new Event('change', { bubbles: true }));
    eq('ticking Start moves the start', state.doc.screens.filter((s) => s.start).map((s) => s.name), ['Basket']);

    // ---- the camera ----
    const zoomWas = state.camera.zoom;
    document.querySelector('[data-act="zoom-in"]').click();
    ok('zooming is not a change to the document', state.camera.zoom > zoomWas && document.getElementById('zoomLabel').textContent === Math.round(state.camera.zoom * 100) + '%');
    fitBoard();
    const r = board.getBoundingClientRect();
    ok('Fit puts every stop on the board', all('.frame, .decision polygon').every((el) => { const b = el.getBoundingClientRect(); return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom; }));
});
