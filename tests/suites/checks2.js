// The checks on elements: size, text, layout, names and styles.
suite(async (ok, eq) => {
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]).sort();
    const has = (check) => keys().includes(check);
    const of = (id) => findFindings(state.doc).filter((f) => f.id === id).map((f) => f.key.split(':')[0]).sort();

    // ---- every template on every size starts clean of these ----
    SCREEN_TEMPLATES.forEach((t) => ['phone', 'tablet', 'laptop', 'desktop'].forEach((p) => {
        openDoc(newDoc(''), false);
        const id = addScreen(p, t.key); setF(id, 'end', true);
        eq(`${t.name} on a ${p} has nothing to report`, keys(), []);
    }));
    openDoc(newDoc(''), false);
    const phone = addScreen('phone'); setF(phone, 'end', true);
    const size = sizesOf(state.doc, phone)[0];
    const add = (type, fields = {}) => { selectId(phone); const id = addElement(type); batch(() => Object.entries(fields).forEach(([f, v]) => setF(id, f, v))); return id; };
    eq('an element as it is added is big enough to press', ELEMENT_TYPES.filter((t) => ELEMENT_KIT[t].control && Math.min(ELEMENT_KIT[t].w, ELEMENT_KIT[t].h) < 44), []);

    // ---- size ----
    const btn = add('button', { text: 'Save', name: 'Save' });
    eq('a named button of the usual size is fine', of(btn), []);
    setF(btn, 'h', 40);
    eq('under 44 px on a touch screen', of(btn), ['target-touch']);
    setF(size.id, 'input', 'pointer');
    eq('but fine with a mouse', of(btn), []);
    setF(btn, 'h', 20);
    eq('under 24 px is too small for anything', [of(btn), findFindings(state.doc).find((f) => f.id === btn).level], [['target-small'], 'err']);
    setF(size.id, 'input', 'touch'); setF(btn, 'h', 48);
    const txt = add('text', { text: 'Some words', h: 16 });
    ok('what is not pressed has no size to meet', !of(txt).includes('target-small') && !of(txt).includes('target-touch'));
    setF(txt, 'h', 32);

    // ---- layout ----
    const b2 = add('button', { text: 'Cancel', name: 'Cancel' });
    const a = recOf(state.doc, btn);
    setF(b2, 'y', a.y + a.h + 4);
    eq('two targets 4 px apart on a touch screen', of(b2), ['targets-close']);
    ok('and it says how far', /4 px apart/.test(findFindings(state.doc).find((f) => f.id === b2).text));
    setF(size.id, 'input', 'pointer');
    eq('a mouse is exact enough', of(b2), []);
    setF(size.id, 'input', 'touch');
    setF(b2, 'y', a.y + 10);
    eq('two controls on top of each other', of(b2), ['overlap']);
    setF(b2, 'y', a.y + a.h + 16); setF(b2, 'x', a.x + 2);
    eq('an edge 2 px off its neighbour', of(b2), ['near-miss']);
    ok('named by which edge', /left edge .* 2 px off/.test(findFindings(state.doc).find((f) => f.id === b2).text));
    setF(b2, 'x', a.x + 8);
    eq('8 px off is a choice, not a slip', of(b2), []);
    setF(b2, 'x', a.x);

    // ---- text ----
    setF(txt, 'fs', 10);
    eq('text under 12 px', of(txt), ['text-small']);
    setF(txt, 'fs', 16); setF(size.id, 'distance', 'far');
    ok('from across a room, 16 px is small too', of(txt).includes('text-small') && /across a room/.test(findFindings(state.doc).find((f) => f.id === txt).text));
    setF(size.id, 'distance', 'near');
    setF(txt, 'text', 'A sentence that is far too long to sit on one line of this narrow box and so runs over');
    eq('text that does not fit its box', of(txt), ['text-fit']);
    setF(txt, 'h', 120);
    eq('fits once the box is taller', of(txt), []);
    setF(btn, 'text', 'Supercalifragilisticexpialidocious'); setF(btn, 'w', 96);
    ok('one word wider than a button does not fit', of(btn).includes('text-fit'));
    setF(btn, 'w', 320); setF(btn, 'text', 'Save');
    const field = add('input', { text: 'An example of what to type here, written at some length', name: 'Search', w: 120 });
    eq('a hint wider than its field', of(field), ['text-fit']);
    setF(field, 'w', 326); setF(field, 'text', 'Search');
    const fresh = add('button');
    eq('a button that still says Button, with no name', of(fresh), ['placeholder']);
    setF(fresh, 'text', '');
    eq('a button with no text and no name', of(fresh), ['control-unnamed']);
    setF(fresh, 'name', 'Close');
    eq('a name settles it', of(fresh), []);
    removeId(fresh);

    // ---- names ----
    setF(field, 'name', '');
    eq('a field with no label', of(field), ['no-label']);
    setF(field, 'name', 'Search');
    const img = add('image', { text: '' });
    eq('an image that does not say what it shows', of(img), ['image-no-desc']);
    setF(img, 'text', 'The team at work');
    const icon = add('icon');
    eq('an icon on its own is decoration', of(icon), []);
    const other = addScreen('phone'); setF(other, 'end', true);
    const link = addLink(phone, other, icon);
    ok('an icon that leads somewhere needs a name', of(icon).includes('control-unnamed'));
    setF(icon, 'name', 'Menu');
    ok('named, it is fine but small on a touch screen... it is not a control by itself', !of(icon).includes('control-unnamed'));
    removeId(link); removeId(other); setF(phone, 'end', true);

    // ---- styles ----
    const odd = add('text', { text: 'A caption', fs: 17 });
    eq('a text size used once is nothing while there are no styles', of(odd), []);
    const big = addStyle('text');
    eq('with styles in use, it is a stray', of(odd), ['size-once']);
    setF(odd, 'textStyle', big);
    eq('pointing at the style settles it', of(odd), []);
    setF(big, 'fs', 9);
    eq('a style that makes text too small is reported on what uses it', of(odd), ['text-small']);
    setF(big, 'fs', 16);
    const pale = addStyle('color'); setF(pale, 'color', '#cbd5e1');
    setF(btn, 'ink', pale); setF(btn, 'fill', pale);
    const f = findFindings(state.doc).find((x) => x.id === btn && x.key.startsWith('contrast'));
    ok('text the same colour as its background', !!f && f.level === 'err' && /1\.0 to 1/.test(f.text));
    setF(btn, 'fill', '');
    ok('pale text on the usual dark button passes', !of(btn).includes('contrast'));
    setF(txt, 'ink', pale);
    ok('pale text on the white screen does not', of(txt).includes('contrast'));
    setF(txt, 'fs', 28); setF(txt, 'h', 200);
    const dim = addStyle('color'); setF(dim, 'color', '#8a8a8a'); setF(txt, 'ink', dim);
    ok('large text needs less contrast', !of(txt).includes('contrast'));
    setF(txt, 'fs', 16);
    ok('the same grey at reading size does not pass', of(txt).includes('contrast'));
    setF(txt, 'ink', '');

    // ---- languages ----
    setF(btn, 'key', 'form.save'); setF(btn, 'w', 96);
    const de = addLang('de');
    change({ op: 'add', kind: 'words', rec: { id: nextId('words'), lang: de, key: 'form.save', text: 'Änderungen jetzt speichern' } });
    eq('a translation too long for the button is reported for that language', of(btn), ['text-fit-de']);
    ok('and named', /In de, the text of/.test(findFindings(state.doc).find((x) => x.id === btn).text));
    setF(btn, 'w', 326);
    eq('a wider button fits both', of(btn), []);

    // ---- every finding has a heading ----
    const groups = new Set(CHECK_GROUPS.map(([g]) => g));
    setF(btn, 'h', 10); setF(field, 'name', '');
    ok('each is listed under a heading', findFindings(state.doc).every((x) => groups.has(x.group)), JSON.stringify(findFindings(state.doc).filter((x) => !groups.has(x.group))));
    eq('the headings', [checkGroup('target-small'), checkGroup('text-fit-de'), checkGroup('no-label'), checkGroup('dead-end')], ['Size', 'Text', 'Names', 'Flow']);
});
