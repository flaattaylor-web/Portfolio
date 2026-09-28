"""Weekly biotech/pharma/academia digest -> email-safe HTML.

Reusable: feed it the handoff JSONs produced by the collection cells and it
returns a single self-contained, inline-styled HTML document that renders in
Gmail as well as in a browser.
"""
import html, json

INK      = "#10233b"
MUTED    = "#5c6b7a"
ACCENT   = "#0b6b5b"
ACCENT2  = "#b8531a"
RULE     = "#e3e6ea"
PAPER    = "#ffffff"
CANVAS   = "#f2f1ec"
CHIP_BG  = "#eef4f2"
FONT     = "Helvetica,Arial,sans-serif"
SERIF    = "Georgia,serif"


def e(s):
    return html.escape(str(s or ""), quote=True)


def chip(text, bg=CHIP_BG, fg=ACCENT):
    return (f'<span style="display:inline-block;background:{bg};color:{fg};font:600 10px/1 {FONT};'
            f'letter-spacing:.08em;text-transform:uppercase;padding:5px 8px;border-radius:3px;'
            f'white-space:nowrap;">{e(text)}</span>')


def section(num, title, subtitle=""):
    sub = (f'<div style="font:400 12px/1.5 {FONT};color:{MUTED};padding-top:3px;">{e(subtitle)}</div>'
           if subtitle else "")
    return f"""
    <tr><td style="padding:34px 32px 10px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="34" valign="top" style="font:700 22px/1 {SERIF};color:{ACCENT};">{num:02d}</td>
        <td valign="top" style="border-bottom:2px solid {INK};padding-bottom:8px;">
          <div style="font:700 15px/1.2 {FONT};color:{INK};letter-spacing:.1em;text-transform:uppercase;">{e(title)}</div>
          {sub}
        </td>
      </tr></table>
    </td></tr>"""


def paper_card(i, c):
    meta = " · ".join(x for x in [c.get("journal"), c.get("date"), c.get("authors")] if x)
    doi = (f' &nbsp;<a href="https://doi.org/{e(c["doi"])}" style="color:{MUTED};text-decoration:none;">doi</a>'
           if c.get("doi") else "")
    why = (f'<div style="margin-top:9px;border-left:3px solid {ACCENT};background:{CHIP_BG};'
           f'padding:9px 12px;font:400 13px/1.55 {FONT};color:{INK};">'
           f'<strong style="color:{ACCENT};">Why it matters:</strong> {e(c["why"])}</div>') if c.get("why") else ""
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-bottom:18px;border:1px solid {RULE};border-radius:5px;">
        <tr><td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="top" width="30" style="font:700 19px/1 {SERIF};color:{ACCENT2};padding-top:1px;">{i}</td>
            <td valign="top">
              {chip(c.get("field",""))}
              <div style="font:600 16px/1.4 {SERIF};color:{INK};margin:9px 0 5px;">
                <a href="{e(c["url"])}" style="color:{INK};text-decoration:none;">{e(c["title"])}</a></div>
              <div style="font:400 11px/1.5 {FONT};color:{MUTED};">{e(meta)}</div>
              {why}
              <div style="margin-top:9px;font:600 11px/1 {FONT};letter-spacing:.06em;">
                <a href="{e(c["url"])}" style="color:{ACCENT};text-decoration:none;">PubMed {e(c["pmid"])} &rarr;</a>{doi}</div>
            </td>
          </tr></table>
        </td></tr>
      </table>"""


def news_row(it, rank=None, show_reach=False):
    lead = (f'<td valign="top" width="30" style="font:700 17px/1.2 {SERIF};color:{ACCENT2};">{rank}</td>'
            if rank else "")
    angle = (f'<div style="margin-top:7px;font:italic 400 12.5px/1.55 {FONT};color:{ACCENT};">'
             f'&#9656; {e(it["angle"])}</div>') if it.get("angle") else ""
    reach = ""
    if show_reach and it.get("n_outlets"):
        reach = chip(f'{it["n_outlets"]} outlets', bg="#fdf1e7", fg=ACCENT2)
    tag = chip(it["tag"]) if it.get("tag") else ""
    tags = (f'<div style="margin-bottom:8px;">{reach}{"&nbsp;" if reach and tag else ""}{tag}</div>'
            if (reach or tag) else "")
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-bottom:1px solid {RULE};">
        <tr><td style="padding:15px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            {lead}
            <td valign="top">
              {tags}
              <div style="font:600 15px/1.4 {FONT};color:{INK};">
                <a href="{e(it["link"])}" style="color:{INK};text-decoration:none;">{e(it["headline"])}</a></div>
              <div style="margin-top:5px;font:400 13.5px/1.6 {FONT};color:#3b4a5a;">{e(it.get("line",""))}</div>
              {angle}
              <div style="margin-top:7px;font:400 11px/1 {FONT};color:{MUTED};letter-spacing:.03em;">
                {e(it.get("outlet",""))} &nbsp;·&nbsp; {e(it.get("date",""))}</div>
            </td>
          </tr></table>
        </td></tr>
      </table>"""


