#!/usr/bin/env python3
"""Build the auto-populating Monday Brief archive for taylorflaat.com.

Standard library only -- runs on a bare GitHub Actions runner with no pip
install and no API keys. Writes, relative to the repo root:

    brief/index.html            latest issue + archive list
    brief/issues/<date>.html    permanent per-issue page
    brief/feed.xml              RSS 2.0
    brief/data/<date>.json      machine-readable issue record

Ranking is deterministic (cross-outlet pickup, journal tier, keyword overlap
with the profile below) so the script needs no model access.
"""
import datetime
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import format_datetime, parsedate_to_datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "brief")
SITE = "https://taylorflaat.com"
UA = {"User-Agent": "taylorflaat.com monday-brief generator (+https://taylorflaat.com)"}
NCBI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

# ---------------------------------------------------------------- config

FEEDS = {
    "funding": 'biotech OR biopharma ("Series A" OR "Series B" OR "Series C" OR financing OR raises OR "venture round" OR IPO)',
    "mergers": '(pharma OR biotech) (acquisition OR acquires OR merger OR "to buy" OR takeover OR "licensing deal")',
    "hiring": '(biotech OR pharma) (layoffs OR "cuts jobs" OR restructuring OR "job cuts" OR appoints OR "chief scientific officer" OR "names CEO")',
    "trials": '(clinical trial) (topline OR "phase 3" OR "phase 2" OR "phase 1" OR readout OR "primary endpoint")',
    "drugs": '("FDA approves" OR "FDA approval" OR "complete response letter" OR "EMA approval" OR CHMP OR "accelerated approval")',
    "academia": '(NIH OR NSF OR university OR academia) (funding OR grant OR budget OR "indirect costs" OR postdoc) research',
    "vet": '(veterinary OR "animal health") (Zoetis OR Elanco OR "Merck Animal Health" OR "pet drug" OR canine OR feline OR vaccine)',
    "ngs": '(sequencing OR genomics) (Illumina OR "Oxford Nanopore" OR PacBio OR "single-cell" OR spatial OR "long-read")',
    "virology": '(virology OR virus OR outbreak OR H5N1 OR measles OR influenza OR antiviral) research',
    "onco": '(oncology OR cancer) (ADC OR bispecific OR "CAR-T" OR immunotherapy OR checkpoint)',
}

# key, display label (raw HTML), subtitle, how many items
SECTIONS = [
    ("buzz", "Most-Shared", "Ordered by how many independent outlets ran the story", 10),
    ("funding", "Money In", "Financings, IPOs, venture rounds", 5),
    ("mergers", "Deals", "M&amp;A, licensing, reverse mergers", 5),
    ("hiring", "People &amp; Headcount", "Hires, exits, layoffs, restructurings", 5),
    ("trials", "Clinical Trials", "Readouts, starts, failures", 5),
    ("drugs", "Regulatory", "Approvals, CRLs, CHMP opinions", 5),
    ("academia", "Academia", "Grants, budgets, institutions", 4),
    ("platform", "The Bench", "NGS, virology and animal-health industry moves", 5),
]
SECTION_FEEDS = {"funding": ["funding"], "mergers": ["mergers"], "hiring": ["hiring"],
                 "trials": ["trials"], "drugs": ["drugs", "onco"], "academia": ["academia"],
                 "platform": ["ngs", "virology", "vet"]}

FIELDS = {
    "Virology": '虚',  # replaced below -- keeps dict order explicit
}
FIELDS = {
    "Virology": 'virus OR "viral vector" OR oncolytic OR "vesicular stomatitis virus" OR antiviral OR "type I interferon" OR vaccine',
    "Molecular Biology": 'CRISPR OR "gene editing" OR cloning OR plasmid OR "site-directed mutagenesis" OR transcription OR "RNA biology"',
    "Cell Biology": '"primary cells" OR organoid OR spheroid OR "flow cytometry" OR "cell sorting" OR "mast cell" OR melanocyte OR co-culture',
    "NGS / Genomics": '"next-generation sequencing" OR "long-read sequencing" OR nanopore OR PacBio OR "library preparation" OR "single-cell RNA sequencing" OR "spatial transcriptomics"',
    "Oncology": '(oncology OR cancer) AND (immunotherapy OR "CAR-T" OR bispecific OR "antibody-drug conjugate" OR "tumor microenvironment" OR "checkpoint inhibitor")',
    "Veterinary Medicine": '(veterinary OR canine OR feline) AND (medicine OR oncology OR immunology OR vaccine OR "mast cell tumor")',
}

