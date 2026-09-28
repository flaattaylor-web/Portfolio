"""Weekly biotech/pharma/academia digest -> email-safe HTML.

Feed it the handoff JSONs produced by the collection cells and it returns the
issue's **content well**: an inline-styled HTML fragment, 680px wide, with no
<html>, <head> or <body> of its own.

The masthead and the sign-off footer are NOT here. They live in Buttondown
under Design > Email > Header and Footer, which wrap this fragment on send,
and are styled to match taylorflaat.com. Two consequences worth knowing:

* Styling is inline because Outlook desktop and the Gmail app drop <style>
  blocks. Buttondown's Email CSS field only refines what it renders itself.
* The Gmail SMTP fallback in send_brief.py gets no masthead or footer, since
  nothing wraps the fragment on that path. Fix that before relying on it.
"""
import html, json, re

# Palette lifted from taylorflaat.com. The site's four accent hues are its
# --A/--C/--G/--T variables -- the DNA bases -- and they drive the section
# rotation below. The dark chrome lives in the Buttondown header and footer;
# here each base is darkened to clear 4.5:1 against white.
A        = "#1D8664"   # adenine   <- site --A #3BE8B0
C        = "#1A73E8"   # cytosine  <- site --C #4F9BFF
G        = "#967019"   # guanine   <- site --G #F0B429
T        = "#E81B37"   # thymine   <- site --T #FF5D73
BASES    = (A, C, G, T)

INK      = "#101A2E"   # headings
BODY     = "#3D4A63"   # body copy
MUTED    = "#697691"   # metadata and source lines
ACCENT   = "#0F8297"   # site --signal-1 #38E1FF, darkened for white
ACCENT2  = "#7161EF"   # site --signal-2 #7C6CFF, darkened for white
RULE     = "#DCE2EC"
RULE_2   = "#EAEEF5"
PAPER    = "#FFFFFF"
PAPER_2  = "#F7F9FC"
CANVAS   = "#EDF0F6"   # must match the Buttondown header/footer ground
CHIP_BG  = "#F7F9FC"

# Mail clients do not fetch webfonts, so these degrade to an OS face. Keep the
# stacks SHORT: each is repeated inline once per styled element, which in the
# 2026-09-27 issue meant 154 uses of FONT and 118 of MONO (DISPLAY, at 33, is
# the one that can afford its 'Space Grotesk' prefix). Lengthening FONT and
# MONO to full webfont stacks cost 8.2 kB against Gmail's ~102 kB clip
# threshold. The site's real three do load on the archive page.
FONT     = "Helvetica,Arial,sans-serif"
DISPLAY  = "'Space Grotesk',Helvetica,Arial,sans-serif"
MONO     = "Consolas,monospace"


def base(i):
    """Section accent, cycling adenine, cytosine, guanine, thymine."""
    return BASES[(i - 1) % 4]


def e(s):
    return html.escape(str(s or ""), quote=True)


def squeeze(s):
    """Strip the template's own indentation from the rendered fragment.

    A full issue runs close to Gmail's ~102 kB clip threshold, and Buttondown's
    header and footer take roughly 10 kB of that before this fragment starts.
    Only whitespace runs containing a newline are touched, so single spaces
    between inline elements -- which separate words -- are left alone.
    """
    s = re.sub(r">\s*\n\s*<", "><", s)
    return re.sub(r"\s*\n\s*", " ", s).strip()


def chip(text, bg=CHIP_BG, fg=ACCENT):
    return (f'<span style="display:inline-block;background:{bg};color:{fg};font:500 9.5px/1 {MONO};'
            f'letter-spacing:.14em;text-transform:uppercase;padding:5px 9px;border-radius:999px;'
            f'white-space:nowrap;">{e(text)}</span>')


def section(num, title, subtitle=""):
    hue = base(num)
    sub = (f'<div style="font:400 12.5px/1.6 {FONT};color:{MUTED};padding-left:16px;'
           f'padding-top:7px;">{e(subtitle)}</div>' if subtitle else "")
    return f"""
    <tr><td style="padding:30px 32px 0 32px;">
      <div style="font:700 10px/1 {MONO};color:{hue};letter-spacing:.22em;
                  text-transform:uppercase;padding-bottom:10px;">{num:02d}</div>
      <div style="font:700 21px/1.24 {DISPLAY};color:{INK};letter-spacing:-.4px;
                  border-left:3px solid {hue};padding-left:13px;">{e(title)}</div>
      {sub}
    </td></tr>"""


