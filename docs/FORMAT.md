# The Flow file format

A Flow file is JSON. The schema is [`schema/flow-v1.json`](../schema/flow-v1.json)
(JSON Schema 2020-12). `tests/suites/formatschema.js` fails when the schema
and the code disagree about any field.

Suggested file name: `name.flow.json`. Media type: `application/vnd.carino.flow+json`.

## The envelope

```json
{
  "$schema": "https://flow.carino.systems/schema/flow-v1.json",
  "kind": "flowdoc",
  "version": 1,
  "name": "Shop checkout",
  "doc": { "v": 1, "name": "Shop checkout", "lang": "en", "screens": [], "sizes": [], "elements": [], "decisions": [], "links": [], "sources": [], "blocks": [], "styles": [], "langs": [], "words": [], "accepts": [], "pins": [], "bases": [], "runs": [], "steps": [] }
}
```

`part`, when `true`, says the document is some screens of a larger workflow
(see Parts). `version` is the envelope's version. `doc.v` is the document's. A bare
document with no envelope opens too.

## The document

Fifteen flat lists of records, and two fields of its own: `name`, and `lang`,
the code of the language the elements' text is written in (default `en`). Every record has an `id` and refers to other
records by id, never by position.

| List | A record is | Refers to |
|---|---|---|
| `screens` | a stop in the workflow that the user sees | a source |
| `sizes` | one drawing of a screen at one width and height | its screen |
| `elements` | a control or piece of content on a size or in a block | its size or block, a source, styles |
| `decisions` | a stop that is a question | |
| `links` | a way from one stop to another | two stops, an element, a source |
| `sources` | an outside address where the real work is kept | |
| `blocks` | a group of elements drawn once and placed on many screens | |
| `styles` | a named colour or text size | |
| `langs` | another language the drawn interface is written in | |
| `words` | one text of one language's dictionary | its language |
| `accepts` | a finding someone accepted, and why | |
| `pins` | a finding someone marked to come back to | |
| `bases` | a base address the screens' live addresses hang off | |
| `runs` | one test of one way through the workflow | a base |
| `steps` | one screen of a run, and how it went | its run, a screen |

A stop is a screen or a decision. A link's `from` and `to` are stops.

### Rules

- **Ids** are a list prefix (`scr`, `siz`, `el`, `dec`, `lnk`, `src`, `blk`, `sty`, `lng`, `wrd`, `acc`, `pin`, `bas`, `run`, `stp`), an
  underscore, then letters and digits. They are opaque and never reused.
- **A field that is absent holds its default.** Flow writes only the fields
  that differ from it. The defaults are in the schema.
- **Order is a field.** `z` on sizes and elements gives the drawing order,
  lowest first. The order of records in a list means nothing; Flow writes
  them sorted by id, so the same content is always the same bytes.
- **Sizes are in CSS pixels.** `contentH` is the full height of content that
  scrolls, and 0 when it does not.
- **Blocks.** An element whose `size` is a block's id is part of that
  block's own drawing. An element of type `block` is a placing: it draws the
  elements of the block named in its `block` field inside its own box, each
  put where its pins say. A placing sits on a size, never inside a block.
- **Pins.** `pinH` and `pinV` say what an element keeps hold of when what it
  is drawn on changes size: `left`/`top` (it stays), `right`/`bottom` (it
  keeps its distance from that edge), `both` (it stretches), `center`, or
  `scale` (it keeps its share).
- **Styles.** `fill` and `ink` point at a style of kind `color`;
  `textStyle` at one of kind `text`, which then gives the size and weight
  in place of `fs`.
- **Languages.** An element's `text` is in the document's `lang`. An
  element with a `key` says, in another language, the `text` of the word
  that has that language and that key; with no such word it keeps its own
  text. There is one word per language and key. A word whose key no element
  has is kept. Which language is shown is not stored.
- **Findings are not stored.** A reader works them out. What is stored is
  what someone said about one: `accepts` and `pins` name a finding by its
  key, the check, a colon and the id of the record it is about
  (`dead-end:scr_...`; nothing after the colon when it is about the whole
  document). One of each per finding.
- **Live addresses.** A screen's live address is a base's `url` and the
  screen's `path`, joined with one slash. A `path` that is itself an http(s)
  address stands alone.
- **Runs.** A run's steps are in order of `n`. A step keeps `name` and `via`
  as text from when the run started; its `stop` is cleared, not the step
  removed, when that screen goes. Test cases are not stored: they are every
  way from a start to an end.
- **A source's `url` is http or https only.** Anything else is dropped on
  reading. Flow never fetches it.

### What a reader must repair

Flow repairs these when it reads a document, and another reader should too:

- a record with a missing, malformed or repeated id is dropped;
- a size whose screen is missing, and an element whose size or block is missing, are dropped;
- a placing whose block is missing, or that sits inside a block, is dropped;
- a word whose language is missing, that has no key, or that repeats a language and key, is dropped;
- a step whose run is missing is dropped; a step's `stop` or a run's `base` that points at nothing is cleared;
- an accept or pin that repeats a finding, or is about a record that is missing, is dropped;
- a `fill`, `ink` or `textStyle` that points at nothing, or at a style of the wrong kind, is cleared;
- a link whose `from` or `to` is not a stop is dropped;
- a `fromEl` or `source` that points at nothing is cleared;
- a screen with no size is given one (Phone, 390 by 844).

## Parts

A part is a document holding some stops of a workflow, made to be worked on
apart and merged back. Its envelope has `"part": true`.

- It holds the chosen stops, their sizes and elements, the links that leave
  them, and only the blocks, styles, sources and words they use.
- A link that leaves the part has its far end in the part as a **stub**: a
  screen or decision with `"stub": true`, its name, and nothing drawn on it.
- To merge a part back, match records by id. A record in both takes the
  part's fields; a record only in the part is added. A stub changes nothing.
  Of the part's own stops, a size, element or link that the workflow has and
  the part does not was removed in the part, and is removed.

## Sealed links

A share link is `https://flow.carino.systems/#e~` followed by base64url of:
1 byte version (1), 16 bytes salt, 12 bytes IV, then AES-256-GCM ciphertext.
The key is PBKDF2-SHA-256 of the passphrase with that salt, 310,000 rounds.
The plaintext is 1 byte (1 when what follows is raw deflate, else 0) and the
file's JSON.

## Binders

A binder is every kept workflow in one file, `*.flowbinder.json`:

    { "kind": "flowbinder", "version": 1, "made": "<ISO date>", "workflows": [ <a file's envelope>, ... ] }

Each entry is exactly what Save a copy writes for that workflow.

## Plain links

A plain link is `https://flow.carino.systems/#~` followed by base64url of the
file's JSON as raw deflate. A browser that cannot deflate writes `#u~` and
base64url of the JSON itself. Nothing in it is secret: whoever has the link
has the workflow.

## Versions

A document with a `v` higher than the reader knows must be opened read-only
or refused, never saved: saving would drop what the newer version added.

## Dictionary files

A dictionary is a separate JSON file, named after its language (`es.json`,
`messages_pt-BR.json`). It maps keys to texts, flat or nested; nested names
join with a dot, so `{ "cart": { "pay": "Pagar" } }` is the key `cart.pay`.
Values that are not text are ignored. Flow saves dictionaries flat, keys in
order.