# Weighted vocabulary drawn from the CV -- drives the deterministic relevance note.
KEYWORDS = {
    "vesicular stomatitis": 7, "oncolytic": 6, "viral vector": 6, "nanopore": 6, "mast cell": 6,
    "melanocyte": 6, "canine": 6, "long-read": 5, "library prep": 5, "flow cytometry": 5,
    "cell sorting": 5, "facs": 5, "glycoprotein": 5, "potency assay": 5, "feline": 5,
    "aptazyme": 5, "infectious clone": 5, "comparative oncology": 5, "pacbio": 5,
    "vaccine": 4, "interferon": 4, "crispr": 4, "single-cell": 4, "organoid": 4, "spheroid": 4,
    "ffpe": 4, "car-t": 4, "lentivir": 4, "adeno-associated": 4, "immunogenicity": 4,
    "veterinary": 4, "illumina": 4, "methylation": 3, "bisulfite": 3, "qpcr": 3, "co-culture": 3,
    "bispecific": 3, "antibody-drug": 3, "off-target": 3, "titer": 3, "assay development": 3,
    "elisa": 3, "immunotherapy": 3, "primary cell": 3, "checkpoint": 2, "organotypic": 2,
}
TIER_5 = ("nature", "science", "cell", "n engl j med", "lancet")
TIER_4 = ("nat ", "cell ", "immunity", "cancer cell", "mol cell", "sci transl med", "cell rep")
TIER_3 = ("nucleic acids res", "genome biol", "genome res", "elife", "plos biol", "embo",
          "j mol diagn", "biotechnol")
TIER_2 = ("j virol", "viruses", "vet ", "j vet", "front immunol", "vaccine", "virology")

# Past employers and places with an application open.
ALIASES = {
    "Azenta Life Sciences": ["Azenta"], "Merck": [r"\bMerck\b"], "Humane Genomics": ["Humane Genomics"],
    "Pfizer": ["Pfizer"], "Boehringer Ingelheim": ["Boehringer"], "Thermo Fisher": ["Thermo Fisher"],
    "Lexeo Therapeutics": ["Lexeo"], "Novartis": ["Novartis"], "Regeneron": ["Regeneron"],
    "GenScript": ["GenScript"], "UCB": [r"\bUCB\b"], "Immunai": ["Immunai"], "Genmab": ["Genmab"],
    "Insmed": ["Insmed"], "Mount Sinai": ["Mount Sinai"], "Evotec": ["Evotec"],
    "Kenvue": ["Kenvue"], "Rocket Pharmaceuticals": ["Rocket Pharmaceutic"],
}

JUNK = re.compile(r"top stocks|stocks to buy|stock recommendation|shares to buy|penny stock|"
                  r"best stocks|zacks|motley fool|price target|analyst rating", re.I)
STOP = set(("the a an of for and or to in on with by from as at is are new its it this that we us biotech "
            "pharma pharmaceutical drug company inc corp says say said report reports after amid over into "
            "more than will can could would first study trial data deal stock shares million billion percent "
            "year years").split())
TIER_OUTLETS = ("Reuters", "STAT", "Fierce Biotech", "Fierce Pharma", "BioPharma Dive",
                "Endpoints News", "Nature", "Science", "Financial Times", "Bloomberg")

# ---------------------------------------------------------------- fetch


def get(url, tries=3, pause=1.0):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as resp:
                return resp.read()
        except Exception as exc:                      # noqa: BLE001 - network is best-effort
            if attempt == tries - 1:
                print(f"  ! {type(exc).__name__}: {exc}", file=sys.stderr)
                return None
            time.sleep(pause * (attempt + 1))
    return None


def clean_title(title):
    return re.sub(r"\s+-\s+[^-]{2,40}$", "", title).strip()


