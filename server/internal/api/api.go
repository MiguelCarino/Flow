// Package api is the server's HTTP face: the static site, and the rooms.
//
// Everything a browser sends about a workflow is sealed before it leaves the
// browser. The room's key is in the link's fragment, which is never sent, so
// this server orders and relays bytes it cannot read. What it can see: which
// rooms exist, how many operations each has, how big they are, and when.
//
//	GET    /api/live                     is this a Flow server?
//	POST   /api/rooms                    make a room from a sealed snapshot
//	GET    /api/rooms/{id}               join: the snapshot and what came after
//	GET    /api/rooms/{id}/events        follow it (server-sent events)
//	POST   /api/rooms/{id}/ops           add a batch of operations
//	POST   /api/rooms/{id}/snapshot      replace the snapshot with a later one
//	POST   /api/rooms/{id}/presence      where I am (relayed, not kept)
//	DELETE /api/rooms/{id}               delete the room
//
// A room's token goes in the Authorization header, never in the address.
package api

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"carino.systems/flow/server/internal/rooms"
)

// Ping is how often a quiet stream is sent a comment, so proxies keep it open.
var Ping = 20 * time.Second

type Server struct {
	Rooms *rooms.Store
	Web   http.FileSystem // the static site
}

var byRE = regexp.MustCompile(`^[a-z0-9]{6,32}$`)

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/live", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"live": true, "v": 1})
	})
	mux.HandleFunc("POST /api/rooms", s.create)
	mux.HandleFunc("GET /api/rooms/{id}", s.auth(rooms.View, s.join))
	mux.HandleFunc("GET /api/rooms/{id}/events", s.auth(rooms.View, s.events))
	mux.HandleFunc("POST /api/rooms/{id}/ops", s.auth(rooms.Edit, s.ops))
	mux.HandleFunc("POST /api/rooms/{id}/snapshot", s.auth(rooms.Edit, s.snapshot))
	mux.HandleFunc("POST /api/rooms/{id}/presence", s.auth(rooms.View, s.presence))
	mux.HandleFunc("DELETE /api/rooms/{id}", s.auth(rooms.Owner, s.remove))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { fail(w, http.StatusNotFound, "not found") })
	mux.Handle("/", s.static())
	return headers(mux)
}

// headers go on every answer. The page carries its own content policy in a
// meta tag; a header can also forbid being framed, which a meta tag cannot.
func headers(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Content-Security-Policy", "frame-ancestors 'self'")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		// A request from another site's page is refused: a room is reached
		// only from the pages this server serves.
		if strings.HasPrefix(r.URL.Path, "/api/") {
			h.Set("Cache-Control", "no-store")
			if site := r.Header.Get("Sec-Fetch-Site"); site != "" && site != "same-origin" && site != "none" {
				fail(w, http.StatusForbidden, "cross-site requests are refused")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// static serves the site. The server's own folders and anything hidden are
// not part of the site.
func (s *Server) static() http.Handler {
	files := http.FileServer(s.Web)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := path.Clean("/" + r.URL.Path)
		for _, part := range strings.Split(p, "/") {
			if strings.HasPrefix(part, ".") {
				http.NotFound(w, r)
				return
			}
		}
		if strings.HasPrefix(p, "/server/") || p == "/server" {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		files.ServeHTTP(w, r)
	})
}

type ctx struct {
	id   string
	role rooms.Role
}

// auth lets a request through when its token gives at least the role needed.
// A wrong token and a room that is not there get the same answer.
func (s *Server) auth(need rooms.Role, next func(http.ResponseWriter, *http.Request, ctx)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		role, err := s.Rooms.Role(id, tok)
		if err != nil || role == rooms.None {
			fail(w, http.StatusNotFound, "no such room, or not with this link")
			return
		}
		if role < need {
			fail(w, http.StatusForbidden, "this link can look but not change")
			return
		}
		next(w, r, ctx{id: id, role: role})
	}
}

func (s *Server) create(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Snapshot string `json:"snapshot"`
	}
	if !readJSON(w, r, rooms.MaxSnapBytes*2, &in) {
		return
	}
	snap, err := base64.StdEncoding.DecodeString(in.Snapshot)
	if err != nil || len(snap) == 0 {
		fail(w, http.StatusBadRequest, "a room starts from a sealed snapshot")
		return
	}
	t, err := s.Rooms.Create(snap)
	if err != nil {
		failErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"id": t.ID, "view": t.View, "edit": t.Edit, "owner": t.Owner})
}

