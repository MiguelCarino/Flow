// The document: ids, what a value is allowed to be, and that the same content
// always serializes to the same bytes.
suite(async (ok, eq) => {
    // ---- ids ----
    const a = nextId('screens'), b = nextId('screens');
    ok('an id carries its list prefix', /^scr_[a-z0-9]+$/.test(a), a);
    ok('two ids differ', a !== b);
    eq('the list is read from the id', [kindOfId(a), kindOfId('el_1a'), kindOfId('nope'), kindOfId('')], ['screens', 'elements', '', '']);
    eq('fixed ids are predictable', withFixedIds(() => [nextId('links'), nextId('sizes')]), ['lnk_10', 'siz_11']);

    // ---- fields ----
    const r = readRec('elements', { id: 'el_a1', size: 'siz_a1', type: 'nonsense', w: 0, h: '12', fs: 9999, text: 5, x: null, extra: 1 });
    eq('an unknown type becomes the first one', r.type, 'box');
    eq('a size below 1 becomes 1', r.w, 1);
    eq('a number typed as text counts', r.h, 12);
    eq('a number is held within its range', r.fs, 400);
    eq('text that is not text is empty', r.text, '');
    eq('null is absent, not zero', r.x, 0);
    ok('a field the format does not have is dropped', !('extra' in r));
    eq('a file holds only what differs from the usual', writeRec('elements', r), { id: 'el_a1', size: 'siz_a1', w: 1, h: 12, fs: 400 });

    // ---- a whole document ----
    const raw = {
        v: 1, name: 'T',
        screens: [{ id: 'scr_a1', name: 'A' }, { id: 'scr_a1', name: 'twice' }, { id: 'bad id' }, { id: 'el_zz', name: 'wrong list' }, null, { id: 'scr_b2', name: 'B' }],
        sizes: [{ id: 'siz_a1', screen: 'scr_a1' }, { id: 'siz_orphan', screen: 'scr_gone' }],
        elements: [{ id: 'el_a1', size: 'siz_a1' }, { id: 'el_lost', size: 'siz_orphan' }],
        decisions: [{ id: 'dec_a1' }],
        links: [{ id: 'lnk_a1', from: 'scr_a1', to: 'dec_a1', fromEl: 'el_gone', source: 'src_gone' }, { id: 'lnk_b1', from: 'scr_a1', to: 'scr_gone' }],
        sources: [{ id: 'src_a1', url: 'javascript:alert(1)' }]
    };
    const doc = normalizeDoc(raw);
    eq('an id used twice, a bad id and an id of another list are dropped', doc.screens.map((s) => s.id), ['scr_a1', 'scr_b2']);
    eq('a size with no screen is dropped; a screen with no size gets one', doc.sizes.map((s) => s.screen).sort(), ['scr_a1', 'scr_b2']);
    eq('an element with no size is dropped', doc.elements.map((e) => e.id), ['el_a1']);
    eq('a link to a stop that is not there is dropped', doc.links.map((l) => l.id), ['lnk_a1']);
    eq('a link keeps no element or source that is not there', [doc.links[0].fromEl, doc.links[0].source], ['', '']);
    eq('an address that is not http(s) is not kept', doc.sources[0].url, '');

    const once = JSON.stringify(serializeDoc(doc));
    const shuffled = cloneData(serializeDoc(doc));
    KINDS.forEach((k) => shuffled[k].reverse());
    eq('the same content is the same bytes, whatever order it arrived in', JSON.stringify(serializeDoc(normalizeDoc(shuffled))), once);
    eq('reading what was written changes nothing', JSON.stringify(serializeDoc(normalizeDoc(JSON.parse(once)))), once);

    // ---- geometry ----
    const box = { x: 0, y: 0, w: 100, h: 50 };
    eq('a line leaves a box on its edge', edgePoint(box, 500, 25), { x: 100, y: 25 });
    eq('a line leaves a diamond on its corner', edgePoint(Object.assign({ diamond: true }, box), 50, -500), { x: 50, y: 0 });
    eq('positions snap to the grid', [snap(3), snap(5), snap(-13)], [0, 8, -16]);
});
