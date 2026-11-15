// Pinning: what an element holds on to when its screen changes size.
suite(async (ok, eq) => {
    const e = (pinH, pinV) => ({ x: 40, y: 100, w: 200, h: 50, pinH, pinV });
    eq('left and top: it stays', pinnedBox(e('left', 'top'), 400, 800, 1000, 600), { x: 40, y: 100, w: 200, h: 50 });
    eq('right and bottom: it keeps its distance from them', pinnedBox(e('right', 'bottom'), 400, 800, 1000, 600), { x: 640, y: -100, w: 200, h: 50 });
    eq('both: it stretches', pinnedBox(e('both', 'both'), 400, 800, 1000, 900), { x: 40, y: 100, w: 800, h: 150 });
    eq('both never shrinks to nothing', pinnedBox(e('both', 'top'), 400, 800, 100, 800).w, GRID);
    eq('centre: it stays as far from the middle', pinnedBox(e('center', 'center'), 400, 800, 1000, 600), { x: 340, y: 0, w: 200, h: 50 });
    eq('scale: it keeps its share', pinnedBox(e('scale', 'scale'), 400, 800, 800, 400), { x: 80, y: 50, w: 400, h: 25 });

    // ---- changing a size from the rail ----
    const id = addScreen('phone', 'detail');
    const size = sizesOf(state.doc, id)[0], by = (type) => state.doc.elements.find((x) => x.size === size.id && x.type === type);
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));
    selectId(id);
    const field = document.querySelector(`#railProps [data-id="${size.id}"][data-f="w"]`);
    field.value = '5'; field.dispatchEvent(new Event('input', { bubbles: true }));
    eq('a width being typed changes nothing yet', [recOf(state.doc, size.id).w, sent.length], [390, 0]);
    field.value = '590'; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    eq('leaving the field sets it', recOf(state.doc, size.id).w, 590);
    eq('what is pinned to both edges stretched', [by('topbar').w, by('button').w, by('button').x], [590, 542, 24]);
    eq('in one change', sent.length, 1);
    undo();
    eq('and one undo', [recOf(state.doc, size.id).w, by('topbar').w, by('button').w], [390, 390, 342]);
    resizeSize(size.id, 'h', 1000);
    eq('what is pinned to the bottom followed it', by('button').y + by('button').h, 1000 - 24);
    resizeSize(size.id, 'contentH', 1400);
    eq('and follows the content when it scrolls', by('button').y + by('button').h, 1400 - 24);
    eq('setting the same value again is no change', resizeSize(size.id, 'h', 1000), false);

    // ---- another size starts as a copy, placed by the pins ----
    const before = state.doc.elements.length;
    showSize(size.id);
    const wide = addSize(id, 'laptop');
    const copies = elementsOf(state.doc, wide);
    eq('a new size copies the elements of the one on show', [copies.length, state.doc.elements.length], [5, before + 5]);
    eq('they keep their names', copies.map((c) => c.name).sort(), elementsOf(state.doc, size.id).map((c) => c.name).sort());
    const top = copies.find((c) => c.type === 'topbar'), btn = copies.find((c) => c.type === 'button');
    eq('the top bar spans the new width', [top.x, top.w], [0, 1366]);
    eq('the button is still above the bottom edge', btn.y + btn.h, 768 - 24);
    ok('and the new size is the one on show', shownSize(recOf(state.doc, id)).id === wide);
    eq('nothing reaches outside the new size', findFindings(state.doc).filter((f) => f.key.startsWith('outside')).length, 0);
    undo();
    eq('one undo removes the size and its copies', [sizesOf(state.doc, id).length, state.doc.elements.length], [1, before]);

    // ---- the rail ----
    selectId(by('button').id);
    const pin = document.querySelector('#railProps [data-f="pinH"]');
    eq('an element shows what it is pinned to', pin.value, 'both');
    pin.value = 'right'; pin.dispatchEvent(new Event('change', { bubbles: true }));
    eq('and it can be changed', by('button').pinH, 'right');
});
