package api

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"carino.systems/flow/server/internal/rooms"
)

type env struct {
	t    *testing.T
	srv  *httptest.Server
	dir  string
	room map[string]string
}

func start(t *testing.T) *env {
	t.Helper()
	dir := t.TempDir()
	web := filepath.Join(dir, "web")
	os.MkdirAll(filepath.Join(web, "server"), 0o755)
	os.WriteFile(filepath.Join(web, "index.html"), []byte("<title>Flow</title>"), 0o644)
	os.WriteFile(filepath.Join(web, ".secret"), []byte("x"), 0o644)
	os.WriteFile(filepath.Join(web, "server", "go.mod"), []byte("x"), 0o644)
	store, err := rooms.Open(filepath.Join(dir, "data"))
	if err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer((&Server{Rooms: store, Web: http.Dir(web)}).Handler())
	t.Cleanup(srv.Close)
	return &env{t: t, srv: srv, dir: dir}
}

func (e *env) do(method, path, token string, body any, hdr ...string) (int, map[string]any) {
	e.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, &buf)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for i := 0; i+1 < len(hdr); i += 2 {
		req.Header.Set(hdr[i], hdr[i+1])
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer res.Body.Close()
	out := map[string]any{}
	json.NewDecoder(res.Body).Decode(&out)
	return res.StatusCode, out
}

func b64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

func (e *env) create() map[string]string {
	e.t.Helper()
	code, out := e.do("POST", "/api/rooms", "", map[string]string{"snapshot": b64("sealed-snapshot-0")})
	if code != 201 {
		e.t.Fatalf("create: %d %v", code, out)
	}
	m := map[string]string{}
	for k, v := range out {
		m[k] = v.(string)
	}
	return m
}

func (e *env) op(room map[string]string, tok, by string, n int, data string) (int, int64) {
	code, out := e.do("POST", "/api/rooms/"+room["id"]+"/ops", tok, map[string]any{"by": by, "n": n, "data": data})
	seq, _ := out["seq"].(float64)
	return code, int64(seq)
}

