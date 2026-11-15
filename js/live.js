// Live: several people changing one workflow at once.
//
// Only there when the page is served by flow-server (server/). The website
// and a copy opened from disk never ask for it and never talk to a server.
//
// How it works. Every change here is already a list of operations (change()
// in js/app.js). In a room each list is sealed with the room's key and sent
// to the server, which gives it a place in one order and relays it. Every
// browser applies the lists in that order, its own included, so everyone
// ends with the same workflow: where two people set the same field, the one
// the server placed later stands.
//
// The server cannot read any of it. The key is made here, lives in the
// link's fragment (which a browser never sends), and seals the snapshot,
// every operation and where each person's pointer is.
//
//   link:  #r~<room>~<key>~<token>     token: what the link may do (look, or change)

const LIVE_MARK = 'r~', LIVE_STORE = 'flow_room', LIVE_NAME = 'flow_live_name';
const LIVE_COLOURS = ['#e11d48', '#7c3aed', '#0891b2', '#16a34a', '#ea580c', '#db2777', '#2563eb', '#ca8a04'];
const SNAPSHOT_EVERY = 200, PRESENCE_MS = 90, PEER_STALE_MS = 12000;

const liveB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
const liveUnB64 = (s) => { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const liveKey = (keyText) => crypto.subtle.importKey('raw', unb64url(keyText), 'AES-GCM', false, ['encrypt', 'decrypt']);
// Any value -> sealed text: 12 bytes of IV, then AES-GCM of its JSON.
async function liveSeal(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return liveB64(out);
}
async function liveUnseal(key, text) {
    const bytes = liveUnB64(text);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, key, bytes.subarray(12))));
}
async function liveCall(L, method, path, body) {
    const res = await fetch('api/rooms' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, L ? { Authorization: 'Bearer ' + L.token } : {}), body: body ? JSON.stringify(body) : undefined });
    if (res.status === 204) return {};
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(out.error || 'The server refused.'); e.status = res.status; throw e; }
    return out;
}

// Is this page served by a Flow server? Asked once, of this page's own host.
async function liveProbe() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return false;
    try { const res = await fetch('api/live'); const out = res.ok ? await res.json() : {}; state.liveServer = out.live === true; }
    catch (e) { state.liveServer = false; }
    $('liveMenu').hidden = !state.liveServer;
    return state.liveServer;
}
const liveName = () => { try { return localStorage.getItem(LIVE_NAME) || ''; } catch (e) { return ''; } };
function liveLink(L, token) { return location.origin + location.pathname + '#' + LIVE_MARK + L.room + '~' + L.keyText + '~' + token; }

function liveState(room, keyText, key, token) {
    const me = 'c' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => (n % 36).toString(36)).join('');
    return { room, keyText, key, token, role: 'view', seq: 0, snapSeq: 0, me, n: 0, pending: [], touched: false, peers: new Map(), stop: null, sending: Promise.resolve(), tokens: {}, status: 'joining', name: liveName(), colour: LIVE_COLOURS[parseInt(me.slice(1, 4), 36) % LIVE_COLOURS.length] };
}
function liveRemember(L) {
    try { sessionStorage.setItem(LIVE_STORE, JSON.stringify({ room: L.room, key: L.keyText, token: L.token, tokens: L.tokens })); } catch (e) { /* no storage: the room is lost on reload */ }
}

