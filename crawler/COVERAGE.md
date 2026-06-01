# Coverage — what this crawler can and cannot fully capture

Empirically tested against the live courts.ie surfaces (June 2026). Read this
before assuming "full coverage".

## TL;DR

| Surface | Full coverage? | How |
|---|---|---|
| **High Court case records** | ✅ Yes | Year sweep; paging is uncapped below each query's total (verified to 25k). |
| **Probate grants** | ✅ Yes (by year of death) | Empty-lastname + year returns every grant for that year. |
| **Judgments (full-text archive)** | ✅ Yes — **plain HTTP** | The by-year search redirects to an unauthenticated Solr GET endpoint; `judgments-archive` pages it. No browser needed. |
| **Determinations (full-text archive)** | ✅ Yes — **plain HTTP** | Same endpoint with ` type:Determination`. |
| Circuit / District / CoA / Supreme **judgments** | ✅ In the archive | The by-year archive spans all courts — confirmed present: IEHC, IECA (CoA), IESC (Supreme), IECC (Circuit), **IEDC (District)**, **IECCA (Court of Criminal Appeal)**. |
| Circuit / District / CoA / Supreme **case records** | ❌ Not public | No public searchable dataset exists — only the High Court has structured case records (confirmed by research, below). |

So: **everything coverable here is reachable over plain HTTP** — High Court
records, probate, and the full judgment/determination archives. The only true
gap is *structured case records* for the non-High-Court tiers, which are not
published online at all.

> Playwright (a dev dependency) was used only to **discover** the archive
> endpoint; it is **not needed at runtime**. You can skip
> `npx playwright install` unless you want the browser as a fallback.

## Evidence

**High Court paging is not capped.**
Per-year totals range ~9k–25k (largest: 2004 = 25,288). Walking 2004 reached
page 1012 (last 13 of 25,288); page 1100 returned 0. Year 2015 (16,393) reached
page 656 likewise. Conclusion: every year is fully pageable on its own, so the
`proceeding` segmenter in `highCourt.ts` is a safety net (triggers only above
`HCS_SEGMENT_THRESHOLD`), not a necessity. Sum of 2000–2026 ≈ 451,824; DB total
≈ 508,409, so ~56k records predate 2000 — covered by extending `--from`
(default `HCS_MIN_YEAR = 1980`).

Note: naively splitting a year by `proceeding` would *drop* the rare
proceeding types that have no filter code (e.g. "Article 26 Reference",
"Notice of Application for Leave to Appeal"). Because years are under the
threshold, the crawler pages them directly and keeps those records. The
segmenter only engages for a partition above the threshold, and warns about any
un-coded residual it cannot reach by `proceeding` alone.

**Probate has a "list all for a year" path.**
`?lastname=&year=2020` → `Grants found: 16,796` (vs 272 for `lastname=murphy`).
Empty year with `lastname=a` → 424,969, i.e. the field is a substring match and
years partition the DB cleanly. The collector therefore sweeps by year with an
empty surname for completeness. Caveat: grants with a blank/unknown year of
death won't appear in a year sweep — pass explicit `--lastnames` to chase those.

**Judgments / determinations listings are capped — and no HTTP hack opens them.**
`/Judgments?sort=desc:DateUploaded` returns ~100 PDFs on page 0, ~96 on page 1,
then only the page-chrome help PDF (~196 real judgments total). `/determinations`
returns ~24 on page 0, then nothing. Things that DON'T work (all tested):

- GET keyword/wildcard/year params (`keys=e`, `keys=*`, `alfresco_NeutralCitation=2015`,
  `selected_year=2015`, `alfresco_todate=2015`) — **ignored**; always the default 100.
- POST the form, even with a cache-busted **live** `form_build_id` + cookies —
  **302 to the homepage** (104,875 B).
- `POST /system/ajax` (Drupal AJAX endpoint) — 200 but **empty body** (form not
  in the server cache; the page is edge-cached so anonymous build_ids aren't stored).
- Direct Alfresco REST (`/acc/alfresco/api/.../search`, `/service/...`, CMIS) — 404.

The vowel/`*` "return everything" trick can't be applied to the *listing*: the
keyword field is only live once the page JS fires. But driving the by-year form
in a browser (Playwright, discovery only) revealed the **real shortcut** below.

**Court census of the browsable listing** (asc+desc, pages 0–1):

```
IEHC 548   High Court
IECA 124   Court of Appeal
IESC  20   Supreme Court
IECC  12   Circuit Court      <- lower court, present
IESCDET 46 Supreme determinations
```

## The shortcut — full archive over plain HTTP (no browser)

Driving `/judgments-year` in a browser showed its form does **not** stay on an
AJAX call — it POSTs and **302-redirects to an unauthenticated GET endpoint**
backed by Solr:

```
GET https://ww2.courts.ie/search/judgments-year/<SOLR_QUERY>?page=<N>
SOLR_QUERY = " type:Judgment" AND "filter:alfresco_year.true"
                               AND "filter:alfresco_todate.<YEAR>"
```

Determinations use `/search/determinations-year/` + ` type:Determination`.
Verified by direct `curl` (no cookie, token, or browser):

- `page` is 0-based, ~95–100 results/page, **pages are distinct**, and a year
  ends on the first empty page.
- 2015 = pages 0–13 ≈ **1,234 judgments** (vs ~196 from the capped listing).
- Returns **all courts**, including IEDC (District) and IECCA (Court of Criminal
  Appeal). Smoke test: determinations 2024 → **164** records (listing showed ~24).

`collectors/judgmentsArchive.ts` implements exactly this — pure HTTP, rate-
limited, resumable per (year, page):

```bash
npx tsx crawler/index.ts judgments-archive            # full judgments archive
npx tsx crawler/index.ts determinations-archive       # full determinations
npx tsx crawler/index.ts download judgments-archive   # then fetch the PDFs
```

Flags: `--from`/`--to` (year range). No `npm playwright install` required.
Other things checked for shortcuts and ruled out: the listing's `page` cap, a
sitemap of judgments (none), and a direct Alfresco REST API (404).

## Case records for other courts — researched, confirmed absent

Online research confirms only the **High Court** publishes a searchable
case-record system; CoA / Supreme / Circuit / District do **not**:

- Case *law* (judgments) on courts.ie covers Supreme (2001+), High Court &
  Court of Criminal Appeal (2004+), Court of Appeal (2014+) — i.e. the archive
  above. Circuit/District seldom publish written judgments.
- Access to actual *court records* (files, pleadings, orders) for any court is,
  outside FOI, reserved to the parties / their legal reps; a non-party must
  apply to the relevant Court Office for a judge's decision — there is no public
  online register.
- The **Legal Diary** (legaldiary.courts.ie / CSOL) lists scheduled cases for
  Supreme, CoA, High, Central Criminal and Circuit courts — but that is a
  *calendar*, not a records database.
- Historical Circuit/District files sit with the **National Archives** (offline,
  by visit; family-law files closed to the public).

Sources: courts.ie/access-court-records, gov.ie "Access Court Judgments and
Determinations", National Archives court-records collections, IRLII case-search,
European e-Justice Portal (national case law, IE).

## Politeness / legal

`robots.txt` on www.courts.ie and www2.courts.ie declares `Crawl-delay: 10`.
At that rate a full High Court crawl *with* details (~508k × 2 requests) is
months of wall-clock — run `--no-details` first, segment by year, and consider
asking the Courts Service about bulk access rather than scraping at scale.
Party names, solicitors, and probate grantees/addresses are personal data:
public record, but store and process accordingly.
