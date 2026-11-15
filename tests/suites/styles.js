// Styles: named colours and text sizes that elements take their look from.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    eq('a colour is six hex digits, lower case, or the usual one', ['#AABBCC', 'red', '#abc', 5].map((v) => readRec('styles', { id: 'sty_a1', color: v }).color), ['#aabbcc', '#0f172a', '#0f172a', '#0f172a']);
    eq('a weight is one of four', ['700', 600, 450, true].map((v) => readRec('styles', { id: 'sty_a1', weight: v }).weight), [700, 600, 400, 400]);

    loadExample();
    const pay = state.doc.elements.find((e) => e.name === 'Pay'), title = state.doc.elements.find((e) => e.text === 'Your cart');
    const g = (e) => board.querySelector(`.el[data-id="${e.id}"]`);
    const usual = g(pay).querySelector('rect').getAttribute('fill');

    // ---- from the rail ----
    selectId('');
    document.querySelector('#railProps [data-act="add-style"][data-kind="color"]').click();
    document.querySelector('#railProps [data-act="add-style"][data-kind="text"]').click();
    const brand = state.doc.styles.find((y) => y.kind === 'color'), big = state.doc.styles.find((y) => y.kind === 'text');
    eq('a colour and a text style are added, named', [brand.name, big.name], ['Colour 1', 'Text 1']);
    ok('each shows in the rail', !!document.querySelector(`#railProps [data-style="${brand.id}"] input[type="color"]`) && !!document.querySelector(`#railProps [data-style="${big.id}"] [data-f="fs"]`));
    const swatch = document.querySelector(`#railProps [data-id="${brand.id}"][data-f="color"]`);
    swatch.value = '#e11d48'; swatch.dispatchEvent(new Event('input', { bubbles: true }));
    swatch.value = '#be123c'; swatch.dispatchEvent(new Event('input', { bubbles: true }));
    eq('choosing a colour sets it', recOf(state.doc, brand.id).color, '#be123c');
    undo();
    eq('and dragging through colours is one step', recOf(state.doc, brand.id).color, '#0f172a');
    redo();
    setF(big.id, 'fs', 40); setF(big.id, 'weight', '700');

    // ---- an element points at them ----
    selectId(pay.id);
    const fill = document.querySelector('#railProps [data-f="fill"]');
    eq('an element is offered the colours for its fill, not the text styles', Array.from(fill.options).map((o) => o.textContent), ['As usual', 'Colour 1']);
    fill.value = brand.id; fill.dispatchEvent(new Event('change', { bubbles: true }));
    eq('its surface takes the colour', g(pay).querySelector('rect').getAttribute('fill'), '#be123c');
    setF(title.id, 'ink', brand.id); setF(title.id, 'textStyle', big.id);
    const t = g(title).querySelector('text');
    eq('text takes the colour, size and weight', [t.getAttribute('fill'), t.getAttribute('font-size'), t.getAttribute('font-weight')], ['#be123c', '40', '700']);
    selectId(title.id);
    ok('its own text size is no longer offered', !document.querySelector('#railProps [data-f="fs"]'));

    // ---- change once, change everywhere ----
    setF(brand.id, 'color', '#15803d');
    eq('changing the style changes every element that uses it', [g(pay).querySelector('rect').getAttribute('fill'), g(title).querySelector('text').getAttribute('fill')], ['#15803d', '#15803d']);
    selectId('');
    ok('the rail counts who uses it', /Used by 2 elements/.test(document.querySelector(`#railProps [data-style="${brand.id}"]`).textContent));

    // ---- files ----
    const again = openFileText(JSON.stringify(fileEnvelope(state.doc))).doc;
    eq('styles and who uses them are in the file', [again.styles.length, again.elements.find((e) => e.id === pay.id).fill], [2, brand.id]);
    const raw = serializeDoc(state.doc);
    raw.elements.find((e) => e.id === pay.id).fill = big.id;
    raw.elements.find((e) => e.id === title.id).ink = 'sty_gone';
    const fixed = normalizeDoc(raw);
    eq('a fill that is a text style, and a colour that is gone, are cleared on reading', [fixed.elements.find((e) => e.id === pay.id).fill, fixed.elements.find((e) => e.id === title.id).ink], ['', '']);

    // ---- removing ----
    ok('40 px text in a 40 px box is reported as not fitting', findFindings(state.doc).some((f) => f.id === title.id && f.key.startsWith('text-fit')));
    setF(title.id, 'h', 56);
    const text = JSON.stringify(serializeDoc(state.doc));
    removeId(brand.id);
    eq('a removed style is cleared from its elements', [recOf(state.doc, pay.id).fill, recOf(state.doc, title.id).ink, recOf(state.doc, title.id).textStyle], ['', '', big.id]);
    eq('which look as usual again', g(pay).querySelector('rect').getAttribute('fill'), usual);
    undo();
    eq('one undo puts the style and its uses back', JSON.stringify(serializeDoc(state.doc)), text);
    eq('none of this is a finding', findFindings(state.doc).length, 0);
});
