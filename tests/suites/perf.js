// The budget: a workflow of 60 screens and 3,000 elements stays usable.
// The limits are several times what a desk machine needs, so a slow test
// machine passes and a change that makes drawing quadratic does not.
suite(async (ok, eq) => {
    const SCREENS = 60, PER = 50, types = ELEMENT_TYPES.filter((t) => t !== 'block');
    const ops = [];
    withFixedIds(() => {
        let prev = '';
        for (let s = 0; s < SCREENS; s++) {
            const scr = nextId('screens'), siz = nextId('sizes');
            ops.push({ op: 'add', kind: 'screens', rec: { id: scr, name: 'Screen ' + s, x: (s % 10) * 600, y: Math.floor(s / 10) * 1100, start: s === 0, end: s === SCREENS - 1 } });
            ops.push({ op: 'add', kind: 'sizes', rec: { id: siz, screen: scr, name: 'Laptop', w: 520, h: 844, input: 'pointer' } });
            for (let e = 0; e < PER; e++) ops.push({ op: 'add', kind: 'elements', rec: { id: nextId('elements'), size: siz, type: types[e % types.length], x: 16 + (e % 3) * 160, y: 16 + Math.floor(e / 3) * 48, w: 152, h: 40, text: 'Item ' + e, name: 'Item ' + e, z: e } });
            if (prev) ops.push({ op: 'add', kind: 'links', rec: { id: nextId('links'), from: prev, to: scr, label: 'Next' } });
            prev = scr;
        }
    }, 7);
    const time = (fn) => { const t0 = performance.now(); fn(); return performance.now() - t0; };
    const best = (fn, n = 3) => Math.min(...Array.from({ length: n }, () => time(fn)));

    const tBuild = time(() => batch(() => ops.forEach(change)));
    eq('the workflow is this big', [state.doc.screens.length, state.doc.elements.length, state.doc.links.length], [SCREENS, SCREENS * PER, SCREENS - 1]);
    ok('building it is one step', undo() && state.doc.elements.length === 0 && redo() && state.doc.elements.length === SCREENS * PER);
    ok(`building it: ${Math.round(tBuild)} ms, budget 3000`, tBuild < 3000);

    const tDraw = best(drawBoard);
    ok(`drawing the whole board: ${Math.round(tDraw)} ms, budget 400`, tDraw < 400);
    eq('every element is on the board', document.querySelectorAll('#board .el').length, SCREENS * PER);

    const tFind = best(() => findFindings(state.doc));
    ok(`every check: ${Math.round(tFind)} ms, budget 150`, tFind < 150);
    eq('and it finds nothing wrong', findFindings(state.doc).length, 0);

    const tSave = best(() => JSON.stringify(fileEnvelope(state.doc)));
    ok(`writing the file: ${Math.round(tSave)} ms, budget 200`, tSave < 200);
    const text = JSON.stringify(fileEnvelope(state.doc));
    const tOpen = best(() => openFileText(text));
    ok(`reading the file: ${Math.round(tOpen)} ms, budget 300`, tOpen < 300);
    ok(`the file is ${Math.round(text.length / 1024)} KB, budget 1024`, text.length < 1024 * 1024);

    const one = state.doc.elements[1500];
    const tEdit = best(() => setF(one.id, 'x', one.x + 8));
    ok(`one edit, saved and drawn: ${Math.round(tEdit)} ms, budget 600`, tEdit < 600);
    selectId(state.doc.screens[30].id);
    const tSel = best(() => { setSelection([]); selectAll(); });
    ok(`selecting every stop: ${Math.round(tSel)} ms, budget 600`, tSel < 600);
    // The numbers, for whoever reads a passing run too.
    console.log('perf', JSON.stringify({ tBuild, tDraw, tFind, tSave, tOpen, tEdit, tSel }));
});
