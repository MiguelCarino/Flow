// The Add grid of element tiles, its fold, and the board's backgrounds.
suite(async (ok, eq) => {
    const rail = document.querySelector('.flow-rail'), row = document.getElementById('libWrapRow'), body = document.getElementById('libBody');
    const tiles = () => Array.from(document.querySelectorAll('#palette .lib-tile'));
    const shown = () => getComputedStyle(body).display !== 'none';

    // ---- the grid ----
    eq('a tile for each of the 25 elements, in three groups', [tiles().length, document.querySelectorAll('#palette .lib-grid').length, Array.from(document.querySelectorAll('#palette .pf-head')).map((h) => h.textContent)], [25, 3, ['Content', 'Controls', 'Structure']]);
    ok('each tile is a drawing of the element and its name', tiles().every((t) => t.querySelector('svg.lib-pic') && t.querySelector('svg.lib-pic').children.length > 0 && t.querySelector('.lib-name').textContent.trim() !== ''));
    ok('the drawings are sound', !/NaN|undefined/.test(document.getElementById('palette').innerHTML));
    ok('the grid is three tiles across', getComputedStyle(document.querySelector('#palette .lib-grid')).gridTemplateColumns.split(' ').length === 3);
    ok('with nothing to add to, the tiles wait and a note says why', tiles().every((t) => t.classList.contains('off') && !t.disabled) && !document.getElementById('addHint').hidden && (() => { const n = state.doc.elements.length; tiles()[0].click(); return state.doc.elements.length === n && !document.getElementById('status').hidden; })());
    ok('with nothing selected the grid is open and there is no fold row', shown() && row.hidden);

    loadExample();
    const by = (n) => state.doc.screens.find((s) => s.name === n), cart = by('Cart');
    const pay = state.doc.elements.find((e) => e.name === 'Pay'), link = state.doc.links[0], ask = state.doc.decisions[0];

    // ---- a screen selected: the grid is what you want ----
    selectId(cart.id);
    ok('with a screen selected the grid stays open, its tiles ready', shown() && row.hidden && tiles().every((t) => !t.classList.contains('off')) && document.getElementById('addHint').hidden);
    const n = state.doc.elements.length;
    document.querySelector('#palette [data-type="toggle"]').click();
    eq('a tile adds its element to the screen', [state.doc.elements.length, recOf(state.doc, soleSelected().id).type], [n + 1, 'toggle']);

    // ---- an element selected: its details have the rail ----
    const addedId = soleSelected().id;
    ok('the element just added is selected, and the grid is held open for the next one', soleSelected().type === 'elements' && shown() && !row.hidden);
    selectId(addedId);
    ok('chosen again, its details have the rail: the grid has folded to one row', !shown() && !row.hidden && rail.classList.contains('lib-wrapped'));
    eq('the row says what it is and what a click does', [row.querySelector('.lw-name').textContent, row.querySelector('.lw-hint').textContent, row.getAttribute('aria-expanded'), row.querySelector('.lw-caret').textContent], ['Elements', 'Keep open', 'false', '▸']);
    ok('the element\'s details are right under it', document.querySelector('#railProps .rail-title').textContent === 'Toggle' && document.getElementById('railProps').getBoundingClientRect().top - row.getBoundingClientRect().bottom < 60);
    undo();
    [pay.id, link.id, ask.id].forEach((id) => { selectId(id); ok(`folded for a selected ${kindOfId(id).slice(0, -1)}`, !shown() && !row.hidden); });
    setSelection([selEntry('elements', pay.id), selEntry('screens', cart.id)]); render();
    ok('folded for several things', !shown());
    selectId('');
    ok('and open again when nothing is selected', shown() && row.hidden);

    // ---- keeping it open ----
    selectId(pay.id);
    row.click();
    eq('a click on the row keeps the grid open', [shown(), row.hidden, row.querySelector('.lw-hint').textContent, row.getAttribute('aria-expanded'), row.querySelector('.lw-caret').textContent], [true, false, 'Fold', 'true', '▾']);
    document.querySelector('#palette [data-type="chip"]').click();
    ok('open, a tile adds beside the selected element, and it stays open', recOf(state.doc, soleSelected().id).type === 'chip' && recOf(state.doc, soleSelected().id).size === pay.size && shown());
    undo();
    selectId(link.id);
    ok('it stays open for whatever is selected next', shown());
    row.click();
    ok('another click lets it fold again', !shown() && state.libPinned === false);
    ok('folding and opening are not changes to the workflow', (() => { const t = JSON.stringify(serializeDoc(state.doc)); selectId(pay.id); row.click(); row.click(); return JSON.stringify(serializeDoc(state.doc)) === t; })());

    // ---- blocks join the grid ----
    setSelection([selEntry('elements', pay.id), selEntry('elements', state.doc.elements.find((e) => e.type === 'image').id)]); render();
    makeBlock();
    const block = state.doc.blocks[0];
    eq('a block gets a tile of its own, in a fourth group', [tiles().length, Array.from(document.querySelectorAll('#palette .pf-head')).map((h) => h.textContent)[3], !!document.querySelector(`#palette [data-type="block:${block.id}"]`)], [26, 'Blocks', true]);
    setF(block.id, 'name', 'Buy box');
    eq('renamed, its tile follows', document.querySelector(`#palette [data-type="block:${block.id}"] .lib-name`).textContent, 'Buy box');
    setLocale('es');
    eq('the tiles and the row are in Flow\'s language', [document.querySelector('#palette [data-type="button"] .lib-name').textContent, document.querySelector('#palette .pf-head').textContent, row.querySelector('.lw-name').textContent], ['Botón', 'Contenido', 'Elementos']);
    setLocale('en');

    // ---- the board's background ----
    const pane = document.getElementById('boardPane'), btn = document.getElementById('boardInkBtn'), board = document.getElementById('board');
    selectId('');
    const before = JSON.stringify(serializeDoc(state.doc));
    const frame = () => getComputedStyle(board.querySelector('.screen .frame')).fill, ink = () => getComputedStyle(board.querySelector('.screen .stop-name')).fill;
    const light = [getComputedStyle(pane).backgroundColor, frame(), ink()];
    eq('the board starts light, and the button offers dark', [light, btn.title, btn.getAttribute('aria-pressed')], [['rgb(248, 250, 252)', 'rgb(255, 255, 255)', 'rgb(15, 23, 42)'], 'Dark background', 'false']);
    btn.click();
    eq('one click: a dark board, the names on it in light ink', [state.boardInk, getComputedStyle(pane).backgroundColor, ink(), btn.title, btn.getAttribute('aria-pressed')], ['dark', 'rgb(10, 10, 10)', 'rgb(250, 250, 250)', 'Blueprint background', 'true']);
    const onScreen = () => [frame(), getComputedStyle(board.querySelector('.el rect[fill="#0f172a"]')).fill, getComputedStyle(board.querySelector('.el text[fill="#0f172a"]')).fill, getComputedStyle(board.querySelector('.el rect[fill="#e2e8f0"]')).fill];
    const paper = ['rgb(255, 255, 255)', 'rgb(15, 23, 42)', 'rgb(15, 23, 42)', 'rgb(226, 232, 240)'];
    eq('the screens stay on white paper, drawn as they are', onScreen(), paper);
    eq('links and decisions on the board take the light ink', [getComputedStyle(board.querySelector('.link path[stroke="#334155"]')).stroke, getComputedStyle(board.querySelector('.link text')).fill, getComputedStyle(board.querySelector('.decision text')).fill], ['rgb(250, 250, 250)', 'rgb(250, 250, 250)', 'rgb(250, 250, 250)']);
    const payFill = () => getComputedStyle(board.querySelector('.el-button rect, .screen .el rect[rx="8"]')).fill;
    ok('the drawing itself is not rewritten: its colours are as they were', board.querySelector('.screen .frame').getAttribute('fill') === '#ffffff');
    btn.click();
    eq('another: blueprint, white on blue, on ruled paper', [state.boardInk, getComputedStyle(pane).backgroundColor, ink(), /linear-gradient/.test(getComputedStyle(pane).backgroundImage), btn.title], ['blue', 'rgb(27, 79, 140)', 'rgb(255, 255, 255)', true, 'Circuit background']);
    eq('the screens are still on paper', onScreen(), paper);
    ok('findings and the selection keep their colours', (() => { const s = addScreen('phone'); const c = board.querySelector('.badge circle'); const red = !!c && getComputedStyle(c).fill === 'rgb(220, 38, 38)'; undo(); return red; })());
    eq('it is remembered in this browser, not in the workflow', [localStorage.getItem('flow_board_ink'), JSON.stringify(serializeDoc(state.doc)) === before, canUndo() && false], ['blue', true, false]);
    const svg = svgOfStops(exportStops('all'), 'board');
    ok('a picture is always on paper', /fill="#ffffff"/.test(svg) && !/1b4f8c|map-ink/.test(svg));
    btn.click();
    const img = getComputedStyle(pane).backgroundImage;
    eq('a third: circuit green, the same ruled paper as blueprint in another colour, with no dots', [state.boardInk, getComputedStyle(pane).backgroundColor, ink(), (img.match(/radial-gradient/g) || []).length, (img.match(/linear-gradient/g) || []).length, getComputedStyle(pane).backgroundSize, btn.dataset.ink, btn.title], ['pcb', 'rgb(11, 59, 42)', 'rgb(236, 253, 243)', 0, 4, '120px 120px, 120px 120px, 24px 24px, 24px 24px', 'pcb', 'Light background']);
    eq('and the screens are still on paper', onScreen(), paper);
    ok('a picture from the circuit board is on paper too', !/0b3b2a|map-ink/.test(svgOfStops(exportStops('all'), 'board')));
    btn.click();
    eq('a fourth click: light again', [state.boardInk, getComputedStyle(pane).backgroundColor, frame(), localStorage.getItem('flow_board_ink'), btn.title], ['', 'rgb(248, 250, 252)', 'rgb(255, 255, 255)', null, 'Dark background']);
    setBoardInk('nonsense');
    eq('anything else is light', state.boardInk, '');
    setLocale('ja'); render();
    eq('the button\'s hint is in Flow\'s language', btn.title, '暗い背景');
    setLocale('en');

    // ---- dragging a tile onto the board ----
    openDoc(newDoc(''), false); loadExample(); fitBoard();
    const cart2 = by('Cart'), receipt = by('Receipt');
    const fr = (s) => board.querySelector(`.screen[data-id="${s.id}"] .frame`).getBoundingClientRect();
    const ptr = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: x, clientY: y }));
    const dragTile = (type, x, y, check) => {
        const t = document.querySelector(`#palette [data-type="${type}"]`), r = t.getBoundingClientRect(), sx = r.left + r.width / 2, sy = r.top + r.height / 2;
        ptr('pointerdown', t, sx, sy);
        ptr('pointermove', document, sx + 12, sy + 4);
        ptr('pointermove', document, x, y);
        const seen = check ? check() : null;
        ptr('pointerup', document, x, y);
        return seen;
    };
    selectId('');
    const sent = []; state.opSinks.push((ops) => sent.push(ops));
    const z = state.camera.zoom, c = fr(cart2), cx = c.left + c.width / 2, cy = c.top + c.height * 0.75, count = state.doc.elements.length;
    const mid = dragTile('toggle', cx, cy, () => [state.dropOn, !!board.querySelector('.drop-on'), !!document.querySelector('.lib-ghost.ok'), document.body.classList.contains('tile-dragging')]);
    eq('while a tile is dragged over a screen, the screen lights up and a copy of the tile follows', mid, [cart2.id, true, true, true]);
    const dropped = recOf(state.doc, soleSelected().id), size2 = sizesOf(state.doc, cart2.id)[0];
    eq('let go there, with nothing selected beforehand, the element is added to that screen', [state.doc.elements.length, dropped.type, dropped.size], [count + 1, 'toggle', size2.id]);
    const want = { x: (cx - c.left) / z, y: (cy - c.top) / z };
    eq('centred on where it was dropped, on the grid', [dropped.x, dropped.y], [snap(want.x - dropped.w / 2), snap(want.y - dropped.h / 2)]);
    ok('nothing of the drag is left behind', !document.querySelector('.lib-ghost') && state.dropOn === '' && !board.querySelector('.drop-on') && !document.body.classList.contains('tile-dragging'));
    eq('it is one change, and it is selected with the grid held open', [sent.length, soleSelected().id === dropped.id, shown()], [1, true, true]);
    undo();
    eq('and one undo', state.doc.elements.length, count);

    const corner = dragTile('card', c.right - 2, c.bottom - 2);
    const card = recOf(state.doc, soleSelected().id);
    ok('dropped at the very corner, it is kept inside the screen', card.type === 'card' && card.x + card.w <= size2.w && card.y + card.h <= sizeHeight(size2) && card.x >= 0);
    dragTile('topbar', cx, cy);
    const bar = recOf(state.doc, soleSelected().id);
    eq('a top bar goes to the top and spans it, wherever it is dropped', [bar.x, bar.y, bar.w, bar.pinH], [0, 0, size2.w, 'both']);
    undo(); undo();

    const n2 = state.doc.elements.length, br = board.getBoundingClientRect();
    const overBg = dragTile('button', br.right - 6, br.top + 6, () => [state.dropOn, !!document.querySelector('.lib-ghost'), !!document.querySelector('.lib-ghost.ok')]);
    eq('over the bare board nothing lights up', overBg, ['', true, false]);
    ok('and letting go there adds nothing, and says where to drop', state.doc.elements.length === n2 && /Drop it on a screen/.test(document.getElementById('status').textContent));
    const dec = board.querySelector('.decision polygon').getBoundingClientRect();
    dragTile('button', dec.left + dec.width / 2, dec.top + dec.height / 2);
    eq('a decision is not somewhere to drop an element', state.doc.elements.length, n2);

    const t0 = document.querySelector('#palette [data-type="button"]'), r0 = t0.getBoundingClientRect();
    ptr('pointerdown', t0, r0.left + 20, r0.top + 10); ptr('pointermove', document, r0.left + 22, r0.top + 11);
    ok('a press that barely moves is not a drag', !document.querySelector('.lib-ghost'));
    ptr('pointerup', document, r0.left + 22, r0.top + 11);
    // The click that would follow a drag is let through again a moment later.
    await new Promise((r) => setTimeout(r, 20));
    selectId(receipt.id); t0.click();
    eq('and the tile\'s click still adds to the selected screen', [state.doc.elements.length, recOf(state.doc, soleSelected().id).size], [n2 + 1, sizesOf(state.doc, receipt.id)[0].id]);
    undo();

    setSelection([selEntry('elements', state.doc.elements.find((e) => e.name === 'Pay').id), selEntry('elements', state.doc.elements.find((e) => e.type === 'image').id)]); render();
    const blk = makeBlock(), bb = board.querySelector(`.block[data-id="${blk}"] .frame`);
    fitBoard();
    const bRect = board.querySelector(`.block[data-id="${blk}"] .frame`).getBoundingClientRect(), inBlock = elementsOf(state.doc, blk).length;
    dragTile('chip', bRect.left + bRect.width / 2, bRect.top + bRect.height / 2);
    eq('an element can be dropped into a block', elementsOf(state.doc, blk).length, inBlock + 1);
    const self = dragTile('block:' + blk, bRect.left + bRect.width / 2, bRect.top + bRect.height / 2, () => state.dropOn);
    eq('a block cannot be dropped into a block', [self, elementsOf(state.doc, blk).length], ['', inBlock + 1]);
    const rr = fr(receipt);
    dragTile('block:' + blk, rr.left + rr.width / 2, rr.top + rr.height / 2);
    eq('but a block is dropped onto a screen as a placing', [recOf(state.doc, soleSelected().id).type, recOf(state.doc, soleSelected().id).block], ['block', blk]);

    setView('flow');
    const cardRect = board.querySelector('.card .frame').getBoundingClientRect(), n3 = state.doc.elements.length;
    dragTile('button', cardRect.left + 30, cardRect.top + 80);
    eq('in the flow view screens are cards, and nothing is dropped on them', state.doc.elements.length, n3);
    setView('board');
    state.readOnly = true; render();
    dragTile('button', cx, cy);
    ok('a workflow open to read only takes no drop', state.doc.elements.length === n3 && !document.querySelector('.lib-ghost'));
    state.readOnly = false; render();
});
