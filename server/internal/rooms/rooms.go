// Package rooms keeps live rooms: for each, a sealed snapshot of the workflow
// and the sealed operations made since, in the order the server received
// them. The server cannot read any of it: everything is encrypted in the
// browsers with a key that is never sent here. What the server adds is the
// one thing the browsers cannot agree on by themselves: the order.
//
// A room is a folder: meta.json, snap (the snapshot's bytes) and log.jsonl
// (one operation batch per line). No database: a room is small, and a folder
// can be backed up by copying it.
package rooms

import (
	"bufio"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

// Role is what a token lets its holder do.
type Role int

const (
	None  Role = iota
	View       // read the room and follow it
	Edit       // also add operations and snapshots
	Owner      // also delete the room
)

func (r Role) String() string {
	return [...]string{"none", "view", "edit", "owner"}[r]
}

var (
	ErrNotFound = errors.New("no such room")
	ErrTooMany  = errors.New("too many")
	ErrTooBig   = errors.New("too big")
	ErrBadSeq   = errors.New("a snapshot must be of a point the room has reached and not yet snapshotted")
)

// Limits. A room is for a team working on one workflow, not for a crowd.
const (
	MaxRooms     = 2000
	MaxPeers     = 32
	MaxOpBytes   = 512 << 10
	MaxSnapBytes = 8 << 20
	MaxLogOps    = 20000 // past this, a snapshot is needed before more operations are taken
)

// Batch is one change by one browser: sealed operations and their place in the order.
type Batch struct {
	Seq  int64  `json:"seq"`
	By   string `json:"by"`   // the browser tab that made it
	N    int64  `json:"n"`    // that tab's own count, so it knows its batches when they come back
	Data string `json:"data"` // sealed: the server stores and relays it unread
}

// Event is what a subscriber is sent.
type Event struct {
	Kind  string // "op", "presence", "gone"
	Batch Batch
}

type meta struct {
	ID      string `json:"id"`
	Created int64  `json:"created"`
	Seq     int64  `json:"seq"`     // the last operation's place
	SnapSeq int64  `json:"snapSeq"` // the place the snapshot is of
	View    string `json:"view"`    // sha-256 of each token, never the token
	Edit    string `json:"edit"`
	Owner   string `json:"owner"`
}

type room struct {
	mu   sync.Mutex
	dir  string
	meta meta
	log  []Batch // operations after SnapSeq, in order
	subs map[chan Event]string
}

// Store is every room under one folder.
type Store struct {
	dir   string
	mu    sync.Mutex
	rooms map[string]*room
}

var idRE = regexp.MustCompile(`^[a-z0-9]{16,40}$`)

func Open(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, err
	}
	return &Store{dir: dir, rooms: map[string]*room{}}, nil
}

func token(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err) // no randomness: nothing the server hands out would be safe
	}
	return hex.EncodeToString(b)
}

func hash(t string) string {
	s := sha256.Sum256([]byte(t))
	return hex.EncodeToString(s[:])
}

// Tokens are what a new room's maker is given, once.
type Tokens struct {
	ID, View, Edit, Owner string
}

// Create makes a room that starts from a sealed snapshot.
func (s *Store) Create(snapshot []byte) (Tokens, error) {
	if len(snapshot) > MaxSnapBytes {
		return Tokens{}, ErrTooBig
	}
	entries, _ := os.ReadDir(s.dir)
	if len(entries) >= MaxRooms {
		return Tokens{}, ErrTooMany
	}
	t := Tokens{ID: token(12), View: token(24), Edit: token(24), Owner: token(24)}
	r := &room{dir: filepath.Join(s.dir, t.ID), subs: map[chan Event]string{}}
	r.meta = meta{ID: t.ID, Created: time.Now().UnixMilli(), View: hash(t.View), Edit: hash(t.Edit), Owner: hash(t.Owner)}
	if err := os.MkdirAll(r.dir, 0o700); err != nil {
		return Tokens{}, err
	}
	if err := writeFile(filepath.Join(r.dir, "snap"), snapshot); err != nil {
		return Tokens{}, err
	}
	if err := r.saveMeta(); err != nil {
		return Tokens{}, err
	}
	s.mu.Lock()
	s.rooms[t.ID] = r
	s.mu.Unlock()
	return t, nil
}

