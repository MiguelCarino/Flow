#!/usr/bin/env bash
# Runs the suites in tests/suites against the real index.html in a headless browser.
#
#   ./tests/run.sh              # everything
#   ./tests/run.sh model undo   # named suites only
#
# Each suite is injected into a copy of index.html, with tests/harness.js
# ahead of everything else, and reports by appending a <pre id="TESTOUT"> of
# "PASS :: name" / "FAIL :: name" lines, which are read back out of the dumped
# DOM. The copy sits in the repo root because index.html pulls css/ and js/ by
# relative path. Served over HTTP, not opened as a file, because that is how
# GitHub Pages serves it and file:// hides script errors and the stylesheet.
set -uo pipefail
cd "$(dirname "$0")/.."

if [ -z "${CHROME:-}" ]; then
    for c in chromium-browser chromium google-chrome "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
        if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then CHROME="$c"; break; fi
    done
fi
[ -n "${CHROME:-}" ] || { echo "no Chromium or Chrome found; set CHROME=..." >&2; exit 127; }
PORT="${PORT:-8743}"
RUNFILE=".testrun.html"

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
PROFILE=$(mktemp -d)
trap 'rm -f "$RUNFILE"; rm -rf "$PROFILE"; kill $SERVER 2>/dev/null' EXIT

for _ in $(seq 50); do
    if (exec 3<>/dev/tcp/127.0.0.1/"$PORT") 2>/dev/null; then exec 3<&-; break; fi
    sleep 0.1
done
kill -0 $SERVER 2>/dev/null || { echo "could not start a server on :$PORT (set PORT=...)" >&2; exit 1; }

if [ $# -gt 0 ]; then
    suites=("$@")
else
    suites=()
    for f in tests/suites/*.js; do suites+=("$(basename "$f" .js)"); done
fi

total=0; failed=0; missing=0

for suite in "${suites[@]}"; do
    src="tests/suites/${suite}.js"
    if [ ! -f "$src" ]; then
        echo "?? ${suite}: no such suite" >&2; missing=$((missing + 1)); continue
    fi

    python3 - "$src" "$RUNFILE" <<'PY'
import sys
suite, runfile = sys.argv[1], sys.argv[2]
html = open('index.html').read()
if '<head>' not in html or '</body>' not in html:
    sys.exit('index.html is missing <head> or </body> to inject into')
html = html.replace('<head>', '<head><script src="tests/harness.js"></script>', 1)
open(runfile, 'w').write(html.replace('</body>', f'<script src="{suite}"></script>\n</body>', 1))
PY

    # A suite marked '@realtime' waits on Web Crypto or IndexedDB, which run
    # off the main thread: under a virtual clock the page looks idle and is
    # dumped before they finish. Those run on the real clock, for a fixed time.
    if head -3 "$src" | grep -q '@realtime'; then
        clock=(--timeout=20000)
    else
        clock=(--virtual-time-budget=8000)
    fi
    dom=$("$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PROFILE" --window-size=1280,800 \
          "${clock[@]}" --dump-dom "http://127.0.0.1:$PORT/$RUNFILE" 2>/dev/null)

    results=$(printf '%s' "$dom" | python3 -c '
import sys, re, html
m = re.search(r"<pre id=\"TESTOUT\">(.*?)</pre>", sys.stdin.read(), re.S)
print(html.unescape(m.group(1)).strip() if m else "")
')

    if [ -z "$results" ]; then
        boot=$(printf '%s' "$dom" | python3 -c '
import sys, re, html
m = re.search(r"<pre id=\"BOOTERR\">(.*?)</pre>", sys.stdin.read(), re.S)
print(html.unescape(m.group(1)).strip() if m else "")
')
        echo "FAIL ${suite}: reported nothing${boot:+ -- ${boot}}"
        failed=$((failed + 1)); continue
    fi

    n=$(printf '%s\n' "$results" | grep -c '^\(PASS\|FAIL\) ::')
    bad=$(printf '%s\n' "$results" | grep '^FAIL ::')
    total=$((total + n))

    if [ -n "$bad" ]; then
        nbad=$(printf '%s\n' "$bad" | wc -l | tr -d ' ')
        failed=$((failed + nbad))
        printf 'FAIL %-14s %d/%d\n' "$suite" "$((n - nbad))" "$n"
        printf '%s\n' "$bad" | sed 's/^/       /'
    else
        printf 'ok   %-14s %d\n' "$suite" "$n"
    fi
done

echo "---"
if [ "$failed" -eq 0 ] && [ "$missing" -eq 0 ]; then
    echo "$total assertions, all passing"
else
    echo "$total assertions, $failed failing${missing:+, $missing suite(s) missing}"
    exit 1
fi
