// Loaded first in the test copy of index.html (tests/run.sh), ahead of the
// policy and every script it governs. A file, not an inline script: the page's
// CSP forbids inline script, and the harness is subject to it like the rest.

// The first boot error, so a suite that never reports can say why it died.
(function () {
    const bootErr = (msg) => {
        if (document.getElementById('BOOTERR')) return;
        const p = document.createElement('pre'); p.id = 'BOOTERR'; p.textContent = msg;
        document.documentElement.appendChild(p);
    };
    window.addEventListener('error', (e) => bootErr(e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
    window.addEventListener('unhandledrejection', (e) => bootErr('unhandled rejection: ' + ((e.reason && (e.reason.stack || e.reason.message)) || e.reason)));
    // Counted for tests/suites/privacy.js.
    // Draw at once while dragging, so a suite can read the board after a move.
    window.FLOW_SYNC = true;
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__cspViolations.push(e.violatedDirective + ' ' + (e.blockedURI || 'inline')));
})();

// suite(async (ok, eq) => { ... }) runs once the page has loaded, on an empty
// document with no history, and writes the results where run.sh reads them.
//   ok(name, condition, detail?)      eq(name, got, want)  (compared as JSON)
window.suite = (fn) => window.addEventListener('load', () => setTimeout(async () => {
    const out = [];
    const ok = (name, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} :: ${name}${!cond && detail ? ' :: ' + detail : ''}`);
    const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    try {
        localStorage.removeItem('flow_live');
        localStorage.removeItem('flow_live_card');
        state.cardId = '';
        // Every suite starts in English, in the full editor, on the board.
        state.simple = false; state.view = 'board';
        setLocale('en');
        state.opSinks.length = 0;
        loadDoc(newDoc(''), false);
        await fn(ok, eq);
    } catch (e) {
        ok('suite ran without throwing', false, (e && e.stack) || String(e));
    }
    const pre = document.createElement('pre'); pre.id = 'TESTOUT'; pre.textContent = out.join('\n');
    document.body.appendChild(pre);
}, 50));

// A pointer on the board, as the browser would send it. at: an element (its
// centre) or { x, y } in window pixels.
window.pointAt = (at) => {
    if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
    return at;
};
window.pointer = (type, target, at, keys = {}) => {
    const p = window.pointAt(at);
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: p.x, clientY: p.y, shiftKey: !!keys.shift, ctrlKey: !!keys.ctrl }));
};
// Press on `from`, move to `to` in steps, release.
window.drag = (from, to, keys = {}) => {
    const board = document.getElementById('board'), a = window.pointAt(from), b = window.pointAt(to);
    window.pointer('pointerdown', from.getBoundingClientRect ? from : board, a, keys);
    for (let i = 1; i <= 4; i++) window.pointer('pointermove', board, { x: a.x + ((b.x - a.x) * i) / 4, y: a.y + ((b.y - a.y) * i) / 4 });
    window.pointer('pointerup', board, b);
};
