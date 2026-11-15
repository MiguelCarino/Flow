// The kit: what can be added, and with which starting values. No DOM here.

// Sizes a screen can be drawn at. Any width and height can be typed; these
// are the shortcuts. input and distance say how the screen is used, which is
// what the size and text checks read (a later step), not the preset's name.
const SIZE_PRESETS = [
    { key: 'phone', name: 'Phone', w: 390, h: 844, input: 'touch', distance: 'near' },
    { key: 'tablet', name: 'Tablet', w: 820, h: 1180, input: 'touch', distance: 'near' },
    { key: 'laptop', name: 'Laptop', w: 1366, h: 768, input: 'pointer', distance: 'near' },
    { key: 'desktop', name: 'Desktop', w: 1920, h: 1080, input: 'pointer', distance: 'near' },
    { key: 'watch', name: 'Watch', w: 198, h: 242, input: 'touch', distance: 'near' },
    { key: 'tv', name: 'TV', w: 1920, h: 1080, input: 'remote', distance: 'far' }
];
const sizePreset = (key) => SIZE_PRESETS.find((p) => p.key === key) || SIZE_PRESETS[0];

// Sizes start big enough to press on a touch screen (44 px), so a new
// element is not a finding the moment it is added.
// The elements. group: where it sits in the Add list. control: the user acts
// on it (the size and name checks of a later step read this). lines: its
// text is a list, one item per line. state / amount: it has an on-off state
// or a 0-100 value to show.
const ELEMENT_GROUPS = [['content', 'Content'], ['controls', 'Controls'], ['structure', 'Structure']];
const ELEMENT_KIT = {
    box: { label: 'Box', group: 'content', w: 240, h: 120, text: '', fs: 16 },
    text: { label: 'Text', group: 'content', w: 240, h: 32, text: 'Text', fs: 16 },
    heading: { label: 'Heading', group: 'content', w: 280, h: 40, text: 'Heading', fs: 28 },
    link: { label: 'Link', group: 'content', w: 120, h: 44, text: 'Link', fs: 16, control: true },
    image: { label: 'Image', group: 'content', w: 240, h: 160, text: 'What the image shows', fs: 14 },
    icon: { label: 'Icon', group: 'content', w: 24, h: 24, text: '', fs: 12 },
    avatar: { label: 'Avatar', group: 'content', w: 48, h: 48, text: 'AB', fs: 16 },
    divider: { label: 'Divider', group: 'content', w: 240, h: 8, text: '', fs: 12 },
    button: { label: 'Button', group: 'controls', w: 160, h: 48, text: 'Button', fs: 16, control: true },
    input: { label: 'Input', group: 'controls', w: 240, h: 48, text: 'Placeholder', fs: 16, control: true },
    textarea: { label: 'Text area', group: 'controls', w: 240, h: 112, text: 'Placeholder', fs: 16, control: true },
    select: { label: 'Select', group: 'controls', w: 240, h: 48, text: 'Choose one', fs: 16, control: true },
    checkbox: { label: 'Checkbox', group: 'controls', w: 200, h: 44, text: 'Option', fs: 16, control: true, state: true },
    radio: { label: 'Radio', group: 'controls', w: 200, h: 44, text: 'Option', fs: 16, control: true, state: true },
    toggle: { label: 'Toggle', group: 'controls', w: 200, h: 44, text: 'Setting', fs: 16, control: true, state: true },
    slider: { label: 'Slider', group: 'controls', w: 240, h: 44, text: '', fs: 12, control: true, amount: true },
    card: { label: 'Card', group: 'structure', w: 280, h: 160, text: 'Card title', fs: 16 },
    list: { label: 'List', group: 'structure', w: 280, h: 168, text: 'First item\nSecond item\nThird item', fs: 16, lines: true },
    table: { label: 'Table', group: 'structure', w: 320, h: 144, text: 'Name | Amount\nFirst | 10\nSecond | 20', fs: 14, lines: true },
    topbar: { label: 'Top bar', group: 'structure', w: 390, h: 56, text: 'Title', fs: 18 },
    tabbar: { label: 'Tab bar', group: 'structure', w: 390, h: 64, text: 'Home\nSearch\nProfile', fs: 12, lines: true, control: true },
    tabs: { label: 'Tabs', group: 'structure', w: 320, h: 48, text: 'First\nSecond\nThird', fs: 14, lines: true, control: true },
    chip: { label: 'Chip', group: 'structure', w: 96, h: 32, text: 'Chip', fs: 14 },
    progress: { label: 'Progress', group: 'structure', w: 240, h: 8, text: '', fs: 12, amount: true },
    alert: { label: 'Alert', group: 'structure', w: 280, h: 56, text: 'Something needs your attention.', fs: 14 },
    // Not in a group: the Add list offers each block by its own name.
    block: { label: 'Block', group: '', w: 240, h: 120, text: '', fs: 16 }
};
const STYLE_KIND_LABEL = { color: 'Colour', text: 'Text' };
const WEIGHT_LABEL = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' };

