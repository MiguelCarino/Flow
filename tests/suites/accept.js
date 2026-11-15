// Accepting a finding with a reason, and pinning one to come back to.
suite(async (ok, eq) => {
    const board = document.getElementById('board'), rail = () => document.getElementById('railFindings');
    const rows = () => Array.from(rail().querySelectorAll(':scope > .f-class > .finding'));
    const count = () => document.getElementById('findingsCount').textContent;
    loadExample();
    const cart = state.doc.screens.find((s) => s.name === 'Cart'), receipt = state.doc.screens.find((s) => s.name === 'Receipt');
    const island = addScreen('phone'); setF(island, 'name', 'Help');
    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    setF(pay.id, 'h', 40);
    eq('three findings are listed, each under its heading', [count(), rows().map((r) => r.querySelector('.f-group').textContent).sort()], ['3', ['Flow', 'Flow', 'Size']]);
    eq('and badged on their screens', [board.querySelector(`[data-badge="${island}"] text`).textContent, board.querySelector(`[data-badge="${cart.id}"] text`).textContent], ['2', '1']);
    const dead = 'dead-end:' + island, unreached = 'unreached:' + island, small = 'target-touch:' + pay.id;
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));

    // ---- pinning ----
    rail().querySelector(`[data-key="${small}"] [data-act="pin-toggle"]`).click();
    eq('a pinned finding is listed first, marked, and still counted', [rows()[0].dataset.key, rows()[0].classList.contains('pinned'), count(), state.doc.pins.length], [small, true, '3', 1]);
    ok('its button says so', rail().querySelector(`[data-key="${small}"] [data-act="pin-toggle"]`).getAttribute('aria-pressed') === 'true');
    eq('pinning is a change like any other', [sent.length, sent[0][0].kind], [1, 'pins']);
    undo(); redo();
    eq('one pin per finding: the button takes it off', [pinFinding(small), state.doc.pins.length], ['', 0]);
    undo();

    // ---- accepting ----
    rail().querySelector(`[data-key="${dead}"] [data-act="accept-start"]`).click();
    const field = () => document.getElementById('acceptReason');
    ok('accepting asks why, with the focus in the field', !!field() && document.activeElement === field());
    eq('nothing is accepted without a reason', [acceptFinding(dead, '   '), state.doc.accepts.length], ['', 0]);
    field().value = 'Help is opened from the';
    setF(island, 'note', 'a change elsewhere while the reason is typed');
    eq('a redraw keeps what was typed', field().value, 'Help is opened from the');
    field().value = 'Help is opened from the system menu, not from a screen.';
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    eq('Enter accepts it with the reason', state.doc.accepts.map((a) => [a.finding, a.reason]), [[dead, 'Help is opened from the system menu, not from a screen.']]);
    eq('it leaves the count and the badge', [count(), board.querySelector(`[data-badge="${island}"] text`).textContent, findingsNow().some((f) => f.key === dead)], ['2', '1', false]);
    const acc = document.getElementById('acceptedList');
    ok('and is kept under Accepted, with the reason', !!acc && /Accepted \(1\)/.test(acc.querySelector('summary').textContent) && /system menu/.test(acc.textContent));
    eq('it cannot be accepted twice', acceptFinding(dead, 'again'), '');
    acceptFinding(small, 'The button is 40 px by design.');
    eq('accepting a pinned finding takes the pin off, as one step', [state.doc.pins.length, state.doc.accepts.length], [0, 2]);
    undo();
    eq('one undo', [state.doc.pins.length, state.doc.accepts.length], [1, 1]);
    rail().querySelector(`[data-key="${unreached}"] [data-act="accept-start"]`).click();
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok('Escape gives up', !field() && state.accepting === '' && state.doc.accepts.length === 1);

    // ---- taking it back ----
    document.querySelector('#acceptedList [data-act="del"]').click();
    eq('Take back puts the finding in the list again', [state.doc.accepts.length, count()], [0, '3']);
    undo();

    // ---- files ----
    const again = openFileText(JSON.stringify(fileEnvelope(state.doc))).doc;
    eq('what was accepted and pinned is in the file', [again.accepts.length, again.pins.length, again.accepts[0].reason], [1, 1, 'Help is opened from the system menu, not from a screen.']);
    const raw = serializeDoc(state.doc);
    raw.accepts.push({ id: 'acc_dup1', finding: dead, reason: 'twice' }, { id: 'acc_lost1', finding: 'dead-end:scr_gone', reason: 'x' }, { id: 'acc_bad1', finding: 'nonsense', reason: 'x' }, { id: 'acc_doc1', finding: 'no-start:', reason: 'whole document' });
    eq('a second say on a finding, and one about a record that is gone, are dropped on reading', normalizeDoc(raw).accepts.map((a) => a.id).sort(), [state.doc.accepts[0].id, 'acc_doc1'].sort());

    // ---- when the finding goes away, and when its record does ----
    setF(island, 'end', true);
    ok('fixed, the finding is no longer found, and what was said is listed apart', findingsSorted().stale.length === 1 && /No longer found \(1\)/.test(rail().textContent));
    setF(island, 'end', false);
    eq('found again, it is still accepted', [findingsSorted().stale.length, findingsSorted().accepted.length], [0, 1]);
    const text = JSON.stringify(serializeDoc(state.doc));
    removeId(island);
    eq('removing the screen removes what was said about it', state.doc.accepts.length, 0);
    removeId(pay.id);
    eq('and removing the element removes its pin', state.doc.pins.length, 0);
    undo(); undo();
    eq('undo brings both back', JSON.stringify(serializeDoc(state.doc)), text);

    // ---- a finding about the whole document ----
    setF(state.doc.screens.find((s) => s.start).id, 'start', false);
    const whole = findingsNow().find((f) => f.key === 'no-start:');
    ok('a finding about the whole workflow can be accepted too', !!whole && acceptFinding('no-start:', 'This file is a library of screens, not one workflow.') !== '' && !findingsNow().some((f) => f.key === 'no-start:'));
    ok('a workflow open to read only offers neither', (() => { state.readOnly = true; render(); const off = Array.from(rail().querySelectorAll('.f-btn')).every((b) => b.disabled); state.readOnly = false; render(); return off; })());
});
