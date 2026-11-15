# The Flow server

Flow works without a server: the website and a copy opened from disk never
talk to one. The server is for one thing the browser cannot do alone:
several people changing one workflow at once.

`flow-server` is one program. It serves the same static files and adds
**live rooms** to them. It is in `server/`, written in Go with only the
standard library, and keeps each room as a folder of files.

## What the server can and cannot see

Everything about a workflow is encrypted in the browser before it is sent:
the snapshot, every change, and where each person's pointer is. The key is
made in the browser of whoever starts the room and travels in the link's
fragment (after the `#`), which browsers never send. The server orders and
relays bytes it cannot read.

It can see: that a room exists, how many changes it has had, how big they
are, when they came, from which address, and how many people are following.
It cannot see: the workflow, its name, anyone's name, or what changed.

Whoever has a room's link has the workflow. Send a link the way you would
send the file.

## Running it

```bash
cd server
go build -o flow-server ./cmd/flow-server
./flow-server -web .. -data /var/lib/flow -addr 127.0.0.1:8750
```

| Flag | Meaning | Default |
|---|---|---|
| `-web` | the folder with Flow's `index.html` | `.` |
| `-data` | where rooms are kept | `./flow-data` |
| `-addr` | the address to listen on | `127.0.0.1:8750` |

It speaks plain HTTP. Put it behind a reverse proxy that speaks HTTPS: the
browser's encryption (Web Crypto) only works on a secure page, which means
HTTPS or `localhost`. The proxy must not buffer the event stream
(`/api/rooms/*/events`); the server sends `X-Accel-Buffering: no` for nginx.

Back up the data folder by copying it. A room is `meta.json`, `snap` and
`log.jsonl`. Without the link, a copy of the folder is unreadable.

## Rooms

- **Starting one:** File, Live, "Start a live room". The workflow that is
  open becomes the room's. The maker is its owner and gets two links to
  hand out.
- **Links:** one that can change the workflow, one that can only look. A
  link is `#r~<room>~<key>~<token>`: the room, the key (never sent) and the
  token that says what the link may do.
- **Roles:** owner (can also end the room), editor, viewer. The server
  enforces them by token; it stores only a hash of each.
- **Joining:** the page takes the link out of the address bar at once,
  fetches the sealed snapshot and the changes since, and follows the room.
  What the joiner had open is kept in Your workflows first.
- **Leaving:** the workflow stays open as that browser's own copy.
- **Ending:** the owner can delete the room for everyone.

## How changes merge

Every change in Flow is a list of operations: add a record, remove one, set
one field of one. In a room each list is sealed and sent; the server gives
it the next place in one order and relays it to everyone, its sender
included. Every browser applies the lists in that order.

- Two people changing **different fields** both keep their change.
- Two people setting **the same field** at the same moment: the one the
  server placed later stands, for everyone.
- A change to a record that someone else **removed** is dropped, for everyone.
- A browser shows its own change at once. When its change comes back from
  the server, and someone else's was placed before it, it applies its own
  again so the server's order stands.
- **Undo** takes back your own change, by sending the reverse operations.
  It does not take back anyone else's.

Now and then a browser that can change the room sends a fresh sealed
snapshot, and the server drops the changes it covers. Someone who was away
for longer than the log reaches joins afresh.

## Limits

- 32 people following a room at once.
- 512 KB per change, 8 MB per snapshot.
- 20,000 changes since the last snapshot (a snapshot is taken every 200).
- 2,000 rooms per server.

## What is not built

- **Accounts.** A room is reached by its link alone. There is no sign-in, no
  list of your rooms, and no way to take back a link you have sent short of
  ending the room.
- **Per-field history.** The server keeps the order of changes only until
  the next snapshot.
- **Rate limits** beyond the sizes above. Put the proxy's in front if the
  server is on the open internet.

## API

A token goes in `Authorization: Bearer`, never in the address. Requests from
another site's page are refused.

| | | Needs |
|---|---|---|
| `GET /api/live` | is this a Flow server? | |
| `POST /api/rooms` | make a room from a sealed snapshot; returns the id and three tokens | |
| `GET /api/rooms/{id}` | the snapshot and the changes since | view |
| `GET /api/rooms/{id}/events?by=&after=` | follow the room (server-sent events: `hello`, `op`, `presence`, `gone`, `reset`) | view |
| `POST /api/rooms/{id}/ops` | add a change; returns its place | edit |
| `POST /api/rooms/{id}/snapshot` | replace the snapshot with one of a later place | edit |
| `POST /api/rooms/{id}/presence` | where I am; relayed to the others, not kept | view |
| `DELETE /api/rooms/{id}` | end the room | owner |

Sealed data is base64 of 12 bytes of IV followed by AES-256-GCM ciphertext
of JSON, under the room's key.

## Tests

```bash
cd server && go test -race ./...
```

End to end, with three copies of the app in one room: run the server, then
open `http://127.0.0.1:8750/tests/live-e2e.html`. It prints PASS and FAIL lines.
