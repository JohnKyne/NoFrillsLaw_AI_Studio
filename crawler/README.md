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
    pdfListing.ts           judgments + determinations recent listing (links)
    judgmentsArchive.ts     FULL archive via the by-year Solr GET (plain HTTP)
    download.ts             pull the actual PDFs for a crawled corpus (b)
    highCourt.ts            High Court two-step (list -> detail) + segmenter (a)
    probate.ts              probate single-step (GET form -> cards)
  lib/fetchFile.ts          streaming, resumable file downloader
  lib/citation.ts           neutral-citation -> court helpers
  data/                     output (gitignored): *.jsonl, pdfs/, debug/, .cursors/
```

> **Read `COVERAGE.md` first.** Everything coverable here — High Court records,
> probate, and the full judgment/determination *archives* — is reachable over
> plain HTTP. (The browse listings are capped, but the by-year search redirects
> to an unauthenticated Solr GET endpoint the `*-archive` collectors use; no
> browser needed.) The only true gap is *structured case records* for
> non-High-Court tiers, which aren't published online at all.

## What each collector covers

| Command | Source | Output | Coverage |
|---|---|---|---|
| `judgments` | `www2.courts.ie/Judgments` | `judgments.jsonl` | ⚠️ **Recent window only** (~196). Use `judgments-archive` for the full set. |
| `determinations` | `www2.courts.ie/determinations` | `determinations.jsonl` | ⚠️ Recent window only (~24). |
| `judgments-archive` | `ww2.courts.ie/search/judgments-year` (Solr GET) | `judgments-archive.jsonl` | ✅ **Full archive**, all courts, by year 2001–present. Plain HTTP. |
| `determinations-archive` | `ww2.courts.ie/search/determinations-year` (Solr GET) | `determinations-archive.jsonl` | ✅ Full determinations archive. |
| `download <corpus>` | the JSONL above | `pdfs/<court>/<citation>.pdf`, `<corpus>-downloads.jsonl` | Downloads PDFs for a captured corpus. Resumable. |
| `high-court` | `courts.ie/high-court-search` | `high-court-list.jsonl`, `high-court-detail.jsonl` | ✅ Full (year sweep; paging uncapped, verified to 25k). 1-based paging; `page=0` = count only. |
| `probate` | `www.courts.ie/app/probate-register` | `probate.jsonl` | ✅ Full by year of death (empty-lastname + year = all grants for that year). |
| `legal-diary` | `legaldiary.courts.ie/download` | `legal-diary/<date>__*.pdf\|docx`, `legal-diary.jsonl` | ⏩ Today's diary — **appellate + High Court lists only** (SC, CoA, Central Criminal, High Court lists). **Not** Circuit (separate JS section) or District (not published centrally). Forward-only — run on a schedule. |
| `gap-audit` | `ww2.courts.ie/search/judgments-year` (citations only) | `gap-audit/REPORT.md`, `gap-audit.jsonl` | 🔎 Flags judgments **apparently missing** from courts.ie — for raising with the Courts Service. No PDF downloads. |
| `irish-reports` | `archive.org` (open API) | `irish-reports/manifest.jsonl`, `…/case-index.jsonl`, `…/text/`, `…/pdf/` | 📚 **Public-domain** Irish Reports **1894–1925** (64 vols, complete). `--mode metadata` (light) lists all vols; `text\|pdf\|all` download + parse the case index. |
| `bailii` | `bailii.org` (browser once, then HTTP) | `bailii-index.jsonl` | 🔁 Irish judgment index, **deduped vs courts.ie** → backfills the pre-2001/2005 hole. Needs a browser UA opt-in (see below). `--from`/`--to`. |

### Archive collector (plain HTTP)

The browse listings are capped to recent uploads. The by-year search redirects
to an unauthenticated Solr GET endpoint
(`ww2.courts.ie/search/{judgments|determinations}-year/<query>?page=N`) that
`judgmentsArchive.ts` pages directly — no browser, token, or cookie. Verified:
2015 ≈ 1,234 judgments across 14 pages; all courts incl. District/IEDC.

```bash
npx tsx crawler/index.ts judgments-archive --from 2001 --to 2026
npx tsx crawler/index.ts determinations-archive
npx tsx crawler/index.ts download judgments-archive  # then fetch the PDFs
```
Flags: `--from`/`--to` (year range). Playwright is a dev dependency used only to
*discover* this endpoint; it is not needed to run any collector.

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
npx tsx crawler/index.ts legal-diary                      # today's diary (appellate + High Court lists)
npx tsx crawler/index.ts gap-audit --from 2024 --to 2024  # flag judgments missing from courts.ie
npx tsx crawler/index.ts irish-reports                    # list PD Irish Reports 1894-1925 (metadata only)
npx tsx crawler/index.ts irish-reports --mode all         # + download full text/PDF and parse case index (heavy)
npx tsx crawler/index.ts bailii --from 1996 --to 2005    # backfill index, deduped vs courts.ie
npx tsx crawler/index.ts all --metadata-only --parallel  # light index pass, concurrent across hosts

# global flags
--delay <ms>        per-host crawl delay (default 10000 — robots Crawl-delay:10)
--concurrency <n>   max in-flight requests PER HOST (default 1; >1 = faster, less polite)
--out <dir>         output dir (default crawler/data)
```

