// Share links, sealed.
//
// A link carries the workflow in its fragment (after the #), which a browser
// never sends to a server. It is encrypted here first with a passphrase the
// sender chooses and tells the recipient some other way, so the link alone,
// in a chat log or a browser's history, opens nothing.
//
//   #e~<base64url of: 1 byte version | 16 bytes salt | 12 bytes iv | ciphertext>
//
// The key is PBKDF2-SHA-256 of the passphrase; the cipher is AES-GCM. What is
// sealed is the file's JSON, deflated when the browser can.

const SEAL_MARK = 'e~', SEAL_VERSION = 1, SEAL_ROUNDS = 310000, PASS_MIN = 8;
const PUBLIC_BASE = 'https://flow.carino.systems/';
const b64url = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = (s) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
async function pipeBytes(bytes, stream) {
    // A stream that fails says so through what is read; these two would say it again, to nobody.
    const w = stream.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {});
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}
async function sealKey(pass, salt) {
    const raw = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: SEAL_ROUNDS, hash: 'SHA-256' }, raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
// The file's text -> the fragment, without the #.
async function sealText(text, pass) {
    if (String(pass || '').length < PASS_MIN) throw new Error(`The passphrase needs ${PASS_MIN} characters at least.`);
    let body = new TextEncoder().encode(text), packed = 0;
    if (typeof CompressionStream === 'function') { body = await pipeBytes(body, new CompressionStream('deflate-raw')); packed = 1; }
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new Uint8Array(body.length + 1); plain[0] = packed; plain.set(body, 1);
    const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await sealKey(pass, salt), plain));
    const out = new Uint8Array(1 + 16 + 12 + sealed.length);
    out[0] = SEAL_VERSION; out.set(salt, 1); out.set(iv, 17); out.set(sealed, 29);
    return SEAL_MARK + b64url(out);
}
// The fragment -> the file's text. Throws, in words, on a wrong passphrase
// or a link that was cut short.
async function unsealText(fragment, pass) {
    const f = String(fragment || '').replace(/^#/, '');
    if (!f.startsWith(SEAL_MARK)) throw new Error('This is not a sealed Flow link.');
    let bytes;
    try { bytes = unb64url(f.slice(SEAL_MARK.length)); } catch (e) { throw new Error('This link is damaged.'); }
    if (bytes.length < 46) throw new Error('This link was cut short.');
    if (bytes[0] !== SEAL_VERSION) throw new Error('This link was made by a newer Flow.');
    let plain;
    try { plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(17, 29) }, await sealKey(pass, bytes.subarray(1, 17)), bytes.subarray(29))); }
    catch (e) { throw new Error('That passphrase does not open this link, or the link was cut short.'); }
    let body = plain.subarray(1);
    if (plain[0] === 1) body = await pipeBytes(body, new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(body);
}
// Where a link points: this page when it is served over the web, the public
// site when it is opened as a file. Never with the page's own query on it.
function shareBase() {
    return location.protocol === 'http:' || location.protocol === 'https:' ? location.origin + location.pathname : PUBLIC_BASE;
}
// ---- Plain links ----
// The same link without the lock, as Topo's: the workflow, deflated, after
// the #, and the address alone builds it again. Nothing is sent to a server,
// but it is not private: whoever gets the link has the workflow.
//
//   #~<base64url of the file's JSON, deflate-raw>
//   #u~<base64url of the file's JSON>     a browser that cannot deflate
const PLAIN_MARK = '~', RAW_MARK = 'u~';
const isPlainFragment = (f) => { const s = String(f || '').replace(/^#/, ''); return s.startsWith(PLAIN_MARK) || s.startsWith(RAW_MARK); };
async function plainText(text) {
    const bytes = new TextEncoder().encode(text);
    if (typeof CompressionStream !== 'function') return RAW_MARK + b64url(bytes);
    return PLAIN_MARK + b64url(await pipeBytes(bytes, new CompressionStream('deflate-raw')));
}
async function unplainText(fragment) {
    const f = String(fragment || '').replace(/^#/, '');
    if (!isPlainFragment(f)) throw new Error('This is not a Flow link.');
    const raw = f.startsWith(RAW_MARK);
    try {
        const bytes = unb64url(f.slice(raw ? RAW_MARK.length : PLAIN_MARK.length));
        if (!bytes.length) throw new Error('empty');
        return new TextDecoder('utf-8', { fatal: true }).decode(raw ? bytes : await pipeBytes(bytes, new DecompressionStream('deflate-raw')));
    } catch (e) { throw new Error('This link is damaged or was cut short.'); }
}
// plain: without the passphrase (and pass is not read).
async function makeShareLink(what, pass, noSources, simple, plain) {
    const { doc, part, ids } = exportDoc(what, noSources);
    if (!ids.length) throw new Error('There is nothing to share in what you chose.');
    const text = JSON.stringify(fileEnvelope(doc, part));
    // ?simple opens the link in the Simple view: for a client who is to read it.
    return shareBase() + (simple ? '?simple' : '') + '#' + (plain ? await plainText(text) : await sealText(text, pass));
}
// A plain link in the address: taken out of it, and the workflow built from it.
function takePlainFromAddress() {
    if (!isPlainFragment(location.hash) || location.hash.length < 4) return '';
    const frag = location.hash.slice(1);
    try { history.replaceState(null, '', location.pathname + location.search + '#editor'); } catch (e) { /* a file: page cannot; the link stays */ }
    return frag;
}
async function openPlain(fragment) {
    const res = openFileText(await unplainText(fragment));
    if (res.error) throw new Error(res.error);
    openDoc(res.doc, res.readOnly);
    return res;
}
// A sealed link in the address bar: taken out of it at once (so it is not
// left in the history under this page), then opened when the passphrase is given.
let _pendingSeal = '';
function takeSealFromAddress() {
    if (!location.hash.startsWith('#' + SEAL_MARK)) return false;
    _pendingSeal = location.hash.slice(1);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* a file: page cannot; the link stays */ }
    return true;
}
async function openSealed(pass) {
    const text = await unsealText(_pendingSeal, pass);
    const res = openFileText(text);
    if (res.error) throw new Error(res.error);
    _pendingSeal = '';
    openDoc(res.doc, res.readOnly);
    return res;
}
