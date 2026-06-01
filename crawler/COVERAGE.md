# Coverage — what this crawler can and cannot fully capture

Empirically tested against the live courts.ie surfaces (June 2026). Read this
before assuming "full coverage".

## TL;DR

| Surface | Full coverage? | How |
|---|---|---|
| **High Court case records** | ✅ Yes | Year sweep; paging is uncapped below each query's total (verified to 25k). |
| **Probate grants** | ✅ Yes (by year of death) | Empty-lastname + year returns every grant for that year. |
| **Judgments (full-text archive)** | ✅ Yes — via Playwright | Browse listing is capped, but the `judgments-archive` collector drives the by-year form in a headless browser to reach the full archive. |
| **Determinations (full-text archive)** | ✅ Yes — via Playwright | Same engine against `/determinations-year`. |
| Circuit / District / CoA / Supreme **judgments** | ✅ In the archive | The by-year archive spans all courts; CoA (IECA), Supreme (IESC) and Circuit (IECC) judgments are confirmed present. |
| Circuit / District / CoA / Supreme **case records** | ❌ N/A | No such public searchable dataset exists — only the High Court has structured case records. |

So: **case records (High Court) + probate are complete via plain HTTP; the full
judgment/determination archives are reachable but require the Playwright
collector** (`judgments-archive` / `determinations-archive`). The only true gap
is *structured case records* for the non-High-Court tiers, which simply don't
exist publicly.

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

The vowel/`*` "return everything" trick can't even be applied: the keyword field
is only reachable once the page's JS fires the AJAX call. So the archive is
genuinely **JS/AJAX-gated**.

**Court census of the browsable listing** (asc+desc, pages 0–1) — confirms lower
courts are present as judgments:

```
IEHC 548   High Court
IECA 124   Court of Appeal
IESC  20   Supreme Court
IECC  12   Circuit Court      <- lower court, present
IESCDET 46 Supreme determinations
```

## Reaching the full archive — implemented via Playwright

The by-year browse pages `/judgments-year` and `/determinations-year` expose a
year `<select>` (2001–present) that drives the Drupal AJAX form. The
`collectors/judgmentsArchive.ts` collector drives this in a headless browser:
pick each year, let the AJAX render, scrape the `/acc/alfresco/...pdf` results,
page through, checkpoint per year. Run:

```bash
npm install && npx playwright install chromium
npx tsx crawler/index.ts judgments-archive            # full judgments archive
npx tsx crawler/index.ts determinations-archive       # full determinations
npx tsx crawler/index.ts download judgments-archive   # then fetch the PDFs
```

Flags: `--from`/`--to` (year range), `--headed` (watch the browser), `--debug`
(dump a screenshot + HTML per year to `data/debug/` to recalibrate selectors).

Selectors are server-rendered Drupal hooks (`#search-year`, `.alfresco-table`,
`/acc/alfresco/...pdf`); if the markup shifts, `--debug` shows you what changed.
Alternatives if you'd rather not run a browser: reverse-engineer the AJAX call
the form fires (Network tab), or use an external aggregator (BAILII / vLex) for
historical Irish judgments where licence terms permit.

## Politeness / legal

`robots.txt` on www.courts.ie and www2.courts.ie declares `Crawl-delay: 10`.
At that rate a full High Court crawl *with* details (~508k × 2 requests) is
months of wall-clock — run `--no-details` first, segment by year, and consider
asking the Courts Service about bulk access rather than scraping at scale.
Party names, solicitors, and probate grantees/addresses are personal data:
public record, but store and process accordingly.