// follow opens the stream and sends each event's kind and batch to a channel.
func (e *env) follow(room map[string]string, tok, by string, after int64) (<-chan [2]string, func()) {
	req, _ := http.NewRequest("GET", fmt.Sprintf("%s/api/rooms/%s/events?by=%s&after=%d", e.srv.URL, room["id"], by, after), nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	ch := make(chan [2]string, 64)
	go func() {
		defer close(ch)
		sc := bufio.NewScanner(res.Body)
		kind := ""
		for sc.Scan() {
			line := sc.Text()
			if strings.HasPrefix(line, "event: ") {
				kind = line[7:]
			} else if strings.HasPrefix(line, "data: ") {
				ch <- [2]string{kind, line[6:]}
			}
		}
	}()
	return ch, func() { res.Body.Close() }
}

func next(t *testing.T, ch <-chan [2]string, kind string) rooms.Batch {
	t.Helper()
	for {
		select {
		case e, ok := <-ch:
			if !ok {
				t.Fatalf("stream ended waiting for %s", kind)
			}
			if e[0] == kind {
				var b rooms.Batch
				json.Unmarshal([]byte(e[1]), &b)
				return b
			}
		case <-time.After(3 * time.Second):
			t.Fatalf("no %s event", kind)
		}
	}
}

func TestLiveAndStatic(t *testing.T) {
	e := start(t)
	if code, out := e.do("GET", "/api/live", "", nil); code != 200 || out["live"] != true {
		t.Fatalf("live: %d %v", code, out)
	}
	for path, want := range map[string]int{"/": 200, "/.secret": 404, "/server/go.mod": 404, "/api/nothing": 404} {
		res, _ := http.Get(e.srv.URL + path)
		if res.StatusCode != want {
			t.Errorf("%s: got %d, want %d", path, res.StatusCode, want)
		}
		if res.Header.Get("X-Content-Type-Options") != "nosniff" || res.Header.Get("Referrer-Policy") != "no-referrer" {
			t.Errorf("%s: headers missing", path)
		}
		res.Body.Close()
	}
	if code, _ := e.do("GET", "/api/live", "", nil, "Sec-Fetch-Site", "cross-site"); code != 403 {
		t.Errorf("a request from another site got %d, want 403", code)
	}
}

func TestRolesAndOrder(t *testing.T) {
	e := start(t)
	room := e.create()
	// Nothing of a token is kept: the room's folder has only hashes.
	meta, _ := os.ReadFile(filepath.Join(e.dir, "data", room["id"], "meta.json"))
	for _, k := range []string{"view", "edit", "owner"} {
		if bytes.Contains(meta, []byte(room[k])) {
			t.Errorf("the %s token is stored in the clear", k)
		}
	}
	if code, _ := e.do("GET", "/api/rooms/"+room["id"], "", nil); code != 404 {
		t.Errorf("no token: got %d, want 404", code)
	}
	if code, _ := e.do("GET", "/api/rooms/"+room["id"], "wrong", nil); code != 404 {
		t.Errorf("wrong token: got %d, want 404", code)
	}
	if code, _ := e.do("GET", "/api/rooms/aaaaaaaaaaaaaaaaaaaaaaaa", room["view"], nil); code != 404 {
		t.Errorf("another room: got %d, want 404", code)
	}
	code, out := e.do("GET", "/api/rooms/"+room["id"], room["view"], nil)
	if code != 200 || out["role"] != "view" || out["snapshot"] != b64("sealed-snapshot-0") || out["seq"].(float64) != 0 {
		t.Fatalf("join as viewer: %d %v", code, out)
	}
	if code, _ := e.op(room, room["view"], "viewer1", 1, "x"); code != 403 {
		t.Errorf("a viewer adding operations got %d, want 403", code)
	}
	if code, _ := e.do("DELETE", "/api/rooms/"+room["id"], room["edit"], nil); code != 403 {
		t.Errorf("an editor deleting the room got %d, want 403", code)
	}
	if code, _ := e.op(room, room["edit"], "BAD ID", 1, "x"); code != 400 {
		t.Errorf("a bad sender got %d, want 400", code)
	}

	// Many writers at once: every batch gets its own place, with no gaps.
	var wg sync.WaitGroup
	seqs := make(chan int64, 60)
	for w := 0; w < 6; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 10; i++ {
				code, seq := e.op(room, room["edit"], fmt.Sprintf("writer%d", w), i, fmt.Sprintf("w%d-%d", w, i))
				if code != 200 {
					t.Errorf("append: %d", code)
				}
				seqs <- seq
			}
		}(w)
	}
	wg.Wait()
	close(seqs)
	seen := map[int64]bool{}
	for s := range seqs {
		seen[s] = true
	}
	for i := int64(1); i <= 60; i++ {
		if !seen[i] {
			t.Fatalf("place %d was never given", i)
		}
	}
	_, out = e.do("GET", "/api/rooms/"+room["id"], room["edit"], nil)
	ops := out["ops"].([]any)
	if len(ops) != 60 || out["role"] != "edit" {
		t.Fatalf("join after 60: %d ops, role %v", len(ops), out["role"])
	}
	last := map[string]int{}
	for i, o := range ops {
		b := o.(map[string]any)
		if int(b["seq"].(float64)) != i+1 {
			t.Fatalf("the log is out of order at %d", i)
		}
		// One writer's batches keep the order it sent them in.
		by, n := b["by"].(string), int(b["n"].(float64))
		if prev, ok := last[by]; ok && n != prev+1 {
			t.Fatalf("%s's batches are out of order: %d after %d", by, n, prev)
		}
		last[by] = n
	}
}

