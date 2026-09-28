#!/usr/bin/env python3
"""Send the issue to the Buttondown list.

This is the delivery path once the brief has public subscribers. The SMTP path
in send_brief.py stays for the fixed personal list; the workflow picks this one
whenever BUTTONDOWN_API_KEY is set, because a free Gmail account cannot serve a
public list (its SMTP ceiling is around a hundred recipients a day, and Gmail
applies behavioural throttling well below that for bulk sends).

The send is two calls on purpose:

  POST  /v1/emails        -> create with an explicit status of "draft"
  PATCH /v1/emails/{id}   -> set status "about_to_send", which queues delivery

Under API version 2026-04-01 a POST that sets "about_to_send" directly is
rejected with sending_requires_confirmation until a one-time
X-Buttondown-Live-Dangerously header is sent for that key. PATCH carries no
such requirement, so create-then-patch needs no confirmation dance. It also
fails safe: if the PATCH does not land, the issue is sitting in Buttondown as a
draft you can send by hand, rather than lost.

Standard library only, matching the rest of the pipeline.
"""
import json
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_brief import OUT, SITE, previous_week
from send_brief import render_html

API = "https://api.buttondown.com/v1"
API_VERSION = "2026-04-01"

# Gmail appends a "[Message clipped] View entire message" link above this size
# and hides everything past it, which on a full issue means the last sections
# and the footer. The body below is only the content well: Buttondown's Header
# and Footer blocks wrap it on send and are not visible to this script, so
# allow for them before comparing. Measured at 4.0 kB + 6.1 kB.
CLIP_BYTES = 102_000
CHROME_BYTES = 10_500


def call(method, path, key, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, method=method, headers={
        "Authorization": f"Token {key}",
        "X-API-Version": API_VERSION,
        "Content-Type": "application/json",
        "User-Agent": "monday-brief"})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            body = r.read()
            return json.loads(body) if body.strip() else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit(f"Buttondown {method} {path} failed: {e.code} {detail}")


def main():
    key = os.environ.get("BUTTONDOWN_API_KEY", "").strip()
    if not key:
        print("send skipped, not configured: BUTTONDOWN_API_KEY", file=sys.stderr)
        return 1

    weeks = int(os.environ.get("BRIEF_WEEKS", "1"))
    _start, end = previous_week(weeks=weeks)
    path = os.path.join(OUT, "data", f"{end.isoformat()}.json")
    if not os.path.exists(path):
        print(f"no issue record at {path} - nothing to send", file=sys.stderr)
        return 1
    with open(path, encoding="utf-8") as fh:
        issue = json.load(fh)

    body = render_html(issue)
    if body.lstrip().startswith("---"):
        # Buttondown reads a leading --- as front matter; ours opens with a
        # hidden preheader div, so this guards a future template change.
        print("body starts with ---, which Buttondown would parse as front "
              "matter; refusing to send", file=sys.stderr)
        return 1

    size = len(body.encode())
    if size + CHROME_BYTES > CLIP_BYTES:
        print(f"warning: body is {size} bytes and Buttondown adds about "
              f"{CHROME_BYTES} more, which puts this issue over Gmail's "
              f"roughly {CLIP_BYTES}-byte clip threshold; the tail of the "
              f"issue will be hidden behind a 'view entire message' link",
              file=sys.stderr)

    draft = call("POST", "/emails", key, {
        "subject": f'The Monday Brief - {issue["window_label"]}',
        "body": body,
        "status": "draft",
        "canonical_url": f'{SITE}/brief/issues/{issue["date"]}.html',
        "metadata": {"issue": issue["issue"], "issue_date": issue["date"]}})
    email_id = draft.get("id")
    if not email_id:
        raise SystemExit(f"Buttondown returned no email id: {str(draft)[:300]}")
    print(f'draft created: {email_id} ({len(body.encode())} bytes)')

    sent = call("PATCH", f"/emails/{email_id}", key, {"status": "about_to_send"})
    print(f'issue {issue["issue"]} queued to subscribers, status '
          f'{sent.get("status", "unknown")}')
    return 0


if __name__ == "__main__":
    sys.exit(main())