def fetch_news(start, end):
    lookback = (datetime.date.today() - start).days + 2
    lo = datetime.datetime.combine(start, datetime.time.min, datetime.timezone.utc)
    hi = datetime.datetime.combine(end, datetime.time.max, datetime.timezone.utc)
    news = {}
    for key, query in FEEDS.items():
        url = ("https://news.google.com/rss/search?q="
               + urllib.parse.quote(f"{query} when:{lookback}d") + "&hl=en-US&gl=US&ceid=US:en")
        blob = get(url)
        rows = []
        if blob:
            try:
                root = ET.fromstring(blob)
            except ET.ParseError:
                root = None
            for item in (root.iter("item") if root is not None else []):
                try:
                    when = parsedate_to_datetime((item.findtext("pubDate") or "").strip())
                except (TypeError, ValueError):
                    continue
                title = (item.findtext("title") or "").strip()
                if not (lo <= when <= hi) or JUNK.search(title):
                    continue
                rows.append({"title": title, "clean": clean_title(title),
                             "link": (item.findtext("link") or "").strip(),
                             "source": (item.findtext("source") or "").strip(),
                             "desc": re.sub("<[^>]+>", " ", item.findtext("description") or "")[:400],
                             "date": when.strftime("%Y-%m-%d"), "cat": key})
        news[key] = rows
        print(f"  {key}: {len(rows)}")
        time.sleep(0.4)
    return news


def fetch_papers(start, end):
    """PubMed esearch + esummary over the entry-date window, one pass per field."""
    email = os.environ.get("NCBI_EMAIL", "").strip()
    suffix = f"&email={urllib.parse.quote(email)}" if email else ""
    by_field, meta = {}, {}
    for field, stem in FIELDS.items():
        term = f'({stem}) AND ("{start:%Y/%m/%d}"[EDAT] : "{end:%Y/%m/%d}"[EDAT])'
        url = (f"{NCBI}/esearch.fcgi?db=pubmed&retmode=json&retmax=40&sort=relevance"
               f"&term={urllib.parse.quote(term)}{suffix}")
        blob = get(url)
        ids = []
        if blob:
            try:
                ids = json.loads(blob)["esearchresult"].get("idlist", [])
            except (ValueError, KeyError):
                ids = []
        by_field[field] = ids
        print(f"  {field}: {len(ids)}")
        time.sleep(0.4)

    every = sorted({p for ids in by_field.values() for p in ids})
    for i in range(0, len(every), 20):
        chunk = every[i:i + 20]
        blob = get(f"{NCBI}/esummary.fcgi?db=pubmed&retmode=json&id={','.join(chunk)}{suffix}")
        if not blob:
            continue
        try:
            result = json.loads(blob).get("result", {})
        except ValueError:
            continue
        for pmid in chunk:
            rec = result.get(pmid)
            if not isinstance(rec, dict) or "title" not in rec:
                continue
            doi = ""
            for aid in rec.get("articleids", []):
                if aid.get("idtype") == "doi":
                    doi = aid.get("value", "")
            authors = [a.get("name", "") for a in rec.get("authors", []) if a.get("name")]
            byline = ""
            if authors:
                byline = authors[0] + (" … " + authors[-1] if len(authors) > 1 else "")
            meta[pmid] = {"pmid": pmid,
                          "title": re.sub(r"\s+", " ", rec["title"]).strip().rstrip("."),
                          "journal": rec.get("source", ""), "date": rec.get("pubdate", ""),
                          "doi": doi, "authors": byline,
                          "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"}
        time.sleep(0.4)
    print(f"  metadata: {len(meta)}/{len(every)}")
    return by_field, meta

# ---------------------------------------------------------------- rank


def tokens(text):
    return {w for w in re.findall(r"[A-Za-z0-9][A-Za-z0-9\-']+", text.lower())
            if w not in STOP and len(w) > 2}


def cluster_news(news, threshold=0.34):
    items = []
    for rows in news.values():
        for row in rows:
            items.append(dict(row, tk=tokens(row["clean"])))
    clusters = []
    for item in sorted(items, key=lambda x: -len(x["tk"])):
        best, score = None, 0.0
        for cluster in clusters:
            union = len(item["tk"] | cluster["tk"]) or 1
            ratio = len(item["tk"] & cluster["tk"]) / union
            if ratio > score:
                best, score = cluster, ratio
        if best is not None and score >= threshold:
            best["members"].append(item)
            best["tk"] |= item["tk"]
        else:
            clusters.append({"tk": set(item["tk"]), "members": [item]})
    for cluster in clusters:
        outlets = sorted({m["source"] for m in cluster["members"] if m["source"]})
        cluster["outlets"] = outlets
        cluster["n_outlets"] = len(outlets)
        cluster["rep"] = max(cluster["members"],
                             key=lambda m: (m["source"] in TIER_OUTLETS, len(m["desc"])))
        del cluster["tk"]
        for member in cluster["members"]:
            member.pop("tk", None)
    clusters.sort(key=lambda c: (-c["n_outlets"], -len(c["members"]), c["rep"]["date"]))
    return clusters, items


