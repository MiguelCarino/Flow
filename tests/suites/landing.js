// The landing page, the sample it offers, the ✕ on what is selected, and a
// selected link's colour.
suite(async (ok, eq) => {
    const landing = document.getElementById('landing'), board = document.getElementById('board');
    const visible = (el) => el.offsetParent !== null;
    const setAddress = (tail) => history.replaceState(null, '', location.pathname + tail);

    // ---- where a visit starts ----
    const at = (tail) => { setAddress(tail); return landingAtStart(); };
    eq('a bare address opens on the landing page; a link that says where it is going does not', [at(''), at('?lang=es'), at('#editor'), at('?simple'), at('?full'), at('#e~abc'), at('#r~room~key~token')], [true, true, false, false, false, false, false]);
    setAddress('');

    showLanding(true);
    ok('the landing page covers the editor', !landing.hidden && landing.getBoundingClientRect().height > 300 && landing.getBoundingClientRect().width === innerWidth && document.body.classList.contains('on-landing') && getComputedStyle(landing).position === 'fixed');
    ok('it says what Flow is; where it runs is said in About, not again here', /Every screen, and every way between them/.test(landing.textContent) && !/no server, no upload, no account/.test(landing.textContent));
    ok('the editor\'s controls are out of the bar meanwhile', !visible(document.getElementById('undoBtn')) && !visible(document.getElementById('fileMenuBtn')));
    eq('the ways in: a new workflow, a file, the example', Array.from(landing.querySelectorAll('.landing-ways [data-act], .landing-chips [data-act]')).map((b) => b.dataset.act), ['landing-new', 'open', 'example']);
    ok('there is no Start drawing or Continue button, and no Your workflows popup', !document.getElementById('landingGo') && !landing.querySelector('[data-act="lib"]') && !document.getElementById('libDlg') && !/Continue your workflow/.test(landing.textContent));
    const mark = landing.querySelector('.landing-mark'), img = mark.querySelector('img.mk-gold').getBoundingClientRect(), runLine = mark.querySelector('.flowline').getBoundingClientRect();
    ok('the mark is centred, with its animation under it', Math.abs((img.left + img.right) / 2 - innerWidth / 2) < 2 && Math.abs((runLine.left + runLine.right) / 2 - innerWidth / 2) < 2 && runLine.top >= img.bottom, `mark ${img.left}-${img.right}, line ${runLine.left}-${runLine.right} top ${runLine.top}, mark bottom ${img.bottom}, window ${innerWidth}`);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    ok('the editor\'s keys do nothing under it', state.selection.size === 0);

    enterEditor();
    eq('going in puts the editor in the address', [state.landing, landing.hidden, location.hash, visible(document.getElementById('undoBtn'))], [false, true, '#editor', true]);
    ok('a reload from there stays in the editor', landingAtStart() === false);
    addScreen('phone'); setF(state.doc.screens[0].id, 'name', 'Home');
    change({ op: 'set', kind: 'doc', id: '', field: 'name', value: 'My app' });
    document.querySelector('[data-act="home"]').click();
    await new Promise((r) => setTimeout(r, 300));
    const draft = landing.querySelector('.landing-card.draft');
    eq('File, All workflows goes back to the start page, with the address bare', [state.landing, location.hash], [true, '']);
    ok('what is open and not kept is the first card, and says so', !!draft && /My app/.test(draft.textContent) && /1 screen/.test(draft.textContent) && /not kept/.test(draft.textContent) && !!draft.querySelector('[data-act="lib-keep"]'));
    setLocale('es'); render();
    await new Promise((r) => setTimeout(r, 300));
    ok('the landing page is in Flow\'s language', /Cada pantalla, y cada camino entre ellas/.test(landing.textContent) && /sin guardar/.test(landing.querySelector('.landing-card.draft').textContent));
    setLocale('en'); render();
    landing.querySelector('.landing-card.draft [data-act="enter"]').click();
    eq('a press on that card goes back in', [state.landing, state.doc.name], [false, 'My app']);
    setAddress(''); showLanding(true);

    // ---- the sample ----
    landing.querySelector('[data-act="example"]').click();
    const doc = state.doc;
    eq('Open the example loads the sample and goes in', [state.landing, doc.name, location.hash], [false, 'Shop', '#editor']);
    eq('a shop from both sides: the customer to the receipt, the staff in the back office', [doc.screens.map((s) => s.name).sort(), doc.decisions.map((d) => d.name).sort(), doc.links.length], [['Cart', 'Order', 'Orders', 'Packing slip', 'Payment declined', 'Product', 'Products', 'Receipt', 'Refund', 'Reset password', 'Sign in'], ['Is everything in stock?', 'Is the card accepted?', 'Is the password right?', 'Who signed in?'], 19]);
    const desktop = doc.sizes.filter((z) => z.name === 'Desktop');
    const only = doc.screens.filter((s) => sizesOf(doc, s.id).every((z) => z.name === 'Desktop')).map((s) => s.name).sort();
    eq('the customer\'s main screens are drawn for a desktop too, used with a mouse', [desktop.map((z) => recOf(doc, z.screen).name).filter((n) => !only.includes(n)).sort(), desktop.every((z) => z.w === 1920 && z.h === 1080 && z.input === 'pointer')], [['Cart', 'Product', 'Products', 'Receipt', 'Sign in'], true]);
    eq('the back office is desktop windows only', only, ['Order', 'Orders', 'Packing slip', 'Refund']);
    ok('one of them takes a dropped file', doc.elements.some((e) => e.type === 'dropzone' && recOf(doc, recOf(doc, e.size).screen).name === 'Refund'));
    ok('with something on each desktop drawing', desktop.every((z) => elementsOf(doc, z.id).length >= 2));
    eq('it has nothing for the checks to report', findFindings(doc).map((f) => f.text), []);
    eq('every screen can be reached and the workflow has its ways through', [testCases(doc).map((c) => c.name), findPaths(doc, doc.screens.find((s) => s.start).id, doc.screens.find((s) => s.end).id).length], [['Sign in to Receipt', 'Sign in to Packing slip'], 1]);
    ok('it uses two sources, and keys for a dictionary', doc.sources.length === 2 && keysInUse(doc).size >= 5);
    const signIn = doc.screens.find((s) => s.name === 'Sign in');
    showSize(sizesOf(doc, signIn.id)[1].id);
    ok('the desktop drawing shows when its size is chosen', board.querySelector(`.screen[data-id="${signIn.id}"] .frame`).getAttribute('width') === '1920' && findFindings(doc).length === 0);
    showSize(sizesOf(doc, signIn.id)[0].id);
    undo();
    eq('one undo brings back what was open before the sample', state.doc.name, 'My app');
    redo(); fitBoard();

    // ---- the ✕ on what is selected ----
    const d = state.doc, q = (sel) => board.querySelector(sel);
    const press = (target) => { pointer('pointerdown', target, target); pointer('pointerup', board, target); };
    const receipt = d.screens.find((s) => s.name === 'Receipt'), thanks = d.elements.find((e) => e.text === 'Thank you');
    ok('nothing selected, no ✕', !q('.node-delete'));
    selectId(thanks.id);
    const disc = () => q('.sel-layer .node-delete');
    ok('a selected element has a ✕: a red disc in a white ring, as on Topo\'s map', !!disc() && disc().querySelector('circle').getAttribute('fill') === '#dc2626' && disc().querySelector('circle').getAttribute('stroke') === '#ffffff' && disc().querySelector('text').textContent === '✕');
    const sent = []; state.opSinks.push((ops) => sent.push(ops));
    press(disc());
    eq('a press on it deletes the element, as one step', [!!recOf(d, thanks.id), state.selection.size, sent.length], [false, 0, 1]);
    undo();
    for (const [what, id] of [['a screen', receipt.id], ['a decision', d.decisions[0].id], ['a link', d.links[0].id]]) {
        selectId(id);
        ok(`${what} has one too`, board.querySelectorAll('.sel-layer .node-delete').length === 1);
    }
    const linksWere = d.links.length, firstLink = d.links[0].id;
    selectId(firstLink); press(disc());
    ok('on a link it deletes the link', !recOf(d, firstLink) && d.links.length === linksWere - 1);
    undo();
    selectId(receipt.id); press(disc());
    ok('on a screen it deletes the screen and what hung off it', !recOf(d, receipt.id) && !recOf(d, thanks.id));
    undo();
    setSelection([selEntry('elements', thanks.id), selEntry('screens', d.screens.find((s) => s.name === 'Product').id)]); render();
    eq('with several selected, each has one', board.querySelectorAll('.sel-layer .node-delete').length, 2);
    const n = d.screens.length;
    press(disc());
    ok('and any of them deletes all that is selected', d.screens.length === n - 1 && !recOf(d, thanks.id));
    undo();
    state.readOnly = true; selectId(receipt.id);
    ok('a workflow open to read only has no ✕', !q('.node-delete'));
    state.readOnly = false; render();
    setView('flow'); selectId(receipt.id);
    ok('the flow view has it too', board.querySelectorAll('.sel-layer .node-delete').length === 1);
    setView('board');

    // ---- a link's colour ----
    const first = d.links.find((l) => l.kind === 'action'), line = (l) => q(`.link[data-id="${l.id}"] path[stroke]:not([stroke-opacity])`);
    selectId('');
    const stroke = () => getComputedStyle(line(first)).stroke;
    eq('a link is slate on the light board', stroke(), 'rgb(51, 65, 85)');
    const inks = {};
    ['dark', 'blue', 'pcb'].forEach((ink) => { setBoardInk(ink); inks[ink] = stroke(); });
    eq('and takes each background\'s own light ink', inks, { dark: 'rgb(250, 250, 250)', blue: 'rgb(255, 255, 255)', pcb: 'rgb(236, 253, 243)' });
    selectId(first.id);
    const gold = 'rgb(234, 179, 8)', selected = {};
    ['', 'dark', 'blue', 'pcb'].forEach((ink) => { setBoardInk(ink); selected[ink || 'light'] = [stroke(), getComputedStyle(q(`.link[data-id="${first.id}"] polygon`)).fill]; });
    eq('selected, it is Topo\'s gold on every background, line and arrow', selected, { light: [gold, gold], dark: [gold, gold], blue: [gold, gold], pcb: [gold, gold] });
    setBoardInk('');
    selectId('');
    state.walk = { from: d.screens.find((s) => s.start).id, to: d.screens.find((s) => s.end).id, pick: 0 }; render();
    ok('a way marked in Walk is gold too', getComputedStyle(board.querySelector('.link.marked path[stroke]:not([stroke-opacity])')).stroke === gold);
    ok('a picture keeps the plain colours', (() => { state.walk.pick = -1; const svg = svgOfStops(exportStops('all'), 'board'); return !/#eab308|node-delete/.test(svg); })());
});
