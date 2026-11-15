// @realtime
// Sealed share links: the workflow encrypted in the link's fragment.
suite(async (ok, eq) => {
    loadExample();
    const text = JSON.stringify(fileEnvelope(state.doc));
    const frag = await sealText(text, 'correct horse battery');
    ok('a sealed link starts with its mark and is plain link characters', /^e~[A-Za-z0-9_-]+$/.test(frag));
    ok('nothing of the workflow can be read in it', !/Shop|checkout|Sign|example/i.test(frag) && !frag.includes(btoa('Shop checkout').slice(0, 8)));
    eq('the passphrase opens it', await unsealText('#' + frag, 'correct horse battery'), text);
    ok('sealing the same thing twice gives different links', (await sealText(text, 'correct horse battery')) !== frag);
    const fail = (p) => p.then(() => '', (e) => e.message);
    eq('a wrong passphrase is refused, in words', await fail(unsealText(frag, 'wrong horse battery')), 'That passphrase does not open this link, or the link was cut short.');
    eq('a link cut short', await fail(unsealText(frag.slice(0, 40), 'correct horse battery')), 'This link was cut short.');
    const bent = frag.slice(0, -6) + (frag.slice(-6, -5) === 'A' ? 'B' : 'A') + frag.slice(-5);
    ok('a link changed on the way does not open', (await fail(unsealText(bent, 'correct horse battery'))) !== '');
    eq('a short passphrase is refused before anything is made', await fail(sealText(text, 'short')), 'The passphrase needs 8 characters at least.');
    eq('what is not a sealed link', await fail(unsealText('#advanced', 'x')), 'This is not a sealed Flow link.');
    ok('it is smaller than the file it carries', frag.length < text.length);

    // ---- a link to this page ----
    const link = await makeShareLink('all', 'correct horse battery');
    ok('the link points at this page, with the workflow after the #', link.startsWith(location.origin + location.pathname + '#e~') && !link.includes('?'));
    selectId(state.doc.screens.find((s) => s.name === 'Cart').id);
    const partLink = await makeShareLink('screen', 'correct horse battery');
    const partEnv = JSON.parse(await unsealText(partLink.split('#')[1], 'correct horse battery'));
    eq('a link to one screen carries a part', [partEnv.part, partEnv.doc.screens.filter((s) => !s.stub).length], [true, 1]);
    const bare = JSON.parse(await unsealText((await makeShareLink('all', 'correct horse battery', true)).split('#')[1], 'correct horse battery'));
    eq('the sources can be left out of a link', bare.doc.sources.length, 0);

    // ---- arriving by a link ----
    const before = JSON.stringify(serializeDoc(state.doc));
    openDoc(newDoc('Mine'), false); addScreen('phone');
    history.replaceState(null, '', location.pathname + location.search + '#' + frag);
    ok('a sealed link in the address is noticed', takeSealFromAddress());
    eq('and taken out of the address at once', location.hash, '');
    ok('an address with no link is left alone', !takeSealFromAddress());
    document.getElementById('passInput').value = 'not the passphrase';
    eq('the wrong passphrase opens nothing and says so', [await runUnseal(), state.doc.name, /does not open/.test(document.getElementById('passMsg').textContent)], [false, 'Mine', true]);
    document.getElementById('passInput').value = 'correct horse battery';
    eq('the right one opens the workflow', [await runUnseal(), JSON.stringify(serializeDoc(state.doc)) === before, document.getElementById('passInput').value], [true, true, '']);
    undo();
    eq('and Undo brings back what was open', state.doc.name, 'Mine');

    // ---- from the dialog ----
    loadExample();
    document.querySelector('[data-act="export-open"]').click();
    const dlg = document.getElementById('exportDlg'), as = document.getElementById('exportAs');
    ok('Export opens its dialog', dlg.open);
    eq('what cannot be exported right now is not offered', Array.from(document.querySelectorAll('input[name="exportWhat"]')).map((r) => r.disabled), [false, true, true, true]);
    as.value = 'link'; as.dispatchEvent(new Event('change', { bubbles: true }));
    ok('a sealed link asks for a passphrase', !document.getElementById('exportLinkOpts').hidden && document.getElementById('exportPicOpts').hidden);
    document.getElementById('exportPass').value = 'short';
    eq('too short a passphrase is said in the dialog', [await runExport(false), document.getElementById('exportMsg').classList.contains('bad')], [null, true]);
    document.getElementById('exportPass').value = 'correct horse battery';
    const made = await runExport(false);
    ok('the link is shown, ready to copy', typeof made === 'string' && document.getElementById('exportLink').value === made && !document.getElementById('exportLinkOut').hidden);
    as.value = 'map'; as.dispatchEvent(new Event('change', { bubbles: true }));
    ok('a picture offers its format instead', !document.getElementById('exportPicOpts').hidden && document.getElementById('exportLinkOpts').hidden);
    document.querySelector('[data-act="dlg-close"][data-dlg="exportDlg"]').click();
    ok('and Close closes it', !dlg.open);
    ok('the workflow is not in the address bar at any point', location.hash === '');
});