def pick_sections(news, clusters):
    """Top-10 multi-outlet stories, then per-section picks that don't repeat them."""
    picked, used = {}, set()
    buzz = []
    for cluster in clusters:
        if cluster["n_outlets"] < 2:
            break
        sig = cluster["rep"]["clean"].lower()[:60]
        if sig in used:
            continue
        used.add(sig)
        buzz.append(dict(cluster["rep"], n_outlets=cluster["n_outlets"],
                         outlets=cluster["outlets"][:6]))
        if len(buzz) == 10:
            break
    # clusters are already sorted by -n_outlets; make the promise explicit anyway
    picked["buzz"] = sorted(buzz, key=lambda r: -r["n_outlets"])

    reach = {}
    for cluster in clusters:
        for member in cluster["members"]:
            reach[member["link"]] = cluster["n_outlets"]

    for key, _label, _sub, count in SECTIONS:
        if key == "buzz":
            continue
        pool = []
        for feed in SECTION_FEEDS[key]:
            pool.extend(news.get(feed, []))
        pool.sort(key=lambda r: (-reach.get(r["link"], 1),
                                 0 if r["source"] in TIER_OUTLETS else 1,
                                 r["date"]))
        rows, seen = [], set()
        for row in pool:
            sig = row["clean"].lower()[:60]
            if sig in seen or sig in used:
                continue
            seen.add(sig)
            rows.append(dict(row, n_outlets=reach.get(row["link"], 1)))
            if len(rows) == count:
                break
        picked[key] = rows
    return picked


def journal_tier(journal):
    low = (journal or "").lower()
    for tier, names in ((5, TIER_5), (4, TIER_4), (3, TIER_3), (2, TIER_2)):
        if any(low.startswith(n) or n in low for n in names):
            return tier
    return 1


def score_paper(rec):
    hay = (rec["title"] + " " + rec["journal"]).lower()
    hits = [(kw, w) for kw, w in KEYWORDS.items() if kw in hay]
    score = sum(w for _kw, w in hits) + 2 * journal_tier(rec["journal"])
    return score, [kw for kw, _w in sorted(hits, key=lambda x: -x[1])[:3]]


def rank_papers(by_field, meta):
    scored = {}
    for field, ids in by_field.items():
        rows = []
        for pmid in ids:
            rec = meta.get(pmid)
            if not rec:
                continue
            score, hits = score_paper(rec)
            rows.append(dict(rec, field=field, score=score, hits=hits))
        rows.sort(key=lambda r: -r["score"])
        scored[field] = rows

    # one best paper per field, then keep the five strongest of those
    best, taken = [], set()
    for field in FIELDS:
        for row in scored.get(field, []):
            if row["pmid"] not in taken:
                best.append(row)
                taken.add(row["pmid"])
                break
    best.sort(key=lambda r: -r["score"])
    top = best[:5]
    taken = {r["pmid"] for r in top}
    extra = []
    for field in FIELDS:
        for row in scored.get(field, []):
            if row["pmid"] not in taken:
                extra.append(row)
                taken.add(row["pmid"])
                break
    for row in top + extra:
        row["why"] = ("Overlaps my bench work: " + ", ".join(row["hits"]) + "."
                      if row["hits"] else "High-profile result in one of my fields.")
    return top, extra


def company_radar(items):
    radar = {}
    for company, patterns in ALIASES.items():
        hits, seen = [], set()
        for item in items:
            hay = item["title"] + " " + item["desc"]
            if not any(re.search(p, hay, re.I) for p in patterns):
                continue
            sig = item["clean"].lower()[:60]
            if sig in seen:
                continue
            seen.add(sig)
            hits.append(item)
        if hits:
            radar[company] = sorted(hits, key=lambda h: h["date"], reverse=True)[:3]
    return radar

# ---------------------------------------------------------------- render


def e(value):
    return html.escape(str(value or ""), quote=True)


