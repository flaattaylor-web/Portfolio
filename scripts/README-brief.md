# The Monday Brief — auto-updating archive

A scheduled GitHub Action rebuilds `brief/` every Monday morning from live
sources. No server, no database, no API keys.

## What lands in the repo

    .github/workflows/monday-brief.yml   the Monday schedule
    scripts/build_brief.py               the generator (standard library only)
    brief/index.html                     latest issue + full archive list
    brief/issues/<YYYY-MM-DD>.html       one permanent page per issue
    brief/feed.xml                       RSS 2.0
    brief/data/<YYYY-MM-DD>.json         machine-readable record per issue

`brief/` is generated output and is committed by the Action — treat it as
build product, not source. The only file you edit by hand is
`scripts/build_brief.py`.

## Install

1. Copy `scripts/build_brief.py`, `.github/workflows/monday-brief.yml` and the
   `brief/` directory into the repo root.
2. Settings → Actions → General → Workflow permissions → **Read and write
   permissions**. Without this the commit step fails with a 403.
3. Commit and push. Then Actions → *Monday Brief* → **Run workflow** to build
   the first issue immediately rather than waiting for Monday.
4. Link it from the main page, e.g. in the nav:
   `<a href="/brief/">Brief</a>`

Optional: add a repository variable `NCBI_EMAIL` (Settings → Secrets and
variables → Actions → Variables) so PubMed can identify the caller. Anonymous
requests work fine; this is only politeness to NCBI.

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
  keyword table in `build_brief.py` is drawn from the CV (VSV, oncolytic, viral
  vector, nanopore, mast cell, melanocyte, canine, FACS, library prep …). The
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
- **Watchlist** — regex scan for past employers and open applications. Edit
  `ALIASES` in `build_brief.py` as that list changes.

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
