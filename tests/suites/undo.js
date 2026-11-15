// Undo steps are operations, not copies of the document: one step per action,
// one per batch, one per field typed in.
suite(async (ok, eq) => {
    const text = () => JSON.stringify(serializeDoc(state.doc));
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));
    const empty = text();

    ok('nothing to undo at the start', !canUndo() && !canRedo());
    const id = addScreen('phone');
    eq('a screen comes with a size', [state.doc.screens.length, state.doc.sizes.length], [1, 1]);
    ok('the first screen is the start', recOf(state.doc, id).start);
    eq('adding a screen and its size is one change sent', sent.length, 1);
    eq('...of two operations', sent[0].map((o) => o.op + ' ' + o.kind), ['add screens', 'add sizes']);
    const one = text();
    ok('undo takes both back', undo() && text() === empty);
    eq('the undo is sent as operations too', sent[1].map((o) => o.op + ' ' + o.kind), ['del sizes', 'del screens']);
    ok('redo brings both again', redo() && text() === one);
    ok('the browser keeps a copy', JSON.parse(localStorage.getItem('flow_live')).doc.screens.length === 1);

    // ---- typing ----
    'Home'.split('').reduce((acc, ch) => { typed('screens', id, 'name', acc + ch); return acc + ch; }, '');
    eq('the field holds what was typed', recOf(state.doc, id).name, 'Home');
    undo();
    eq('typing in a field is one step, back to what it was', recOf(state.doc, id).name, 'Screen 1');
    redo();
    eq('and one step forward', recOf(state.doc, id).name, 'Home');
    typed('screens', id, 'name', 'Home!'); commitTyping(); typed('screens', id, 'name', 'Home!!');
    undo();
    eq('leaving the field ends the step', recOf(state.doc, id).name, 'Home!');
    undo(); undo();
    eq('each step goes back in turn', recOf(state.doc, id).name, 'Screen 1');
    typed('screens', id, 'name', 'Screen 1');
    setF(id, 'note', 'n');
    undo();
    eq('typing that changed nothing does not join the next step', recOf(state.doc, id).note, '');

    // ---- batches ----
    const n = sent.length;
    batch(() => { setF(id, 'x', 80); batch(() => setF(id, 'y', 160)); setF(id, 'name', 'Moved'); });
    eq('a batch, even nested, is one change', sent.length, n + 1);
    undo();
    eq('and one undo', [recOf(state.doc, id).x, recOf(state.doc, id).y, recOf(state.doc, id).name], [0, 0, 'Screen 1']);
    ok('a new change empties redo', canRedo() && setF(id, 'name', 'Other') && !canRedo());

    // ---- one start ----
    const second = addScreen('laptop');
    setStart(second, true);
    eq('marking a start unmarks the other', state.doc.screens.filter((s) => s.start).map((s) => s.id), [second]);
    undo();
    eq('as one step', state.doc.screens.filter((s) => s.start).map((s) => s.id), [id]);

    // ---- removing and replacing ----
    loadExample();
    const example = text();
    const cart = state.doc.screens.find((s) => s.name === 'Cart');
    selectId(cart.id);
    removeId(cart.id);
    ok('a removed record is no longer selected', state.selection.size === 0);
    undo();
    eq('undoing a removal restores every dependent', text(), example);
    // Something in every list, so New has every list to empty.
    const fullOps = [['styles', { id: 'sty_t1' }], ['langs', { id: 'lng_t1', code: 'es' }], ['words', { id: 'wrd_t1', lang: 'lng_t1', key: 'k', text: 't' }], ['blocks', { id: 'blk_t1' }], ['accepts', { id: 'acc_t1', finding: 'no-start:', reason: 'r' }], ['pins', { id: 'pin_t1', finding: 'no-start:' }], ['bases', { id: 'bas_t1' }], ['runs', { id: 'run_t1', base: 'bas_t1' }], ['steps', { id: 'stp_t1', run: 'run_t1' }]];
    batch(() => { fullOps.forEach(([kind, rec]) => change({ op: 'add', kind, rec })); change({ op: 'set', kind: 'doc', id: '', field: 'lang', value: 'fr' }); });
    ok('every list has a record in it', KINDS.every((k) => state.doc[k].length > 0), KINDS.filter((k) => !state.doc[k].length).join(' '));
    const full = text();
    openDoc(newDoc(''), false);
    eq('New empties the document, every list and its language', text(), empty);
    undo();
    eq('and Undo brings all of it back', text(), full);
    undo();
    openDoc(newDoc(''), false);
    undo();
    eq('and Undo brings the workflow back', text(), example);

    // ---- the limit ----
    for (let i = 0; i < UNDO_LIMIT + 20; i++) setF(cart.id, 'x', 2000 + i * 8);
    let steps = 0;
    while (undo()) steps++;
    eq('only the last steps are kept', steps, UNDO_LIMIT);
});
