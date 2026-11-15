// Nothing leaves the page: the policy is never broken, nothing is fetched
// from another host, and a source's address is only ever a link.
suite(async (ok, eq) => {
    loadExample();
    selectId(state.doc.screens[0].id);
    selectId('');
    await new Promise((r) => setTimeout(r, 400));
    eq('the content policy is never broken', window.__cspViolations, []);
    const away = performance.getEntriesByType('resource').map((e) => e.name).filter((u) => !u.startsWith(location.origin + '/'));
    eq('nothing is loaded from another host', away, []);
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    ok('the page may connect to itself only', /connect-src 'self';/.test(csp) && /script-src 'self';/.test(csp) && /frame-src 'none'/.test(csp));
    eq('no referrer is sent', document.querySelector('meta[name="referrer"]').content, 'no-referrer');
    const links = Array.from(document.querySelectorAll('#railProps a[href^="http"]'));
    ok('a source is shown as a link', links.length > 0);
    ok('every outside link opens apart and says nothing', links.every((a) => a.target === '_blank' && /noopener/.test(a.rel) && /noreferrer/.test(a.rel)));
    ok('the board holds no outside address', !/https?:\/\/(?!www\.w3\.org)/.test(document.getElementById('board').innerHTML));
    ok('the document is not in the address bar', location.hash === '' && !/doc=|example/.test(location.search));
});