const LINK_KIND_LABEL = { action: 'The user does something', system: 'The system decides', auto: 'Happens by itself', back: 'Goes back' };
const SOURCE_KIND_LABEL = { vector: 'Vector file', code: 'Code', board: 'Live board', other: 'Other' };
const STATUS_LABEL = { drawn: 'Drawn', designed: 'Designed', built: 'Built' };
const INPUT_LABEL = { touch: 'Touch', pointer: 'Mouse', remote: 'Remote' };
const DISTANCE_LABEL = { near: 'Held or at a desk', far: 'Across a room' };
const PIN_H_LABEL = { left: 'Left edge', right: 'Right edge', both: 'Both edges (stretches)', center: 'Centre', scale: 'Its share of the width' };
const PIN_V_LABEL = { top: 'Top edge', bottom: 'Bottom edge', both: 'Both edges (stretches)', center: 'Centre', scale: 'Its share of the height' };

// ---- Screen templates ----
// A template lays out a first set of elements for a size: build(w, h) -> the
// elements, without ids. Each is pinned so that changing the size, or adding
// another size of the screen, keeps the layout sensible.
function templateKit(w, h) {
    const m = w >= 700 ? 48 : 24, cw = w - m * 2;
    // Content wider than this is hard to read; on a wide screen it is centred.
    const col = Math.min(cw, 560), cx = Math.round((w - col) / 2 / GRID) * GRID;
    const wide = col < cw;
    const el = (type, x, y, ww, hh, text, extra = {}) => Object.assign({ type, x, y, w: ww, h: hh, text, fs: ELEMENT_KIT[type].fs }, extra);
    const row = (type, y, hh, text, extra = {}) => el(type, wide ? cx : m, y, col, hh, text, Object.assign({ pinH: wide ? 'center' : 'both' }, extra));
    return { m, cw, col, el, row, top: (title) => el('topbar', 0, 0, w, 56, title, { pinH: 'both' }) };
}
const SCREEN_TEMPLATES = [
    { key: 'blank', name: 'Blank', build: () => [] },
    { key: 'signin', name: 'Sign in', build: (w, h) => {
        const k = templateKit(w, h);
        return [
            k.row('heading', 96, 40, 'Welcome back'),
            k.row('input', 168, 48, 'Email', { name: 'Email' }),
            k.row('input', 232, 48, 'Password', { name: 'Password' }),
            k.row('button', 312, 48, 'Sign in', { name: 'Sign in' }),
            k.row('link', 368, 44, 'Forgot your password?', { name: 'Forgot password' })
        ];
    } },
    { key: 'list', name: 'List', build: (w, h) => {
        const k = templateKit(w, h);
        return [
            k.top('Items'),
            k.row('input', 72, 48, 'Search', { name: 'Search' }),
            k.row('list', 136, 280, 'First item\nSecond item\nThird item\nFourth item\nFifth item', { name: 'Items' }),
            k.el('tabbar', 0, h - 64, w, 64, 'Home\nSearch\nProfile', { pinH: 'both', pinV: 'bottom', name: 'Main tabs' })
        ];
    } },
    { key: 'detail', name: 'Detail', build: (w, h) => {
        const k = templateKit(w, h);
        return [
            k.top('Detail'),
            k.row('image', 72, 200, 'The main picture'),
            k.row('heading', 288, 40, 'Product name'),
            k.row('text', 336, 72, 'A short description of what this is, over a couple of lines.'),
            k.row('button', h - 72, 48, 'Continue', { pinV: 'bottom', name: 'Continue' })
        ];
    } },
    { key: 'form', name: 'Form', build: (w, h) => {
        const k = templateKit(w, h);
        return [
            k.top('Your details'),
            k.row('input', 80, 48, 'Full name', { name: 'Full name' }),
            k.row('input', 144, 48, 'Email', { name: 'Email' }),
            k.row('select', 208, 48, 'Country', { name: 'Country' }),
            k.row('checkbox', 272, 44, 'I agree to the terms', { name: 'Agree to terms' }),
            k.row('button', 336, 48, 'Save', { name: 'Save' })
        ];
    } },
    { key: 'settings', name: 'Settings', build: (w, h) => {
        const k = templateKit(w, h);
        return [
            k.top('Settings'),
            k.row('toggle', 72, 44, 'Notifications', { on: true, name: 'Notifications' }),
            k.row('toggle', 124, 44, 'Dark mode', { name: 'Dark mode' }),
            k.row('divider', 176, 8, ''),
            k.row('select', 200, 48, 'Language', { name: 'Language' }),
            k.row('button', h - 72, 48, 'Sign out', { pinV: 'bottom', name: 'Sign out' })
        ];
    } }
];
const screenTemplate = (key) => SCREEN_TEMPLATES.find((t) => t.key === key) || SCREEN_TEMPLATES[0];

