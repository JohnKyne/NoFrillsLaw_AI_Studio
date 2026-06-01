# Coverage — what this crawler can and cannot fully capture

Empirically tested against the live courts.ie surfaces (June 2026). Read this
before assuming "full coverage".

## TL;DR

| Surface | Full coverage? | How |
|---|---|---|
| **High Court case records** | ✅ Yes | Year sweep; paging is uncapped below each query's total (verified to 25k). |
| **Probate grants** | ✅ Yes (by year of death) | Empty-lastname + year returns every grant for that year. |
| **Judgments (full-text archive)** | ❌ No | Browse listing is capped to ~recent; full archive is behind an Alfresco AJAX search not yet driven. |
| **Determinations (full-text archive)** | ❌ No | Same Alfresco cap (~24 recent on the listing). |
| Circuit / District / CoA / Supreme **case records** | ❌ N/A | No such public searchable dataset exists — only the High Court has one. |

So: **case-record and probate coverage is complete; judgment-archive coverage is not.**

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

**Judgments / determinations listings are capped.**
`/Judgments?sort=desc:DateUploaded` returns ~100 PDFs on page 0, ~96 on page 1,
then only the page-chrome help PDF from page 2 on (~196 real judgments total).
`/determinations` returns ~24 on page 0, then nothing. These are *recent
windows*, not the archive. The Irish judgment archive (tens of thousands of
documents back to ~2001, with all-court filters) is served by the Drupal
"alfresco" search form (`alfresco_Court[]`, `alfresco_fromdate/todate`,
`alfresco_NeutralCitation`, `alfresco_JudgmentBy`). A plain form POST 302-
redirects to the homepage — the search is JS/AJAX-driven against an Alfresco
backend that this CLI does not yet call.

## To reach the full judgment archive (not yet implemented)

One of:
1. **Reverse-engineer the Alfresco AJAX endpoint** the search form calls
   (inspect the `js_*.js` Drupal aggregate or a browser Network tab), then
   page it by date window / court / citation. Cleanest if it returns JSON.
2. **Drive the form with a headless browser** (Playwright): fill
   `alfresco_fromdate`/`alfresco_todate` in monthly windows × each
   `alfresco_Court[]`, scrape the rendered result PDFs, paginate. Robust but
   slow. This would slot in as a new `collectors/judgmentsArchive.ts` behind
   the same rate-limiter and cursor.
3. **Use an external aggregator** (e.g. BAILII / vLex / the IECLR datasets)
   for historical Irish judgments if licence terms permit.

Until one of those lands, treat `judgments`/`determinations` here as
"recent-uploads only", and `download` as fetching the PDFs for whatever those
collectors captured.

## Politeness / legal

`robots.txt` on www.courts.ie and www2.courts.ie declares `Crawl-delay: 10`.
At that rate a full High Court crawl *with* details (~508k × 2 requests) is
months of wall-clock — run `--no-details` first, segment by year, and consider
asking the Courts Service about bulk access rather than scraping at scale.
Party names, solicitors, and probate grantees/addresses are personal data:
public record, but store and process accordingly.
