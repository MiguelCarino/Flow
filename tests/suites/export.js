// Export: parts that merge back, pictures, the storyboard, the zip, the copy
// sheet and the report.
suite(async (ok, eq) => {
    loadExample();
    const doc = () => state.doc, by = (name) => doc().screens.find((s) => s.name === name);
    const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = doc().decisions[0];
    const text = () => JSON.stringify(serializeDoc(doc()));
    const read = (blob) => blob.text();

    // ---- what is exported ----
    eq('the whole workflow, in reading order', exportStops('all'), [signIn.id, ask.id, cart.id, receipt.id]);
    eq('nothing selected and nothing marked offers neither', [exportStops('selected'), exportStops('path'), exportStops('screen')], [[], [], []]);
    const pay = doc().elements.find((e) => e.name === 'Pay');
    setSelection([selEntry('elements', pay.id), selEntry('decisions', ask.id)]);
    eq('a selected element counts as its screen', exportStops('selected'), [ask.id, cart.id]);
    eq('one screen only when one screen is meant', exportStops('screen'), []);
    setSelection([selEntry('screens', cart.id)]);
    eq('this screen', exportStops('screen'), [cart.id]);
    state.walk = { from: signIn.id, to: receipt.id, pick: 0 };
    eq('the marked way, in its own order', exportStops('path'), [signIn.id, ask.id, cart.id, receipt.id]);

    // ---- a part ----
    const part = partOfDoc(doc(), [cart.id]);
    eq('a part has its screen, and the stop its link leaves for as a stub', part.screens.map((s) => [s.name, s.stub]), [['Cart', false], ['Receipt', true]].sort((a, b) => (part.screens.find((s) => s.name === a[0]).id < part.screens.find((s) => s.name === b[0]).id ? -1 : 1)));
    eq('the link that leaves is kept; the one that arrives is not', [part.links.length, part.links[0].to], [1, receipt.id]);
    eq('its own elements, none of the stub\'s', [part.elements.length, part.elements.every((e) => recOf(doc(), e.size).screen === cart.id)], [3, true]);
    eq('only the sources it uses', [partOfDoc(doc(), [signIn.id]).sources.length, part.sources.length], [1, 0]);
    eq('a part has nothing to report about its stub', findFindings(part).filter((f) => f.id === receipt.id).length, 0);
    const out = await buildExport({ what: 'screen', as: 'doc' });
    const env = JSON.parse(await read(out.blob));
    eq('exported as a document it says it is a part', [out.name, env.part, env.kind, env.doc.screens.length], ['Shop checkout Cart.flow.json', true, 'flowdoc', 2]);
    eq('the whole workflow does not', JSON.parse(await read((await buildExport({ what: 'all', as: 'doc' })).blob)).part, undefined);
    ok('a part opens on its own', openFileText(JSON.stringify(env)).part === true && !openFileText(JSON.stringify(env)).error);
    const whole = normalizeDoc(serializeDoc(doc()));
    loadDoc(part, false); setView('board');
    ok('and draws its stub dashed, as not included', /not included/.test(document.querySelector(`#board .screen[data-id="${receipt.id}"] .stop-name`).textContent) && !!document.querySelector(`#board .screen[data-id="${receipt.id}"] .frame[stroke-dasharray]`));

    // ---- worked on apart, then merged back ----
    const worked = normalizeDoc(serializeDoc(part)), wEl = (name) => worked.elements.find((e) => e.name === name || e.text === name);
    wEl('Pay').text = 'Pay now'; wEl('Pay').h = 56;
    worked.elements = worked.elements.filter((e) => e.type !== 'image');
    worked.elements.push(readRec('elements', { id: 'el_new1', size: wEl('Pay').size, type: 'text', text: 'Free delivery', x: 32, y: 480, w: 326, h: 32 }));
    worked.screens.find((s) => s.stub).name = 'Renamed by mistake';
    worked.links.push(readRec('links', { id: 'lnk_new1', from: cart.id, to: receipt.id, kind: 'back', label: 'Long press' }));
    loadDoc(whole, false);
    const before = text();
    const sent = []; state.opSinks.push((ops) => sent.push(ops));
    const n = mergeDoc(worked);
    const p2 = doc().elements.find((e) => e.name === 'Pay'), cartSize = sizesOf(doc(), by('Cart').id)[0];
    eq('merging takes the part\'s changes', [p2.text, p2.h], ['Pay now', 56]);
    eq('adds what is new, and removes what was removed there', [!!recOf(doc(), 'el_new1'), !!recOf(doc(), 'lnk_new1'), elementsOf(doc(), cartSize.id).some((e) => e.type === 'image')], [true, true, false]);
    eq('a stub changes nothing: the real stop keeps its name', by('Receipt').name, 'Receipt');
    eq('the rest of the workflow is untouched', [by('Sign in').name, doc().screens.length, doc().decisions.length, doc().links.length], ['Sign in', 3, 1, 5]);
    eq('as one step', [sent.length, n > 0], [1, true]);
    eq('merging the same part again changes nothing', mergeDoc(worked), 0);
    undo();
    ok('one undo takes the merge back', text() === before);
    eq('a part with nothing changed merges as nothing', mergeDoc(partOfDoc(doc(), [by('Cart').id])), 0);

    // ---- pictures ----
    const svgOk = (s) => { const d = new DOMParser().parseFromString(s, 'image/svg+xml'); return !d.querySelector('parsererror') && d.documentElement.nodeName === 'svg'; };
    const all = exportStops('all');
    const map = svgOfStops(all, 'board');
    ok('the board as a picture is well-formed SVG', svgOk(map));
    ok('with nothing of the editor in it', !/sel-layer|data-h=|class="badge"|opacity="0.25"/.test(map) && !/NaN|undefined/.test(map));
    eq('every stop and link is in it', [(map.match(/class="stop screen/g) || []).length, (map.match(/class="link/g) || []).length], [3, 4]);
    const some = svgOfStops([by('Cart').id, by('Receipt').id], 'board');
    eq('a picture of two screens has the link between them only', [(some.match(/class="stop screen/g) || []).length, (some.match(/class="link/g) || []).length], [2, 1]);
    ok('the flow view as a picture has cards', /class="stop screen card/.test(svgOfStops(all, 'flow')) && state.view === 'board');
    selectId(by('Cart').id);
    svgOfStops(all, 'flow');
    ok('making a picture leaves the selection and the view alone', soleSelected().id === by('Cart').id && state.view === 'board');
    const one = svgOfSize(sizesOf(doc(), by('Sign in').id)[0]);
    ok('one screen is drawn at its real size', svgOk(one) && /width="392" height="846"/.test(one) && /Welcome back/.test(one));
    state.walk = { from: by('Sign in').id, to: by('Receipt').id, pick: 0 };
    const story = svgOfStoryboard(walkPaths()[0]);
    ok('a storyboard numbers the stops and says what leads on', svgOk(story) && /1\. Sign in/.test(story) && /4\. Receipt/.test(story) && /Taps Sign in/.test(story) && /Yes/.test(story));
    const svgOut = await buildExport({ what: 'all', as: 'map', format: 'svg' });
    eq('exported as SVG', [svgOut.name, svgOut.blob.type, svgOk(await read(svgOut.blob))], ['Shop checkout board.svg', 'image/svg+xml', true]);
    const png = await buildExport({ what: 'screen', as: 'map', format: 'png', scale: 2 });
    const head = new Uint8Array(await png.blob.slice(0, 24).arrayBuffer()), dv = new DataView(head.buffer);
    eq('exported as PNG it is a PNG', [png.name.endsWith('.png'), Array.from(head.slice(1, 4)).map((c) => String.fromCharCode(c)).join('')], [true, 'PNG']);
    const want = /width="(\d+)" height="(\d+)"/.exec(svgOfStops([by('Cart').id], 'board'));
    eq('at twice the size', [dv.getUint32(16), dv.getUint32(20)], [want[1] * 2, want[2] * 2]);
    ok('the fonts ride along as data, from this site only', /@font-face/.test(await fontCss()) && performance.getEntriesByType('resource').every((e) => e.name.startsWith(location.origin + '/')));

    // ---- each screen, zipped when there are several ----
    const single = await buildExport({ what: 'screen', as: 'screens', format: 'svg' });
    eq('one screen with one size is one file', single.name, 'Cart Phone 390x844.svg');
    selectId(by('Sign in').id);
    const zip = await buildExport({ what: 'screen', as: 'screens', format: 'svg' });
    const zb = new Uint8Array(await zip.blob.arrayBuffer()), zv = new DataView(zb.buffer);
    eq('a screen with two sizes is a zip of two', [zip.name, zv.getUint32(0, true).toString(16), zv.getUint16(zb.length - 22 + 10, true)], ['Shop checkout Sign in screens.zip', '4034b50', 2]);
    const nameLen = zv.getUint16(26, true), first = new TextDecoder().decode(zb.subarray(30, 30 + nameLen)), size = zv.getUint32(18, true);
    const body = zb.subarray(30 + nameLen, 30 + nameLen + size);
    eq('its first file is stored whole, with the right checksum', [first, zv.getUint32(14, true), svgOk(new TextDecoder().decode(body))], ['Sign in Phone 390x844.svg', crc32(body), true]);
    eq('the checksum is the standard one', crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926');
    const allZip = new Uint8Array(await (await buildExport({ what: 'all', as: 'screens', format: 'svg' })).blob.arrayBuffer());
    eq('every screen of the workflow, the size on show of each', new DataView(allZip.buffer).getUint16(allZip.length - 22 + 10, true), 3);

    // ---- the copy sheet ----
    loadDictionary('en', { cart: { pay: 'Pay' } });
    const es = loadDictionary('es', { cart: { pay: 'Pagar' } }).lang;
    const csv = sheetCsv(exportStops('all')), rows = parseCsv(csv);
    eq('the copy sheet has a column per language', rows[0], ['id', 'screen', 'size', 'type', 'name', 'key', 'en', 'es']);
    const payRow = rows.find((r) => r[5] === 'cart.pay');
    eq('and a row per text', [rows.length - 1, payRow.slice(1)], [doc().elements.length, ['Cart', 'Phone', 'Button', 'Pay', 'cart.pay', 'Pay', 'Pagar']]);
    eq('text with commas, quotes and new lines survives', parseCsv('a,b\r\n"x, ""y""\nz",2\r\n'), [['a', 'b'], ['x, "y"\nz', '2']]);
    const edited = rows.map((r) => r.slice());
    edited[0].push('fr');
    edited.forEach((r, i) => { if (i) r.push(r[5] === 'cart.pay' ? 'Payer' : ''); });
    edited.find((r) => r[5] === 'cart.pay')[6] = 'Pay now'; edited.find((r) => r[5] === 'cart.pay')[7] = 'Pagar ahora';
    const titleRow = edited.find((r) => r[6] === 'Your cart'); titleRow[7] = 'Tu carrito';
    edited.push(['el_nobody', '', '', '', '', '', 'x', '', '']);
    sent.length = 0;
    const r = bringInSheet(edited.map((row) => row.map(csvCell).join(',')).join('\n'));
    const payNow = doc().elements.find((e) => e.name === 'Pay'), fr = doc().langs.find((l) => l.code === 'fr');
    eq('brought back, it changes the texts and the translations', [payNow.text, wordOf(es, 'cart.pay').text, r.unknown], ['Pay now', 'Pagar ahora', 1]);
    eq('a new language column adds the language', [!!fr, wordOf(fr.id, 'cart.pay').text], [true, 'Payer']);
    const title = doc().elements.find((e) => e.text === 'Your cart');
    eq('a translation for an element with no key gives it one', [title.key, wordOf(es, title.key).text], ['cart.your_cart', 'Tu carrito']);
    eq('as one step', sent.length, 1);
    ok('a sheet of something else is refused, in words', bringInSheet('name,price\nx,1').error !== '');
    undo();

    // ---- the report ----
    const html = reportHtml(exportStops('all'));
    const rd = new DOMParser().parseFromString(html, 'text/html');
    eq('the report names the workflow and every stop', [rd.querySelector('h1').textContent, rd.querySelectorAll('section')[1].querySelectorAll('article').length], ['Shop checkout', 4]);
    ok('with the map, each size drawn, and what is on it', rd.querySelectorAll('.map svg').length === 1 && rd.querySelectorAll('figure svg').length === 4 && /Sign in/.test(rd.querySelector('table').textContent));
    ok('where it leads, the findings and the sources', /Taps Pay/.test(html) && /Findings/.test(html) && /Shop app repository/.test(html));
    ok('no script and nothing loaded from anywhere', !/<script|<link|<img|src=|url\(/i.test(html));
    ok('the sources can be left out', !/Shop app repository|example\.com/.test(reportHtml(exportStops('all'), { noSources: true })));
    const acc = acceptFinding(findFindings(doc())[0] ? findFindings(doc())[0].key : 'no-start:', 'Fine for now.');
    setF(by('Receipt').id, 'name', '<b>Receipt & more</b>');
    ok('names are written as text, not as markup', /&lt;b&gt;Receipt &amp; more&lt;\/b&gt;/.test(reportHtml(exportStops('all'))) && !/<b>Receipt/.test(reportHtml(exportStops('all'))));
    selectId(by('Cart').id);
    const partReport = reportHtml(exportStops('screen'));
    ok('a report of one screen says the rest is not in it', /of 4 stops in the workflow/.test(partReport) && /not in this report/.test(partReport));
    const rep = await buildExport({ what: 'all', as: 'report' });
    eq('exported as one HTML file', [rep.name, rep.blob.type], ['Shop checkout report.html', 'text/html']);

    // ---- leaving the sources out, and refusing in words ----
    const bare = JSON.parse(await read((await buildExport({ what: 'all', as: 'doc', noSources: true })).blob)).doc;
    eq('a document without its sources has none, and points at none', [bare.sources.length, bare.screens.some((s) => s.source || s.at)], [0, false]);
    ok('the workflow itself keeps them', doc().sources.length === 1);
    setSelection([]);
    const refused = await buildExport({ what: 'screen', as: 'doc' }).then(() => '', (e) => e.message);
    eq('exporting a screen with none selected says so', refused, 'Select a screen first.');
    state.walk.pick = -1;
    eq('a storyboard with no way marked says so', await buildExport({ what: 'all', as: 'storyboard' }).then(() => '', (e) => e.message), 'A storyboard follows one way: mark it in Walk first.');
});
