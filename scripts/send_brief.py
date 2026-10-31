#!/usr/bin/env python3
"""Email the issue that build_brief.py has just written.

Runs after the build step and *before* the commit step. That ordering is the
idempotency mechanism: the commit is the repo's record that a week's issue was
both generated and sent, so a send that fails leaves the tree uncommitted and
the next scheduled attempt rebuilds and retries from clean. Once the issue is
committed, later runs find it already present, build nothing, and send nothing.

Standard library only, matching build_brief.py. The email body is rendered by
build_newsletter.py, which emits inline-styled table HTML that survives Gmail;
the site pages are not reused because their styling lives in a <style> block.
"""
import html as _html
import json
import os
import re
import smtplib
import ssl
import sys
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_brief import ALIASES, OUT, SECTIONS, SITE, previous_week
from build_newsletter import build

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "465"))

# Gmail collapses a message body past roughly this size behind a "View entire
# message" link. Warn rather than fail: a clipped brief still arrives, and the
# archive link in the text part still resolves.
CLIP_BYTES = 102_000


def _news(row):
    """build_brief's news record -> the keys build_newsletter's news_row reads.

    The blurb is squeezed and cut at 230 characters exactly as the site's
    render_news does. The stored JSON keeps the full outlet text, and passing
    it through untrimmed is what pushes a full issue over Gmail's clip size.
    """
    return {"headline": row.get("clean", ""),
            "link": row.get("link", ""),
            "line": re.sub(r"\s+", " ", row.get("desc", "")).strip()[:230],
            "outlet": row.get("source", ""),
            "date": row.get("date", ""),
            "n_outlets": row.get("n_outlets")}


def _radar(hits):
    """Watchlist hits use short keys in the email renderer."""
    return [{"t": h.get("clean", ""), "l": h.get("link", ""),
             "s": h.get("source", ""), "d": h.get("date", "")} for h in hits]


def render_html(issue):
    counts = dict(issue["counts"])
    # Preheader: the grey line Gmail shows next to the subject in the list view.
    buzz = issue["picked"].get("buzz") or []
    counts["headline_preview"] = (
        buzz[0].get("clean", "") if buzz else
        f'{counts["papers"]} papers and {counts["news"]} headlines from the past week.')
    return build(issue=issue["issue"],
                 window=issue["window_label"],
                 papers={"top5": issue["top5"], "per_field": issue["also"]},
                 picked={k: [_news(r) for r in v] for k, v in issue["picked"].items()},
                 radar={co: _radar(h) for co, h in issue["radar"].items()},
                 tracked=list(ALIASES),
                 counts=counts,
                 generated=issue["generated"])


def render_text(issue):
    """Plain-text alternative. Deliverability, and it is what a screen reader
    or a text-only client gets."""
    out = [f'THE MONDAY BRIEF | Issue {issue["issue"]} | {issue["window_label"]}',
           "",
           f'Read online: {SITE}/brief/issues/{issue["date"]}.html',
           ""]
    out.append("FIVE PAPERS WORTH READING")
    for i, p in enumerate(issue["top5"], 1):
        meta = " | ".join(x for x in [p.get("journal"), p.get("date")] if x)
        out.append(f'{i}. {p.get("title", "")}')
        if meta:
            out.append(f'   {meta}')
        out.append(f'   PMID {p.get("pmid", "")} - {p.get("url", "")}')
    out.append("")
    for key, label, _sub, _n in SECTIONS:
        rows = issue["picked"].get(key) or []
        if not rows:
            continue
        out.append(_html.unescape(label).upper())
        for row in rows:
            out.append(f'- {row.get("clean", "")}')
            out.append(f'  {row.get("source", "")} | {row.get("link", "")}')
        out.append("")
    out.append(f'Archive: {SITE}/brief/   RSS: {SITE}/brief/feed.xml')
    return "\n".join(out)


def main():
    to = [a.strip() for a in
          os.environ.get("BRIEF_TO", "").replace(";", ",").split(",") if a.strip()]
    sender = os.environ.get("BRIEF_FROM", "").strip()
    password = os.environ.get("GMAIL_APP_PASSWORD", "")
    missing = [n for n, v in (("BRIEF_TO", to), ("BRIEF_FROM", sender),
                              ("GMAIL_APP_PASSWORD", password)) if not v]
    if missing:
        print("send skipped, not configured: " + ", ".join(missing), file=sys.stderr)
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
    size = len(body.encode("utf-8"))
    if size > CLIP_BYTES:
        print(f"warning: body is {size} bytes; Gmail clips above roughly "
              f"{CLIP_BYTES}", file=sys.stderr)

    msg = EmailMessage()
    msg["Subject"] = f'The Monday Brief - {issue["window_label"]}'
    msg["From"] = formataddr(("The Monday Brief", sender))
    msg["To"] = ", ".join(to)
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    msg["List-Unsubscribe"] = f"<mailto:{sender}?subject=unsubscribe>"
    msg.set_content(render_text(issue))
    msg.add_alternative(body, subtype="html")

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=ssl.create_default_context()) as smtp:
        smtp.login(sender, password)
        smtp.send_message(msg)

    print(f'sent issue {issue["issue"]} to {len(to)} recipient(s), {size} bytes')
    return 0


if __name__ == "__main__":
    sys.exit(main())