CSS = """
:root{--bg:#0A0E1A;--bg-2:#0E1424;--panel:#121A2E;--panel-2:#161F38;--line:#243356;
--line-soft:#1B2740;--ink:#EAF0FF;--ink-2:#A9B6D6;--ink-3:#6A7899;--A:#3BE8B0;
--signal-1:#38E1FF;--signal-2:#7C6CFF;--amber:#F5A623;--maxw:1180px}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:400 16px/1.65 'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--signal-1);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 24px}
header.top{border-bottom:1px solid var(--line-soft);
background:linear-gradient(180deg,var(--bg-2),var(--bg));padding:26px 0}
header.top .wrap{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap}
.brand{font:700 15px/1 'JetBrains Mono',monospace;letter-spacing:.14em;
text-transform:uppercase;color:var(--ink)}
.back{font:500 12px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--ink-3);
text-transform:uppercase;margin-left:auto}
.hero{padding:54px 0 30px}
.eyebrow{font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.2em;
text-transform:uppercase;color:var(--ink-3);display:flex;align-items:center;gap:10px}
.idx{color:var(--signal-2);font-weight:700}
h1.title{font:700 clamp(30px,5vw,50px)/1.06 'Space Grotesk',sans-serif;
letter-spacing:-.02em;margin:16px 0 10px}
.lead{color:var(--ink-2);max-width:62ch;font-size:17px;margin:0}
.stats{display:flex;gap:26px;flex-wrap:wrap;margin-top:26px;padding-top:20px;
border-top:1px solid var(--line-soft)}
.stat b{display:block;font:700 22px/1.1 'JetBrains Mono',monospace;color:var(--signal-1)}
.stat span{font:500 10px/1.4 'JetBrains Mono',monospace;letter-spacing:.14em;
text-transform:uppercase;color:var(--ink-3)}
section{padding:40px 0 10px}
.sec-head{border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:24px}
.sec-title{font:600 25px/1.15 'Space Grotesk',sans-serif;margin:12px 0 6px;letter-spacing:-.01em}
.sec-lead{color:var(--ink-3);margin:0;font-size:14px}
.card{background:var(--panel);border:1px solid var(--line-soft);border-radius:10px;
padding:18px 20px;margin-bottom:14px;display:flex;gap:16px;transition:border-color .15s}
.card:hover{border-color:var(--line)}
.pn{font:700 13px/1.4 'JetBrains Mono',monospace;color:var(--signal-2);min-width:34px}
.card h4{font:600 17px/1.4 'Space Grotesk',sans-serif;margin:0 0 6px}
.card h4 a{color:var(--ink)}
.meta{font:400 11.5px/1.5 'JetBrains Mono',monospace;color:var(--ink-3)}
.body{color:var(--ink-2);font-size:14.5px;margin:7px 0 0}
.why{margin-top:10px;padding:9px 12px;border-left:2px solid var(--A);background:var(--panel-2);
border-radius:0 6px 6px 0;font-size:13.5px;color:var(--ink-2)}
.why b{color:var(--A);font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.1em;
text-transform:uppercase}
.tags{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:9px}
.tag{font:500 10px/1 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;
padding:5px 8px;border-radius:3px;background:rgba(56,225,255,.09);color:var(--signal-1);
border:1px solid rgba(56,225,255,.2)}
.tag.reach{background:rgba(245,166,35,.09);color:var(--amber);border-color:rgba(245,166,35,.22)}
.tag.field{background:rgba(124,108,255,.1);color:#b3a9ff;border-color:rgba(124,108,255,.24)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px}
.radar{background:var(--panel);border:1px solid var(--line-soft);border-left:2px solid var(--amber);
border-radius:0 8px 8px 0;padding:14px 16px}
.radar .co{font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.14em;
text-transform:uppercase;color:var(--amber);margin-bottom:9px}
.radar p{margin:0 0 8px;font-size:13.5px;line-height:1.5}
.radar p a{color:var(--ink)}
.src{color:var(--ink-3);font:400 11px/1.4 'JetBrains Mono',monospace}
table.also{width:100%;border-collapse:collapse}
table.also td{padding:13px 0;border-bottom:1px solid var(--line-soft);vertical-align:top}
table.also td.f{width:150px;padding-right:14px}
.arch{list-style:none;padding:0;margin:0}
.arch li{border-bottom:1px solid var(--line-soft);padding:13px 0;display:flex;gap:16px;
align-items:baseline;flex-wrap:wrap}
.arch .d{font:500 12px/1 'JetBrains Mono',monospace;color:var(--signal-1);min-width:96px}
.arch .t{color:var(--ink-2);font-size:14.5px;flex:1}
footer{margin-top:50px;border-top:1px solid var(--line-soft);background:var(--bg-2);padding:30px 0}
footer .wrap{color:var(--ink-3);font-size:12.5px;line-height:1.75}
footer b{color:var(--ink-2);font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.12em;
text-transform:uppercase;display:block;margin-bottom:9px}
@media(max-width:620px){.card{flex-direction:column;gap:8px}
table.also td.f{width:auto;display:block}table.also td{display:block;border:0;padding-bottom:0}
table.also tr{display:block;border-bottom:1px solid var(--line-soft);padding:12px 0}}
"""

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&'
         'family=JetBrains+Mono:wght@400;500;700&display=swap">')


