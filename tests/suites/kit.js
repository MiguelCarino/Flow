// The kit: every element type draws, and the templates lay out a screen.
suite(async (ok, eq) => {
    // 'block' is a placing of a block, not something in the kit's list (tests/suites/blocks.js).
    const TYPES = ELEMENT_TYPES.filter((t) => t !== 'block');
    const board = document.getElementById('board');
    eq('the kit has an entry for every type, and no other', Object.keys(ELEMENT_KIT).sort(), ELEMENT_TYPES.slice().sort());
    ok('a block is not added like the others', addElement('block') === '');
    eq('twenty-six elements', TYPES.length, 26);
    eq('the Add list offers each one', Array.from(document.querySelectorAll('#palette [data-act="add-el"]')).map((b) => b.dataset.type).sort(), TYPES.slice().sort());
    ok('every element is in a group that is shown', TYPES.map((t) => ELEMENT_KIT[t]).every((k) => ELEMENT_GROUPS.some(([g]) => g === k.group)));

    const screen = addScreen('phone');
    TYPES.forEach((type) => { selectId(screen); addElement(type); });
    eq('each can be added', state.doc.elements.map((e) => e.type).sort(), TYPES.slice().sort());
    const drawn = Array.from(board.querySelectorAll('.el'));
    eq('and each is drawn', drawn.length, 26);
    ok('with no broken number in the drawing', !/NaN|undefined|Infinity/.test(board.innerHTML));
    ok('each has something to press on', drawn.every((g) => { const b = g.getBoundingClientRect(); return b.width > 0 && b.height > 0; }));
    ok('nothing is drawn with foreignObject', !board.querySelector('foreignObject'));
    const top = state.doc.elements.find((e) => e.type === 'topbar'), tab = state.doc.elements.find((e) => e.type === 'tabbar');
    eq('a top bar spans the top and stretches', [top.x, top.y, top.w, top.pinH], [0, 0, 390, 'both']);
    eq('a tab bar sits at the bottom and stays there', [tab.x, tab.y + tab.h, tab.w, tab.pinV], [0, 844, 390, 'bottom']);

    // States and amounts show.
    const toggle = state.doc.elements.find((e) => e.type === 'toggle'), g = () => board.querySelector(`.el[data-id="${toggle.id}"]`).innerHTML;
    const off = g(); setF(toggle.id, 'on', true);
    ok('a toggle shown as on is drawn differently', g() !== off);
    const bar = state.doc.elements.find((e) => e.type === 'progress');
    setF(bar.id, 'value', 25);
    eq('a progress bar is filled to its value', board.querySelectorAll(`.el[data-id="${bar.id}"] rect`)[1].getAttribute('width'), String(bar.w * 0.25));
    selectId(toggle.id);
    ok('the rail offers the state', !!document.querySelector('#railProps [data-f="on"]') && !document.querySelector('#railProps [data-f="value"]'));
    const table = state.doc.elements.find((e) => e.type === 'table');
    eq('a table draws a cell per | and a row per line', board.querySelectorAll(`.el[data-id="${table.id}"] text`).length, 6);
    setF(table.id, 'text', '');
    ok('an element with no text still draws', !/NaN/.test(board.innerHTML) && !!board.querySelector(`.el[data-id="${table.id}"]`));

    // ---- templates ----
    eq('the templates are offered', Array.from(document.getElementById('addTemplate').options).map((o) => o.value), SCREEN_TEMPLATES.map((t) => t.key));
    SCREEN_TEMPLATES.forEach((t) => SIZE_PRESETS.forEach((p) => {
        const els = t.build(p.w, p.h).map((e, i) => readRec('elements', Object.assign({ id: 'el_t' + i, size: 'siz_t1' }, e)));
        const out = els.filter((e) => e.x < 0 || e.x + e.w > p.w || e.w < 8);
        if (p.key !== 'watch') eq(`${t.name} fits across a ${p.name}`, out.map((e) => e.type), []);
    }));
    const n = state.doc.elements.length;
    const id = addScreen('laptop', 'signin');
    eq('a screen from a template is named after it and comes laid out', [recOf(state.doc, id).name, state.doc.elements.length - n], ['Sign in', 5]);
    eq('with nothing to report but that nothing leads to it', findFindings(state.doc).filter((f) => f.id === id).map((f) => f.key.split(':')[0]).sort(), ['dead-end', 'unreached']);
    undo();
    eq('as one step', [state.doc.elements.length, !!recOf(state.doc, id)], [n, false]);
});
