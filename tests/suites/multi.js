// Several things selected: picking them, then moving, lining up, copying
// and removing them together, each as one step.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    const q = (sel) => board.querySelector(sel);
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = state.doc.decisions[0];
    const frame = (s) => q(`.screen[data-id="${s.id}"] .frame`);
    const press = (target, keys) => { pointer('pointerdown', target, target, keys); pointer('pointerup', board, target, keys); };
    const ids = () => Array.from(state.selection).map((e) => e.id).sort();
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));

    // ---- picking ----
    press(frame(cart));
    press(frame(receipt), { shift: true });
    eq('Shift and a press adds to the selection', ids(), [cart.id, receipt.id].sort());
    press(frame(cart), { ctrl: true });
    eq('Ctrl and a press takes one away', ids(), [receipt.id]);
    press(frame(cart), { shift: true });
    ok('with several selected there are no handles', !q('.sel-layer [data-h]') && board.querySelectorAll('.sel-layer').length === 2);
    ok('and the rail says how many', document.querySelector('#railProps .rail-title').textContent === '2 selected');
    eq('picking is not a change', sent.length, 0);

    const r = board.getBoundingClientRect();
    drag({ x: r.left + 4, y: r.top + 4 }, { x: r.right - 4, y: r.bottom - 4 }, { shift: true });
    eq('Shift and a drag on the background selects every stop it touches', ids(), [signIn.id, cart.id, receipt.id, ask.id].sort());
    ok('and the box is gone', state.marquee === null && !/stroke-dasharray="4 3"/.test(board.innerHTML));
    const f = frame(cart).getBoundingClientRect();
    drag(frame(cart), { x: f.right - 2, y: f.bottom - 2 }, { shift: true });
    const cartEls = elementsOf(state.doc, sizesOf(state.doc, cart.id)[0].id);
    eq('started on a screen, it selects that screen\'s elements', ids(), cartEls.filter((e) => e.y + e.h > 422).map((e) => e.id).sort());
    drag(frame(cart), { x: f.left + 2, y: f.top + 2 }, { shift: true });
    eq('all of them, from corner to corner', ids(), cartEls.map((e) => e.id).sort());

    // ---- moving together ----
    setSelection([selEntry('screens', cart.id), selEntry('screens', receipt.id), selEntry('elements', cartEls[0].id)]); render();
    eq('an element whose screen moves too is not moved twice', movingIds().sort(), [cart.id, receipt.id].sort());
    const z = state.camera.zoom, c = pointAt(frame(cart));
    drag(frame(cart), { x: c.x + 100 * z, y: c.y + 48 * z });
    eq('a drag moves all of them by the same step', [recOf(state.doc, cart.id).x - 1152, recOf(state.doc, cart.id).y, recOf(state.doc, receipt.id).x - 1784, recOf(state.doc, receipt.id).y], [104, 48, 104, 48]);
    eq('in one change', sent.length, 1);
    undo();
    eq('and one undo', [recOf(state.doc, cart.id).x, recOf(state.doc, receipt.id).y], [1152, 0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    eq('the arrows move them all', [recOf(state.doc, cart.id).x, recOf(state.doc, receipt.id).x], [1144, 1776]);
    undo();

    // ---- lining up ----
    setSelection(cartEls.map((e) => selEntry('elements', e.id))); render();
    const [title, photo, pay] = cartEls;
    setF(photo.id, 'x', 64); setF(pay.id, 'w', 160); sent.length = 0;
    alignSelection('left');
    eq('left edges line up', cartEls.map((e) => e.x), [32, 32, 32]);
    eq('as one change', sent.length, 1);
    alignSelection('right');
    eq('right edges line up', cartEls.map((e) => e.x + e.w), [358, 358, 358]);
    alignSelection('hcenter');
    eq('centres line up', cartEls.map((e) => e.x + e.w / 2), [195, 195, 195]);
    alignSelection('vspace');
    const gaps = [photo.y - (title.y + title.h), pay.y - (photo.y + photo.h)];
    ok('spaced evenly, the gaps are equal and the ends stay', Math.abs(gaps[0] - gaps[1]) <= 1 && title.y === 96 && pay.y + pay.h === 448, JSON.stringify(gaps));
    alignSelection('top');
    eq('top edges line up', cartEls.map((e) => e.y), [96, 96, 96]);
    for (let i = 0; i < 7; i++) undo();

    setSelection([selEntry('screens', signIn.id), selEntry('decisions', ask.id), selEntry('screens', cart.id)]); render();
    alignSelection('vcenter');
    eq('stops line up by their boxes', ask.y + DECISION_H / 2, 422);
    undo();
    setSelection([selEntry('screens', cart.id), selEntry('elements', pay.id)]); render();
    eq('a screen and an element do not line up', [alignSelection('left'), alignGroup().length], [false, 0]);
    ok('and the buttons say so', document.querySelector('#railProps [data-act="align"]').disabled);
    setSelection([selEntry('screens', cart.id), selEntry('screens', receipt.id)]); render();
    eq('two cannot be spaced', alignSelection('hspace'), false);

    // ---- copying ----
    const counts = () => [state.doc.screens.length, state.doc.sizes.length, state.doc.elements.length, state.doc.links.length];
    const was = counts();
    setSelection([selEntry('screens', signIn.id)]); render();
    const [copy] = duplicateSelected();
    eq('a screen is copied with its sizes and elements, and no links', counts(), [was[0] + 1, was[1] + 2, was[2] + 6, was[3]]);
    eq('the copy is selected, named, below, and not a second start', [ids(), recOf(state.doc, copy).name, recOf(state.doc, copy).y > 844, recOf(state.doc, copy).start], [[copy], 'Sign in copy', true, false]);
    undo();
    eq('one undo', counts(), was);
    setSelection([selEntry('elements', pay.id), selEntry('elements', title.id)]); render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', ctrlKey: true, bubbles: true }));
    const made = ids().map((id) => recOf(state.doc, id));
    eq('Ctrl+D copies elements beside the originals, on top', [made.length, made.every((m) => m.size === pay.size && m.z > pay.z), state.doc.elements.length], [2, true, was[2] + 2]);
    undo();

    // ---- all, and removing ----
    setSelection([selEntry('elements', pay.id)]); render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    eq('Ctrl+A with an element selected takes its screen\'s elements', ids(), cartEls.map((e) => e.id).sort());
    setSelection([]); selectAll();
    eq('with nothing selected, every stop', ids().length, 4);
    setSelection([selEntry('screens', cart.id), selEntry('elements', pay.id), selEntry('decisions', ask.id)]); render();
    const text = JSON.stringify(serializeDoc(state.doc));
    sent.length = 0;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    eq('Delete removes them all, and what hung off them', [state.doc.screens.length, state.doc.decisions.length, state.doc.links.length, state.selection.size, sent.length], [2, 0, 0, 0, 1]);
    undo();
    eq('one undo brings everything back', JSON.stringify(serializeDoc(state.doc)), text);
});