// Start a room from the workflow that is open. -> the room's state.
async function liveCreate(name) {
    if (state.live) return state.live;
    try { localStorage.setItem(LIVE_NAME, name || ''); } catch (e) { /* no storage */ }
    const keyText = b64url(crypto.getRandomValues(new Uint8Array(32))), key = await liveKey(keyText);
    const made = await liveCall(null, 'POST', '', { snapshot: await liveSeal(key, fileEnvelope(state.doc)) });
    const L = liveState(made.id, keyText, key, made.owner);
    L.role = 'owner'; L.tokens = { view: made.view, edit: made.edit, owner: made.owner }; L.status = 'live';
    // A room's workflow belongs to the room, not to a card in this browser.
    flushCard(); setCard('');
    state.live = L;
    liveRemember(L);
    liveFollow(L);
    render();
    return L;
}
// Join a room from its link's parts. The workflow that was open is kept
// first if it had anything in it, since the room's takes its place.
async function liveJoin(room, keyText, token, tokens) {
    if (state.live) liveLeave();
    const key = await liveKey(keyText), L = liveState(room, keyText, key, token);
    const got = await liveCall(L, 'GET', '/' + room);
    const env = await liveUnseal(key, got.snapshot);
    const res = openFileText(JSON.stringify(env));
    if (res.error) throw new Error(res.error);
    if (!state.cardId && !state.readOnly && KINDS.some((k) => state.doc[k].length)) await keepWorkflow();
    await flushCard(); setCard('');
    L.role = got.role; L.seq = got.snapSeq; L.snapSeq = got.snapSeq; L.status = 'live';
    L.tokens = tokens || { [got.role]: token };
    state.live = L;
    loadDoc(res.doc, got.role === 'view');
    for (const b of got.ops) await liveTake(L, b, true);
    liveRemember(L);
    liveFollow(L);
    render(); fitBoard();
    return L;
}
function liveLeave() {
    const L = state.live;
    if (!L) return;
    if (L.stop) L.stop.abort();
    state.live = null;
    try { sessionStorage.removeItem(LIVE_STORE); } catch (e) { /* no storage */ }
    // What is open stays open, as this browser's own copy; a viewer may now change it.
    if (state.readOnly) { state.readOnly = false; clearHistory(); }
    render();
}

// ---- Sending ----
// Every saved change in a room goes out, in the order it was made.
function liveSend(ops) {
    const L = state.live;
    if (!L || L.role === 'view' || !ops || !ops.length) return;
    const batch = { n: ++L.n, ops: cloneData(ops) };
    L.pending.push(batch);
    L.sending = L.sending.then(async () => {
        const data = await liveSeal(L.key, batch.ops);
        for (let wait = 400; state.live === L; wait = Math.min(wait * 2, 8000)) {
            try { await liveCall(L, 'POST', '/' + L.room + '/ops', { by: L.me, n: batch.n, data }); L.status = 'live'; return; }
            catch (e) {
                // Refused for good (the room is gone, the link cannot change it): stop trying.
                if (e.status && e.status < 500 && e.status !== 429) { L.status = 'refused'; L.pending = L.pending.filter((p) => p !== batch); render({ typing: true }); return; }
                L.status = 'offline'; render({ typing: true });
                await new Promise((r) => setTimeout(r, wait));
            }
        }
    });
}

// ---- Receiving ----
// One batch from the server, in its place. Mine comes back too: by then
// someone else's may have been applied over what I did, so mine and all I
// have done since are applied again, in order, and the server's order stands.
async function liveTake(L, b, quiet) {
    if (state.live !== L && !quiet) return;
    if (b.seq <= L.seq) return;
    if (b.seq !== L.seq + 1) throw new Error('gap');
    L.seq = b.seq;
    if (b.by === L.me) {
        const i = L.pending.findIndex((p) => p.n === b.n);
        if (i >= 0) {
            const again = L.touched ? L.pending.slice(i) : [];
            L.pending.splice(0, i + 1);
            if (again.length) { again.forEach((p) => p.ops.forEach((op) => applyOp(state.doc, op))); liveShow(quiet); }
            if (!L.pending.length) L.touched = false;
        }
    } else {
        const ops = await liveUnseal(L.key, b.data);
        if (Array.isArray(ops)) ops.forEach((op) => applyOp(state.doc, op));
        if (L.pending.length) L.touched = true;
        liveShow(quiet);
    }
    // Now and then someone who can change the room sends a fresh snapshot, so
    // the log stays short and joining stays quick.
    if (!quiet && L.role !== 'view' && !L.pending.length && L.seq - L.snapSeq >= SNAPSHOT_EVERY) {
        const at = L.seq; L.snapSeq = at;
        liveSeal(L.key, fileEnvelope(state.doc)).then((data) => liveCall(L, 'POST', '/' + L.room + '/snapshot', { seq: at, data })).catch(() => {});
    }
}
// The workflow changed by someone else: this browser's copy and the page
// follow. Not an undo step here, and not sent on.
function liveShow(quiet) {
    if (quiet) return;
    dropMissingSelection();
    state.seq++;
    keep();
    // Someone typing in a field keeps their field.
    const a = document.activeElement, typing = !!a && $('railProps').contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'checkbox'));
    render({ typing });
}