func (s *Store) get(id string) (*room, error) {
	if !idRE.MatchString(id) {
		return nil, ErrNotFound
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if r, ok := s.rooms[id]; ok {
		return r, nil
	}
	r := &room{dir: filepath.Join(s.dir, id), subs: map[chan Event]string{}}
	b, err := os.ReadFile(filepath.Join(r.dir, "meta.json"))
	if err != nil {
		return nil, ErrNotFound
	}
	if err := json.Unmarshal(b, &r.meta); err != nil || r.meta.ID != id {
		return nil, ErrNotFound
	}
	if f, err := os.Open(filepath.Join(r.dir, "log.jsonl")); err == nil {
		sc := bufio.NewScanner(f)
		sc.Buffer(make([]byte, 64<<10), MaxOpBytes*2)
		for sc.Scan() {
			var b Batch
			// A line cut short by a crash is the last one, and is dropped.
			if json.Unmarshal(sc.Bytes(), &b) == nil && b.Seq > r.meta.SnapSeq {
				r.log = append(r.log, b)
			}
		}
		f.Close()
	}
	// The log is the truth about how far the room has got.
	if n := len(r.log); n > 0 && r.log[n-1].Seq > r.meta.Seq {
		r.meta.Seq = r.log[n-1].Seq
	} else if n == 0 && r.meta.Seq < r.meta.SnapSeq {
		r.meta.Seq = r.meta.SnapSeq
	}
	s.rooms[id] = r
	return r, nil
}

// Role says what a token may do in a room. The comparison takes the same
// time whether or not the token is right.
func (s *Store) Role(id, tok string) (Role, error) {
	r, err := s.get(id)
	if err != nil {
		return None, err
	}
	h := []byte(hash(tok))
	role := None
	for _, c := range []struct {
		want string
		role Role
	}{{r.meta.View, View}, {r.meta.Edit, Edit}, {r.meta.Owner, Owner}} {
		if subtle.ConstantTimeCompare(h, []byte(c.want)) == 1 {
			role = c.role
		}
	}
	return role, nil
}

// State is what a browser needs to join: the snapshot and what came after.
type State struct {
	Seq, SnapSeq int64
	Snapshot     []byte
	Ops          []Batch
}

func (s *Store) Join(id string) (State, error) {
	r, err := s.get(id)
	if err != nil {
		return State{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	snap, err := os.ReadFile(filepath.Join(r.dir, "snap"))
	if err != nil {
		return State{}, err
	}
	return State{Seq: r.meta.Seq, SnapSeq: r.meta.SnapSeq, Snapshot: snap, Ops: append([]Batch(nil), r.log...)}, nil
}

// Append gives a batch its place in the order, keeps it and tells the room.
func (s *Store) Append(id, by string, n int64, data string) (int64, error) {
	if len(data) > MaxOpBytes {
		return 0, ErrTooBig
	}
	r, err := s.get(id)
	if err != nil {
		return 0, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.log) >= MaxLogOps {
		return 0, ErrTooMany
	}
	b := Batch{Seq: r.meta.Seq + 1, By: by, N: n, Data: data}
	line, _ := json.Marshal(b)
	f, err := os.OpenFile(filepath.Join(r.dir, "log.jsonl"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return 0, err
	}
	_, err = f.Write(append(line, '\n'))
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return 0, err
	}
	r.meta.Seq = b.Seq
	r.log = append(r.log, b)
	r.send(Event{Kind: "op", Batch: b}, "")
	return b.Seq, nil
}

// Snapshot replaces the room's snapshot with one of a later point, and drops
// the operations it covers. It is how the log stays short.
func (s *Store) Snapshot(id string, seq int64, data []byte) error {
	if len(data) > MaxSnapBytes {
		return ErrTooBig
	}
	r, err := s.get(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if seq <= r.meta.SnapSeq || seq > r.meta.Seq {
		return ErrBadSeq
	}
	if err := writeFile(filepath.Join(r.dir, "snap"), data); err != nil {
		return err
	}
	keep := r.log[:0:0]
	for _, b := range r.log {
		if b.Seq > seq {
			keep = append(keep, b)
		}
	}
	r.meta.SnapSeq = seq
	if err := r.saveMeta(); err != nil {
		return err
	}
	// The snapshot and its place are on disk; now the log can lose what they cover.
	var out []byte
	for _, b := range keep {
		line, _ := json.Marshal(b)
		out = append(out, line...)
		out = append(out, '\n')
	}
	if err := writeFile(filepath.Join(r.dir, "log.jsonl"), out); err != nil {
		return err
	}
	r.log = keep
	return nil
}

func (s *Store) Delete(id string) error {
	r, err := s.get(id)
	if err != nil {
		return err
	}
	// The store is held until the folder is gone: a stream that is still
	// closing must not find half a room and take it for a whole one.
	s.mu.Lock()
	defer s.mu.Unlock()
	r.mu.Lock()
	for ch := range r.subs {
		close(ch)
	}
	r.subs = map[chan Event]string{}
	r.mu.Unlock()
	delete(s.rooms, id)
	return os.RemoveAll(r.dir)
}

// Subscribe follows a room from after a place in the order. It returns what
// was missed, and a channel of what comes next. reset is true when what was
// missed is no longer kept: the browser must join afresh.
func (s *Store) Subscribe(id, by string, after int64) (missed []Batch, ch chan Event, reset bool, err error) {
	r, err := s.get(id)
	if err != nil {
		return nil, nil, false, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if len(r.subs) >= MaxPeers {
		return nil, nil, false, ErrTooMany
	}
	if after < r.meta.SnapSeq {
		return nil, nil, true, nil
	}
	for _, b := range r.log {
		if b.Seq > after {
			missed = append(missed, b)
		}
	}
	ch = make(chan Event, 256)
	r.subs[ch] = by
	return missed, ch, false, nil
}

func (s *Store) Unsubscribe(id string, ch chan Event) {
	r, err := s.get(id)
	if err != nil {
		return
	}
	r.mu.Lock()
	by, ok := r.subs[ch]
	if ok {
		delete(r.subs, ch)
		close(ch)
		r.send(Event{Kind: "gone", Batch: Batch{By: by}}, "")
	}
	r.mu.Unlock()
}

// Presence is relayed and forgotten: where someone's pointer is, is not history.
func (s *Store) Presence(id, by, data string) error {
	if len(data) > 8<<10 {
		return ErrTooBig
	}
	r, err := s.get(id)
	if err != nil {
		return err
	}
	r.mu.Lock()
	r.send(Event{Kind: "presence", Batch: Batch{By: by, Data: data}}, by)
	r.mu.Unlock()
	return nil
}

// Peers is how many browsers follow a room.
func (s *Store) Peers(id string) int {
	r, err := s.get(id)
	if err != nil {
		return 0
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.subs)
}

// send gives an event to every subscriber but one. A subscriber that has
// fallen 256 events behind is dropped; its browser joins again.
func (r *room) send(e Event, except string) {
	for ch, by := range r.subs {
		if except != "" && by == except {
			continue
		}
		select {
		case ch <- e:
		default:
			delete(r.subs, ch)
			close(ch)
		}
	}
}

func (r *room) saveMeta() error {
	b, _ := json.Marshal(r.meta)
	return writeFile(filepath.Join(r.dir, "meta.json"), b)
}

// writeFile replaces a file whole: written beside it, then renamed over it,
// so a crash leaves the old file or the new one, never half of one.
func writeFile(path string, data []byte) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
