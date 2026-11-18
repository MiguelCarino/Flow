#!/usr/bin/env python3
"""Render a test page on the real clock and print its DOM once it reports.

    realclock.py CHROME URL PROFILE [SECONDS]

A suite marked '@realtime' waits on Web Crypto or IndexedDB, which run off the
main thread. Under a virtual clock the page looks idle and is dumped before
they finish, and since Chromium 157 '--timeout' no longer holds '--dump-dom'
back either: the page is dumped at load. So this drives the browser over its
DevTools pipe (standard library only) and reads the DOM when #TESTOUT or
#BOOTERR appears, or when SECONDS run out.
"""
import fcntl
import json
import os
import subprocess
import sys
import time

chrome, url, profile = sys.argv[1], sys.argv[2], sys.argv[3]
limit = float(sys.argv[4]) if len(sys.argv) > 4 else 30

# The browser reads commands on fd 3 and writes replies on fd 4.
cmd_r, cmd_w = os.pipe()
out_r, out_w = os.pipe()


def to_3_and_4():
    # In the child: lift both ends clear of 3 and 4 first, so neither
    # overwrites the other, then put them where the browser looks.
    hi_r = fcntl.fcntl(cmd_r, fcntl.F_DUPFD, 10)
    hi_w = fcntl.fcntl(out_w, fcntl.F_DUPFD, 10)
    os.dup2(hi_r, 3)
    os.dup2(hi_w, 4)


proc = subprocess.Popen(
    [chrome, '--headless', '--disable-gpu', '--no-sandbox', f'--user-data-dir={profile}',
     '--window-size=1280,800', '--remote-debugging-pipe', 'about:blank'],
    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    pass_fds=(3, 4),
    preexec_fn=to_3_and_4)
os.close(cmd_r)
os.close(out_w)
writer = os.fdopen(cmd_w, 'wb', buffering=0)
reader = os.fdopen(out_r, 'rb', buffering=0)

buf = b''
next_id = 0


def call(method, params=None, session=None):
    """Send one command and return its result, skipping events."""
    global buf, next_id
    next_id += 1
    msg = {'id': next_id, 'method': method, 'params': params or {}}
    if session:
        msg['sessionId'] = session
    writer.write(json.dumps(msg).encode() + b'\0')
    while True:
        while b'\0' not in buf:
            chunk = reader.read(65536)
            if not chunk:
                raise SystemExit('the browser closed its pipe')
            buf += chunk
        raw, buf = buf.split(b'\0', 1)
        reply = json.loads(raw)
        if reply.get('id') == next_id:
            if 'error' in reply:
                raise SystemExit(f'{method}: {reply["error"]}')
            return reply.get('result', {})


PROBE = ("document.getElementById('TESTOUT') || document.getElementById('BOOTERR')"
         " ? document.documentElement.outerHTML : ''")

try:
    target = call('Target.createTarget', {'url': url})['targetId']
    session = call('Target.attachToTarget', {'targetId': target, 'flatten': True})['sessionId']
    deadline = time.monotonic() + limit
    dom = ''
    while True:
        dom = call('Runtime.evaluate', {'expression': PROBE, 'returnByValue': True},
                   session).get('result', {}).get('value', '')
        if dom or time.monotonic() > deadline:
            break
        time.sleep(0.2)
    if not dom:
        dom = call('Runtime.evaluate', {'expression': 'document.documentElement.outerHTML',
                                        'returnByValue': True}, session)['result'].get('value', '')
    sys.stdout.write(dom)
finally:
    try:
        call('Browser.close')
    except BaseException:
        pass
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
