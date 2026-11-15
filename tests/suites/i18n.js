// Flow's own language: five of them, apart from the workflow's.
suite(async (ok, eq) => {
    const { LOCALES, WORDS, CLIENT_KEYS } = FLOW_I18N;
    eq('five languages', LOCALES, ['en', 'es', 'pt-BR', 'ja', 'ru']);
    const holes = [];
    Object.keys(WORDS).forEach((k) => { if (WORDS[k].length !== 4 || WORDS[k].some((w) => typeof w !== 'string' || !w.trim())) holes.push(k); });
    eq('every word has all four translations', holes, []);
    const marks = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    eq('and keeps its placeholders', Object.keys(WORDS).filter((k) => WORDS[k].some((w) => marks(w) !== marks(k))), []);
    ok('what a client sees is a set of its own', CLIENT_KEYS.length > 30 && CLIENT_KEYS.includes('Walk through it') && !CLIENT_KEYS.includes('↶ Undo'));

    eq('a browser language becomes one of the five', ['es-MX', 'pt', 'pt-PT', 'ja-JP', 'ru', 'fr', ''].map((l) => { setLocale('en'); const q = { 'es-MX': 'es', pt: 'pt-BR', 'pt-PT': 'pt-BR', 'ja-JP': 'ja', ru: 'ru' }[l] || 'en'; setLocale(q); return flowLocale(); }), ['es', 'pt-BR', 'pt-BR', 'ja', 'ru', 'en', 'en']);
    setLocale('en');
    eq('English is the key and the fallback', [t('Walk through it'), t('A string nobody translated')], ['Walk through it', 'A string nobody translated']);
    setLocale('es');
    eq('a word in Spanish, with its number filled in', [t('Walk through it'), t('{n} screens', { n: 3 }), t('A string nobody translated')], ['Recorrerlo', '3 pantallas', 'A string nobody translated']);
    eq('the page says which language it is in', document.documentElement.lang, 'es');

    // ---- the page's fixed words ----
    const undoB = document.getElementById('undoBtn'), file = document.getElementById('fileMenuBtn');
    eq('buttons and their hints are translated', [undoB.textContent, undoB.title, file.textContent.replace(/\s+/g, ' ').trim()], ['↶ Deshacer', 'Deshacer (Ctrl+Z)', 'Archivo ▾']);
    ok('and the button still works', undoB.id === 'undoBtn' && undoB.dataset.act === 'undo');
    eq('menus and dialogs too', [document.querySelector('[data-act="export-open"]').firstChild.nodeValue.trim(), document.getElementById('exportTitle').textContent, document.querySelector('#exportAs option[value="report"]').textContent], ['Exportar…', 'Exportar', 'Un informe para leer, enviar o imprimir (PDF o HTML)']);
    setLocale('ja');
    eq('changing again starts from the English, not from the Spanish', [undoB.textContent, document.getElementById('exportTitle').textContent], ['↶ 元に戻す', '書き出し']);
    setLocale('en');
    eq('and English comes back exactly', [undoB.textContent, undoB.title, document.getElementById('exportTitle').textContent], ['↶ Undo', 'Undo (Ctrl+Z)', 'Export']);

    // ---- the fleet's switch ----
    window.dispatchEvent(new CustomEvent('carino:langchange', { detail: { lang: 'ru' } }));
    eq('the navbar\'s language choice changes Flow', [flowLocale(), undoB.textContent], ['ru', '↶ Отменить']);
    window.dispatchEvent(new CustomEvent('carino:langchange', { detail: { lang: 'xx' } }));
    eq('a language Flow does not have is English', flowLocale(), 'en');

    // ---- Flow's language and the workflow's are apart ----
    loadExample();
    loadDictionary('en', { cart: { pay: 'Pay' } });
    const es = loadDictionary('es', { cart: { pay: 'Pagar' } }).lang;
    const pay = state.doc.elements.find((e) => e.name === 'Pay');
    const says = () => Array.from(document.querySelectorAll(`#board .el[data-id="${pay.id}"] text`)).map((x) => x.textContent).join('');
    const before = JSON.stringify(serializeDoc(state.doc));
    setLocale('ja');
    eq('Flow in Japanese leaves the workflow as it is written', [says(), state.lang, undoB.textContent], ['Pay', '', '↶ 元に戻す']);
    showLang(es);
    eq('the workflow in Spanish leaves Flow in Japanese', [says(), flowLocale(), undoB.textContent], ['Pagar', 'ja', '↶ 元に戻す']);
    setLocale('ru');
    eq('and Flow in Russian leaves the workflow in Spanish', [says(), state.lang === es], ['Pagar', true]);
    ok('neither is a change to the document', JSON.stringify(serializeDoc(state.doc)) === before && !canUndo() === false);
    ok('the workflow\'s own words are never looked up in Flow\'s list', (() => { setF(pay.id, 'text', 'Play'); showLang(''); const s = says(); undo(); return s === 'Play'; })());

    // ---- what a client sees, in every language ----
    for (const loc of LOCALES.slice(1)) {
        setLocale(loc); setSimple(true); playStart();
        const bar = document.getElementById('simpleBar').textContent, pane = document.getElementById('playPane').textContent;
        ok(`${loc}: the Simple view and Play are in it`, bar.includes(t('Walk through it')) && pane.includes(t('From here')) && pane.includes(t('Leave Play')) && !/Walk through it|From here|Leave Play|Start again/.test(bar + pane), bar + ' | ' + pane.slice(0, 120));
        playExit(); setSimple(false);
    }
    setLocale('en');
    ok('nothing was fetched to translate', performance.getEntriesByType('resource').every((e) => e.name.startsWith(location.origin + '/')));
});
