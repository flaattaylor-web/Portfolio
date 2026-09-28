# The Monday Brief — auto-updating archive

A scheduled GitHub Action rebuilds `brief/` every Monday morning from live
sources, then emails the issue. No server and no database; the only credential
is a Gmail app password, used by the send step.

## What lands in the repo

    .github/workflows/monday-brief.yml   the Monday schedule
    scripts/build_brief.py               the generator (standard library only)
    scripts/build_newsletter.py          renders the email-safe HTML body
    scripts/send_brief.py                sends that body over Gmail SMTP
    scripts/send_broadcast.py            sends it to the Buttondown list
    scripts/setup_brief_email.py         one-off: stores the app password
    brief/index.html                     latest issue + full archive list
    brief/issues/<YYYY-MM-DD>.html       one permanent page per issue
    brief/feed.xml                       RSS 2.0
    brief/data/<YYYY-MM-DD>.json         machine-readable record per issue

`brief/` is generated output and is committed by the Action — treat it as
build product, not source. The files you edit by hand are
`scripts/build_brief.py` for the site and content, and
`scripts/build_newsletter.py` for the email layout.

## Install

1. Copy `scripts/build_brief.py`, `.github/workflows/monday-brief.yml` and the
   `brief/` directory into the repo root.
2. Settings → Actions → General → Workflow permissions → **Read and write
   permissions**. Without this the commit step fails with a 403.
3. Commit and push. Then Actions → *Monday Brief* → **Run workflow** to build
   the first issue immediately rather than waiting for Monday.
4. Link it from the main page, e.g. in the nav:
   `<a href="/brief/">Brief</a>`

5. Set up the email once: `python scripts/setup_brief_email.py`. It prompts
   for the sender, the recipients and the Gmail app password, checks the
   password by logging in to Gmail, then stores it as the `GMAIL_APP_PASSWORD`
   secret with `BRIEF_FROM` and `BRIEF_TO` as plain variables. Until this is
   done the Monday run still rebuilds the site, but emails nobody.

Optional: add a repository variable `NCBI_EMAIL` (Settings → Secrets and
variables → Actions → Variables) so PubMed can identify the caller. Anonymous
requests work fine; this is only politeness to NCBI.

## Subscribers

Two delivery paths. The workflow uses Buttondown whenever the
`BUTTONDOWN_API_KEY` secret is set, and falls back to Gmail SMTP otherwise.
A free Gmail account cannot serve a public list — its SMTP ceiling is about a
hundred recipients a day and Gmail throttles bulk sends well below published
quotas — so the SMTP path is only for the fixed personal list.

To open signups:

1. Create the newsletter at buttondown.com and copy the API key from
   Settings → Programming.
2. Add it as the `BUTTONDOWN_API_KEY` repository secret.
3. Copy the form action out of Settings → Embedding and paste it into
   `SUBSCRIBE_ACTION` at the top of `build_brief.py`. While that constant is
   empty the signup block is omitted, so the page never shows a form that
   posts nowhere.
4. Subscribe the existing recipients yourself, then drop `BRIEF_TO`,
   `BRIEF_FROM` and `GMAIL_APP_PASSWORD` if you no longer want the fallback.

The send is two API calls: create the issue as a `draft`, then PATCH it to
`about_to_send`. Under API version 2026-04-01 a create that sets
`about_to_send` directly is refused until a one-time confirmation header is
sent for the key, while PATCH carries no such requirement. It also fails
safe — a PATCH that does not land leaves a draft you can send by hand.

Buttondown handles double opt-in and the unsubscribe link, which a public
list needs and the SMTP path does not provide.

## Schedule

`cron: "10 11 * * 1"` — 11:10 UTC Monday, which is 07:10 Eastern in summer and
06:10 in winter. GitHub does not adjust for daylight saving, and its scheduler
is best-effort: a run can start several minutes late, or be dropped entirely if
the repo has had no activity for 60 days. The weekly commit counts as activity,
so an active brief keeps itself alive.

Each run covers the **previous full Monday–Sunday**. Re-running the same week
overwrites that issue rather than adding a duplicate. To backfill a longer
window once, dispatch the workflow manually with `weeks` set to 2 or more.

## How ranking works

Deterministic, so the Action needs no model access:

- **Papers** — six PubMed `esearch` queries, one per field, filtered on entry
  date. Each result scores `sum(keyword weights) + 2 × journal tier`, where the
  keyword table in `build_brief.py` weights the fields the brief covers (VSV,
  oncolytic, viral vector, nanopore, mast cell, melanocyte, canine, FACS,
  library prep …). The
  best paper per field competes for the five headline slots; the remaining
  field-leaders fill "one more per discipline". The relevance note under each
  paper lists the keywords that actually matched — it is generated from the
  match, not written prose.
- **News** — ten topic feeds over the same window. Headlines are clustered by
  token overlap so the same event from multiple outlets collapses to one story;
  `n_outlets` is the reach measure and drives the "Most-Shared" order. Sections
  then draw their items by reach, outlet tier and recency, skipping anything
  already used in Most-Shared. Stock-promotion and analyst-rating content is
  dropped by pattern.
- **Watchlist** — regex scan for the standing roster of biopharma and
  life-science tooling companies. Edit `ALIASES` in `build_brief.py` to change
  which companies are tracked.

## Honesty constraint

"Most-shared" means the number of independent outlets that ran the story.
Social platforms expose no engagement data to this pipeline, so the page never
claims post-level virality. Every item links to its source and is summarised no
further than the outlet's own blurb. If you change the ranking, keep the footer
note in `shell()` accurate.

## Failure behaviour

If every fetch fails the script exits non-zero **before** writing anything, so
a network blip leaves the last good issue in place rather than publishing an
empty page. Per-feed failures are logged and skipped. An older issue whose
`issues/*.html` page is missing is left out of the archive list so no link
404s.
