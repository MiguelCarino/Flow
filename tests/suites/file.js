// Files: the envelope, what is refused, and a newer document opening read-only.
suite(async (ok, eq) => {
    loadExample();
    const env = fileEnvelope(state.doc);
    eq('the envelope names itself', [env.kind, env.version, env.name, env.doc.v], ['flowdoc', 1, 'Shop checkout', 1]);
    const text = JSON.stringify(env);
    const back = openFileText(text);
    eq('a file opens as the same document', JSON.stringify(serializeDoc(back.doc)), JSON.stringify(env.doc));
    ok('and can be changed', back.readOnly === false);
    ok('a bare document opens too', !openFileText(JSON.stringify(env.doc)).error);
    eq('what is not a workflow is refused, in words', ['not json', '[]', '{"kind":"nettopology","doc":{"v":1}}', '{"kind":"flowdoc"}', '{"name":"x"}'].map((t) => typeof openFileText(t).error), ['string', 'string', 'string', 'string', 'string']);

    eq('the file name comes from the workflow', fileName(state.doc), 'Shop checkout.flow.json');
    eq('with nothing unsafe in it', fileName({ name: '../a/b:c*?' }), '..abc.flow.json');
    eq('and a name when there is none', fileName({ name: '  ' }), 'workflow.flow.json');

    // ---- a newer document ----
    const newer = cloneData(env); newer.doc.v = 2; newer.doc.future = { anything: true };
    ok('opening a file says so', openFileFrom(JSON.stringify(newer)));
    ok('a newer document is read-only', state.readOnly && !document.getElementById('roBanner').hidden);
    const before = JSON.stringify(serializeDoc(state.doc));
    const id = state.doc.screens[0].id;
    eq('nothing changes it', [setF(id, 'name', 'x'), addScreen('phone'), removeId(id), undo()], [false, '', false, false]);
    eq('not a byte', JSON.stringify(serializeDoc(state.doc)), before);
    ok('its fields are off', Array.from(document.querySelectorAll('#railProps [data-f]')).every((el) => el.disabled));
    ok('and the browser keeps the last workflow it could save', JSON.parse(localStorage.getItem('flow_live')).doc.v === 1);
    ok('opening a file this build can save lifts it', openFileFrom(text) && !state.readOnly && document.getElementById('roBanner').hidden);
});
