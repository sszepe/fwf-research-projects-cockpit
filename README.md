# FWF Research Cockpit

A lightweight **Vite + React + TypeScript** single-page application for exploring Austrian Science Fund (FWF) research projects, outputs, and researchers at your institution. Uses the [FWF Open API](https://www.fwf.ac.at/en/discover/open-api) — CC0 data, no login required.

---

## Features

- **Projects** — browse, search, and filter all FWF projects affiliated with your institution; drill into individual project pages with metadata, summaries, keywords, and related outputs
- **Outputs** — explore publications and other research outputs linked to your institution's projects, with faceted filters by category, publication year, and journal/publisher
- **Persons** — directory of principal investigators and key researchers derived from project data, with profile pages showing connected projects and outputs
- **DOI / ID Search** — full-text lookup across all FWF fields: find records by grant DOI, researcher name, ORCID, keywords, or any identifier
- **About** — live API index statistics and configuration reference
- **Raw JSON viewer** — every record exposes its underlying API response for inspection

---

## Tech Stack

| Layer | Choice |
|---|---|
| Build tool | Vite |
| UI | React 18 + TypeScript |
| Routing | Hash-based (`#/path`) — no server config required |
| Styling | Plain CSS with CSS custom properties |
| API | FWF Open API (Meilisearch-backed, CC0) |
| Deployment | Any static host |

---

## Setup

```bash
npm install
cp .env.local.example .env.local   # then edit with your institution's values
npm run dev
```

---

## Configuration (`.env.local`)

| Variable | Description | Example |
|---|---|---|
| `VITE_FWF_API_BASE_URL` | FWF Open API base URL | `https://openapi.fwf.ac.at` |
| `VITE_FWF_API_KEY` | Public read key (no registration needed) | `3a03f2...` |
| `VITE_ORG_ROR` | Full ROR URL of your institution | `https://ror.org/xxx` |
| `VITE_ORG_NAME` | Display name shown in the header and footer | `xxx` |

The **ROR ID** is used to filter projects: the app searches the FWF API for your short ROR identifier and then cross-checks each hit against the project's PI institution, research institutes, and key researcher affiliations. Find your ROR at [ror.org](https://ror.org).

The **API key** is public and shared across all users — fetch the current value from `https://openapi.fwf.ac.at/fwfkey/`.

---

## Project Structure

```
src/
├── api/
│   └── fwf.ts              # All FWF API calls, caching, data transforms
├── components/
│   ├── Header.tsx
│   └── Footer.tsx
├── pages/
│   ├── ProjectsPage.tsx     # Project list with search + facets
│   ├── ProjectDetailPage.tsx
│   ├── OutputsPage.tsx      # Output list with category tabs + facets
│   ├── OutputDetailPage.tsx
│   ├── PersonPage.tsx       # Researcher directory
│   ├── PersonDetailPage.tsx
│   ├── DoiSearchPage.tsx    # Full-text / identifier search
│   └── AboutPage.tsx
├── styles/
│   └── theme.css
├── router.ts               # Hash router + slug/path helpers
├── App.tsx
└── main.tsx
```

---

## Data Loading & Caching

All API data is fetched once per session and held in module-level promise caches (`projectsCache`, `outputsCache`, `personsCache`). Navigating between pages does not re-fetch.

- **Projects** are loaded by searching the FWF API for your institution's ROR short ID, then filtering results to confirm the affiliation. Up to 3 000 records are paginated in batches of 1 000.
- **Outputs** are fetched per project using the project's connected output IDs, then deduplicated.
- **Persons** are derived client-side from the projects index — no separate persons endpoint is required.

To force a fresh load (e.g. after a data update), call `resetCaches()` from `fwf.ts` or reload the page.

---

## Build & Deploy

```bash
npm run build   # outputs to dist/
```

The `dist/` folder is a fully static site — deploy to nginx, Vercel, GitHub Pages, Netlify, or any static host. No server-side logic is required.

Because routing is hash-based (`/#/projects`, `/#/outputs/123`, etc.), no rewrite rules are needed.

---

## API Notes

- The FWF Open API is backed by **Meilisearch**. All attributes are full-text searchable, but the API does not support server-side filtering or faceting — all filtering happens client-side after fetching.
- Data is refreshed by FWF **once per day**.
- The public API key is the same for all consumers and requires no registration. Fetch it from `https://openapi.fwf.ac.at/fwfkey/`.
- All FWF data is licensed **CC0 (Public Domain)**.

---

## Adapting for Another Institution

1. Look up your institution's ROR ID at [ror.org](https://ror.org).
2. Update `VITE_ORG_ROR` and `VITE_ORG_NAME` in `.env.local`.
3. Run `npm run dev` — the app will immediately filter to your institution's projects.

No code changes are required for a different institution.