func (s *Server) join(w http.ResponseWriter, r *http.Request, c ctx) {
	st, err := s.Rooms.Join(c.id)
	if err != nil {
		failErr(w, err)
		return
	}
	ops := st.Ops
	if ops == nil {
		ops = []rooms.Batch{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"role": c.role.String(), "seq": st.Seq, "snapSeq": st.SnapSeq,
		"snapshot": base64.StdEncoding.EncodeToString(st.Snapshot), "ops": ops, "peers": s.Rooms.Peers(c.id),
	})
}

func (s *Server) ops(w http.ResponseWriter, r *http.Request, c ctx) {
	var in struct {
		By   string `json:"by"`
		N    int64  `json:"n"`
		Data string `json:"data"`
	}
	if !readJSON(w, r, rooms.MaxOpBytes*2, &in) {
		return
	}
	if !byRE.MatchString(in.By) || in.Data == "" {
		fail(w, http.StatusBadRequest, "a batch needs who made it and its sealed data")
		return
	}
	seq, err := s.Rooms.Append(c.id, in.By, in.N, in.Data)
	if err != nil {
		failErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"seq": seq})
}

func (s *Server) snapshot(w http.ResponseWriter, r *http.Request, c ctx) {
	var in struct {
		Seq  int64  `json:"seq"`
		Data string `json:"data"`
	}
	if !readJSON(w, r, rooms.MaxSnapBytes*2, &in) {
		return
	}
	snap, err := base64.StdEncoding.DecodeString(in.Data)
	if err != nil || len(snap) == 0 {
		fail(w, http.StatusBadRequest, "a snapshot is sealed data")
		return
	}
	if err := s.Rooms.Snapshot(c.id, in.Seq, snap); err != nil {
		failErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) presence(w http.ResponseWriter, r *http.Request, c ctx) {
	var in struct {
		By   string `json:"by"`
		Data string `json:"data"`
	}
	if !readJSON(w, r, 16<<10, &in) {
		return
	}
	if !byRE.MatchString(in.By) {
		fail(w, http.StatusBadRequest, "presence needs who it is")
		return
	}
	if err := s.Rooms.Presence(c.id, in.By, in.Data); err != nil {
		failErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) remove(w http.ResponseWriter, r *http.Request, c ctx) {
	if err := s.Rooms.Delete(c.id); err != nil {
		failErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// events is the room's stream. It starts with what the browser missed since
// the place it names, then sends each thing as it happens.
func (s *Server) events(w http.ResponseWriter, r *http.Request, c ctx) {
	fl, ok := w.(http.Flusher)
	if !ok {
		fail(w, http.StatusInternalServerError, "this server cannot stream")
		return
	}
	by := r.URL.Query().Get("by")
	after, _ := strconv.ParseInt(r.URL.Query().Get("after"), 10, 64)
	if !byRE.MatchString(by) {
		fail(w, http.StatusBadRequest, "say who is following")
		return
	}
	missed, ch, reset, err := s.Rooms.Subscribe(c.id, by, after)
	if err != nil {
		failErr(w, err)
		return
	}
	h := w.Header()
	h.Set("Content-Type", "text/event-stream; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if reset {
		// What was missed is no longer kept: join afresh.
		fmt.Fprint(w, "event: reset\ndata: {}\n\n")
		fl.Flush()
		return
	}
	defer s.Rooms.Unsubscribe(c.id, ch)
	send := func(kind string, b rooms.Batch) {
		data, _ := json.Marshal(b)
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", kind, data)
	}
	fmt.Fprint(w, "event: hello\ndata: {}\n\n")
	for _, b := range missed {
		send("op", b)
	}
	fl.Flush()
	tick := time.NewTicker(Ping)
	defer tick.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case e, open := <-ch:
			if !open {
				return
			}
			send(e.Kind, e.Batch)
			fl.Flush()
		case <-tick.C:
			fmt.Fprint(w, ": ping\n\n")
			fl.Flush()
		}
	}
}

func readJSON(w http.ResponseWriter, r *http.Request, max int64, into any) bool {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, max))
	if err != nil {
		fail(w, http.StatusRequestEntityTooLarge, "too big")
		return false
	}
	if json.Unmarshal(body, into) != nil {
		fail(w, http.StatusBadRequest, "not JSON")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func failErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, rooms.ErrNotFound):
		fail(w, http.StatusNotFound, "no such room, or not with this link")
	case errors.Is(err, rooms.ErrTooBig):
		fail(w, http.StatusRequestEntityTooLarge, "too big")
	case errors.Is(err, rooms.ErrTooMany):
		fail(w, http.StatusTooManyRequests, "this room is full, or its log needs a snapshot first")
	case errors.Is(err, rooms.ErrBadSeq):
		fail(w, http.StatusConflict, err.Error())
	default:
		fail(w, http.StatusInternalServerError, "the server could not do that")
	}
}