func TestStreamReplayPresenceSnapshot(t *testing.T) {
	e := start(t)
	room := e.create()
	e.op(room, room["edit"], "alice1", 1, "a1")
	e.op(room, room["edit"], "alice1", 2, "a2")

	// Following from the start replays what was missed, then goes live.
	bob, stopBob := e.follow(room, room["view"], "bobbob", 1)
	defer stopBob()
	if b := next(t, bob, "op"); b.Seq != 2 || b.Data != "a2" {
		t.Fatalf("replay: %+v", b)
	}
	alice, stopAlice := e.follow(room, room["edit"], "alice1", 2)
	defer stopAlice()
	next(t, alice, "hello")
	e.op(room, room["edit"], "alice1", 3, "a3")
	if b := next(t, bob, "op"); b.Seq != 3 || b.By != "alice1" || b.N != 3 {
		t.Fatalf("live: %+v", b)
	}
	if b := next(t, alice, "op"); b.Seq != 3 {
		t.Fatalf("the sender gets its own batch back, with its place: %+v", b)
	}

	// Presence goes to the others, not back to who sent it, and is not kept.
	if code, _ := e.do("POST", "/api/rooms/"+room["id"]+"/presence", room["view"], map[string]string{"by": "bobbob", "data": "here"}); code != 204 {
		t.Fatalf("presence: %d", code)
	}
	if b := next(t, alice, "presence"); b.By != "bobbob" || b.Data != "here" {
		t.Fatalf("presence: %+v", b)
	}
	select {
	case ev := <-bob:
		t.Fatalf("presence came back to its sender: %v", ev)
	case <-time.After(150 * time.Millisecond):
	}
	_, out := e.do("GET", "/api/rooms/"+room["id"], room["view"], nil)
	if len(out["ops"].([]any)) != 3 {
		t.Fatalf("presence was kept in the log")
	}

	// A snapshot of a later point drops the operations it covers.
	snap := func(tok string, seq int, data string) int {
		code, _ := e.do("POST", "/api/rooms/"+room["id"]+"/snapshot", tok, map[string]any{"seq": seq, "data": b64(data)})
		return code
	}
	if code := snap(room["view"], 2, "s"); code != 403 {
		t.Errorf("a viewer's snapshot got %d, want 403", code)
	}
	if code := snap(room["edit"], 9, "s"); code != 409 {
		t.Errorf("a snapshot of a point not reached got %d, want 409", code)
	}
	if code := snap(room["edit"], 2, "snapshot-at-2"); code != 204 {
		t.Fatalf("snapshot: %d", code)
	}
	if code := snap(room["edit"], 2, "again"); code != 409 {
		t.Errorf("a snapshot of the same point got %d, want 409", code)
	}
	_, out = e.do("GET", "/api/rooms/"+room["id"], room["view"], nil)
	ops := out["ops"].([]any)
	if out["snapshot"] != b64("snapshot-at-2") || out["snapSeq"].(float64) != 2 || len(ops) != 1 || ops[0].(map[string]any)["data"] != "a3" {
		t.Fatalf("after the snapshot: %v", out)
	}
	// Someone who was further back than the snapshot is told to join afresh.
	late, stopLate := e.follow(room, room["view"], "latelate", 0)
	defer stopLate()
	next(t, late, "reset")

	// When a follower goes, the others are told.
	stopBob()
	if b := next(t, alice, "gone"); b.By != "bobbob" {
		t.Fatalf("gone: %+v", b)
	}

	// The room survives the server: a new store reads the same folder.
	store, _ := rooms.Open(filepath.Join(e.dir, "data"))
	st, err := store.Join(room["id"])
	if err != nil || st.Seq != 3 || st.SnapSeq != 2 || len(st.Ops) != 1 || string(st.Snapshot) != "snapshot-at-2" {
		t.Fatalf("reopened: %+v %v", st, err)
	}
	if seq, _ := store.Append(room["id"], "carol1", 1, "c1"); seq != 4 {
		t.Fatalf("the order carries on after a restart: got %d", seq)
	}

	// Only the owner deletes it, and then it is gone for everyone.
	if code, _ := e.do("DELETE", "/api/rooms/"+room["id"], room["owner"], nil); code != 204 {
		t.Fatalf("delete: %d", code)
	}
	if code, _ := e.do("GET", "/api/rooms/"+room["id"], room["owner"], nil); code != 404 {
		t.Errorf("a deleted room got %d, want 404", code)
	}
	if _, err := os.Stat(filepath.Join(e.dir, "data", room["id"])); !os.IsNotExist(err) {
		t.Errorf("the room's folder is still there")
	}
}

func TestLimits(t *testing.T) {
	e := start(t)
	room := e.create()
	if code, _ := e.op(room, room["edit"], "alice1", 1, strings.Repeat("x", rooms.MaxOpBytes+1)); code != 413 {
		t.Errorf("an oversize batch got %d, want 413", code)
	}
	if code, _ := e.do("POST", "/api/rooms", "", map[string]string{"snapshot": "not base64!"}); code != 400 {
		t.Errorf("a snapshot that is not sealed data got %d, want 400", code)
	}
	if code, _ := e.do("POST", "/api/rooms/"+room["id"]+"/presence", room["view"], map[string]string{"by": "bobbob", "data": strings.Repeat("x", 9<<10)}); code != 413 {
		t.Errorf("oversize presence got %d, want 413", code)
	}
}
