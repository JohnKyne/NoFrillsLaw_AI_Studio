# Index snapshot — 2026-06-02

Metadata-only crawl of the free courts.ie / Internet Archive sources (no PDFs).
Generated with `--delay 4000`; resumable collectors. PDFs, High Court case
details, and probate are NOT here (heavy tiers — run on persistent infra).

| File | Contents | Records |
|---|---|---|
| `judgments-archive.jsonl` | All courts.ie judgments 2001–2026 (citation, court, pdfUrl, id) | 20,929 |
| `determinations-archive.jsonl` | Supreme Court determinations | 1,779 |
| `irish-reports/manifest.jsonl` | Public-domain Irish Reports 1894–1925 (IA) | 64 vols |
| `gap-audit/REPORT.md` + `.jsonl` | Candidate missing judgments (citation-sequence gaps) | 3,460 gaps / 117 court-years |

By court (judgments): HC 13,660 · CA 3,944 · SC 2,511 · CCA 355 · DC 189 · CC 75 · CCC 13.
Gap headline: 3,460 assigned-but-unpublished citations — worst 2004 HC (7%), 2010 SC (21%), CCA 2006–08.