def shell(title, description, body, canonical):
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(description)}">
<link rel="canonical" href="{e(canonical)}">
<meta property="og:title" content="{e(title)}"><meta property="og:type" content="article">
<meta property="og:description" content="{e(description)}">
<link rel="alternate" type="application/rss+xml" title="The Monday Brief"
      href="{SITE}/brief/feed.xml">
{FONTS}<style>{CSS}</style></head><body>
<header class="top"><div class="wrap"><span class="brand">Taylor Flaat</span>
<span class="eyebrow">The Monday Brief</span>
<a class="back" href="{SITE}/">&larr; taylorflaat.com</a></div></header>
{body}
<footer><div class="wrap"><b>How this is built</b>
Papers are pulled from PubMed by entry date across virology, molecular biology, cell biology,
NGS/genomics, oncology and veterinary medicine, then ranked on journal tier and keyword overlap
with my own bench work; publication dates can predate the indexing window. Industry items come
from ten topic news feeds over the same window, de-duplicated, with stock-promotion and
aggregator content dropped. &ldquo;Most-shared&rdquo; is the number of independent outlets that
ran the same story &mdash; social platforms expose no engagement data to this pipeline, so no
post-level virality is claimed. Every item links to its source and is summarised no further than
the outlet&rsquo;s own blurb. Rebuilt automatically every Monday.
<div style="margin-top:14px"><a href="{SITE}/brief/feed.xml">RSS feed</a> &nbsp;&middot;&nbsp;
<a href="{SITE}/brief/">Archive</a></div></div></footer>
</body></html>"""


def render_news(rows, numbered=True):
    out = []
    for i, row in enumerate(rows, 1):
        tags = []
        if row.get("n_outlets", 0) > 1:
            tags.append(f'<span class="tag reach">{row["n_outlets"]} outlets</span>')
        if row.get("source"):
            tags.append(f'<span class="tag">{e(row["source"])}</span>')
        index = f'<div class="pn">{i:02d}</div>' if numbered else ""
        blurb = e(re.sub(r"\s+", " ", row.get("desc", ""))[:230])
        out.append(f'<div class="card">{index}<div style="flex:1">'
                   f'<div class="tags">{"".join(tags)}</div>'
                   f'<h4><a href="{e(row["link"])}" target="_blank" rel="noopener">'
                   f'{e(row["clean"])}</a></h4>'
                   f'<div class="meta">{e(row.get("date", ""))}</div>'
                   f'<p class="body">{blurb}</p></div></div>')
    return "".join(out) or '<p class="sec-lead">Nothing material in this window.</p>'


def render_issue(issue):
    counts = issue["counts"]
    parts = [
        f'<div class="wrap hero"><div class="eyebrow"><span class="idx">{e(issue["issue"])}</span>'
        f' Week in review</div><h1 class="title">{e(issue["window_label"])}</h1>'
        f'<p class="lead">Funding, deals, hiring, trials and approvals across biotech, pharma and '
        f'academia &mdash; plus the newest papers in virology, molecular biology, cell biology, '
        f'NGS, oncology and veterinary medicine, ranked against my own bench work.</p>'
        f'<div class="stats">'
        f'<div class="stat"><b>{counts["news"]}</b><span>headlines screened</span></div>'
        f'<div class="stat"><b>{counts["papers"]}</b><span>papers assessed</span></div>'
        f'<div class="stat"><b>{counts["clusters"]}</b><span>multi-outlet stories</span></div>'
        f'<div class="stat"><b>{counts["radar"]}</b><span>watchlist hits</span></div>'
        f'</div></div>']

    if issue["radar"]:
        cards = []
        for company, hits in issue["radar"].items():
            rows = "".join(
                f'<p><a href="{e(h["link"])}" target="_blank" rel="noopener">{e(h["clean"])}</a>'
                f'<br><span class="src">{e(h["source"])} &middot; {e(h["date"])}</span></p>'
                for h in hits)
            cards.append(f'<div class="radar"><div class="co">{e(company)}</div>{rows}</div>')
        parts.append(
            f'<section><div class="wrap"><div class="sec-head">'
            f'<div class="eyebrow"><span class="idx">01</span> Watchlist</div>'
            f'<h2 class="sec-title">Companies on my radar.</h2>'
            f'<p class="sec-lead">Past employers and places I have an application open.</p></div>'
            f'<div class="grid">{"".join(cards)}</div></div></section>')

    cards = []
    for i, paper in enumerate(issue["top5"], 1):
        byline = f' &middot; {e(paper["authors"])}' if paper.get("authors") else ""
        cards.append(
            f'<div class="card"><div class="pn">{i:02d}</div><div style="flex:1">'
            f'<div class="tags"><span class="tag field">{e(paper["field"])}</span></div>'
            f'<h4><a href="{e(paper["url"])}" target="_blank" rel="noopener">'
            f'{e(paper["title"])}</a></h4>'
            f'<div class="meta">{e(paper["journal"])} &middot; {e(paper["date"])}{byline}'
            f' &middot; PMID {e(paper["pmid"])}</div>'
            f'<div class="why"><b>Relevance</b><br>{e(paper["why"])}</div></div></div>')
    parts.append(
        f'<section><div class="wrap"><div class="sec-head">'
        f'<div class="eyebrow"><span class="idx">02</span> Literature</div>'
        f'<h2 class="sec-title">Five papers worth the time.</h2>'
        f'<p class="sec-lead">Highest-scoring work indexed this window, one per field.</p>'
        f'</div>{"".join(cards)}</div></section>')

    if issue["also"]:
        rows = "".join(
            f'<tr><td class="f"><span class="tag field">{e(p["field"])}</span></td><td>'
            f"<div style=\"font:600 15px/1.4 'Space Grotesk',sans-serif\">"
            f'<a href="{e(p["url"])}" target="_blank" rel="noopener" style="color:var(--ink)">'
            f'{e(p["title"])}</a></div><div class="meta" style="margin-top:4px">'
            f'{e(p["journal"])} &middot; {e(p["date"])} &middot; PMID {e(p["pmid"])}</div></td></tr>'
            for p in issue["also"])
        parts.append(
            f'<section><div class="wrap"><div class="sec-head">'
            f'<div class="eyebrow"><span class="idx">03</span> Also indexed</div>'
            f'<h2 class="sec-title">One more per discipline.</h2></div>'
            f'<table class="also">{rows}</table></div></section>')

    num = 4
    for key, label, sub, _count in SECTIONS:
        rows = issue["picked"].get(key, [])
        if not rows:
            continue
        parts.append(
            f'<section><div class="wrap"><div class="sec-head">'
            f'<div class="eyebrow"><span class="idx">{num:02d}</span> Industry</div>'
            f'<h2 class="sec-title">{label}</h2><p class="sec-lead">{sub}</p></div>'
            f'{render_news(rows, numbered=(key == "buzz"))}</div></section>')
        num += 1
    return "".join(parts)


def render_index(issues):
    latest = issues[0]
    rows = "".join(
        f'<li><span class="d">{e(it["date"])}</span><span class="t">'
        f'<a href="issues/{e(it["date"])}.html">{e(it["window_label"])}</a></span>'
        f'<span class="src">{it["counts"]["news"]} headlines &middot; '
        f'{it["counts"]["papers"]} papers</span></li>' for it in issues)
    plural = "s" if len(issues) != 1 else ""
    body = (render_issue(latest)
            + f'<section><div class="wrap"><div class="sec-head">'
              f'<div class="eyebrow"><span class="idx">&infin;</span> Archive</div>'
              f'<h2 class="sec-title">Every issue.</h2>'
              f'<p class="sec-lead">{len(issues)} issue{plural} published.</p></div>'
              f'<ul class="arch">{rows}</ul></div></section>')
    return shell("The Monday Brief — Taylor Flaat",
                 f"Weekly biotech, pharma and academia digest: {latest['window_label']}.",
                 body, f"{SITE}/brief/")


def render_feed(issues):
    items = []
    for it in issues[:30]:
        when = datetime.datetime.strptime(it["date"], "%Y-%m-%d").replace(
            tzinfo=datetime.timezone.utc)
        items.append(
            f"<item><title>The Monday Brief — {e(it['window_label'])}</title>"
            f"<link>{SITE}/brief/issues/{it['date']}.html</link>"
            f'<guid isPermaLink="true">{SITE}/brief/issues/{it["date"]}.html</guid>'
            f"<pubDate>{format_datetime(when)}</pubDate>"
            f"<description>{it['counts']['news']} headlines screened, "
            f"{it['counts']['papers']} papers assessed across virology, molecular biology, "
            f"cell biology, NGS, oncology and veterinary medicine.</description></item>")
    built = format_datetime(datetime.datetime.now(datetime.timezone.utc))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
            f"<title>The Monday Brief — Taylor Flaat</title><link>{SITE}/brief/</link>"
            "<description>Weekly biotech, pharma and academia digest with newly indexed "
            "literature across virology, molecular biology, cell biology, NGS, oncology and "
            "veterinary medicine.</description><language>en-us</language>"
            f"<lastBuildDate>{built}</lastBuildDate>{''.join(items)}</channel></rss>")

# ---------------------------------------------------------------- main


def previous_week(today=None, weeks=1):
    if today is None:
        today = datetime.date.today()
    monday = today - datetime.timedelta(days=today.weekday())
    return monday - datetime.timedelta(days=7 * weeks), monday - datetime.timedelta(days=1)


def load_archive(stamp):
    data_dir = os.path.join(OUT, "data")
    os.makedirs(data_dir, exist_ok=True)
    archive = []
    for name in sorted(os.listdir(data_dir)):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(data_dir, name), encoding="utf-8") as fh:
                rec = json.load(fh)
        except (ValueError, OSError):
            continue
        if rec.get("date") == stamp:
            continue
        # Only list an older issue if its page is actually on disk, so the
        # archive never links somewhere that 404s.
        if not os.path.exists(os.path.join(OUT, "issues", f"{rec.get('date')}.html")):
            print(f"  skipping {name}: no issues/{rec.get('date')}.html", file=sys.stderr)
            continue
        archive.append(rec)
    return archive


def main():
    weeks = int(os.environ.get("BRIEF_WEEKS", "1"))
    start, end = previous_week(weeks=weeks)
    stamp = end.isoformat()
    label = (f"{start:%d %B} – {end:%d %B %Y}" if start.month != end.month
             else f"{start:%d} – {end:%d %B %Y}")
    print(f"window {start} .. {end}")

    print("news:")
    news = fetch_news(start, end)
    clusters, items = cluster_news(news)
    picked = pick_sections(news, clusters)
    radar = company_radar(items)

    print("papers:")
    by_field, meta = fetch_papers(start, end)
    top5, also = rank_papers(by_field, meta)

    if not items and not meta:
        print("no data fetched — leaving the site untouched", file=sys.stderr)
        return 1

    archive = load_archive(stamp)
    issue = {"issue": f"{len(archive) + 1:02d}", "date": stamp, "window_label": label,
             "generated": datetime.date.today().isoformat(),
             "counts": {"news": sum(len(v) for v in news.values()),
                        "papers": len(meta),
                        "clusters": sum(1 for c in clusters if c["n_outlets"] >= 2),
                        "radar": sum(len(v) for v in radar.values())},
             "picked": picked, "radar": radar, "top5": top5, "also": also}

    os.makedirs(os.path.join(OUT, "issues"), exist_ok=True)
    with open(os.path.join(OUT, "data", f"{stamp}.json"), "w", encoding="utf-8") as fh:
        json.dump(issue, fh, indent=1)
    with open(os.path.join(OUT, "issues", f"{stamp}.html"), "w", encoding="utf-8") as fh:
        fh.write(shell(f"The Monday Brief — {label}",
                       f"Biotech, pharma and academia digest for {label}.",
                       render_issue(issue), f"{SITE}/brief/issues/{stamp}.html"))

    everything = sorted(archive + [issue], key=lambda a: a["date"], reverse=True)
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as fh:
        fh.write(render_index(everything))
    with open(os.path.join(OUT, "feed.xml"), "w", encoding="utf-8") as fh:
        fh.write(render_feed(everything))

    print(f"issue {issue['issue']} written: {issue['counts']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
