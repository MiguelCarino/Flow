// Live rooms, end to end: three copies of the app against a real flow-server.
// Open tests/live-e2e.html from the server; it writes PASS / FAIL lines.
(async () => {
    const out = [];
    const ok = (name, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} :: ${name}${!cond && detail ? ' :: ' + detail : ''}`);
    const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(40); } return false; };
    try {
        localStorage.clear(); sessionStorage.clear();
        const open = async () => {
            // The copies share this tab's session storage, where a tab remembers its
            // room for a reload: a new copy must not find another's and walk in.
            sessionStorage.clear();
            const f = document.createElement('iframe'); f.style.cssText = 'width:900px;height:600px;border:1px solid #ccc';
            f.src = '../index.html?full&lang=en'; document.body.appendChild(f);
            await new Promise((r) => f.addEventListener('load', r, { once: true }));
            const w = f.contentWindow;
            // Draw at once: a frame nobody is looking at is given no animation frames.
            w.FLOW_SYNC = true;
            await new Promise((r) => { const s = w.document.createElement('script'); s.src = 'tests/live-agent.js'; s.onload = r; w.document.body.appendChild(s); });
            await until(() => w.__flow.state.liveServer === true, 4000);
            return w;
        };
        const A = await open();
        ok('the page knows it is served by a Flow server', A.__flow.state.liveServer === true && !A.document.getElementById('liveMenu').hidden);
        A.loadExample();
        const La = await A.liveCreate('Ana');
        eq('starting a room makes its maker the owner, with a link for each role', [La.role, Object.keys(La.tokens).sort(), La.status], ['owner', ['edit', 'owner', 'view'], 'live']);
        ok('the tag on the board says it is live', /Live · 1/.test(A.document.getElementById('liveTag').textContent));

        // ---- what the server holds ----
        const peek = async (token) => (await fetch(`../api/rooms/${La.room}`, { headers: { Authorization: 'Bearer ' + token } }));
        const held = await (await peek(La.tokens.view)).json();
        const plain = atob(held.snapshot);
        ok('the server holds the workflow sealed: none of its words can be read', !/Sign in|Shop checkout|screens|example/.test(plain) && held.snapshot.length > 500);
        eq('without a token, or with a wrong one, the room is not there', [(await peek('')).status, (await peek('nope')).status], [404, 404]);
        ok('the key is in the link and nowhere the server sees', A.liveLink(La, La.tokens.edit).includes('#r~' + La.room + '~' + La.keyText) && !JSON.stringify(held).includes(La.keyText));

        // ---- a second person joins by the link ----
        const B = await open();
        const keptBefore = (await B.libList()).length;
        B.addScreen('phone');
        const Lb = await B.liveJoin(La.room, La.keyText, La.tokens.edit);
        eq('joining by the edit link gives the same workflow, and the right to change it', [B.__flow.text() === A.__flow.text(), Lb.role, B.__flow.state.readOnly], [true, 'edit', false]);
        ok('what the joiner had open was kept first', (await B.libList()).length === keptBefore + 1);
        const cart = A.__flow.state.doc.screens.find((s) => s.name === 'Cart');

        A.__flow.setF(cart.id, 'name', 'Basket');
        ok('a change by one shows for the other', await until(() => B.__flow.rec(cart.id).name === 'Basket'));
        ok('and is drawn on their board', await until(() => B.document.querySelector(`#board .screen[data-id="${cart.id}"] .stop-name`).textContent.startsWith('Basket')));
        const added = B.addScreen('laptop', 'signin');
        ok('a screen added by the other, with its size and elements, arrives', await until(() => A.__flow.rec(added) && A.__flow.text() === B.__flow.text()));
        ok('a change that arrives is not an undo step of mine', A.__flow.state.doc.screens.length === 4 && (() => { A.undo(); return A.__flow.rec(cart.id).name === 'Cart' && !!A.__flow.rec(added); })());
        ok('my undo is shared like any change', await until(() => B.__flow.rec(cart.id).name === 'Cart'));

        // ---- two people, the same field, the same moment ----
        for (let i = 0; i < 6; i++) { A.__flow.setF(cart.id, 'note', 'from A ' + i); B.__flow.setF(cart.id, 'note', 'from B ' + i); A.__flow.setF(cart.id, 'x', 2000 + i * 8); B.__flow.setF(cart.id, 'y', 80 + i * 8); }
        ok('they end with the same workflow', await until(() => A.__flow.text() === B.__flow.text() && !A.__flow.state.live.pending.length && !B.__flow.state.live.pending.length && A.__flow.state.live.seq === B.__flow.state.live.seq));
        const note = A.__flow.rec(cart.id).note;
        ok('the one the server placed last stands, for both', /^from [AB] 5$/.test(note) && B.__flow.rec(cart.id).note === note, note);
        eq('changes to different fields both stand', [A.__flow.rec(cart.id).x, A.__flow.rec(cart.id).y], [2040, 120]);
        B.removeId(added); A.__flow.setF(added, 'name', 'Too late');
        ok('a change to something the other removed is dropped, the same for both', await until(() => !A.__flow.rec(added) && !B.__flow.rec(added) && A.__flow.text() === B.__flow.text()));

        // ---- typing while the other changes things ----
        B.selectId(cart.id);
        const field = B.document.querySelector('#railProps [data-f="name"]');
        field.focus(); field.value = 'Car'; field.dispatchEvent(new B.Event('input', { bubbles: true }));
        A.__flow.setF(A.__flow.state.doc.screens.find((s) => s.name === 'Receipt').id, 'note', 'while B types');
        await until(() => B.__flow.state.doc.screens.some((s) => s.note === 'while B types'));
        ok('someone else\'s change does not take the field from under my typing', B.document.activeElement === field && B.document.body.contains(field) && field.value === 'Car');
        field.value = 'Cart'; field.dispatchEvent(new B.Event('input', { bubbles: true })); field.dispatchEvent(new B.Event('change', { bubbles: true }));
        await until(() => A.__flow.rec(cart.id).name === 'Cart' && A.__flow.text() === B.__flow.text());

        // ---- presence ----
        const board = A.document.getElementById('board'), r = board.getBoundingClientRect();
        board.dispatchEvent(new A.PointerEvent('pointermove', { bubbles: true, clientX: r.left + 200, clientY: r.top + 150 }));
        A.selectId(cart.id);
        ok('the other sees who is here, by name', await until(() => { const p = Array.from(B.__flow.state.live.peers.values())[0]; return p && p.name === 'Ana' && typeof p.x === 'number' && p.sel.includes(cart.id); }));
        ok('and their pointer and selection on the board', await until(() => !!B.document.querySelector('#board .peer') && /Ana/.test(B.document.querySelector('#board .peer').textContent)));
        ok('the tag counts both', await until(() => /Live · 2/.test(B.document.getElementById('liveTag').textContent)));
        ok('where a pointer is, is not history: the room\'s order did not move', A.__flow.state.live.seq === B.__flow.state.live.seq && (await (await peek(La.tokens.view)).json()).seq === A.__flow.state.live.seq);

        // ---- a link that can only look ----
        const C = await open();
        const Lc = await C.liveJoin(La.room, La.keyText, La.tokens.view);
        eq('the view link joins as a viewer, read only', [Lc.role, C.__flow.state.readOnly, C.__flow.text() === A.__flow.text()], ['view', true, true]);
        ok('and says so', /look at this live workflow but not change/.test(C.document.getElementById('roBanner').textContent) && !C.document.getElementById('roBanner').hidden);
        eq('a viewer changes nothing', [C.__flow.setF(cart.id, 'name', 'Mine'), C.addScreen('phone')], [false, '']);
        const sneak = await fetch(`../api/rooms/${La.room}/ops`, { method: 'POST', headers: { Authorization: 'Bearer ' + La.tokens.view, 'Content-Type': 'application/json' }, body: JSON.stringify({ by: 'sneaky1', n: 1, data: 'x' }) });
        eq('and the server refuses a change sent with the view link', sneak.status, 403);
        A.__flow.setF(cart.id, 'note', 'seen by all');
        ok('but follows every change', await until(() => C.__flow.rec(cart.id).note === 'seen by all'));
        ok('a viewer has only the view link to pass on', (() => { C.document.querySelector('[data-act="live"]').click(); const v = Array.from(C.document.querySelectorAll('#liveBody .link-out')).map((i) => i.value); C.__flow.closeDlg('liveDlg'); return v.length === 1 && v[0].endsWith(La.tokens.view); })());

        // ---- a dropped connection ----
        const before = A.__flow.state.live.seq;
        A.__flow.state.live.stop.abort();
        B.__flow.setF(cart.id, 'note', 'while A was away'); B.addScreen('watch');
        ok('after the connection drops, what was missed arrives in order', await until(() => A.__flow.text() === B.__flow.text() && A.__flow.state.live.seq > before, 9000));

        // ---- many changes: a snapshot keeps the log short ----
        A.batch(() => {}); 
        for (let i = 0; i < 230; i++) A.__flow.setF(cart.id, 'x', 3000 + i * 8);
        ok('230 changes all arrive', await until(() => B.__flow.rec(cart.id).x === 3000 + 229 * 8 && !A.__flow.state.live.pending.length, 20000));
        ok('and the room took a fresh snapshot, so its log is short', await until(async () => { const h = await (await peek(La.tokens.view)).json(); return h.snapSeq > 0 && h.ops.length < 220; }, 8000));
        const D = await open();
        await D.liveJoin(La.room, La.keyText, La.tokens.edit);
        ok('someone joining now gets the workflow as it is', D.__flow.text() === A.__flow.text());
        D.liveLeave();
        ok('leaving keeps the workflow open, as their own copy', D.__flow.state.live === null && D.__flow.text() === A.__flow.text() && D.document.getElementById('liveTag').hidden);
        D.__flow.setF(cart.id, 'name', 'Only mine'); await sleep(400);
        ok('and what they do then is not sent', A.__flow.rec(cart.id).name === 'Cart');

        // ---- another workflow is not a change to the room's ----
        B.openDoc(B.newDoc('Something else'), false);
        await sleep(500);
        ok('opening another workflow leaves the room and leaves it as it was', B.__flow.state.live === null && A.__flow.state.doc.screens.length > 3);

        // ---- the end of the room ----
        eq('only the owner can end it', (await fetch(`../api/rooms/${La.room}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + La.tokens.edit } })).status, 403);
        A.document.querySelector('[data-act="live"]').click();
        A.document.querySelector('[data-act="live-end"]').click();
        ok('ending the room asks once more', A.__flow.state.live !== null && /for good/.test(A.document.querySelector('[data-act="live-end"]').textContent));
        A.document.querySelector('[data-act="live-end"]').click();
        ok('then the owner is out, with the workflow still open', await until(() => A.__flow.state.live === null) && A.__flow.state.doc.screens.length > 3);
        ok('and the viewer is told the room is gone', await until(() => C.__flow.state.live && C.__flow.state.live.status === 'gone', 9000));
        eq('the room is gone from the server', (await peek(La.tokens.owner)).status, 404);
    } catch (e) {
        ok('the run finished without throwing', false, (e && e.stack) || String(e));
    }
    document.getElementById('OUT').textContent = out.join('\n'); document.title = 'done';
})();
