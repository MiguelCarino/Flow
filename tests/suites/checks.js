// The checks: each finding appears for its cause and goes when it is fixed.
suite(async (ok, eq) => {
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]).sort();
    const has = (check) => keys().includes(check);

    eq('an empty document has nothing to report', keys(), []);
    loadExample();
    eq('the example has nothing to report', findFindings(state.doc).map((f) => f.text), []);

    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = state.doc.decisions[0];

    setF(signIn.id, 'start', false);
    ok('no start screen', has('no-start'));
    eq('with no start, nothing is called unreachable', has('unreached'), false);
    batch(() => { setF(signIn.id, 'start', true); setF(cart.id, 'start', true); });
    eq('two starts are named, one finding each', keys().filter((k) => k === 'two-starts').length, 2);
    undo(); undo();

    const island = addScreen('phone');
    eq('a new screen nothing leads to, and that leads nowhere', keys(), ['dead-end', 'unreached']);
    setF(island, 'end', true);
    eq('marked as an end, it is only unreachable', keys(), ['unreached']);
    addLink(receipt.id, island);
    eq('an end that leads on, and a way with no words', keys(), ['end-leads-on', 'link-unnamed']);
    undo(); undo(); undo();
    eq('back to nothing', keys(), []);

    const yes = state.doc.links.find((l) => l.from === ask.id && l.cond === 'Yes');
    const no = state.doc.links.find((l) => l.from === ask.id && l.cond === 'No');
    setF(yes.id, 'cond', '');
    ok('a branch with no answer', has('branch-unnamed'));
    setF(yes.id, 'cond', 'no ');
    ok('two branches with the same answer, whatever the case', has('branch-twice'));
    undo(); undo();
    removeId(no.id);
    ok('a decision with one branch', has('decision-branches'));
    undo();
    setF(ask.id, 'name', '  ');
    ok('a decision with no question', has('decision-unnamed'));
    undo();

    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    setF(pay.id, 'x', 300);
    const outside = findFindings(state.doc).find((f) => f.key.startsWith('outside'));
    ok('an element past the edge of its screen', !!outside && outside.id === pay.id);
    eq('its badge is on its screen', findingStop(state.doc, outside), cart.id);
    undo();
    const size = recOf(state.doc, pay.size);
    setF(pay.id, 'y', 900);
    ok('below the frame is outside', has('outside'));
    setF(size.id, 'contentH', 1200);
    ok('unless the content scrolls that far', !has('outside'));
    undo(); undo();

    setF(cart.id, 'at', 'src/Cart');
    ok('a place with no source chosen', has('at-no-source'));
    undo();
    setF(cart.id, 'status', 'built');
    ok('built with no code source', has('built-no-code'));
    setF(cart.id, 'source', state.doc.sources[0].id);
    ok('a code source settles it', !has('built-no-code'));
    setF(state.doc.sources[0].id, 'kind', 'vector');
    ok('a vector file is not code', has('built-no-code'));
    undo(); undo(); undo();
    eq('and back to nothing again', keys(), []);
});
