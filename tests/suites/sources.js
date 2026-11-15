// Sources: outside addresses that are only ever pointed at.
suite(async (ok, eq) => {
    eq('http and https are kept', [safeUrl('https://example.com/a'), safeUrl(' http://example.com ')], ['https://example.com/a', 'http://example.com']);
    eq('anything that could run or embed is not', ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'blob:x', 'example.com', 7].map(safeUrl), ['', '', '', '', '', '']);
    ok('the reason is said in words', urlProblem('ftp://x') !== '' && urlProblem('https://x') === '' && urlProblem('') === '');
    eq('an address that carries a key is noticed', ['https://x.test/?token=abc', 'https://user:pw@x.test/', 'https://x.test/#access_token=1', 'https://x.test/file?id=4'].map(urlCarriesSecret), [true, true, true, false]);

    loadExample();
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]);
    const src = state.doc.sources[0];
    setF(src.id, 'url', 'javascript:alert(1)');
    eq('a bad address set by any route is emptied', recOf(state.doc, src.id).url, '');
    ok('a source with no address is reported', keys().includes('source-no-url'));
    setF(src.id, 'url', 'http://example.com/repo');
    ok('plain http is reported', keys().includes('source-http'));
    setF(src.id, 'url', 'http://localhost:3000/');
    ok('but not on this computer', !keys().includes('source-http'));
    setF(src.id, 'url', 'https://example.com/repo?token=abc');
    ok('an address with a key is an error', findFindings(state.doc).some((f) => f.key.startsWith('source-secret') && f.level === 'err'));
    setF(src.id, 'url', 'https://example.com/repo');

    // ---- in the rail ----
    selectId('');
    const field = document.querySelector('#railProps [data-url]');
    eq('the address shows in its field', field.value, 'https://example.com/repo');
    field.value = 'javascript:alert(1)';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    eq('a bad address typed is not kept', recOf(state.doc, src.id).url, 'https://example.com/repo');
    ok('and the field says why', !document.querySelector(`[data-url-msg="${src.id}"]`).hidden);

    const signIn = state.doc.screens.find((s) => s.name === 'Sign in');
    selectId(signIn.id);
    const open = document.querySelector('#railProps a.pf-open');
    eq('a screen links to its source', open && open.getAttribute('href'), 'https://example.com/repo');
    eq('in a new tab, saying nothing of where it came from', [open.target, open.rel], ['_blank', 'noopener noreferrer']);

    document.querySelector('[data-act="del"][data-id="' + src.id + '"]') || selectId('');
    removeId(src.id);
    eq('removing a source clears it from the screen, and keeps the place', [recOf(state.doc, signIn.id).source, recOf(state.doc, signIn.id).at], ['', 'src/screens/SignIn']);
    undo();
    eq('one undo puts both back', recOf(state.doc, signIn.id).source, src.id);
});