**Speeding up a run.** courts.ie hard-caps page size (search 20, HCS 25 — no
`rows`/`pageSize` override), so the levers are: (1) `all --parallel` — runs
collectors concurrently; the per-host limiter still applies, so this only speeds
work spanning *different* hosts (search `ww2` ∥ PDFs `www2` ∥ `archive.org` ∥
`bailii.org` ∥ HCS `courts.ie`) — a free win; (2) lower `--delay`; (3)
`--concurrency n` for bounded per-host parallelism (≈ n/delay throughput — less
polite, risks blocks); (4) don't crawl the 508k HC *details* in full — list-only
+ selective details. `gap-audit` is derivable from `judgments-archive` offline.

Re-running a command **resumes** from `data/.cursors/<collector>.json`. Delete
the cursor file to restart a collector from scratch.

## Scheduling the Legal Diary

The diary site only retains the **current** edition, so the archive has to be
accumulated by capturing it daily. A scheduled GitHub Actions workflow does this:

- `.github/workflows/legal-diary.yml` — runs `legal-diary` daily at 06:30 UTC,
  writing to `crawler/diary-archive/` and committing any new files. Scheduled
  workflows run only from the **default branch**, so it starts once merged
  there; until then trigger it from the Actions tab ("Run workflow").

Prefer your own box instead of CI? A portable cron line:

```cron
30 6 * * *  cd /path/to/repo && /usr/bin/npx tsx crawler/index.ts legal-diary --out crawler/diary-archive
```

Both are idempotent — same-day re-runs skip already-captured files.

## Auditing courts.ie for missing judgments (`gap-audit`)

courts.ie is **not complete**, and this flags what's missing so it can be raised
with the Courts Service. It downloads no PDFs — just neutral citations — and
writes `gap-audit/REPORT.md` (a sendable list) from two signals:

1. **Sequence gaps** — neutral citations run sequentially per court per year
   ([2024] IEHC 1, 2, 3…), so a *missing number* is a judgment that was assigned
   a citation but isn't online. Works for **any year, including recent** (no
   second source needed). E.g. 2024 surfaced ~89 such gaps across all courts.
2. **Wholesale-missing court-years** (range runs) — a court present in some
   years but absent/near-absent in others, e.g. **High Court 2003–2004** (the
   archive holds almost none; BAILII confirms ~400/yr existed). Sequence
   analysis is blind to these — with zero citations there's no sequence — so
   they're caught by comparing across years.

Each flagged citation is a **candidate to verify**, not proof: a number may have
been assigned and the judgment not delivered, or lawfully withheld/anonymised
(e.g. childcare). For pre-~2005 years, missing citations can usually be
**confirmed to exist on BAILII** (comprehensive there). Run it for a targeted
year range, not as a blanket sweep — it paginates each year.

## BAILII & the Anubis anti-bot (operator opt-in)

`bailii` backfills the years courts.ie lacks (BAILII reaches back to ~1933 HC /
1965 SC and is comprehensive 1996–2004). BAILII serves plain static HTML — no
data API — but fronts it with **Anubis**, a proof-of-work anti-bot. The collector
solves the PoW **once** in a real browser (`npx playwright install chromium`),
takes the clearance cookie, then reads every per-year index page over normal
rate-limited HTTP.

By default it solves under our **honest identifying UA**, and Anubis **won't
clear that** — so the command exits with guidance rather than bypassing anything.
Anubis only clears *browser-like* User-Agents, so using BAILII via automation
means presenting the crawler as a browser. That's an **operator decision**, opted
into explicitly via `CRAWLER_UA`:

```bash
CRAWLER_UA="Mozilla/5.0 … Chrome/120 Safari/537.36" \
  npx tsx crawler/index.ts bailii --from 1996 --to 2005
```

Rationale for treating this differently from paywalled sources: BAILII is **free,
public-interest legal information** with no subscription, no contract barring
access, and no commercial licensor; Anubis is load/abuse management, and we solve
it legitimately and stay polite (index pages only, 3s/host, low volume). Use
judgement and keep it light.

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