def paper_card(i, c):
    meta = " · ".join(x for x in [c.get("journal"), c.get("date"), c.get("authors")] if x)
    doi = (f' &nbsp;<a href="https://doi.org/{e(c["doi"])}" style="color:{MUTED};text-decoration:none;">doi</a>'
           if c.get("doi") else "")
    hue = base(i)
    why = (f'<div style="margin-top:11px;padding-top:10px;border-top:1px solid {RULE_2};'
           f'font:400 12.5px/1.6 {FONT};color:{BODY};">'
           f'<strong style="color:{INK};">Why it matters:</strong> {e(c["why"])}</div>') if c.get("why") else ""
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-bottom:12px;background:{PAPER_2};border:1px solid {RULE};border-radius:8px;">
        <tr>
          <td width="3" style="width:3px;line-height:1px;font-size:1px;
                               background:{hue};border-radius:8px 0 0 8px;">&nbsp;</td>
          <td style="padding:15px 17px;">
            <div style="font:400 10px/1 {MONO};color:{MUTED};letter-spacing:.16em;
                        text-transform:uppercase;padding-bottom:8px;">
              <span style="color:{hue};font-weight:700;">{i:02d}</span>&nbsp;&nbsp;{e(c.get("field",""))}</div>
              <div style="font:600 15px/1.36 {DISPLAY};color:{INK};letter-spacing:-.15px;margin:0 0 8px;">
                <a href="{e(c["url"])}" style="color:{INK};text-decoration:none;">{e(c["title"])}</a></div>
              <div style="font:400 10.5px/1.6 {MONO};color:{MUTED};">{e(meta)}</div>
              {why}
              <div style="margin-top:10px;font:500 10.5px/1 {MONO};letter-spacing:.1em;">
                <a href="{e(c["url"])}" style="color:{ACCENT};text-decoration:none;">PubMed {e(c["pmid"])} &rarr;</a>{doi}</div>
          </td>
        </tr>
      </table>"""


def news_row(it, rank=None, show_reach=False):
    hue = base(rank) if rank else ACCENT
    lead = (f'<td valign="top" width="28" style="width:28px;font:700 11px/1.55 {MONO};'
            f'color:{hue};padding-top:2px;">{rank:02d}</td>' if rank else "")
    angle = (f'<div style="margin-top:7px;font:400 12.5px/1.55 {FONT};color:{BODY};'
             f'border-left:2px solid {RULE};padding-left:9px;">'
             f'{e(it["angle"])}</div>') if it.get("angle") else ""
    reach = ""
    if show_reach and it.get("n_outlets"):
        reach = chip(f'{it["n_outlets"]} outlets', bg=PAPER_2, fg=hue)
    tag = chip(it["tag"]) if it.get("tag") else ""
    tags = (f'<div style="margin-bottom:8px;">{reach}{"&nbsp;" if reach and tag else ""}{tag}</div>'
            if (reach or tag) else "")
    return f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-bottom:1px solid {RULE_2};">
        <tr><td style="padding:14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            {lead}
            <td valign="top">
              {tags}
              <div style="font:500 13.5px/1.5 {FONT};">
                <a href="{e(it["link"])}" style="color:{C};text-decoration:none;">{e(it["headline"])}</a></div>
              <div style="margin-top:5px;font:400 13px/1.6 {FONT};color:{BODY};">{e(it.get("line",""))}</div>
              {angle}
              <div style="margin-top:6px;font:400 10.5px/1.6 {MONO};color:{MUTED};">
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
    for n, (co, hits) in enumerate(radar.items(), 1):
        hue = base(n)
        rows = "".join(
            f'<div style="padding:9px 0 0 0;">'
            f'<a href="{e(h["l"])}" style="font:400 12.5px/1.5 {FONT};'
            f'color:{C};text-decoration:none;">{e(h["t"])}</a>'
            f'<div style="font:400 10px/1.5 {MONO};color:{MUTED};padding-top:2px;">'
            f'{e(h["s"])} &middot; {e(h["d"])}</div></div>'
            for h in hits)
        out.append(
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
            f'style="margin-bottom:11px;background:{PAPER_2};border:1px solid {RULE};border-radius:8px;">'
            f'<tr><td style="padding:14px 16px;">'
            f'<div style="font:700 13px/1 {DISPLAY};color:{INK};letter-spacing:-.1px;">'
            f'<span style="display:inline-block;width:6px;height:6px;border-radius:999px;'
            f'background:{hue};margin-right:7px;"></span>{e(co)}</div>{rows}</td></tr></table>')
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
        f'<td valign="top" style="padding:11px 10px 11px 0;border-bottom:1px solid {RULE_2};width:130px;">'
        f'{chip(c["field"])}</td>'
        f'<td valign="top" style="padding:11px 0;border-bottom:1px solid {RULE_2};">'
        f'<div style="font:600 14px/1.45 {DISPLAY};color:{INK};letter-spacing:-.1px;">'
        f'<a href="{e(c["url"])}" style="color:{INK};text-decoration:none;">{e(c["title"])}</a></div>'
        f'<div style="margin-top:4px;font:400 10.5px/1.5 {MONO};color:{MUTED};">'
        f'{e(c["journal"])} &middot; {e(c["date"])} &middot; PMID {e(c["pmid"])}</div>'
        f'<div style="margin-top:5px;font:400 12.5px/1.55 {FONT};color:{BODY};">{e(c["why"])}</div>'
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

    stats = [(counts['news'], "headlines screened"),
             (counts['papers'], "papers assessed"),
             (counts['clusters'], "multi-outlet stories"),
             (len(radar), "watchlist hits")]
    statcells = "".join(
        f'<td width="25%" align="center" style="padding:0 4px;">'
        f'<div style="font:700 22px/1 {DISPLAY};color:{base(n)};letter-spacing:-.5px;">{v}</div>'
        f'<div style="font:400 9px/1.4 {MONO};color:{MUTED};letter-spacing:.1em;'
        f'text-transform:uppercase;padding-top:6px;">{k}</div></td>'
        for n, (v, k) in enumerate(stats, 1))

    # The masthead and the sign-off footer now live in Buttondown's Header and
    # Footer blocks, so this returns the content well only -- no <html>, no
    # <body>, no wordmark. The issue number and date window moved in here
    # because a static Buttondown header cannot carry per-issue values.
    return squeeze(f"""<div style="display:none;max-height:0;overflow:hidden;">{e(counts['headline_preview'])}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{CANVAS};">
