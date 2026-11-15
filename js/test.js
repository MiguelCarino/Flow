// Testing the drawn workflow against the real thing.
//
// A test case is one way from a start to an end (testCases, js/model.js): it
// is worked out from the workflow and never stored. A run is one go at a
// case: the tester opens each screen's live address in another tab, looks,
// and says whether it is as drawn. Runs and their steps are kept in the
// workflow.
//
// Flow opens nothing itself. A live address is a link the tester clicks; it
// opens in another tab, with no word of where it came from.

const RESULT_LABEL = { '': 'Not checked', pass: 'Passed', fail: 'Failed', skip: 'Skipped' };
const RESULT_MARK = { '': '○', pass: '✓', fail: '✕', skip: '–' };
const baseShown = () => { const b = state.base ? recOf(state.doc, state.base) : null; return b || state.doc.bases[0] || null; };

function addBase() {
    const id = nextId('bases'), n = state.doc.bases.length;
    return change({ op: 'add', kind: 'bases', rec: { id, name: ['Staging', 'Production', 'Local'][n] || 'Base ' + (n + 1) } }) ? id : '';
}
// Start a run of one way. Its steps are written down now, with what each
// screen is called and what leads to it, so the run reads the same later.
function startRun(path, name) {
    const doc = state.doc, steps = caseSteps(doc, path);
    if (!steps.length || state.readOnly) return '';
    const id = nextId('runs'), base = baseShown();
    const ok = batch(() => {
        if (!change({ op: 'add', kind: 'runs', rec: { id, name: name || `${steps[0].name} to ${steps[steps.length - 1].name}`, base: base ? base.id : '', at: Date.now() } })) return false;
        steps.forEach((s, n) => change({ op: 'add', kind: 'steps', rec: { id: nextId('steps'), run: id, n, stop: s.stop, name: s.name, via: s.via } }));
        return true;
    });
    if (!ok) return '';
    openRun(id);
    return id;
}
function openRun(id, at) {
    const steps = stepsOf(state.doc, id);
    if (!recOf(state.doc, id) || !steps.length) return false;
    const todo = steps.findIndex((s) => !s.result);
    state.test = { run: id, at: at === undefined ? (todo < 0 ? 0 : todo) : Math.max(0, Math.min(steps.length - 1, at)), once: '' };
    state.play = null;
    render();
    return true;
}
function closeRun() { if (state.test) { state.test = null; render(); } }
// Say how a step went, and move to the next one still to do.
function markStep(result) {
    const t = state.test, steps = t ? stepsOf(state.doc, t.run) : [], step = steps[t ? t.at : -1];
    if (!step || state.readOnly) return false;
    commitTyping();
    setF(step.id, 'result', result);
    const next = steps.findIndex((s, i) => i > t.at && !s.result);
    if (next >= 0) { t.at = next; t.once = ''; }
    render();
    return true;
}
// The address a step opens: one typed for this step only, or the screen's
// own on the run's base.
function stepUrl(step) {
    const doc = state.doc, t = state.test, run = recOf(doc, step.run);
    if (t && t.once && safeUrl(t.once)) return safeUrl(t.once);
    return liveUrl(run && run.base ? recOf(doc, run.base) : null, step.stop ? recOf(doc, step.stop) : null);
}

