// @realtime
// What kind of finding each is, the drop zone, Add again, and a first
// workflow from the start page.
suite(async (ok, eq) => {
    const rail = document.getElementById('railFindings');
    const find = (check) => findFindings(state.doc).filter((f) => checkOfKey(f.key) === check);
    const classes = () => Array.from(rail.querySelectorAll('details.f-class')).map((d) => d.dataset.cls);

    // ---- every check has a class ----
    const known = new Set(CHECK_CLASSES.map(([k]) => k));
    const listed = CHECK_GROUPS.flatMap(([, list]) => list);
    ok('every check is in a class', listed.every((c) => known.has(checkClass(c))), listed.filter((c) => !known.has(checkClass(c))).join());
    eq('the classes of some checks', ['placeholder', 'screen-untouched', 'decision-same', 'dead-end', 'text-fit-de', 'source-secret'].map(checkClass), ['unchanged', 'unchanged', 'decision-nowhere', 'dead-end', 'fit', 'secrets']);
    eq('a class has a name', [className('unchanged'), className('decision-nowhere'), className('nope')], ['Unchanged since it was added', 'Decisions that lead nowhere', 'Other']);

    // ---- unchanged since it was added ----
    const s1 = addScreen('phone');
    eq('a screen nobody touched is a finding', find('screen-untouched').map((f) => [f.id, f.cls, f.level]), [[s1, 'unchanged', 'warn']]);
    selectId(s1); const btn = addElement('button');
    eq('with something drawn on it, it is not', find('screen-untouched').length, 0);
    eq('but the button still says Button', find('placeholder').map((f) => [f.id, f.cls]), [[btn, 'unchanged']]);
    removeId(btn); setF(s1, 'name', 'Home');
    eq('nor is one that was given a name', find('screen-untouched').length, 0);
    selectId(s1); const b2 = addElement('button'); setF(b2, 'text', 'Go on'); setF(b2, 'name', 'Go on');

    // ---- decisions that lead nowhere ----
    const d = addDecision(); setF(d, 'name', 'Is it paid?');
    addLink(s1, d); setF(state.doc.links[0].id, 'label', 'Taps Go on');
    eq('a decision with no branch leads nowhere', find('decision-branches').map((f) => f.cls), ['decision-nowhere']);
    const s2 = addScreen('phone'); setF(s2, 'name', 'Done'); setF(s2, 'end', true);
    selectId(s2); setF(addElement('heading'), 'text', 'All done');
    const l1 = addLink(d, s2); setF(l1, 'cond', 'Yes');
    eq('with one branch it is not finished', find('decision-branches').map((f) => f.cls), ['decision-unfinished']);
    const l2 = addLink(d, s2); setF(l2, 'cond', 'No');
    eq('two branches to the same place decide nothing', find('decision-same').map((f) => [f.id, f.cls, f.level]), [[d, 'decision-nowhere', 'warn']]);
    setF(l2, 'to', s1);
    eq('until they part', [find('decision-same').length, find('decision-branches').length], [0, 0]);
    setF(l2, 'to', s2);

    // ---- the list is sorted into the classes ----
    selectId(s1); const b3 = addElement('button');
    render();
    eq('one heading per class found, in order', classes(), ['decision-nowhere', 'unchanged']);
    const head = rail.querySelector('details.f-class[data-cls="unchanged"] summary');
    ok('a heading names the class and counts it', /Unchanged since it was added/.test(head.textContent) && head.querySelector('.count').textContent === '1');
    ok('each finding sits under its class', rail.querySelector('details[data-cls="unchanged"] .finding').dataset.key === 'placeholder:' + b3 && rail.querySelectorAll('.finding').length === findingsNow().length);
    pinFinding('placeholder:' + b3);
    eq('a pinned finding is listed first, under Pinned', classes(), ['pinned', 'decision-nowhere']);
    pinFinding('placeholder:' + b3);
    state.clsShut.add('unchanged'); renderFindings();
    ok('a class folded shut stays shut over a redraw', !rail.querySelector('details[data-cls="unchanged"]').open && rail.querySelector('details[data-cls="decision-nowhere"]').open);
    state.clsShut.clear();
    setLocale('es'); render();
    ok('the classes are in Flow\'s language', /Sin cambios desde que se añadió/.test(rail.textContent) && /Decisiones que no llevan a nada/.test(rail.textContent));
    setLocale('en');
    removeId(b3);

    // ---- the drop zone ----
    selectId(s1); const dz = addElement('dropzone');
    const rec = () => recOf(state.doc, dz);
    eq('a drop zone is added like any element', [rec().type, rec().w, rec().h, ELEMENT_KIT.dropzone.control], ['dropzone', 280, 144, true]);
    const g = document.querySelector(`#board .el[data-id="${dz}"]`);
    ok('it is drawn as a dashed box that says what to drop', g.querySelector('rect[stroke-dasharray]') && /Drop a file here/.test(g.textContent) && g.querySelector('path'));
    eq('left as it was, it is unchanged since it was added', find('placeholder').map((f) => f.id), [dz]);
    setF(dz, 'text', 'Drop your receipt here');
    eq('with its own text it is fine', findFindings(state.doc).filter((f) => f.id === dz).length, 0);
    setF(dz, 'text', '');
    eq('with no text and no name it has nothing to be called by', findFindings(state.doc).filter((f) => f.id === dz).map((f) => checkOfKey(f.key)), ['control-unnamed']);
    setF(dz, 'text', 'Drop your receipt here');
    ok('it has a tile in the grid', !!document.querySelector('#palette [data-type="dropzone"] svg'));
    const back = openFileText(JSON.stringify(fileEnvelope(state.doc)));
    ok('and it is kept in a file', !back.error && back.doc.elements.some((e) => e.type === 'dropzone'));

    // ---- add again ----
    state.lastAdded = ''; setSelection([]); render();
    const again = document.getElementById('addAgain');
    ok('nothing to add again before anything was added', again.hidden);
    selectId(s1);
    document.querySelector('#palette [data-type="chip"]').click();
    const first = soleSelected().id;
    ok('after a tile is used, Add again names it', !again.hidden && /Chip again/.test(again.textContent) && state.lastAdded === 'chip');
    again.click();
    const second = soleSelected().id;
    ok('a press adds another, on the same screen, under the first', second !== first && recOf(state.doc, second).type === 'chip' && recOf(state.doc, second).size === recOf(state.doc, first).size && recOf(state.doc, second).y > recOf(state.doc, first).y);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    ok('so does the A key', soleSelected().id !== second && recOf(state.doc, soleSelected().id).type === 'chip');
    const n = state.doc.elements.length;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    eq('Ctrl+A still selects, and adds nothing', state.doc.elements.length, n);
    undo();
    eq('each one added is one undo step', state.doc.elements.length, n - 1);
    ok('it is on offer while the grid is folded', document.querySelector('.flow-rail').classList.contains('lib-wrapped') ? again.getBoundingClientRect().height > 0 : true);
    setSelection([]); render();
    const m = state.doc.elements.length;
    again.click();
    eq('with nowhere to put it, nothing is added', state.doc.elements.length, m);
    state.readOnly = true; render();
    ok('nor on a workflow that cannot be changed', again.hidden);
    state.readOnly = false; render();

    // ---- a first workflow from the start page ----
    for (const c of await libList()) await libDelete(c.id);
    loadDoc(newDoc(''), false); setCard('');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    showLanding(true); await wait(300);
    const none = document.getElementById('landingNone'), more = document.getElementById('landingMore'), saved = document.getElementById('landingSaved'), box = document.getElementById('landingDrop');
    ok('with nothing kept, the start page says so and offers to make the first', !none.hidden && more.hidden && saved.hidden && /No workflow is kept in this browser yet\. Make the first one:/.test(none.textContent) && none.getBoundingClientRect().height > 0);
    document.getElementById('landingName').value = 'Checkout';
    box.querySelector('[data-act="landing-new"]').click();
    await wait(600);
    const cards = await libList();
    eq('it is made, named, kept and opened', [state.landing, state.doc.name, cards.length, cards[0] && cards[0].name, state.cardId === (cards[0] && cards[0].id), location.hash], [false, 'Checkout', 1, 'Checkout', true, '#editor']);
    addScreen('phone');
    goHome(); await wait(400);
    const card = () => document.querySelector(`#landingCards .landing-card[data-card="${cards[0].id}"]`);
    ok('with one kept, the start page lists it, marked open, above the way to start another', none.hidden && !more.hidden && !saved.hidden && !!card() && /Checkout/.test(card().textContent) && /1 screen/.test(card().textContent) && card().classList.contains('on')
        && document.getElementById('landing').classList.contains('has-saved') && saved.getBoundingClientRect().top < box.getBoundingClientRect().top);
    document.getElementById('landingName').value = 'Second';
    box.querySelector('[data-act="landing-new"]').click();
    await wait(600);
    eq('another one made from there is kept beside the first', [(await libList()).map((c) => c.name).sort(), state.doc.name], [['Checkout', 'Second'], 'Second']);
    goHome(); await wait(400);
    card().querySelector('[data-act="lib-open"]').click(); await wait(400);
    eq('a press on a card opens it', [state.landing, state.doc.name, state.doc.screens.length], [false, 'Checkout', 1]);
    for (const c of await libList()) await libDelete(c.id);
    history.replaceState(null, '', location.pathname + location.search);
});
