# Security & Audit

## npm audit

- **xlsx (high)** – Replaced with **exceljs** for reading `.xlsx` / `.csv` in the import pipeline. The previous SheetJS (xlsx) package had unfixed prototype pollution and ReDoS advisories.
- **next (moderate)** – Unbounded `next/image` disk cache (GHSA-3x4c-7xq6-9pq8). This app does not use `next/image`, so impact is low. Options:
  - **Upgrade (breaking):** `npm audit fix --force` will upgrade to Next.js 16.2.0; test the app after upgrading.
  - **Stay on current:** Remaining moderate finding is acceptable if you are not using the Image component.

## Commands

```bash
npm audit
npm audit fix          # Apply non-breaking fixes only
npm audit fix --force  # Apply all fixes (may introduce breaking changes)
```