// A small workflow to look at: sign in, a decision, a cart and a receipt.
// Returns the operations that build it, so it goes in like any other change.
function exampleOps() {
    const id = nextId;
    const signIn = id('screens'), cart = id('screens'), receipt = id('screens'), ask = id('decisions');
    const sSign = id('sizes'), sSignWide = id('sizes'), sCart = id('sizes'), sReceipt = id('sizes');
    const btnIn = id('elements'), btnPay = id('elements');
    const repo = id('sources');
    const add = (kind, rec) => ({ op: 'add', kind, rec });
    const phone = sizePreset('phone'), laptop = sizePreset('laptop');
    const size = (sid, screen, p, z) => add('sizes', { id: sid, screen, name: p.name, w: p.w, h: p.h, input: p.input, distance: p.distance, z });
    const el = (eid, sz, type, x, y, w, h, text, extra = {}) => add('elements', Object.assign({ id: eid, size: sz, type, x, y, w, h, text, z: y }, extra));
    return [
        add('sources', { id: repo, kind: 'code', label: 'Shop app repository', url: 'https://example.com/shop-app' }),
        add('screens', { id: signIn, name: 'Sign in', x: 0, y: 0, start: true, path: '/sign-in', source: repo, at: 'src/screens/SignIn' }),
        size(sSign, signIn, phone, 1), size(sSignWide, signIn, laptop, 2),
        el(id('elements'), sSign, 'heading', 32, 96, 326, 40, 'Welcome back', { fs: 28, pinH: 'both' }),
        el(id('elements'), sSign, 'input', 32, 176, 326, 48, 'Email', { name: 'Email', pinH: 'both' }),
        el(id('elements'), sSign, 'input', 32, 240, 326, 48, 'Password', { name: 'Password', pinH: 'both' }),
        el(btnIn, sSign, 'button', 32, 320, 326, 48, 'Sign in', { name: 'Sign in', pinH: 'both' }),
        el(id('elements'), sSignWide, 'heading', 520, 200, 326, 40, 'Welcome back', { fs: 28, pinH: 'center' }),
        el(id('elements'), sSignWide, 'button', 520, 424, 326, 48, 'Sign in', { name: 'Sign in', pinH: 'center' }),
        add('decisions', { id: ask, name: 'Is the password right?', x: 632, y: 344 }),
        add('screens', { id: cart, name: 'Cart', x: 1152, y: 0, path: '/cart' }),
        size(sCart, cart, phone, 1),
        el(id('elements'), sCart, 'heading', 32, 96, 326, 40, 'Your cart', { fs: 28, pinH: 'both' }),
        el(id('elements'), sCart, 'image', 32, 160, 326, 200, 'The product photo', { pinH: 'both' }),
        el(btnPay, sCart, 'button', 32, 400, 326, 48, 'Pay', { name: 'Pay', pinH: 'both' }),
        add('screens', { id: receipt, name: 'Receipt', x: 1784, y: 0, end: true, path: '/receipt' }),
        size(sReceipt, receipt, phone, 1),
        el(id('elements'), sReceipt, 'heading', 32, 96, 326, 40, 'Thank you', { fs: 28, pinH: 'both' }),
        add('links', { id: id('links'), from: signIn, fromEl: btnIn, to: ask, label: 'Taps Sign in' }),
        add('links', { id: id('links'), from: ask, to: cart, kind: 'system', cond: 'Yes' }),
        add('links', { id: id('links'), from: ask, to: signIn, kind: 'system', cond: 'No', label: 'Shows the error' }),
        add('links', { id: id('links'), from: cart, fromEl: btnPay, to: receipt, label: 'Taps Pay' })
    ];
}
