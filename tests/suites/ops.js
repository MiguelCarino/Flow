// Operations: the only way a document changes, and each returns its undo.
suite(async (ok, eq) => {
    const doc = newDoc('');
    const text = () => JSON.stringify(serializeDoc(doc));
    const empty = text();

    const backAdd = applyOp(doc, { op: 'add', kind: 'screens', rec: { id: 'scr_a1', name: 'A' } });
    eq('adding returns the removal', backAdd, { op: 'del', kind: 'screens', id: 'scr_a1' });
    eq('adding the same id again does nothing', applyOp(doc, { op: 'add', kind: 'screens', rec: { id: 'scr_a1', name: 'again' } }), null);
    eq('an id of another list is refused', applyOp(doc, { op: 'add', kind: 'screens', rec: { id: 'el_a1' } }), null);

    const backSet = applyOp(doc, { op: 'set', kind: 'screens', id: 'scr_a1', field: 'name', value: 'B' });
    eq('setting returns the old value', backSet, { op: 'set', kind: 'screens', id: 'scr_a1', field: 'name', value: 'A' });
    eq('setting the value it already has does nothing', applyOp(doc, { op: 'set', kind: 'screens', id: 'scr_a1', field: 'name', value: 'B' }), null);
    eq('a field the list does not have is refused', applyOp(doc, { op: 'set', kind: 'screens', id: 'scr_a1', field: 'w', value: 9 }), null);
    eq('a record that is gone is no error', applyOp(doc, { op: 'set', kind: 'screens', id: 'scr_zz', field: 'name', value: 'x' }), null);
    applyOp(doc, { op: 'set', kind: 'screens', id: 'scr_a1', field: 'x', value: 'not a number' });
    eq('a value is made valid on the way in', recOf(doc, 'scr_a1').x, 0);

    eq('the document name is a field too', applyOp(doc, { op: 'set', kind: 'doc', id: '', field: 'name', value: 'N' }), { op: 'set', kind: 'doc', id: '', field: 'name', value: '' });
    applyOp(doc, { op: 'set', kind: 'doc', id: '', field: 'name', value: '' });

    const backDel = applyOp(doc, { op: 'del', kind: 'screens', id: 'scr_a1' });
    eq('removing returns the whole record', [backDel.op, backDel.rec.id, backDel.rec.name], ['add', 'scr_a1', 'B']);
    eq('removing what is gone does nothing', applyOp(doc, { op: 'del', kind: 'screens', id: 'scr_a1' }), null);
    eq('everything taken back leaves an empty document', text(), empty);

    // ---- removing takes the dependents first ----
    exampleOps().forEach((op) => applyOp(doc, op));
    const before = text();
    const signIn = doc.screens.find((s) => s.name === 'Sign in');
    const ops = removalOps(doc, signIn.id);
    eq('the owner goes last', ops[ops.length - 1], { op: 'del', kind: 'screens', id: signIn.id });
    const inv = ops.map((op) => applyOp(doc, op));
    ok('every removal applied', inv.every(Boolean));
    eq('a removed screen takes its sizes, elements and links', [doc.sizes.length, doc.links.length, doc.screens.length], [2, 2, 2]);
    eq('nothing is left pointing at what is gone', JSON.stringify(serializeDoc(normalizeDoc(serializeDoc(doc)))), text());
    inv.reverse().forEach((op) => applyOp(doc, op));
    eq('taken back in reverse, the document is as it was', text(), before);

    const pay = doc.elements.find((e) => e.name === 'Pay');
    removalOps(doc, pay.id).forEach((op) => applyOp(doc, op));
    eq('a link outlives the element it started at', doc.links.filter((l) => l.fromEl === pay.id).length + doc.links.length, 4);
    const receipt = doc.screens.find((s) => s.name === 'Receipt');
    eq('a screen keeps its last size', removalOps(doc, sizesOf(doc, receipt.id)[0].id), []);
    const src = doc.sources[0];
    removalOps(doc, src.id).forEach((op) => applyOp(doc, op));
    eq('a removed source is cleared from what pointed at it', doc.screens.filter((s) => s.source).length, 0);
});
