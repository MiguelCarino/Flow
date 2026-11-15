// Play: the workflow clicked through from the start.
suite(async (ok, eq) => {
    const pane = document.getElementById('playPane');
    const q = (sel) => pane.querySelector(sel), all = (sel) => Array.from(pane.querySelectorAll(sel));
    eq('with no screen there is nothing to play', [playStart(), state.play, pane.hidden], [false, null, true]);
    loadExample();
    const by = (name) => state.doc.screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = state.doc.decisions[0];
    const before = JSON.stringify(serializeDoc(state.doc));
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));
    const at = () => stopName(recOf(state.doc, state.play.at));
    const ways = () => all('.pl-way').map((b) => b.textContent);

    document.getElementById('playBtn').click();
    eq('Play opens on the start screen', [pane.hidden, at()], [false, 'Sign in']);
    ok('the screen is drawn with its elements', !!q('.pl-screen') && /Welcome back/.test(q('.pl-screen').innerHTML));
    eq('what leads on is listed, in words', ways(), ['Taps Sign in→ Is the password right?']);
    const hot = all('.pl-hot');
    eq('the button that leads somewhere is marked and can be pressed', [hot.length, hot[0].dataset.act, hot[0].getAttribute('role')], [1, 'play-go', 'button']);
    ok('Back has nowhere to go yet', q('[data-act="play-back"]').disabled);

    hot[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    eq('pressing it goes to the decision', [at(), !!q('.pl-question'), q('.pl-question').textContent], ['Is the password right?', true, 'Is the password right?']);
    eq('whose answers are the ways on', ways(), ['Yes→ Cart', 'Shows the error · No→ Sign in']);
    all('.pl-way')[1].click();
    eq('No goes back to Sign in', at(), 'Sign in');
    all('.pl-way')[0].click(); all('.pl-way')[0].click();
    eq('Yes goes to the cart', at(), 'Cart');
    eq('where it has been is kept', q('.pl-crumbs').textContent.replace(/\s+/g, ' ').trim(), 'Sign in › Is the password right? › Sign in › Is the password right? › Cart');
    q('[data-act="play-back"]').click();
    eq('Back goes one step back', at(), 'Is the password right?');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    eq('and so does Backspace', at(), 'Sign in');
    q('[data-act="play-restart"]').click();
    eq('Start again forgets the way', [at(), state.play.history.length], ['Sign in', 0]);

    playGo(state.doc.links.find((l) => l.from === signIn.id).id); playGo(state.doc.links.find((l) => l.cond === 'Yes').id);
    q('.pl-hot').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    eq('at an end, it says so', [at(), ways(), /The workflow ends here/.test(q('.pl-side').textContent)], ['Receipt', [], true]);
    eq('a link that does not leave this stop is refused', [playGo(state.doc.links[0].id), at()], [false, 'Receipt']);
    ok('playing changed nothing in the document', JSON.stringify(serializeDoc(state.doc)) === before && sent.length === 0 && !canUndo() === false);

    // ---- keys belong to Play ----
    setSelection([selEntry('screens', cart.id)]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    ok('Delete does not reach the board behind', !!recOf(state.doc, cart.id));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    eq('Escape leaves Play', [state.play, pane.hidden, pane.innerHTML], [null, true, '']);

    // ---- where it starts, and several ways from one element ----
    selectId(cart.id);
    playStart();
    eq('with a stop selected, Play starts there', at(), 'Cart');
    playExit();
    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    const declined = addLink(cart.id, signIn.id, pay.id); setF(declined, 'cond', 'the card is declined');
    const plain = addLink(cart.id, signIn.id); setF(plain, 'kind', 'back');
    playStart(cart.id);
    eq('an element that leads two ways is marked but not pressed', [all('.pl-hot').length, all('.pl-hot')[0].dataset.act], [1, undefined]);
    eq('the list says which, and names a way that has no words by its element', ways(), ['Taps Pay→ Receipt', 'if the card is declined→ Sign in', 'Go on→ Sign in']);
    showSize(sizesOf(state.doc, signIn.id)[1].id);
    playStart(signIn.id);
    eq('Play shows the size that is on show', q('.pl-screen').getAttribute('viewBox'), '-6 -6 1378 780');
    ok('a way that starts at an element of another size is still offered', ways().length === 1 && all('.pl-hot').length === 0);

    // ---- the workflow changing under it ----
    playStart(cart.id);
    removeId(cart.id);
    eq('if the stop it is on is removed, Play closes', [state.play, pane.hidden], [null, true]);
    undo();
    playStart(cart.id); loadExample();
    eq('opening another workflow closes it too', state.play, null);
});
