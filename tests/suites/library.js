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

    // ---- a card's tools: rename, duplicate, merge ----
    const cardOfId = (cid) => document.querySelector(`#landingCards [data-card="${cid}"]`);
    eq('a card has its tools: rename, duplicate, save, delete (merge needs a second workflow)', Array.from(cardOfId(id).querySelectorAll('.landing-tool')).map((b) => b.dataset.act), ['lib-rename', 'lib-duplicate', 'lib-save', 'lib-del']);
    // duplicate
    cardOfId(id).querySelector('[data-act="lib-duplicate"]').click(); await wait(400);
    let all = await libList();
    const twin = all.find((c) => c.id !== id);
    eq('Duplicate makes a second card under the next free name, with the same workflow', [all.length, twin.name, twin.doc.doc.name, twin.doc.doc.screens.length, JSON.stringify(twin.doc.doc.screens.map((x) => x.id)) === JSON.stringify(serializeDoc(state.doc).screens.map((x) => x.id))], [2, 'Shop checkout 2', 'Shop checkout 2', 3, true]);
    ok('the open workflow is still the original', state.cardId === id && state.doc.name === 'Shop checkout' && rows().length === 2);
    eq('with two kept, a card offers Merge too', Array.from(cardOfId(twin.id).querySelectorAll('.landing-tool')).map((b) => b.dataset.act), ['lib-rename', 'lib-duplicate', 'lib-merge', 'lib-save', 'lib-del']);
    // rename a card that is not open
    cardOfId(twin.id).querySelector('[data-act="lib-rename"]').click(); await wait(200);
    let field = document.querySelector('#landingCards .landing-card-rename');
    ok('Rename turns the card\'s name into a field, with the name in it', !!field && field.value === 'Shop checkout 2' && document.activeElement === field);
    field.value = 'Shop, the copy';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(400);
    eq('Enter keeps the new name, on the card and in the workflow', [(await libGet(twin.id)).name, (await libGet(twin.id)).doc.doc.name, /Shop, the copy/.test(cardOfId(twin.id).textContent), !!document.querySelector('.landing-card-rename')], ['Shop, the copy', 'Shop, the copy', true, false]);
    cardOfId(twin.id).querySelector('[data-act="lib-rename"]').click(); await wait(200);
    field = document.querySelector('#landingCards .landing-card-rename');
    field.value = 'Thrown away';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); await wait(300);
    eq('Esc leaves the name as it was', (await libGet(twin.id)).name, 'Shop, the copy');
    cardOfId(twin.id).querySelector('[data-act="lib-rename"]').click(); await wait(200);
    field = document.querySelector('#landingCards .landing-card-rename');
    field.value = '   ';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await wait(300);
    eq('a blank name changes nothing', (await libGet(twin.id)).name, 'Shop, the copy');
    // rename the one that is open: an ordinary change
    const undoWas = canUndo();
    eq('renaming the open workflow renames it in the editor too', [await renameCard(id, 'Shop, live'), state.doc.name, (await libGet(id)).name], [true, 'Shop, live', 'Shop, live']);
    undo(); await flushCard();
    eq('and Undo takes that back', [state.doc.name, (await libGet(id)).name], ['Shop checkout', 'Shop checkout']);

    // merge: a copy worked on, back into the original
    const copyDoc = openFileText(JSON.stringify((await libGet(twin.id)).doc)).doc;
    const changed = copyDoc.screens.find((x) => !x.start), wasCalled = changed.name;
    changed.name = 'Renamed in the copy';
    copyDoc.screens.push(readRec('screens', { id: 'scr_extra', name: 'Help', x: 0, y: 0 }));
    await libPut(Object.assign({}, await libGet(twin.id), { doc: fileEnvelope(normalizeDoc(serializeDoc(copyDoc))) }));
    render(); await wait(300);
    cardOfId(twin.id).querySelector('[data-act="lib-merge"]').click(); await wait(300);
    const mdlg = document.getElementById('mergeDlg');
    ok('Merge asks which workflow to merge into, offering the others', mdlg.open && /Merge "Shop, the copy" into which workflow\?/.test(document.getElementById('mergeAsk').textContent) && Array.from(document.querySelectorAll('#mergeList [data-act="merge-into"]')).map((b) => b.dataset.id).join() === id);
    const lowest = Math.max(...state.doc.screens.map((x) => x.y));
    document.querySelector(`#mergeList [data-id="${id}"]`).click(); await wait(600);
    ok('merged into the open workflow: what both have takes the copy\'s values', !mdlg.open && recOf(state.doc, changed.id).name === 'Renamed in the copy');
    ok('what only the copy had is added, below what was drawn', !!recOf(state.doc, 'scr_extra') && recOf(state.doc, 'scr_extra').y > lowest, String(recOf(state.doc, 'scr_extra') && recOf(state.doc, 'scr_extra').y));
    ok('the target keeps its own name, and the source card stays', state.doc.name === 'Shop checkout' && !!(await libGet(twin.id)) && (await libList()).length === 2);
    ok('the card of the open workflow has it too', (await libGet(id)).doc.doc.screens.some((x) => x.name === 'Renamed in the copy'));
    undo(); await flushCard();
    ok('into the open workflow it is one undo step', recOf(state.doc, changed.id).name === wasCalled && !recOf(state.doc, 'scr_extra'));
    // into a card that is not open
    const res = await mergeCardInto(id, twin.id);
    const after2 = (await libGet(twin.id)).doc.doc;
    eq('merged into a workflow that is not open, its card is rewritten', [res.changes > 0, after2.screens.find((x) => x.id === changed.id).name === wasCalled, after2.name], [true, true, 'Shop, the copy']);
    eq('merging the same thing again changes nothing', (await mergeCardInto(id, twin.id)).changes, 0);
    eq('a workflow is not merged into itself', (await mergeCardInto(id, id)).error, 'Choose another workflow to merge into.');
    // two different workflows end up one under the other
    const a = newDoc('A'); a.screens.push(readRec('screens', { id: 'scr_alpha', name: 'Alpha', x: 0, y: 0 })); a.sizes.push(readRec('sizes', { id: 'siz_alpha', screen: 'scr_alpha', name: 'Phone', w: 390, h: 844 }));
    const b = newDoc('B'); b.screens.push(readRec('screens', { id: 'scr_beta1', name: 'Beta', x: 0, y: 0 }));
    const both = mergeWorkflows(normalizeDoc(serializeDoc(a)), normalizeDoc(serializeDoc(b)));
    ok('two different workflows merged keep every screen, the second set below the first', both.doc.screens.length === 2 && both.doc.name === 'A' && both.doc.screens.find((x) => x.id === 'scr_beta1').y >= 844 + 400 && both.doc.screens.find((x) => x.id === 'scr_alpha').y === 0, JSON.stringify(both.doc.screens.map((x) => [x.id, x.y])));
    await libDelete(twin.id); render(); await wait(300);

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