// ---- The run, over the board ----
function renderTest() {
    const pane = $('testPane'), doc = state.doc, t = state.test;
    if (t && !recOf(doc, t.run)) state.test = null;
    pane.hidden = !state.test;
    if (!state.test) { pane.innerHTML = ''; return; }
    const run = recOf(doc, t.run), steps = stepsOf(doc, t.run), step = steps[Math.min(t.at, steps.length - 1)], tally = runTally(doc, t.run);
    const screen = step.stop ? recOf(doc, step.stop) : null, url = stepUrl(step), off = ro();
    // Typing in the note or the one-off address must not lose the field.
    const typing = document.activeElement && pane.contains(document.activeElement) && document.activeElement.id ? document.activeElement.id : '';
    let stage;
    if (screen) {
        const size = shownSize(screen), H = sizeHeight(size);
        stage = `<svg class="pl-screen" viewBox="-6 -6 ${size.w + 12} ${H + 12}" preserveAspectRatio="xMidYMid meet" role="img" data-raw aria-label="${esc(tr('{name} as drawn', { name: stopName(screen) }))}">`
            + `<rect width="${size.w}" height="${H}" rx="${n1(Math.min(12, size.w / 20))}" fill="${INK.frame}" stroke="${INK.frameLine}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
            + elementsOf(doc, size.id).map((e) => elementSvg(e, 1, true)).join('') + '</svg>';
    } else stage = `<div class="pl-decision"><p class="pl-kicker">${esc(tr('No longer in the workflow'))}</p><p class="pl-question">${esc(step.name)}</p></div>`;
    const done = tally.todo === 0;
    let side = `<p class="pl-kicker">${esc(tr('Step {n} of {n2}', { n: t.at + 1, n2: steps.length }))}</p><h2 class="tp-name">${esc(step.name)}</h2>`
        + (step.via ? `<p class="pf-note"><strong>${esc(tr('To get here:'))}</strong> ${esc(step.via)}</p>` : '<p class="pf-note">The run starts here.</p>')
        + '<p class="pf-note">Open the real screen and compare it with the drawing.</p>'
        + (url ? `<a class="btn btn-ghost sm tp-open" id="testOpen" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(tr('Open the real screen ↗'))}</a><p class="tp-url">${esc(url)}</p>`
            : `<p class="pf-warn" data-raw>${esc((screen && !screen.path.trim() ? tr('This screen has no live address.') : run.base ? tr('There is no address to open.') : tr('This run has no base address.')) + ' ' + tr('Type one below for this step.'))}</p>`)
        + pf('Another address, for this step only', `<input class="input" type="url" id="testOnce" value="${esc(t.once)}" placeholder="https://" autocomplete="off" spellcheck="false">`)
        + '<p class="pf-note">It is used now and not saved.</p>'
        + pf('Note', `<textarea class="textarea" rows="2" id="testNote" data-id="${step.id}" data-f="note"${off}>${esc(step.note)}</textarea>`)
        + `<div class="tp-marks"><button type="button" class="btn sm tp-pass${step.result === 'pass' ? ' on' : ''}" data-act="test-mark" data-result="pass"${off}>✓ As drawn</button>`
        + `<button type="button" class="btn sm tp-fail${step.result === 'fail' ? ' on' : ''}" data-act="test-mark" data-result="fail"${off}>✕ Not as drawn</button>`
        + `<button type="button" class="btn btn-ghost sm${step.result === 'skip' ? ' on' : ''}" data-act="test-mark" data-result="skip"${off}>${esc(tr('Skip'))}</button></div>`
        + '<ol class="tp-steps">' + steps.map((s, i) => `<li><button type="button" class="tp-step ${s.result || 'todo'}${i === t.at ? ' at' : ''}" data-act="test-at" data-i="${i}" aria-current="${i === t.at ? 'step' : 'false'}">`
            + `<span class="tp-mark" aria-hidden="true">${RESULT_MARK[s.result]}</span><span>${esc(s.name)}</span><span class="dim">${esc(tr(RESULT_LABEL[s.result]))}</span></button></li>`).join('') + '</ol>';
    const verdict = done ? (tally.fail ? tr('Finished: {n} of {n2} not as drawn.', { n: tally.fail, n2: tally.total }) : tr('Finished: every screen checked was as drawn.') + (tally.skip ? ' ' + tr('{n} skipped.', { n: tally.skip }) : '')) : tr('{n} of {n2} checked.', { n: tally.total - tally.todo, n2: tally.total });
    pane.innerHTML = `<div class="pl-top"><div class="pl-crumbs tp-head"><strong>${esc(run.name)}</strong> <span class="tp-verdict ${done ? tally.verdict : ''}">${esc(verdict)}</span></div>`
        + '<div class="pl-btns"><button type="button" class="btn btn-primary sm" data-act="test-close">' + esc(tr('Leave the run')) + '</button></div></div>'
        + `<div class="pl-body"><div class="pl-stage">${stage}</div><aside class="pl-side tp-side">${side}</aside></div>`;
    translateChrome(pane);
    if (typing && $(typing)) { const f = $(typing); f.focus(); if (f.setSelectionRange) { const n = f.value.length; try { f.setSelectionRange(n, n); } catch (e) { /* a url field has no selection */ } } }
}

// ---- In the rail ----
// Base addresses, with the workflow's own settings.
function basesHtml() {
    const doc = state.doc;
    let s = '<div class="pf-group"><div class="pf-head">Live addresses</div><p class="pf-note">Where the real thing runs: staging, production, your own computer. Each screen\'s live address is its path on one of these, so a test can open it. Flow only makes the link; it never opens it itself.</p>';
    doc.bases.forEach((b) => {
        s += `<div class="size-card" data-base="${b.id}"><div class="pf-inline">${inText(b.id, 'name', b.name, 'placeholder="Staging" aria-label="Name"')}${actBtn('del', '✕', `data-id="${b.id}" title="Remove this address" aria-label="Remove this address"`)}</div>`
            + pf('Address', `<input class="input" type="url" data-id="${b.id}" data-f="url" data-url value="${esc(b.url)}" placeholder="https://staging.example.com" autocomplete="off" spellcheck="false"${ro()}>`)
            + `<p class="pf-warn" data-url-msg="${b.id}" hidden></p></div>`;
    });
    if (!state.readOnly) s += actBtn('add-base', '+ Address');
    return s + '</div>';
}
function renderTestRail() {
    const doc = state.doc, cases = testCases(doc), base = baseShown(), off = ro();
    let s = '';
    if (doc.bases.length > 1) s += `<label class="pf"><span class="pf-l">Test against</span><select class="select" id="testBase">${doc.bases.map((b) => `<option value="${b.id}"${base && b.id === base.id ? ' selected' : ''}>${esc(b.name || b.url || 'Base')}</option>`).join('')}</select></label>`;
    else if (!doc.bases.length) s += '<p class="pf-note">Add a live address (select nothing on the board) so a test can open the real screens.</p>';
    if (state.walk.pick >= 0 && walkPaths()[state.walk.pick]) s += `<button type="button" class="btn btn-ghost sm wide" data-act="test-walk"${off}>Test the way marked in Walk</button>`;
    if (cases.length) {
        s += `<details class="f-more"${state.casesOpen ? ' open' : ''} id="casesList"><summary data-raw>${esc(tr('Test cases ({n})', { n: cases.length }))}</summary><p class="pf-note">Every way from the start to an end.</p>`
            + cases.map((c, i) => `<div class="tc-row"><span class="tc-name">${i + 1}. ${esc(c.name)} <span class="dim">${esc(tn(caseSteps(doc, c.path).length, '1 screen', '{n} screens'))}</span></span>`
                + `<button type="button" class="f-btn" data-act="test-case" data-i="${i}"${off}>Run</button></div>`).join('') + '</details>';
    } else s += `<p class="pf-note">${doc.screens.some((x) => x.start) ? 'No way leads from the start to an end yet, so there is no test case.' : 'Mark a start screen to get test cases.'}</p>`;
    const runs = doc.runs.slice().sort((a, b) => b.at - a.at);
    if (runs.length) {
        s += '<div class="pf-head">Runs</div>' + runs.map((r) => {
            const t = runTally(doc, r.id);
            return `<div class="tc-row"><button type="button" class="tc-run ${t.verdict}" data-act="test-open" data-id="${r.id}"><span class="tp-mark" aria-hidden="true">${t.verdict === 'pass' ? '✓' : t.verdict === 'fail' ? '✕' : '○'}</span>`
                + `<span class="tc-name">${esc(r.name)} <span class="dim">${esc(t.fail ? tr('{n} failed', { n: t.fail }) : t.todo ? tr('{n} of {n2}', { n: t.total - t.todo, n2: t.total }) : tr('passed'))} · ${esc(new Date(r.at).toLocaleDateString())}</span></span></button>`
                + `<button type="button" class="f-btn" data-act="del" data-id="${r.id}" aria-label="Delete this run"${off}>✕</button></div>`;
        }).join('');
    }
    const box = $('railTest'), was = document.activeElement, keep = was && box.contains(was) ? was.id : '';
    box.innerHTML = s;
    translateChrome(box);
    if (keep && $(keep)) $(keep).focus();
}

// ---- Test cases as a sheet ----
function casesCsv() {
    const doc = state.doc, lines = [['case', 'step', 'do', 'expect', 'live address'].map(csvCell).join(',')];
    testCases(doc).forEach((c, i) => caseSteps(doc, c.path).forEach((s, n) => {
        lines.push([`${i + 1}. ${c.name}`, n + 1, s.via || tr('Open the workflow'), s.name, recOf(doc, s.stop).path].map(csvCell).join(','));
    }));
    return '﻿' + lines.join('\r\n') + '\r\n';
}