// The room's stream: read with fetch, so the token goes in a header and not
// in an address. Comes back by itself when the connection drops.
async function liveFollow(L) {
    for (let wait = 500; state.live === L; wait = Math.min(wait * 2, 8000)) {
        L.stop = new AbortController();
        try {
            const res = await fetch(`api/rooms/${L.room}/events?by=${L.me}&after=${L.seq}`, { headers: { Authorization: 'Bearer ' + L.token }, signal: L.stop.signal });
            if (res.status === 404 || res.status === 403) { L.status = 'gone'; render({ typing: true }); return; }
            if (!res.ok || !res.body) throw new Error('stream');
            const reader = res.body.getReader(), dec = new TextDecoder();
            let buf = '', kind = '';
            wait = 500;
            for (;;) {
                const { value, done } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                let at;
                while ((at = buf.indexOf('\n')) >= 0) {
                    const line = buf.slice(0, at); buf = buf.slice(at + 1);
                    if (line.startsWith('event: ')) kind = line.slice(7);
                    else if (line.startsWith('data: ')) await liveEvent(L, kind, JSON.parse(line.slice(6)));
                }
            }
        } catch (e) {
            if (state.live !== L) return;
            if (e && e.message === 'rejoin') { const { room, keyText, token, tokens } = L; state.live = null; try { await liveJoin(room, keyText, token, tokens); } catch (err) { /* the next try is the visitor's */ } return; }
        }
        if (state.live !== L) return;
        L.status = 'offline'; render({ typing: true });
        await new Promise((r) => setTimeout(r, wait));
    }
}
async function liveEvent(L, kind, b) {
    if (state.live !== L) return;
    if (kind === 'hello') { if (L.status !== 'live') { L.status = 'live'; render({ typing: true }); } livePresenceSoon(true); return; }
    if (kind === 'reset') throw new Error('rejoin');
    if (kind === 'op') { try { await liveTake(L, b); } catch (e) { throw new Error('rejoin'); } return; }
    if (kind === 'gone') { if (L.peers.delete(b.by)) { drawSoon(); liveTag(); } return; }
    if (kind === 'presence') {
        try { const p = await liveUnseal(L.key, b.data); const isNew = !L.peers.has(b.by); L.peers.set(b.by, Object.assign(p, { at: Date.now() })); drawSoon(); if (isNew) { liveTag(); livePresenceSoon(true); } }
        catch (e) { /* not sealed with this room's key: ignored */ }
    }
}

