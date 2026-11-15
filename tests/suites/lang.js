// The languages of the workflow that is open: dictionaries, keys, and the
// switch that shows the whole workflow in one of them.
suite(async (ok, eq) => {
    const board = document.getElementById('board');
    const says = (e) => Array.from(board.querySelectorAll(`.el[data-id="${e.id}"] text`)).map((t) => t.textContent).join(' ');
    const keys = () => findFindings(state.doc).map((f) => f.key.split(':')[0]).sort();

    eq('a dictionary is flat or nested', Array.from(flattenDictionary({ cart: { pay: 'Pay', n: 3, deep: { x: 'X' } }, 'a b': 'c' })), [['cart.pay', 'Pay'], ['cart.deep.x', 'X'], ['a_b', 'c']]);
    eq('the language is read from the file name', ['es.json', 'messages_pt-BR.json', 'locale.zh-Hans.json', 'strings.json', 'es.txt'].map(langOfFileName), ['es', 'pt-BR', 'zh-Hans', '', '']);
    eq('a code is a code', ['es', 'pt_BR', 'español', '', 'e'].map((c) => fCode(c, '?')), ['es', 'pt-BR', '?', '?', '?']);

    loadExample();
    const el = (text) => state.doc.elements.find((e) => e.text === text && recOf(state.doc, e.size).name === 'Phone');
    const pay = el('Pay'), cartTitle = el('Your cart'), signIn = el('Sign in'), email = el('Email');
    eq('a new workflow is written in en and has no other language', [state.doc.lang, state.doc.langs.length], ['en', 0]);
    ok('with no language to switch to, there is no switch', document.getElementById('langBar').hidden);
    const sent = [];
    state.opSinks.push((ops) => sent.push(ops));

    // ---- the interface's own dictionary names the elements ----
    const en = { cart: { title: 'Your cart', pay: 'Pay' }, auth: { submit: 'Sign in', email: 'Email' }, unused: { one: 'Never drawn' } };
    const r1 = loadDictionary('en', en);
    eq('loading the workflow\'s own language gives matching elements their key', [r1.matched, r1.lang, pay.key, cartTitle.key, email.key], [5, '', 'cart.pay', 'cart.title', 'auth.email']);
    eq('on every size of the screen', state.doc.elements.filter((e) => e.key === 'auth.submit').length, 2);
    eq('as one step', sent.length, 1);
    en.cart.pay = 'Pay now';
    eq('loading it again changes the text of what has a key', [loadDictionary('en', en).changed, pay.text], [1, 'Pay now']);
    undo();
    eq('one undo', pay.text, 'Pay');

    // ---- another language ----
    const r2 = loadDictionary('es', { cart: { title: 'Tu carrito', pay: 'Pagar' }, auth: { submit: 'Entrar' }, unused: { one: 'Nunca' } });
    const es = recOf(state.doc, r2.lang);
    eq('a dictionary in another language adds the language and its words', [es.code, r2.added, r2.unused, state.doc.words.length], ['es', 4, 1, 4]);
    eq('the board still shows the workflow as written', [says(pay), says(cartTitle)], ['Pay', 'Your cart']);
    ok('and now there is a switch', !document.getElementById('langBar').hidden);
    eq('a language missing some keys is reported', findFindings(state.doc).filter((f) => f.key.startsWith('lang-missing')).map((f) => f.text), ['es has no text for 1 of 4 keys: auth.email']);

    // ---- the switch ----
    const before = JSON.stringify(serializeDoc(state.doc)); sent.length = 0;
    const list = document.getElementById('flowLang');
    list.value = es.id; list.dispatchEvent(new Event('change', { bubbles: true }));
    eq('choosing the language shows the whole workflow in it', [says(pay), says(cartTitle), says(signIn)], ['Pagar', 'Tu carrito', 'Entrar']);
    eq('what has no word keeps its own text', says(email), 'Email');
    ok('which is a way of looking, not a change', JSON.stringify(serializeDoc(state.doc)) === before && sent.length === 0);
    ok('Flow\'s own words did not change', document.querySelector('[data-act="add-screen"]').textContent === '+ Screen' && document.documentElement.lang === 'en');
    setView('flow');
    ok('the flow view shows it in that language too', /Pagar/.test(board.querySelector('.card .thumb').parentNode.parentNode.innerHTML));
    setView('board');
    playStart(recOf(state.doc, recOf(state.doc, pay.size).screen).id);
    ok('and so does Play', /Pagar/.test(document.getElementById('playPane').innerHTML));
    playExit();

    // ---- writing a translation in the rail ----
    selectId(email.id);
    const field = document.querySelector('#railProps [data-word]');
    ok('with a language on show, the Text field is that language\'s', !!field && field.value === '' && field.placeholder === 'Email');
    field.focus(); field.value = 'C'; field.dispatchEvent(new Event('input', { bubbles: true }));
    field.value = 'Correo'; field.dispatchEvent(new Event('input', { bubbles: true }));
    eq('typing writes the word', [wordOf(es.id, 'auth.email').text, says(email), email.text], ['Correo', 'Correo', 'Email']);
    ok('without rebuilding the field', document.activeElement === field && document.body.contains(field));
    eq('and the report is settled', keys().includes('lang-missing'), false);
    const box = el('Password');
    selectId(box.id);
    const f2 = document.querySelector('#railProps [data-word]');
    f2.value = 'Contraseña'; f2.dispatchEvent(new Event('input', { bubbles: true }));
    eq('an element with no key is given one, from where and what it is', [box.key, wordOf(es.id, box.key).text], ['sign_in.password', 'Contraseña']);
    undo();
    eq('the key and the word go in one undo', [box.key, state.doc.words.length], ['', 5]);

    // ---- keys ----
    setF(el('Welcome back').id, 'key', 'cart.pay');
    ok('one key on two different texts is reported', keys().includes('key-clash'));
    undo();
    eq('a key has no spaces', readRec('elements', { id: 'el_a1', size: 'siz_a1', key: ' cart pay ' }).key, 'cart_pay');

    // ---- files ----
    eq('a language saves as a flat dictionary, keys in order', JSON.parse(dictionaryText(es.id)), { 'auth.email': 'Correo', 'auth.submit': 'Entrar', 'cart.pay': 'Pagar', 'cart.title': 'Tu carrito', 'unused.one': 'Nunca' });
    eq('the workflow\'s own language too, from its elements', JSON.parse(dictionaryText('')), { 'auth.email': 'Email', 'auth.submit': 'Sign in', 'cart.pay': 'Pay', 'cart.title': 'Your cart' });
    const again = openFileText(JSON.stringify(fileEnvelope(state.doc))).doc;
    eq('languages and words are in the file', [again.lang, again.langs.length, again.words.length, again.elements.find((e) => e.id === pay.id).key], ['en', 1, 5, 'cart.pay']);
    const raw = serializeDoc(state.doc);
    raw.words.push({ id: 'wrd_dup1', lang: es.id, key: 'cart.pay', text: 'twice' }, { id: 'wrd_lost1', lang: 'lng_gone', key: 'x', text: 'y' }, { id: 'wrd_nokey1', lang: es.id, text: 'z' });
    eq('a second word for a key, a word of no language and a word with no key are dropped on reading', normalizeDoc(raw).words.length, 5);
    ok('a file that is not named after a language is refused, in words', openDictionaryFrom('strings.json', '{}') === null && !document.getElementById('status').hidden);

    // ---- from the rail ----
    selectId('');
    ok('the rail lists the language and how much of it there is', /5 of 5 keys|4 of 4 keys/.test(document.querySelector(`#railProps [data-lang="${es.id}"]`).textContent));
    loadDictionary('en', { x: 'y' });
    const same = addLang('en');
    ok('listing the workflow\'s own language again is reported', keys().includes('lang-same'));
    removeId(same);

    // ---- removing ----
    const text = JSON.stringify(serializeDoc(state.doc));
    removeId(es.id);
    eq('removing a language removes its words', [state.doc.langs.length, state.doc.words.length], [0, 0]);
    eq('and the board goes back to the workflow as written', [state.lang, says(pay), document.getElementById('langBar').hidden], ['', 'Pay', true]);
    undo();
    eq('one undo brings the dictionary back', JSON.stringify(serializeDoc(state.doc)), text);
    loadExample();
    eq('another workflow opens as it is written', state.lang, '');
});
