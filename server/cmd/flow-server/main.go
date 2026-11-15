// flow-server serves Flow and adds live rooms to it.
//
//	flow-server -web /path/to/Flow -data /var/lib/flow -addr 127.0.0.1:8750
//
// Without this program Flow works exactly as before: the website and a copy
// opened from disk never talk to a server. Served by this program, the same
// files gain File, Live: several people changing one workflow at once.
//
// It listens on plain HTTP. Put it behind a reverse proxy that speaks HTTPS
// (the browsers' encryption needs a secure page), and keep its data folder
// backed up: a room is a folder of files, sealed by keys this program never has.
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"carino.systems/flow/server/internal/api"
	"carino.systems/flow/server/internal/rooms"
)

func main() {
	web := flag.String("web", ".", "the folder with Flow's index.html")
	data := flag.String("data", "./flow-data", "where rooms are kept")
	addr := flag.String("addr", "127.0.0.1:8750", "the address to listen on")
	flag.Parse()

	if _, err := os.Stat(*web + "/index.html"); err != nil {
		log.Fatalf("no index.html in %s: point -web at the Flow folder", *web)
	}
	store, err := rooms.Open(*data)
	if err != nil {
		log.Fatalf("cannot use %s for rooms: %v", *data, err)
	}
	srv := &http.Server{
		Addr:              *addr,
		Handler:           (&api.Server{Rooms: store, Web: http.Dir(*web)}).Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	go func() {
		<-stop.Done()
		ctx, done := context.WithTimeout(context.Background(), 3*time.Second)
		defer done()
		srv.Shutdown(ctx)
	}()
	log.Printf("Flow at http://%s  (site: %s, rooms: %s)", *addr, *web, *data)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
