# courts.ie crawler

Four collectors for the public Courts Service of Ireland data surfaces, with a
shared rate-limiter, cookie jar, retrying HTTP client, and resumable cursors.
Dependency-free (Node 18+ global `fetch`); runs under the project's `tsx`.

> **Scaffold only — not run.** Review, set a sane `--delay`, and confirm you're
> entitled to bulk-collect before pointing it at the live site.

## Layout

```
crawler/
  config.ts                 hosts, crawl-delay, endpoints, output dir
  types.ts                  JSONL record shapes
  index.ts                  CLI dispatcher
  lib/
    rateLimiter.ts          per-host serialization + min delay
    http.ts                 fetch wrapper: UA, retry/backoff, cookie jar
    cursor.ts               resumable JSON checkpoints
    jsonl.ts                append-only JSONL writer
  collectors/
    pdfListing.ts           judgments + determinations (PDF-link harvest)
    download.ts             pull the actual PDFs for a crawled corpus (b)
    highCourt.ts            High Court two-step (list -> detail) + segmenter (a)
    probate.ts              probate single-step (GET form -> cards)
  lib/fetchFile.ts          streaming, resumable file downloader
  data/                     output (gitignored): *.jsonl, pdfs/, .cursors/
```

> **Read `COVERAGE.md` first.** High Court records and probate are fully
> coverable; the judgment/determination *archives* are **not** (browse listings
> are capped — the full corpus sits behind an Alfresco AJAX search this CLI
> doesn't yet drive).

## What each collector covers

| Command | Source | Output | Coverage |
|---|---|---|---|
| `judgments` | `www2.courts.ie/Judgments` | `judgments.jsonl` | ⚠️ **Recent window only** (~196). Full archive needs the Alfresco search — see COVERAGE.md. |
| `determinations` | `www2.courts.ie/determinations` | `determinations.jsonl` | ⚠️ Recent window only (~24). |
| `download <corpus>` | the JSONL above | `pdfs/<court>/<citation>.pdf`, `<corpus>-downloads.jsonl` | Downloads PDFs for whatever the listing captured. Resumable. |
| `high-court` | `courts.ie/high-court-search` | `high-court-list.jsonl`, `high-court-detail.jsonl` | ✅ Full (year sweep; paging uncapped, verified to 25k). 1-based paging; `page=0` = count only. |
| `probate` | `www.courts.ie/app/probate-register` | `probate.jsonl` | ✅ Full by year of death (empty-lastname + year = all grants for that year). |

## The two-step (High Court only)

`GetCases` (step 1) is a cheap **search/count** that returns the case ref
(`arch_name`) + name + parties per row — you page through it to enumerate.
`GetCaseRefDetails/<ref>` (step 2) explodes one ref into the **deep record**
(parties+solicitors, orders, listings, judgments, applications, related cases).
You only pay the detail cost on refs step 1 confirmed. Use `--no-details` to
collect step 1 only (fast: names + parties, no enrichment).

Both share the `ASP.NET_SessionId` cookie seeded by loading the search page
once. Quirks encoded in `collectors/highCourt.ts`:
- send **all** `GetCases` form keys (server rejects partial bodies),
- `page` is **1-based**,
- detail lives at the site **root** `/HCS/GetCaseRefDetails/` (the
  `/high-court-search/HCS/...` path 302-redirects away).

## Usage

```bash
npx tsx crawler/index.ts judgments                        # recent window
npx tsx crawler/index.ts download judgments               # then pull the PDFs (b)
npx tsx crawler/index.ts determinations
npx tsx crawler/index.ts high-court --from 2015 --to 2024 # two-step, segmented (a)
npx tsx crawler/index.ts high-court --no-details          # list only (fast)
npx tsx crawler/index.ts probate --years 2020,2021        # full year sweep
npx tsx crawler/index.ts probate --lastnames murphy,kelly --years 2020
npx tsx crawler/index.ts all

# global flags
--delay <ms>   per-host crawl delay (default 10000 — robots Crawl-delay:10)
--out <dir>    output dir (default crawler/data)
```

Re-running a command **resumes** from `data/.cursors/<collector>.json`. Delete
the cursor file to restart a collector from scratch.

## Politeness & caveats

- **robots.txt** on `www.courts.ie` and `www2.courts.ie` declares
  `Crawl-delay: 10`. The default honours it. At 10s/request the High Court
  detail crawl over ~508k cases is *months* of wall-clock — segment by year,
  run `--no-details` first, or seek bulk access from the Courts Service rather
  than hammering the site.
- **Personal data**: party names, solicitors, and probate grantees/addresses
  are exposed. Public record, but handle (and store) accordingly.
- **HTML parsing** in `pdfListing.ts`/`probate.ts` is regex-based and brittle;
  swap in a real parser if the markup changes.
- **Coverage limits**: only the High Court has searchable *case records*. Other
  courts surface only as *judgments* (where published) — there is no
  Circuit/District/CoA/Supreme case-record search to crawl.
