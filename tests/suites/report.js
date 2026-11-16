// @realtime
// The report in the fleet's document designs: its pages, its preview, and
// its file as a PDF or as HTML.
suite(async (ok, eq) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const parse = (html) => new DOMParser().parseFromString(html, 'text/html');

    // ---- packing pieces into pages ----
    eq('pieces fill a page and go over to the next', packPages([40, 40, 40, 40], [false, false, false, false], 100), [[0, 1], [2, 3]]);
    eq('a heading goes over the page with what follows it', packPages([40, 40, 10, 40], [false, false, true, false], 100), [[0, 1], [2, 3]]);
    eq('a run of headings stays together', packPages([70, 10, 10, 30], [false, true, true, false], 100), [[0], [1, 2, 3]]);
    eq('a piece taller than a page has one to itself', packPages([30, 300, 30], [false, false, false], 100), [[0], [1], [2]]);
    eq('nothing gives one empty page', packPages([], [], 100), [[]]);

    // ---- the designs ----
    loadSample();
    const ids = exportStops('all');
    const white = await reportDesigned(ids, { theme: 'white' });
    const d = parse(white.html), pages = Array.from(d.querySelectorAll('section.page'));
    ok('the report is letter pages, more than one for the sample', white.pages > 1 && pages.length === white.pages && /@page \{ size: 8\.5in 11in; margin: 0; \}/.test(white.html));
    eq('in the design asked for', d.documentElement.getAttribute('data-theme'), 'white');
    ok('every page has the head, the mark behind it and a numbered foot', pages.every((p, i) => p.querySelector('header .wordmark') && p.querySelector('.watermark svg') && p.querySelector('footer span:last-child').textContent === `${i + 1} / ${pages.length}`));
    eq('the first page has the kicker, the title and four cards', [pages[0].querySelector('.kicker').textContent, pages[0].querySelector('h1').textContent, pages[0].querySelectorAll('.cards .card').length, pages[0].querySelector('.card.hi .v').textContent], ['Workflow report', 'Shop', 4, '11']);
    eq('the sections are numbered', Array.from(d.querySelectorAll('h2 i')).map((i) => i.textContent), ['01', '02', '03', '04', '05']);
    eq('every stop is in it', d.querySelectorAll('.stop').length, state.doc.screens.length + state.doc.decisions.length);
    eq('every size of every screen is a picture', d.querySelectorAll('.shots img').length, state.doc.sizes.length);
    ok('the pictures are written into the file', Array.from(d.querySelectorAll('img')).every((i) => i.getAttribute('src').startsWith('data:image/png;base64,')));
    ok('it has no script and loads nothing from elsewhere', !d.querySelector('script') && Array.from(d.querySelectorAll('link')).every((l) => l.href.startsWith(location.origin)));
    for (const theme of ['black', 'blue']) {
        const r = await reportDesigned(ids, { theme });
        eq(`${theme}: the same pages in another design`, [parse(r.html).documentElement.getAttribute('data-theme'), r.pages], [theme, white.pages]);
    }
    eq('a design that is not one is white', parse((await reportDesigned(ids, { theme: 'pink' })).html).documentElement.getAttribute('data-theme'), 'white');
    const bare = await reportDesigned(ids, { theme: 'white', noSources: true });
    ok('the sources can be left out', /Shop app repository|example\.com/.test(white.html) && !/Shop app repository|example\.com/.test(bare.html));
    setF(state.doc.screens[0].id, 'name', '<b>Sign & in</b>');
    const odd = (await reportDesigned(ids, { theme: 'white' })).html;
    ok('names are written as text, not as markup', /&lt;b&gt;Sign &amp; in&lt;\/b&gt;/.test(odd) && !/<b>Sign & in/.test(odd));
    undo();

    // ---- nothing runs off a page ----
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-3000px;top:0;width:816px;height:1056px;border:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(white.html.replace(/@media screen \{[\s\S]*?\n\}\n/, '')); f.contentDocument.close();
    await wait(900);
    const fd = f.contentDocument, over = Array.from(fd.querySelectorAll('.page')).map((p) => Math.max(...Array.from(p.querySelectorAll('.atom')).map((a) => a.getBoundingClientRect().bottom)) - p.querySelector('footer').getBoundingClientRect().top);
    ok('on every page the last piece ends above the foot', over.length === white.pages && over.every((v) => v <= 0), JSON.stringify(over.map(Math.round)));
    ok('and each page is exactly a letter page', Array.from(fd.querySelectorAll('.page')).every((p) => p.getBoundingClientRect().width === 816 && p.getBoundingClientRect().height === 1056));
    f.remove();

    // ---- findings are listed by their class ----
    addScreen('phone'); addDecision();
    const found = parse((await reportDesigned(exportStops('all'), { theme: 'white' })).html);
    const subs = Array.from(found.querySelectorAll('.sub')).map((s) => s.textContent);
    ok('the report lists findings under what kind each is', subs.some((s) => /^Unchanged since it was added · 1$/.test(s)) && subs.some((s) => /^Decisions that lead nowhere · 1$/.test(s)) && found.querySelectorAll('li.err').length > 0);
    undo(); undo();

    // ---- the preview ----
    try { localStorage.removeItem('flow_report_design'); localStorage.removeItem('carino-report-format'); } catch (e) { /* no storage */ }
    document.querySelector('[data-act="report-open"]').click();
    const dlg = document.getElementById('reportDlg'), status = document.getElementById('reportStatus'), frame = document.getElementById('reportFrame');
    for (let i = 0; i < 200 && !_rp.html; i++) await wait(100);
    ok('File, Report opens the preview with the report in it', dlg.open && _rp.html.includes('data-theme="white"') && frame.srcdoc === _rp.html);
    eq('it says how long the report is', status.textContent, `${white.pages} pages · Letter`);
    eq('the designs on offer', Array.from(document.querySelectorAll('input[name="reportDesign"]')).map((r) => r.value), ['white', 'black', 'blue', 'plain']);
    const sw = document.getElementById('reportFormat');
    ok('the PDF | HTML switch is there, on PDF', !!sw && Array.from(sw.querySelectorAll('[data-format]')).map((b) => b.dataset.format + b.getAttribute('aria-checked')).join() === 'pdftrue,htmlfalse');
    eq('the file is named for the workflow and the format', [document.getElementById('reportName').textContent, document.getElementById('reportGo').textContent], ['Shop report.pdf', 'Download PDF']);
    sw.querySelector('[data-format="html"]').click();
    eq('HTML changes the name and the button', [document.getElementById('reportName').textContent, document.getElementById('reportGo').textContent], ['Shop report.html', 'Download HTML']);
    document.querySelector('input[name="reportDesign"][value="blue"]').click();
    for (let i = 0; i < 60 && !_rp.html.includes('data-theme="blue"'); i++) await wait(100);
    ok('another design redraws it, and is remembered', _rp.html.includes('data-theme="blue"') && localStorage.getItem('flow_report_design') === 'blue');
    document.querySelector('input[name="reportDesign"][value="plain"]').click();
    for (let i = 0; i < 60 && _rp.html.includes('data-theme'); i++) await wait(100);
    ok('Plain is the report with no design', !_rp.html.includes('class="page"') && /Workflow report/.test(_rp.html) && /no design/.test(status.textContent));
    document.querySelector('input[name="reportDesign"][value="black"]').click();
    for (let i = 0; i < 60 && !_rp.html.includes('data-theme="black"'); i++) await wait(100);

    // ---- the files ----
    const saved = [], realSave = window.saveBlob;
    const eng = window.CarinoPdf;
    ok('the fleet\'s report engine is on the page', !!eng && typeof eng.download === 'function');
    const html = await eng.htmlFile(_rp.html, {});
    ok('the HTML file stands alone: fonts written in, no stylesheet to fetch, no script', /@font-face/.test(html) && !/<link[^>]+href=/.test(html) && !/<script/.test(html) && /data-theme="black"/.test(html));
    const pdf = await eng.pdf(_rp.html, { fonts: 'fonts/carino-fonts.css', title: 'Shop' });
    const headBytes = new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 400).arrayBuffer()));
    eq('the PDF has a page for every page of the report', [pdf.type, headBytes.startsWith('%PDF-'), Number((/\/Count (\d+)/.exec(headBytes) || [])[1])], ['application/pdf', true, white.pages]);
    ok('and each is a letter page', /\/MediaBox \[0 0 612 792\]/.test(new TextDecoder().decode(new Uint8Array(await pdf.slice(0, 1200).arrayBuffer()))));
    document.querySelector('[data-act="report-close"]').click();
    ok('✕ closes the preview', !dlg.open);

    // ---- from the Export dialog, for a part ----
    selectId(state.doc.screens.find((s) => s.name === 'Cart').id);
    document.querySelector('[data-act="export-open"]').click();
    const as = document.getElementById('exportAs');
    as.value = 'report'; as.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('input[name="exportWhat"][value="screen"]').click();
    eq('Export offers to preview a report', document.getElementById('exportGo').textContent, 'Preview the report…');
    document.getElementById('exportGo').click();
    for (let i = 0; i < 60 && !(_rp.html && _rp.what === 'screen'); i++) await wait(100);
    ok('which opens the preview for what was chosen', !document.getElementById('exportDlg').open && dlg.open && parse(_rp.html).querySelectorAll('.stop').length === 1 && /of 15 stops/.test(_rp.html));
    eq('named for the part', document.getElementById('reportName').textContent, 'Shop Cart report.html');
    setLocale('es'); render(); await drawReport();
    ok('the report and its preview are in Flow\'s language', /Informe del flujo|Informe/.test(parse(_rp.html).querySelector('.kicker').textContent) && document.getElementById('reportGo').textContent === 'Descargar HTML' && /página/.test(status.textContent));
    setLocale('en'); render();
    document.querySelector('[data-act="report-close"]').click();
    try { localStorage.removeItem('flow_report_design'); localStorage.removeItem('carino-report-format'); } catch (e) { /* no storage */ }

    // ---- the fleet's blocks on the start page ----
    ok('the start page carries the fleet\'s short hero', !!document.querySelector('#landing .short-hero'));
});
