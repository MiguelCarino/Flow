// Testing against the real thing: live addresses, test cases and runs.
suite(async (ok, eq) => {
    const pane = document.getElementById('testPane'), rail = () => document.getElementById('railTest');
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]).sort();
    loadExample();
    const doc = () => state.doc, by = (name) => doc().screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = doc().decisions[0];

    // ---- live addresses ----
    eq('a path hangs off a base, whatever the slashes', [['https://s.test', '/cart'], ['https://s.test/', 'cart'], ['https://s.test/app/', '/cart'], ['https://s.test/app', 'cart?x=1']].map(([u, p]) => liveUrl({ url: u }, { path: p })), ['https://s.test/cart', 'https://s.test/cart', 'https://s.test/app/cart', 'https://s.test/app/cart?x=1']);
    eq('a path that is a whole address stands by itself', liveUrl({ url: 'https://s.test' }, { path: 'https://other.test/x' }), 'https://other.test/x');
    eq('no base, no path, or something that is not a web address gives nothing', [liveUrl(null, { path: '/x' }), liveUrl({ url: 'https://s.test' }, { path: ' ' }), liveUrl({ url: 'https://s.test' }, { path: 'javascript:alert(1)' }).startsWith('https://s.test/')], ['', '', true]);

    // ---- test cases ----
    const cases = testCases(doc());
    eq('one way from the start to the end is one test case', cases.map((c) => c.name), ['Sign in to Receipt']);
    eq('a case is a step per screen, with what leads there and the decision taken', caseSteps(doc(), cases[0].path), [
        { stop: signIn.id, name: 'Sign in', via: '' },
        { stop: cart.id, name: 'Cart', via: 'Taps Sign in · Is the password right? Yes' },
        { stop: receipt.id, name: 'Receipt', via: 'Taps Pay' }]);
    const skip = addLink(signIn.id, cart.id);
    eq('a second way is a second case; a way with no words is told by its control or as going on', [testCases(doc()).map((c) => c.name), caseSteps(doc(), testCases(doc())[0].path)[1].via], [['Sign in to Receipt, way 1', 'Sign in to Receipt, way 2'], 'Go on']);
    undo();
    const help = addScreen('phone');
    eq('a screen that leads nowhere is an end too, but only if it can be reached', testCases(doc()).length, 1);
    undo();
    setF(signIn.id, 'start', false);
    eq('with no start there are no cases', testCases(doc()), []);
    undo();

    // ---- the rail ----
    render();
    ok('with no live address the rail says to add one', /Add a live address/.test(rail().textContent));
    selectId('');
    document.querySelector('#railProps [data-act="add-base"]').click();
    const staging = doc().bases[0];
    eq('a base address is added, named', [doc().bases.length, staging.name], [1, 'Staging']);
    ok('with no address yet, it is reported', keys().includes('base-no-url'));
    const field = document.querySelector(`#railProps [data-id="${staging.id}"][data-f="url"]`);
    field.value = 'javascript:alert(1)'; field.dispatchEvent(new Event('input', { bubbles: true }));
    eq('only a web address is kept', [staging.url, document.querySelector(`[data-url-msg="${staging.id}"]`).hidden], ['', false]);
    field.value = 'https://staging.shop.test/app'; field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    eq('typed, it is set', [staging.url, keys()], ['https://staging.shop.test/app', []]);
    setF(staging.id, 'url', 'http://staging.shop.test/?token=abc');
    eq('plain http and a key in the address are reported', keys(), ['base-http', 'base-secret']);
    setF(staging.id, 'url', 'https://staging.shop.test/app');
    setF(receipt.id, 'path', '');
    eq('a screen with no path cannot be opened by a test', keys(), ['no-live-address']);
    setF(receipt.id, 'path', '/receipt');
    ok('the cases are listed', /Test cases \(1\)/.test(rail().textContent) && !!rail().querySelector('[data-act="test-case"]'));

    // ---- a run ----
    const sent = []; state.opSinks.push((ops) => sent.push(ops));
    rail().querySelector('[data-act="test-case"]').click();
    const run = doc().runs[0], steps = () => stepsOf(doc(), run.id);
    eq('Run starts a run with a step per screen, as one change', [doc().runs.length, steps().map((s) => [s.n, s.name, s.result]), sent.length], [1, [[0, 'Sign in', ''], [1, 'Cart', ''], [2, 'Receipt', '']], 1]);
    eq('against the base, named after the case', [run.base, run.name, run.at > 0], [staging.id, 'Sign in to Receipt', true]);
    ok('the run opens on its first step, with the screen as drawn', !pane.hidden && /Step 1 of 3/.test(pane.textContent) && /Welcome back/.test(pane.querySelector('.pl-screen').innerHTML));
    const open = () => document.getElementById('testOpen');
    eq('the real screen is a link to its live address', [open().getAttribute('href'), open().target, open().rel], ['https://staging.shop.test/app/sign-in', '_blank', 'noopener noreferrer']);
    ok('Flow opened nothing itself', performance.getEntriesByType('resource').every((e) => e.name.startsWith(location.origin + '/')));
    pane.querySelector('[data-act="test-mark"][data-result="pass"]').click();
    eq('As drawn passes the step and moves on', [steps()[0].result, state.test.at, /To get here: Taps Sign in · Is the password right\? Yes/.test(pane.textContent.replace(/\s+/g, ' '))], ['pass', 1, true]);

    // a note, and an address for this step only
    const note = document.getElementById('testNote');
    note.focus(); note.value = 'The total is'; note.dispatchEvent(new Event('input', { bubbles: true }));
    note.value = 'The total is missing'; note.dispatchEvent(new Event('input', { bubbles: true }));
    eq('a note is kept with the step', steps()[1].note, 'The total is missing');
    ok('typing it does not rebuild the field', document.activeElement === note && document.body.contains(note));
    const before = JSON.stringify(serializeDoc(doc()));
    const once = document.getElementById('testOnce');
    once.value = 'https://preview-1234.shop.test/cart'; once.dispatchEvent(new Event('change', { bubbles: true }));
    eq('another address is used for this step', open().getAttribute('href'), 'https://preview-1234.shop.test/cart');
    ok('and is not saved in the workflow', JSON.stringify(serializeDoc(doc())) === before && !before.includes('preview-1234'));
    document.getElementById('testOnce').value = 'javascript:alert(1)'; document.getElementById('testOnce').dispatchEvent(new Event('change', { bubbles: true }));
    eq('one that is not a web address is not used', open().getAttribute('href'), 'https://staging.shop.test/app/cart');
    pane.querySelector('[data-act="test-mark"][data-result="fail"]').click();
    eq('Not as drawn fails the step', [steps()[1].result, state.test.at, state.test.once], ['fail', 2, '']);
    eq('a screen that failed its last test is a finding, with the note', findFindings(doc()).filter((f) => f.key.startsWith('test-failed')).map((f) => [f.id, f.level, /The total is missing/.test(f.text)]), [[cart.id, 'err', true]]);
    pane.querySelector('[data-act="test-mark"][data-result="skip"]').click();
    ok('with every step said, the run says how it went', /Finished: 1 of 3 not as drawn/.test(pane.textContent));
    eq('the tally', runTally(doc(), run.id), { pass: 1, fail: 0 + 1, skip: 1, todo: 0, total: 3, verdict: 'fail' });
    pane.querySelectorAll('[data-act="test-at"]')[1].click();
    ok('a step can be gone back to', state.test.at === 1 && document.getElementById('testNote').value === 'The total is missing');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok('Escape leaves the run; it is kept', state.test === null && pane.hidden && doc().runs.length === 1);
    ok('the rail lists it as failed', /1 failed/.test(rail().querySelector('.tc-run').textContent) && rail().querySelector('.tc-run').classList.contains('fail'));

    // ---- a later run settles the finding ----
    state.walk = { from: signIn.id, to: receipt.id, pick: 0 }; render();
    rail().querySelector('[data-act="test-walk"]').click();
    const second = doc().runs.find((r) => r.id !== run.id);
    setF(second.id, 'at', run.at + 1000);
    ok('the marked way can be tested too', !!second && state.test.run === second.id);
    markStep('pass'); markStep('pass');
    eq('a later pass of the same screen settles it', [keys().includes('test-failed'), runTally(doc(), second.id).verdict], [false, 'open']);
    markStep('pass');
    eq('all passed', runTally(doc(), second.id).verdict, 'pass');
    closeRun();
    rail().querySelector(`[data-act="test-open"][data-id="${run.id}"]`).click();
    ok('an old run opens again', state.test.run === run.id);
    playStart();
    ok('Play closes it', state.test === null && !!state.play);
    playExit();

    // ---- what survives a change to the workflow ----
    removeId(cart.id);
    eq('a run keeps its step when the screen is removed', [steps().length, steps()[1].stop, steps()[1].name, steps()[1].result], [3, '', 'Cart', 'fail']);
    openRun(run.id, 1);
    ok('and still reads: the screen is named as no longer there', /No longer in the workflow/.test(pane.textContent) && /Cart/.test(pane.textContent));
    closeRun(); undo();
    eq('undo puts the screen back in the step', steps()[1].stop, cart.id);
    removeId(staging.id);
    eq('removing the base leaves the runs, with no base', [doc().runs.length, doc().runs.every((r) => r.base === '')], [2, true]);
    openRun(run.id, 0);
    ok('a run with no base says so and offers a one-off address', /no base address/.test(pane.textContent) && !open() && !!document.getElementById('testOnce'));
    closeRun(); undo();
    const text = JSON.stringify(serializeDoc(doc()));
    removeId(run.id);
    eq('removing a run removes its steps', [doc().runs.length, doc().steps.length], [1, 3]);
    undo();
    eq('one undo', JSON.stringify(serializeDoc(doc())), text);

    // ---- files, report, sheet ----
    const again = openFileText(JSON.stringify(fileEnvelope(doc()))).doc;
    eq('bases, runs and steps are in the file', [again.bases.length, again.runs.length, again.steps.length], [1, 2, 6]);
    const raw = serializeDoc(doc());
    raw.steps.push({ id: 'stp_lost1', run: 'run_gone', n: 0 }, { id: 'stp_ghost1', run: run.id, n: 9, stop: 'scr_gone', name: 'Old' });
    const fixed = normalizeDoc(raw);
    eq('a step of no run is dropped; a step whose screen is gone keeps its name', [!!fixed.steps.find((s) => s.id === 'stp_lost1'), fixed.steps.find((s) => s.id === 'stp_ghost1').stop], [false, '']);
    const html = reportHtml(exportStops('all'));
    ok('the report has the test cases and the runs', /Test cases/.test(html) && /Taps Sign in · Is the password right\? Yes/.test(html) && /Test runs/.test(html) && /The total is missing/.test(html) && /1 failed/.test(html));
    selectId(cart.id);
    ok('a report of one screen leaves the cases out', !/Test cases/.test(reportHtml(exportStops('screen'))));
    const csv = parseCsv(await (await buildExport({ what: 'all', as: 'cases' })).blob.text());
    eq('the test cases as a sheet', [csv[0], csv.length, csv[2]], [['case', 'step', 'do', 'expect', 'live address'], 4, ['1. Sign in to Receipt', '2', 'Taps Sign in · Is the password right? Yes', 'Cart', '/cart']]);
    const part = partOfDoc(doc(), [cart.id]);
    eq('a part carries the base addresses, not the runs', [part.bases.length, part.runs.length], [1, 0]);
    state.readOnly = true; openRun(run.id, 0);
    ok('a workflow open to read only can be read through, not marked', Array.from(pane.querySelectorAll('[data-act="test-mark"]')).every((b) => b.disabled) && markStep('pass') === false);
    state.readOnly = false; closeRun();
});