def radar_block(radar):
    if not radar:
        return (f'<div style="font:400 13px/1.6 {FONT};color:{MUTED};">No coverage of the tracked '
                f'companies in this window.</div>')
    out = []
    for co, hits in radar.items():
        rows = "".join(
            f'<div style="padding:7px 0 0 0;font:400 13px/1.5 {FONT};color:#3b4a5a;">'
            f'<a href="{e(h["l"])}" style="color:{INK};text-decoration:none;">{e(h["t"])}</a>'
            f'<span style="color:{MUTED};font-size:11px;"> &nbsp;{e(h["s"])} · {e(h["d"])}</span></div>'
            for h in hits)
        out.append(
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
            f'style="margin-bottom:12px;background:{CHIP_BG};border-radius:5px;">'
            f'<tr><td style="padding:12px 14px;border-left:3px solid {ACCENT2};">'
            f'<div style="font:700 12px/1 {FONT};color:{INK};letter-spacing:.09em;text-transform:uppercase;">'
            f'{e(co)}</div>{rows}</td></tr></table>')
    return "".join(out)


def build(*, issue, window, papers, picked, radar, tracked, counts, generated):
    # A company can appear in more than one watchlist group; show it once.
    tracked = list(dict.fromkeys(tracked))
    # The "Most-Shared" caption promises descending outlet count, so enforce it here
    # rather than trusting the order the curation step happened to return.
    picked = dict(picked)
    picked["buzz"] = sorted(picked.get("buzz", []),
                            key=lambda r: -(r.get("n_outlets") or 0))

    nav = " &nbsp;·&nbsp; ".join([
        "Companies in focus", "Five papers", "Also indexed", "Most-shared",
        "Money in", "Deals", "People", "Trials", "Regulatory", "Academia", "Platforms &amp; tools"])

    top5 = "".join(paper_card(i, c) for i, c in enumerate(papers["top5"], 1))

    also_rows = "".join(
        f'<tr>'
        f'<td valign="top" style="padding:11px 10px 11px 0;border-bottom:1px solid {RULE};width:130px;">'
        f'{chip(c["field"])}</td>'
        f'<td valign="top" style="padding:11px 0;border-bottom:1px solid {RULE};">'
        f'<div style="font:600 14px/1.45 {SERIF};color:{INK};">'
        f'<a href="{e(c["url"])}" style="color:{INK};text-decoration:none;">{e(c["title"])}</a></div>'
        f'<div style="margin-top:4px;font:400 11px/1.5 {FONT};color:{MUTED};">'
        f'{e(c["journal"])} · {e(c["date"])} · PMID {e(c["pmid"])}</div>'
        f'<div style="margin-top:5px;font:400 12.5px/1.55 {FONT};color:{ACCENT};">{e(c["why"])}</div>'
        f'</td></tr>'
        for c in papers["per_field"])

    def block(key, rank=False, reach=False):
        rows = picked.get(key, [])
        if not rows:
            return f'<div style="font:400 13px/1.6 {FONT};color:{MUTED};">Nothing material this window.</div>'
        return "".join(news_row(it, rank=(i if rank else None), show_reach=reach)
                       for i, it in enumerate(rows, 1))

    body = f"""
    {section(1, "Companies In Focus", "A standing roster of biopharma and life-science tooling companies")}
    <tr><td style="padding:6px 32px 0 32px;">{radar_block(radar)}
      <div style="margin-top:6px;font:400 11px/1.6 {FONT};color:{MUTED};">
        Watchlist: {e(", ".join(tracked))}</div></td></tr>

    {section(2, "Five Papers Worth Reading", "Highest-scoring work indexed this window")}
    <tr><td style="padding:6px 32px 0 32px;">{top5}</td></tr>

    {section(3, "Also Indexed", "One more per discipline")}
    <tr><td style="padding:6px 32px 0 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">{also_rows}</table>
    </td></tr>

    {section(4, "Most-Shared Stories", "Ranked by how many independent outlets ran it")}
    <tr><td style="padding:0 32px;">{block("buzz", rank=True, reach=True)}</td></tr>

    {section(5, "Money In", "Financings, IPOs, venture rounds")}
    <tr><td style="padding:0 32px;">{block("funding")}</td></tr>

    {section(6, "Deals", "M&amp;A, licensing, reverse mergers")}
    <tr><td style="padding:0 32px;">{block("mergers")}</td></tr>

    {section(7, "People &amp; Headcount", "Hires, exits, layoffs, restructurings")}
    <tr><td style="padding:0 32px;">{block("hiring")}</td></tr>

    {section(8, "Clinical Trials", "Readouts, starts, failures")}
    <tr><td style="padding:0 32px;">{block("trials")}</td></tr>

    {section(9, "Regulatory &amp; Drug Advances", "Approvals, CRLs, CHMP opinions")}
    <tr><td style="padding:0 32px;">{block("drugs")}</td></tr>

    {section(10, "Academia", "Grants, budgets, institutions")}
    <tr><td style="padding:0 32px;">{block("academia")}</td></tr>

    {section(11, "Platforms & Tools", "NGS, virology and animal-health industry moves")}
    <tr><td style="padding:0 32px 10px 32px;">{block("platform")}</td></tr>
    """

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The Monday Brief &mdash; {e(window)}</title></head>
<body style="margin:0;padding:0;background:{CANVAS};">
<div style="display:none;max-height:0;overflow:hidden;">{e(counts['headline_preview'])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CANVAS};">
<tr><td align="center" style="padding:22px 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0"
       style="width:680px;max-width:680px;background:{PAPER};border-radius:7px;overflow:hidden;
              box-shadow:0 1px 3px rgba(16,35,59,.10);">

  <tr><td style="background:{INK};padding:26px 32px 22px 32px;">
    <div style="font:400 10px/1 {FONT};color:#8fa6bd;letter-spacing:.22em;text-transform:uppercase;">
      Issue {e(issue)} &nbsp;·&nbsp; Biotech &middot; Pharma &middot; Academia</div>
    <div style="font:700 33px/1.1 {SERIF};color:#ffffff;letter-spacing:-.4px;margin:10px 0 0;">
      The Monday Brief</div>
    <div style="font:400 13px/1.5 {FONT};color:#b9c9d8;margin-top:7px;">
      Week in review &nbsp;·&nbsp; {e(window)}</div>
    <div style="margin-top:16px;padding-top:14px;border-top:1px solid #23395c;
                font:400 11px/1.7 {FONT};color:#8fa6bd;">{nav}</div>
  </td></tr>

  <tr><td style="padding:20px 32px 4px 32px;background:#fbfbf9;border-bottom:1px solid {RULE};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:400 12px/1.7 {FONT};color:{MUTED};">
        <strong style="color:{INK};">This issue:</strong>
        {counts['news']} headlines screened across 10 topic feeds &nbsp;·&nbsp;
        {counts['papers']} newly indexed papers assessed &nbsp;·&nbsp;
        {counts['clusters']} stories cross-checked for multi-outlet pickup
        <div style="margin-top:7px;color:#8794a3;font-size:11px;">
          &ldquo;Most-shared&rdquo; ranks by how many independent outlets ran a story. X and LinkedIn expose no
          engagement data to this pipeline, so no post-level virality is claimed.
        </div>
      </td></tr></table>
  </td></tr>

  {body}

  <tr><td style="padding:26px 32px 30px 32px;background:#fbfbf9;border-top:1px solid {RULE};">
    <div style="font:700 11px/1 {FONT};color:{INK};letter-spacing:.1em;text-transform:uppercase;">
      How this was built</div>
    <div style="margin-top:9px;font:400 11.5px/1.7 {FONT};color:{MUTED};">
      Papers: PubMed, entry date {e(window)}, screened across virology, molecular biology, cell biology,
      NGS/genomics, oncology and veterinary medicine, then ranked on journal tier and topical fit. Publication
      dates can predate the indexing window. News: ten topic feeds over the same window, de-duplicated, with
      stock-promotion and aggregator content dropped. &ldquo;Most-shared&rdquo; is measured as the number of
      independent outlets that ran the same story &mdash; X and LinkedIn expose no engagement data to this
      pipeline, so cross-outlet pickup is the reach proxy and no post-level virality is claimed. Every headline
      links to its source; nothing is paraphrased beyond the outlet&rsquo;s own summary.
    </div>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid {RULE};
                font:400 11px/1.6 {FONT};color:#8794a3;">
      Generated {e(generated)} &nbsp;·&nbsp; Next issue Monday.
    </div>
  </td></tr>

</table>
</td></tr></table>
</body></html>"""
