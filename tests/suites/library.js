// @realtime
// Your workflows: kept in this browser, saving themselves.
suite(async (ok, eq) => {
    for (const c of await libList()) await libDelete(c.id);
    eq('nothing is kept to begin with', [(await libList()).length, state.cardId], [0, '']);
    loadExample();
    setF(state.doc.screens[0].id, 'note', 'a change before it is kept');
    await new Promise((r) => setTimeout(r, 500));
    eq('a workflow is not kept until its owner says so', (await libList()).length, 0);

    const id = await keepWorkflow();
    const cards = await libList();
    eq('Keep makes a card of it', [cards.length, cards[0].id, cards[0].name, cards[0].doc.kind, cards[0].doc.doc.screens.length], [1, id, 'Shop checkout', 'flowdoc', 3]);
    eq('and remembers which card is open', [state.cardId, localStorage.getItem('flow_live_card'), document.getElementById('keptTag').hidden], [id, id, false]);
    eq('keeping it again does nothing', [await keepWorkflow(), (await libList()).length], [id, 1]);

    // ---- it saves itself ----
    const cart = state.doc.screens.find((s) => s.name === 'Cart');
    setF(cart.id, 'name', 'Basket'); change({ op: 'set', kind: 'doc', id: '', field: 'name', value: 'Shop, second draft' });
    await flushCard();
    const after = await libGet(id);
    eq('a change is written to the card', [after.name, after.doc.doc.screens.some((s) => s.name === 'Basket')], ['Shop, second draft', true]);
    ok('with when it was made kept and when it changed moved on', after.created === cards[0].created && after.updated >= cards[0].updated);
    undo();
    await flushCard();
    eq('an undo is a change too', (await libGet(id)).name, 'Shop checkout');

    // ---- another workflow ----
    openDoc(newDoc('Second'), false);
    eq('New while a kept workflow is open starts one that is not kept', [state.cardId, state.doc.name, canUndo()], ['', 'Second', false]);
    eq('and the kept one is as it was left', (await libGet(id)).doc.doc.screens.length, 3);
    addScreen('watch');
    eq('opening a kept workflow keeps the unkept one first, so nothing is lost', [await openCard(id), (await libList()).length, state.cardId, state.doc.name], [true, 2, id, 'Shop checkout']);
    const second = (await libList()).find((c) => c.id !== id);
    eq('the one that was open is there', [second.name, second.doc.doc.screens.length], ['Second', 1]);
    eq('an empty workflow is not kept just for being open', await (async () => { await openCard(second.id); openDoc(newDoc(''), false); await openCard(id); return (await libList()).length; })(), 2);
    eq('a card that is not there opens nothing', await openCard('card_nothing'), false);

    // ---- on the start page ----
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    document.querySelector('[data-act="home"]').click();
    await wait(300);
    const rows = () => Array.from(document.querySelectorAll('#landingCards .landing-card'));
    ok('the start page lists them, the open one marked', state.landing && rows().length === 2 && rows().filter((r) => r.classList.contains('on')).length === 1 && !document.querySelector('#landingCards .draft'));
    ok('a kept workflow that is open is not offered to be kept again', document.getElementById('keepMenu').hidden);
    const del = () => document.querySelector(`#landingCards [data-card="${second.id}"] [data-act="lib-del"]`);
    del().click(); await wait(200);
    eq('Delete asks once more before it does', [(await libList()).length, del().textContent], [2, 'Delete for good']);
    del().click(); await wait(300);
    eq('then deletes that card only', [(await libList()).map((c) => c.id), rows().length], [[id], 1]);

    // ---- the binder: every kept workflow in one file ----
    const saves = [], realSave = window.saveBlob;
    window.saveBlob = (blob, name) => { saves.push({ blob, name }); };
    try {
        const env = await binderEnvelope();
        eq('a binder carries every kept workflow, each as its own file would be', [env.kind, env.version, env.workflows.length, env.workflows[0].kind, env.workflows[0].doc.name], ['flowbinder', 1, 1, 'flowdoc', 'Shop checkout']);
        document.getElementById('binderExport').click(); await wait(300);
        ok('Back up all saves it as one file', saves.length === 1 && /^Flow binder \d{4}-\d\d-\d\d\.flowbinder\.json$/.test(saves[0].name) && JSON.parse(await saves[0].blob.text()).workflows.length === 1);
        document.querySelector(`#landingCards [data-card="${id}"] [data-act="lib-save"]`).click(); await wait(300);
        ok('a card saves its own workflow as a file', saves.length === 2 && saves[1].name === 'Shop checkout.flow.json' && JSON.parse(await saves[1].blob.text()).kind === 'flowdoc');
    } finally { window.saveBlob = realSave; }
    const other = newDoc('From elsewhere'); other.screens.push(readRec('screens', { id: 'scr_else', name: 'Elsewhere' }));
    const binder = JSON.stringify({ kind: 'flowbinder', version: 1, made: 'x', workflows: [(await libGet(id)).doc, fileEnvelope(normalizeDoc(serializeDoc(other))), { nonsense: true }] });
    eq('opening a binder adds what is not here yet', [await openAnyFile(binder), (await libList()).map((c) => c.name).sort(), state.landing], ['binder', ['From elsewhere', 'Shop checkout'], true]);
    eq('opening it again adds nothing', [await openAnyFile(binder), (await libList()).length], ['binder', 2]);
    await wait(300);
    eq('the workflow that was open is still the one open', [state.cardId, state.doc.name], [id, 'Shop checkout']);
    eq('a workflow file still opens in the editor', [await openAnyFile(JSON.stringify(fileEnvelope(other))), state.landing, state.doc.name], ['doc', false, 'From elsewhere']);
    await openCard(id);
    for (const c of await libList()) if (c.id !== id) await libDelete(c.id);
    await libDelete(id);
    eq('deleting the card that is open leaves the workflow open, not kept', [state.cardId, state.doc.name, localStorage.getItem('flow_live_card')], ['', 'Shop checkout', null]);
    goHome(); await wait(300);
    ok('and it is back on the start page as the one not kept, with Keep beside it', !!document.querySelector('#landingCards .draft [data-act="lib-keep"]') && document.getElementById('binderExport').hidden);
    showLanding(false);

    // ---- read-only, and no IndexedDB ----
    state.readOnly = true;
    eq('a workflow open to read only is not kept', await keepWorkflow(), '');
    state.readOnly = false;
    _libDb = null;
    const fid = await keepWorkflow();
    eq('without IndexedDB the cards go to localStorage', [JSON.parse(localStorage.getItem('flow_library')).length, (await libList())[0].id], [1, fid]);
    await libDelete(fid);
    eq('and are deleted from there', JSON.parse(localStorage.getItem('flow_library')).length, 0);
    localStorage.removeItem('flow_library');
    _libDbTried = false;
    ok('nothing of this was sent anywhere', performance.getEntriesByType('resource').every((e) => e.name.startsWith(location.origin + '/')));
});
