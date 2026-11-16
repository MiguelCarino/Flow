// @realtime
// Flow's own words are whole in every language: the editor is driven through
// its states in each one, and nothing it asks for may lack a translation.
suite(async (ok, eq) => {
    const { LOCALES, missed } = FLOW_I18N;
    // Every state the editor has words for.
    const drive = async () => {
        openDoc(newDoc(''), false); selectId(''); render();
        loadExample();
        const doc = state.doc, by = (n) => doc.screens.find((s) => s.name === n);
        const signIn = by('Sign in'), cart = by('Cart'), receipt = by('Receipt'), ask = doc.decisions[0];
        const pay = doc.elements.find((e) => e.name === 'Pay');
        const base = addBase(); setF(base, 'url', 'http://staging.example.com/?token=x');
        const src2 = addSource();
        loadDictionary('en', { cart: { pay: 'Pay' } });
        const es = loadDictionary('es', { cart: { pay: 'Pagar con tarjeta de crédito ahora mismo' } }).lang; addLang('en');
        const colour = addStyle('color'), text = addStyle('text');
        setF(colour, 'color', '#cbd5e1'); setF(pay.id, 'fill', colour); setF(pay.id, 'ink', colour); setF(pay.id, 'w', 96);
        // One of every element, with what makes each check speak.
        selectId(cart.id);
        ELEMENT_TYPES.filter((x) => x !== 'block').forEach((type) => { selectId(cart.id); const id = addElement(type); selectId(id); });
        const els = elementsOf(doc, sizesOf(doc, cart.id)[0].id);
        const of = (type) => els.find((e) => e.type === type);
        setF(of('button').id, 'h', 16); setF(of('input').id, 'name', ''); setF(of('image').id, 'text', ''); setF(of('text').id, 'fs', 9);
        setF(of('link').id, 'x', of('link').x + 2); setF(of('checkbox').id, 'text', ''); setF(of('heading').id, 'w', 40); setF(of('card').id, 'x', 380);
        setF(of('toggle').id, 'y', of('radio').y + 4); setF(of('alert').id, 'key', 'cart.pay'); setF(of('chip').id, 'fs', 17);
        addLink(cart.id, signIn.id, of('icon').id);
        setSelection([selEntry('elements', of('list').id), selEntry('elements', of('table').id)]); render();
        makeBlock(); selectId(doc.blocks[0].id); selectId(doc.elements.find((e) => e.type === 'block').id);
        addBlock();
        const island = addScreen('tv', 'settings'); setF(island, 'status', 'built'); setF(island, 'at', 'x'); addSize(island, 'watch');
        const d2 = addDecision(); addLink(d2, island); const l2 = addLink(d2, cart.id); setF(l2, 'cond', 'a'); addLink(d2, receipt.id); setF(doc.links[doc.links.length - 1].id, 'cond', 'a');
        setF(receipt.id, 'path', ''); addLink(receipt.id, signIn.id); setF(by('Cart').id, 'start', true);
        [signIn.id, ask.id, pay.id, doc.links[0].id, doc.links.find((l) => l.from === ask.id).id, island, d2, ''].forEach((id) => selectId(id));
        setSelection([selEntry('screens', cart.id), selEntry('elements', pay.id)]); render();
        setSelection([selEntry('screens', cart.id), selEntry('screens', receipt.id), selEntry('decisions', ask.id)]); render();
        showLang(es); selectId(pay.id); showLang(''); selectId('');
        // Findings: every one, then accepted, pinned, taken back, stale.
        const all = findFindings(doc);
        state.accepting = all[0].key; renderFindings(); state.accepting = '';
        acceptFinding(all[0].key, 'because'); pinFinding(all[1].key); acceptFinding('dead-end:' + receipt.id, 'gone'); pinFinding('unreached:' + receipt.id);
        state.acceptedOpen = true; render();
        // Walk and Test.
        state.walk = { from: '', to: '', pick: -1 }; render();
        state.walk = { from: signIn.id, to: signIn.id, pick: -1 }; render();
        state.walk = { from: island, to: signIn.id, pick: -1 }; render();
        state.walk = { from: signIn.id, to: receipt.id, pick: 0 }; render();
        const run = startRun(walkPaths()[0]); markStep('pass'); markStep('fail'); markStep('skip'); openRun(run, 0);
        removeId(base); openRun(run, 0); undo(); closeRun();
        const c = testCases(doc)[0]; if (c) { startRun(c.path, c.name); closeRun(); }
        state.casesOpen = true; render();
        playStart(signIn.id); playGo(linksFrom(doc, signIn.id)[0].id); playExit();
        setView('flow'); setView('board'); setSimple(true); setSimple(false);
        // Messages.
        ['new', 'example'].forEach((a) => document.querySelector(`[data-act="${a}"]`).click());
        saveDictionary; mergeFileFrom('nope'); sheetFileFrom('a,b\n1,2'); openFileFrom('{}'); openDictionaryFrom('x.txt', '{}'); openDictionaryFrom('es.json', 'nope'); openDictionaryFrom('es.json', '{}');
        openDictionaryFrom('es.json', '{"a":"b"}'); openDictionaryFrom(state.doc.lang + '.json', '{"a":"b"}');
        mergeFileFrom(JSON.stringify(fileEnvelope(state.doc))); sheetFileFrom(sheetCsv(exportStops('all')));
        // The report, and the dialogs.
        loadExample(); const b2 = addBase(); setF(b2, 'url', 'https://s.test'); const r2 = startRun(testCases(state.doc)[0].path); markStep('fail'); closeRun();
        acceptFinding(findFindings(state.doc)[0].key, 'ok');
        reportHtml(exportStops('all')); selectId(state.doc.screens[0].id); reportHtml(exportStops('screen'));
        for (const what of ['screen', 'path']) await buildExport({ what, as: 'doc' }).catch(() => {});
        await buildExport({ what: 'all', as: 'storyboard' }).catch((e) => say(e.message, true));
        await makeShareLink('all', 'short').catch((e) => say(e.message, true));
        await unsealText('e~AAAA', 'x').catch((e) => say(e.message, true));
        await keepWorkflow(); showLanding(true); paintLanding(await libList()); state.libSure = state.cardId; paintLanding(await libList()); state.libSure = '';
        state.libRename = state.cardId; paintLanding(await libList()); state.libRename = ''; const kept = state.cardId, twin = await duplicateCard(kept); say(tr('Duplicated as "{name}".', { name: twin.name }));
        paintLanding(await libList()); await openCardMerge(kept); await runCardMerge(twin.id); await openCardMerge(twin.id); await runCardMerge(kept); for (const e of [await mergeCardInto(kept, kept), await mergeCardInto(kept, 'card_none')]) say(e.error, true);
        { const real = window.saveBlob; window.saveBlob = () => {}; await exportBinder().catch(() => {}); window.saveBlob = real; } await openAnyFile(JSON.stringify(await binderEnvelope())); await openAnyFile('{"kind":"flowbinder","workflows":[]}');
        for (const card of await libList()) await libDelete(card.id);
        paintLanding([]); await reportDesigned(exportStops('all'), { theme: 'white' }); showLanding(false);
        renderExport(); casesCsv();
    };
    setLocale('en'); missed.clear();
    await drive();
    eq('English asks for nothing', Array.from(missed), []);
    for (const loc of LOCALES.slice(1)) {
        missed.clear(); setLocale(loc);
        await drive();
        const list = Array.from(missed).sort();
        eq(`${loc}: every word asked for has a translation`, list.length, 0);
        list.slice(0, 400).forEach((k) => ok(`${loc} lacks: ${k}`, false));
        if (loc === 'es') window.__missed = list;
    }
    setLocale('en');
    // Every word keeps its placeholders, in every language.
    const marks = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    LOCALES.slice(1).forEach((loc) => {
        const more = FLOW_I18N.MORE[loc] || {};
        eq(`${loc}: placeholders are kept`, Object.keys(more).filter((k) => marks(more[k]) !== marks(k)), []);
    });
});
