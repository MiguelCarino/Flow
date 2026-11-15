// The published schema names exactly what a file can hold: every field of
// every list, its allowed values, and nothing else.
suite(async (ok, eq) => {
    const schema = await (await fetch('schema/flow-v1.json')).json();
    const defs = schema.$defs, DEF = { screens: 'screen', sizes: 'size', elements: 'element', decisions: 'decision', links: 'link', sources: 'source', blocks: 'block', styles: 'style', langs: 'lang', words: 'word', accepts: 'accept', pins: 'pin', bases: 'base', runs: 'run', steps: 'step' };
    eq('the schema is the one files point at', schema.$id, FILE_SCHEMA);
    eq('the envelope has these keys', Object.keys(schema.properties).sort(), Object.keys(fileEnvelope(newDoc(''), true)).sort());
    eq('the document has these lists', Object.keys(defs.doc.properties).sort(), ['v'].concat(Object.keys(DOC_FIELDS), KINDS).sort());
    eq('the document version is this build\'s', defs.doc.properties.v.const, DOC_VERSION);
    ok('the id pattern is the model\'s', defs.id.pattern === ID_RE.source && defs.ref.pattern === ID_RE.source);

    const ENUMS = { 'screens.status': SCREEN_STATUS, 'sizes.input': SIZE_INPUT, 'sizes.distance': SIZE_DISTANCE, 'elements.type': ELEMENT_TYPES, 'elements.pinH': PIN_H, 'elements.pinV': PIN_V, 'links.kind': LINK_KINDS, 'sources.kind': SOURCE_KINDS, 'styles.kind': STYLE_KINDS, 'styles.weight': STYLE_WEIGHTS, 'steps.result': STEP_RESULTS };
    KINDS.forEach((kind) => {
        const def = defs[DEF[kind]];
        eq(`${kind}: the schema names every field and no other`, Object.keys(def.properties).sort(), ['id'].concat(Object.keys(FIELDS[kind])).sort());
        ok(`${kind}: nothing unnamed is allowed`, def.additionalProperties === false);
        Object.entries(FIELDS[kind]).forEach(([field, spec]) => {
            const p = def.properties[field];
            if (p.enum) eq(`${kind}.${field}: the same values, the usual one first`, p.enum, ENUMS[kind + '.' + field]);
            if ('default' in p) eq(`${kind}.${field}: the same usual value`, p.default, spec[1]);
            if (p.maxLength && p.type === 'string' && !p.pattern) ok(`${kind}.${field}: the same longest text`, spec[0]('x'.repeat(p.maxLength + 5)).length === p.maxLength);
            if (p.type === 'integer') eq(`${kind}.${field}: the same range`, [spec[0](-1e17, 0), spec[0](1e17, 0)], [p.minimum, p.maximum]);
        });
    });

    // The example, checked against the schema by a small reader of it.
    const problems = [];
    const check = (value, s, where) => {
        if (s.$ref) s = defs[s.$ref.split('/').pop()];
        if ('const' in s && value !== s.const) problems.push(`${where}: not ${s.const}`);
        if (s.enum && !s.enum.includes(value)) problems.push(`${where}: ${value} not allowed`);
        if (s.type === 'string' && (typeof value !== 'string' || (s.maxLength && value.length > s.maxLength) || (s.pattern && !new RegExp(s.pattern).test(value)))) problems.push(`${where}: bad text`);
        if (s.type === 'integer' && (!Number.isInteger(value) || value < s.minimum || value > s.maximum)) problems.push(`${where}: bad number`);
        if (s.type === 'boolean' && typeof value !== 'boolean') problems.push(`${where}: not true or false`);
        if (s.type === 'array') value.forEach((v, i) => check(v, s.items, `${where}[${i}]`));
        if (s.type === 'object') {
            (s.required || []).forEach((k) => { if (!(k in value)) problems.push(`${where}: no ${k}`); });
            Object.keys(value).forEach((k) => { if (!s.properties[k]) problems.push(`${where}.${k}: not in the schema`); else check(value[k], s.properties[k], `${where}.${k}`); });
        }
    };
    loadExample();
    check(JSON.parse(JSON.stringify(fileEnvelope(state.doc))), schema, 'file');
    eq('the example is a valid file', problems, []);
    const bad = fileEnvelope(state.doc); bad.doc.screens[0].colour = 'red'; bad.doc.links[0].kind = 'teleport';
    problems.length = 0; check(bad, schema, 'file');
    eq('and the reader does notice what is wrong', problems.length, 2);
});