<tr><td align="center" style="padding:0 12px;">
<table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0"
       style="width:680px;max-width:680px;background:{PAPER};">

  <tr><td style="padding:26px 32px 0 32px;">
    <div style="font:400 10px/1 {MONO};color:{MUTED};letter-spacing:.22em;text-transform:uppercase;">
      <span style="color:{ACCENT};font-weight:700;">{e(issue)}</span>&nbsp;&nbsp;Week in review</div>
    <div style="font:700 27px/1.16 {DISPLAY};color:{INK};letter-spacing:-.7px;margin:11px 0 0;">
      {e(window)}</div>
    <div style="margin-top:12px;padding-top:11px;border-top:1px solid {RULE_2};
                font:400 10.5px/1.8 {MONO};color:{MUTED};">{nav}</div>
  </td></tr>

  <tr><td style="padding:20px 32px 0 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background:{PAPER_2};border:1px solid {RULE};border-radius:8px;">
      <tr><td style="padding:17px 10px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>{statcells}</tr></table>
      </td></tr>
      <tr><td style="padding:0 18px 15px 18px;font:400 11px/1.65 {FONT};color:{MUTED};">
        &ldquo;Most-shared&rdquo; ranks by how many independent outlets ran a story. X and LinkedIn expose no
        engagement data to this pipeline, so no post-level virality is claimed.
      </td></tr>
    </table>
  </td></tr>

  {body}

  <tr><td style="padding:24px 32px 30px 32px;">
    <div style="padding-top:14px;border-top:1px solid {RULE_2};
                font:400 10.5px/1.7 {MONO};color:{MUTED};">
      Generated {e(generated)} &nbsp;&middot;&nbsp; Next issue Monday.
    </div>
  </td></tr>

</table>
</td></tr></table>""")