// ---- Presence: who is here, and where they point ----
let _presenceTimer = null, _presenceLast = '', _pointer = null;
function livePresenceSoon(force) {
    const L = state.live;
    if (!L || L.status !== 'live') return;
    if (force) _presenceLast = '';
    if (_presenceTimer) return;
    _presenceTimer = setTimeout(async () => {
        _presenceTimer = null;
        if (state.live !== L) return;
        const p = { name: L.name, colour: L.colour, x: _pointer ? Math.round(_pointer.x) : null, y: _pointer ? Math.round(_pointer.y) : null, view: state.view, sel: Array.from(state.selection).slice(0, 20).map((e) => e.id) };
        const text = JSON.stringify(p);
        if (text === _presenceLast) return;
        _presenceLast = text;
        try { await liveCall(L, 'POST', '/' + L.room + '/presence', { by: L.me, data: await liveSeal(L.key, p) }); } catch (e) { /* presence is not worth a retry */ }
    }, PRESENCE_MS);
}
// The others' pointers and selections, drawn over the board in their colours.
function presenceSvg(u) {
    const L = state.live;
    if (!L || !L.peers.size) return '';
    const doc = state.doc, now = Date.now();
    let s = '';
    L.peers.forEach((p, by) => {
        if (now - p.at > PEER_STALE_MS) { L.peers.delete(by); return; }
        if (p.view !== state.view) return;
        const colour = /^#[0-9a-f]{6}$/i.test(p.colour) ? p.colour : '#2563eb';
        (Array.isArray(p.sel) ? p.sel : []).forEach((id) => {
            const rec = typeof id === 'string' ? recOf(doc, id) : null;
            if (!rec) return;
            let box = null;
            if (isStopId(id)) box = boxOfStop(rec);
            else if (kindOfId(id) === 'elements' && state.view !== 'flow') { const at = placeOf(rec); if (at && at.shown) box = { x: at.x + rec.x, y: at.y + rec.y, w: rec.w, h: rec.h }; }
            if (box) s += `<rect x="${n1(box.x - 3 * u)}" y="${n1(box.y - 3 * u)}" width="${n1(box.w + 6 * u)}" height="${n1(box.h + 6 * u)}" rx="${n1(4 * u)}" fill="none" stroke="${colour}" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
        });
        if (typeof p.x !== 'number' || typeof p.y !== 'number') return;
        const name = String(p.name || '').slice(0, 24) || '?', w = textWidth(name, 11, 600) * u + 12 * u;
        s += `<g class="peer" data-peer="${esc(by)}" transform="translate(${p.x} ${p.y})" pointer-events="none">`
            + `<path d="M0 0 L0 ${n1(16 * u)} L${n1(4.5 * u)} ${n1(12 * u)} L${n1(8 * u)} ${n1(19 * u)} L${n1(10.5 * u)} ${n1(17.5 * u)} L${n1(7 * u)} ${n1(11 * u)} L${n1(12.5 * u)} ${n1(11 * u)} Z" fill="${colour}" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke"/>`
            + `<rect x="${n1(12 * u)}" y="${n1(16 * u)}" width="${n1(w)}" height="${n1(18 * u)}" rx="${n1(9 * u)}" fill="${colour}"/>`
            + `<text x="${n1(18 * u)}" y="${n1(25 * u)}" font-family='${FONT}' font-size="${n1(11 * u)}" font-weight="600" fill="#ffffff" dominant-baseline="central">${esc(name)}</text></g>`;
    });
    return s;
}

// ---- On the page ----
function liveTag() {
    const L = state.live, tag = $('liveTag');
    tag.hidden = !L;
    if (!L) return;
    const n = L.peers.size + 1;
    tag.textContent = L.status === 'live' ? tr('Live · {n}', { n }) : L.status === 'offline' ? tr('Live · reconnecting…') : L.status === 'gone' ? tr('Live · the room is gone') : L.status === 'refused' ? tr('Live · not sent') : tr('Live · joining…');
    tag.className = 'live-tag ' + L.status;
}
function renderLive() {
    liveTag();
    const dlg = $('liveDlg');
    if (!dlg.open) return;
    const L = state.live, box = $('liveBody');
    if (!L) {
        box.innerHTML = `<p class="pf-note">Start a room and send its link: everyone with the link works on this workflow at once. It is encrypted in each browser with a key that is in the link and never sent to the server.</p>`
            + `<label class="pf"><span class="pf-l">Your name, for the others</span><input class="input" type="text" id="liveNameIn" maxlength="24" value="${esc(liveName())}" data-raw autocomplete="off"></label>`
            + `<p id="liveMsg" class="pf-note dlg-msg" role="status" aria-live="polite"></p>`
            + `<div class="dlg-foot"><button type="button" class="btn btn-primary sm" data-act="live-start">Start a live room</button><button type="button" class="btn btn-ghost sm" data-act="dlg-close" data-dlg="liveDlg">Close</button></div>`;
    } else {
        const row = (label, token) => (token ? `<label class="pf"><span class="pf-l">${label}</span><input class="input link-out" type="text" readonly data-raw value="${esc(liveLink(L, token))}"></label>` : '');
        const peers = [`<li><span class="peer-dot" style="background:${L.colour}"></span>${esc(L.name || tr('You'))} <span class="dim" data-tr>you</span></li>`]
            .concat(Array.from(L.peers.values()).map((p) => `<li><span class="peer-dot" style="background:${/^#[0-9a-f]{6}$/i.test(p.colour) ? p.colour : '#2563eb'}"></span>${esc(String(p.name || '?').slice(0, 24))}</li>`));
        box.innerHTML = `<p class="pf-note" data-raw>${esc(L.role === 'view' ? tr('You are following this room. Your link can look but not change.') : tr('You are in a live room. Every change is shared as you make it.'))}</p>`
            + `<div class="pf-head">Here now</div><ul class="peer-list">${peers.join('')}</ul>`
            + row('A link that can change it', L.tokens.edit) + row('A link that can only look', L.tokens.view)
            + '<p class="pf-note">Whoever has a link has the workflow. Send it the way you would send the file.</p>'
            + `<p id="liveMsg" class="pf-note dlg-msg" role="status" aria-live="polite"></p>`
            + `<div class="dlg-foot"><button type="button" class="btn btn-ghost sm" data-act="live-leave">Leave the room</button>`
            + (L.role === 'owner' ? '<button type="button" class="btn btn-ghost sm danger" data-act="live-end">End the room for everyone</button>' : '')
            + '<button type="button" class="btn btn-ghost sm" data-act="dlg-close" data-dlg="liveDlg">Close</button></div>';
    }
    translateChrome(box);
}
async function liveAct(act) {
    const msg = $('liveMsg'), fail = (e) => { if (msg) { msg.textContent = tr((e && e.message) || 'That did not work.'); msg.classList.add('bad'); } };
    try {
        if (act === 'live-start') { if (msg) msg.textContent = tr('Working…'); await liveCreate(($('liveNameIn').value || '').trim()); }
        else if (act === 'live-leave') liveLeave();
        else if (act === 'live-end') { const L = state.live; if (!state.liveSure) { state.liveSure = true; document.querySelector('[data-act="live-end"]').textContent = tr('End it for good'); return; } await liveCall(L, 'DELETE', '/' + L.room); liveLeave(); }
        state.liveSure = false;
        renderLive();
    } catch (e) { fail(e); }
}

// A room's link in the address bar is taken out of it at once, like a sealed
// link: it is the key to the room and should not sit in the history.
function takeRoomFromAddress() {
    if (!location.hash.startsWith('#' + LIVE_MARK)) return null;
    const [room, key, token] = location.hash.slice(1 + LIVE_MARK.length).split('~');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* a file: page keeps its address */ }
    return room && key && token ? { room, key, token } : null;
}
// At start: join the room in the link, or the one this tab was in before a reload.
async function liveBoot() {
    const fromLink = takeRoomFromAddress();
    state.opSinks.push(liveSend);
    $('board').addEventListener('pointermove', (ev) => { if (state.live) { _pointer = boardPoint(ev); livePresenceSoon(); } });
    $('board').addEventListener('pointerleave', () => { if (state.live) { _pointer = null; livePresenceSoon(); } });
    setInterval(() => { const L = state.live; if (L && L.peers.size) { const n = L.peers.size; presenceSvg(1); if (L.peers.size !== n) { drawBoard(); liveTag(); } } }, 4000);
    if (!await liveProbe()) return;
    let want = fromLink;
    if (!want) { try { const kept = JSON.parse(sessionStorage.getItem(LIVE_STORE) || 'null'); if (kept) want = kept; } catch (e) { /* nothing kept */ } }
    if (!want) return;
    try { await liveJoin(want.room, want.key, want.token, want.tokens); say(state.live.role === 'view' ? 'You are following a live room.' : 'You are in a live room.'); }
    catch (e) { try { sessionStorage.removeItem(LIVE_STORE); } catch (err) { /* no storage */ } say(e.status === 404 ? 'That room is not there, or the link is not right.' : 'The live room could not be opened.', true); }
}
