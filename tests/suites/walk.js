// Walk: how do I get from A to B? Every way between two stops.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = state.doc.decisions[0];
    const names = (p) => p.stops.map((id) => stopName(recOf(state.doc, id)));

    eq('one way from the start to the end', findPaths(state.doc, signIn.id, receipt.id).map(names), [['Sign in', 'Is the password right?', 'Cart', 'Receipt']]);
    eq('none against the arrows', findPaths(state.doc, receipt.id, signIn.id), []);
    eq('none from a stop to itself, or to nothing', [findPaths(state.doc, cart.id, cart.id), findPaths(state.doc, cart.id, ''), findPaths(state.doc, 'scr_gone', cart.id)], [[], [], []]);
    const skip = addLink(signIn.id, cart.id); setF(skip, 'label', 'Uses a saved sign-in');
    const back = addLink(cart.id, signIn.id); setF(back, 'label', 'Signs out');
    const paths = findPaths(state.doc, signIn.id, receipt.id);
    eq('two ways now, the shortest first', paths.map(names), [['Sign in', 'Cart', 'Receipt'], ['Sign in', 'Is the password right?', 'Cart', 'Receipt']]);
    ok('a loop does not go round for ever', findPaths(state.doc, signIn.id, receipt.id, 50).length === 2);
    eq('a way is told in steps', pathSteps(paths[0]).map((s) => s.stop || '> ' + s.via), ['Sign in', '> Uses a saved sign-in', 'Cart', '> Taps Pay', 'Receipt']);

    // ---- in the rail ----
    render();
    const from = () => document.getElementById('walkFrom'), to = () => document.getElementById('walkTo');
    eq('Walk starts from the start screen', from().value, signIn.id);
    ok('and asks where to', /Choose where to start/.test(document.getElementById('railWalk').textContent));
    const before = JSON.stringify(serializeDoc(state.doc));
    to().value = receipt.id; to().dispatchEvent(new Event('change', { bubbles: true }));
    const rows = () => Array.from(document.querySelectorAll('#railWalk .walk-path'));
    eq('the ways are listed', [rows().length, /2 ways/.test(document.getElementById('railWalk').textContent)], [2, true]);
    ok('nothing is marked yet', !board.querySelector('.link.marked') && !/opacity="0.25"/.test(board.innerHTML));
    rows()[0].click();
    eq('choosing one marks its links on the board', Array.from(board.querySelectorAll('.link.marked')).map((g) => g.dataset.id).sort(), paths[0].links.slice().sort());
    eq('and everything off it is drawn faint', [board.querySelector(`.decision[data-id="${ask.id}"]`).getAttribute('opacity'), board.querySelector(`.screen[data-id="${cart.id}"]`).getAttribute('opacity')], ['0.25', null]);
    ok('the chosen way is shown as chosen', rows()[0].getAttribute('aria-pressed') === 'true' && rows()[1].getAttribute('aria-pressed') === 'false');
    setView('flow');
    ok('the flow view marks it too', board.querySelectorAll('.link.marked').length === 2 && board.querySelector(`.decision[data-id="${ask.id}"]`).getAttribute('opacity') === '0.25');
    setView('board');
    ok('walking is a way of looking, not a change', JSON.stringify(serializeDoc(state.doc)) === before);

    // ---- it follows the workflow ----
    removeId(skip);
    eq('removing a link on the marked way leaves the ways that remain', [rows().length, state.walk.pick], [1, 0]);
    undo();
    document.querySelector('#railWalk [data-act="walk-pick"][data-i="-1"]').click();
    ok('the mark can be cleared', state.walk.pick === -1 && !board.querySelector('.link.marked'));
    from().value = receipt.id; from().dispatchEvent(new Event('change', { bubbles: true }));
    to().value = signIn.id; to().dispatchEvent(new Event('change', { bubbles: true }));
    ok('no way is said in words', /There is no way from "Receipt" to "Sign in"/.test(document.getElementById('railWalk').textContent));
    to().value = receipt.id; to().dispatchEvent(new Event('change', { bubbles: true }));
    ok('the same stop twice is asked about', /two different stops/.test(document.getElementById('railWalk').textContent));
    removeId(receipt.id);
    ok('a stop that is removed is forgotten', state.walk.to === '' && to().value === '');

    // ---- many ways ----
    openDoc(newDoc(''), false);
    const ids = []; for (let i = 0; i < 9; i++) ids.push(addScreen('watch'));
    batch(() => { for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if (i !== j) change({ op: 'add', kind: 'links', rec: { id: nextId('links'), from: ids[i], to: ids[j], label: 'x' } }); });
    const t0 = performance.now(), many = findPaths(state.doc, ids[0], ids[8]);
    eq('in a workflow where everything leads everywhere, only the first dozen are listed', [many.length, many[0].stops.length], [12, 2]);
    ok('and quickly', performance.now() - t0 < 300);
});
