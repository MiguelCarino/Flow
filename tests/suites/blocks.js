// Blocks: a group of elements drawn once and placed on many screens.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    const q = (sel) => board.querySelector(sel);
    // The checks about blocks; what the elements in them are told is in tests/suites/checks2.js.
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]).filter((k) => k.startsWith('block-')).sort();
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const cart = by('Cart'), receipt = by('Receipt');
    const cartSize = sizesOf(state.doc, cart.id)[0];
    const [title, photo, pay] = elementsOf(state.doc, cartSize.id);
    const payLink = state.doc.links.find((l) => l.fromEl === pay.id);
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));

    // ---- making one from what is selected ----
    setSelection([selEntry('elements', photo.id), selEntry('elements', pay.id)]); render();
    const before = JSON.stringify(serializeDoc(state.doc));
    document.querySelector('#railProps [data-act="make-block"]').click();
    const block = state.doc.blocks[0], placing = recOf(state.doc, soleSelected().id);
    eq('the elements become a block, as one change', [state.doc.blocks.length, sent.length], [1, 1]);
    eq('the block is as big as what it holds', [block.w, block.h], [326, 288]);
    eq('its elements keep their places inside it', elementsOf(state.doc, block.id).map((e) => [e.type, e.x, e.y]), [['image', 0, 0], ['button', 0, 240]]);
    eq('one placing takes their place on the screen', [placing.type, placing.block, placing.x, placing.y, placing.w, placing.h, elementsOf(state.doc, cartSize.id).length], ['block', block.id, 32, 160, 326, 288, 2]);
    eq('a link that started at one of them starts at the placing', recOf(state.doc, payLink.id).fromEl, placing.id);
    ok('the block is drawn on the board, to the right of everything', !!q(`.block[data-id="${block.id}"]`) && block.x > receipt.x + 390);
    ok('and says how often it is placed', /placed once/.test(q(`.block[data-id="${block.id}"] .stop-name`).textContent));
    eq('the screen shows the same things through the placing', q(`.el[data-id="${placing.id}"]`).querySelectorAll('text').length, 2);
    ok('what is inside a placing is not selectable by itself', q(`.el[data-id="${placing.id}"]`).querySelectorAll('[data-id]').length === 0);
    eq('nothing to report', keys(), []);

    // ---- placing it elsewhere ----
    selectId(receipt.id);
    const list = document.getElementById('addType');
    ok('the Add list offers the block by name', Array.from(list.options).some((o) => o.value === 'block:' + block.id && o.textContent === 'Block 1'));
    list.value = 'block:' + block.id;
    document.querySelector('[data-act="add-el"]').click();
    const second = recOf(state.doc, soleSelected().id);
    eq('a placing goes on the selected screen at the block\'s size', [second.type, second.block, second.w, second.h, second.size], ['block', block.id, 326, 288, sizesOf(state.doc, receipt.id)[0].id]);
    ok('and the block counts it', /placed 2 times/.test(q(`.block[data-id="${block.id}"] .stop-name`).textContent));

    // ---- change once, change everywhere ----
    const inner = elementsOf(state.doc, block.id).find((e) => e.type === 'button');
    setF(inner.id, 'text', 'Buy now');
    eq('a change to the block shows in every placing', [placing, second].map((p) => Array.from(q(`.el[data-id="${p.id}"]`).querySelectorAll('text')).some((t) => t.textContent === 'Buy now')), [true, true]);
    setF(inner.id, 'pinH', 'both'); setF(inner.id, 'pinV', 'bottom');
    setF(second.id, 'w', 200); setF(second.id, 'h', 400);
    const drawn = Array.from(q(`.el[data-id="${second.id}"]`).querySelectorAll('rect')).find((r) => r.getAttribute('rx') === '8');
    eq('in a placing of another size, its elements follow their pins', [drawn.getAttribute('width'), drawn.parentNode.getAttribute('transform')], ['200', 'translate(0 352)']);

    // ---- editing inside the block ----
    selectId(block.id);
    ok('with the block selected, elements can be added to it', !document.querySelector('[data-act="add-el"]').disabled);
    list.value = 'text';
    document.querySelector('[data-act="add-el"]').click();
    const added = recOf(state.doc, soleSelected().id);
    eq('a new element goes inside the block', [added.size, added.type], [block.id, 'text']);
    ok('it has no arrow to link from', !q('.sel-layer [data-h="link"]') && !!q('.sel-layer [data-h="resize"]'));
    list.value = 'block:' + block.id;
    eq('a block cannot be placed inside a block', addElement('block:' + block.id), '');
    removeId(added.id);
    selectId(block.id);
    // Pressed in the gap between its two elements, so the press is on the block.
    const z = state.camera.zoom, frame = q(`.block[data-id="${block.id}"] .frame`), fr = frame.getBoundingClientRect();
    const from = { x: fr.left + 10 * z, y: fr.top + 220 * z }, was = [block.x, block.y];
    pointer('pointerdown', frame, from);
    pointer('pointermove', board, { x: from.x + 80 * z, y: from.y + 160 * z });
    pointer('pointerup', board, { x: from.x + 80 * z, y: from.y + 160 * z });
    eq('a block is moved like a screen', [recOf(state.doc, block.id).x - was[0], recOf(state.doc, block.id).y - was[1]], [80, 160]);
    undo();
    const wField = document.querySelector(`#railProps [data-id="${block.id}"][data-f="w"]`);
    wField.value = '426'; wField.dispatchEvent(new Event('change', { bubbles: true }));
    eq('making the block wider stretches what is pinned to both edges', [recOf(state.doc, block.id).w, recOf(state.doc, inner.id).w], [426, 426]);
    undo();

    // ---- checks ----
    setF(inner.id, 'x', 200);
    ok('an element past the edge of its block is reported', findFindings(state.doc).some((f) => f.key.startsWith('outside') && /the block "Block 1"/.test(f.text)));
    undo();
    const empty = addBlock();
    eq('an empty block is reported', keys(), ['block-empty']);
    selectId(empty); list.value = 'button'; document.querySelector('[data-act="add-el"]').click();
    eq('then a block that is placed nowhere', keys(), ['block-unused']);
    removeId(empty);
    eq('removing it settles it', [keys(), state.doc.blocks.length, state.doc.elements.filter((e) => e.size === empty).length], [[], 1, 0]);

    // ---- copying ----
    selectId(block.id);
    const [copy] = duplicateSelected();
    eq('a block is copied with what is in it, and no placings', [recOf(state.doc, copy).name, elementsOf(state.doc, copy).length, state.doc.elements.filter((e) => e.block === copy).length], ['Block 1 copy', 2, 0]);
    undo();
    selectId(cart.id);
    const [cartCopy] = duplicateSelected();
    eq('a copied screen keeps its placing of the same block', elementsOf(state.doc, sizesOf(state.doc, cartCopy)[0].id).filter((e) => e.block === block.id).length, 1);
    undo();
    eq('a new size of a screen keeps it too', elementsOf(state.doc, addSize(cart.id, 'laptop')).filter((e) => e.block === block.id).length, 1);
    undo();

    // ---- files ----
    const env = JSON.stringify(fileEnvelope(state.doc));
    eq('blocks and placings are in the file', [openFileText(env).doc.blocks.length, openFileText(env).doc.elements.filter((e) => e.type === 'block').length], [1, 2]);
    const raw = JSON.parse(env).doc;
    raw.elements.push({ id: 'el_nest1', size: block.id, type: 'block', block: block.id }, { id: 'el_lost1', size: cartSize.id, type: 'block', block: 'blk_gone' }, { id: 'el_plain1', size: cartSize.id, type: 'text', block: block.id });
    const fixed = normalizeDoc(raw);
    eq('a block inside a block and a placing of nothing are dropped on reading', [!!fixed.elements.find((e) => e.id === 'el_nest1'), !!fixed.elements.find((e) => e.id === 'el_lost1')], [false, false]);
    eq('and only a placing keeps a block', fixed.elements.find((e) => e.id === 'el_plain1').block, '');

    // ---- removing ----
    const text = JSON.stringify(serializeDoc(state.doc));
    removeId(block.id);
    eq('removing a block removes its elements and its placings', [state.doc.blocks.length, state.doc.elements.filter((e) => e.type === 'block' || e.size === block.id).length], [0, 0]);
    eq('a link that started at a placing stays, from the screen', [recOf(state.doc, payLink.id).fromEl, recOf(state.doc, payLink.id).from], ['', cart.id]);
    undo();
    eq('one undo brings it all back', JSON.stringify(serializeDoc(state.doc)), text);
    while (canUndo() && state.doc.blocks.length) undo();
    eq('and undoing the block leaves the screen as it was', JSON.stringify(serializeDoc(state.doc)), before);
});
