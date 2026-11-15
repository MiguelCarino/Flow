# flow-server

Serves Flow and adds live rooms: several people changing one workflow at
once, encrypted end to end. See [docs/SERVER.md](../docs/SERVER.md).

```bash
go build -o flow-server ./cmd/flow-server
./flow-server -web .. -data ./flow-data -addr 127.0.0.1:8750
go test -race ./...
```

Standard library only. AGPL-3.0-or-later.
