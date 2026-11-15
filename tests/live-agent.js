// Put into each copy of the app by tests/live-e2e.js: hands the test what the
// page keeps in constants, which another window cannot otherwise reach.
window.__flow = {
    get state() { return state; },
    text: () => JSON.stringify(serializeDoc(state.doc)),
    rec: (id) => recOf(state.doc, id),
    setF: (id, field, value) => setF(id, field, value),
    closeDlg: (id) => closeDlg(id)
};
