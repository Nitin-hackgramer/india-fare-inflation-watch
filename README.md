# India Fare Inflation Watch

Build a polished, responsive government-grade analytics web application for **“Airfare Index India”**, a prototype for SIH26056: Development of a Real-time Airfare Price Index for India to augment CPI.

## 1. Product objective

Create an analytics platform for MoSPI-style researchers, policy analysts, and administrators to monitor Indian airfare inflation, compare airline fares across routes, and explore historical price trends.

This is NOT a flight booking website. Prioritize data visualization, analytical clarity, credibility, and usability.

Build the frontend first using realistic mock data, with a modular architecture that allows future integration with Supabase and a FastAPI backend deployed on Render.

## 2. Tech stack

- React + TypeScript + Vite.
- Tailwind CSS and reusable shadcn/ui components.
- Recharts for interactive charts.
- Lucide icons.
- React Router for navigation.
- Supabase-ready data layer, but do not require credentials to run the initial demo.
- Use clean, modular, strongly typed code.

## 3. Design system

Use this color palette consistently:
- Milk: `#FDFDF1` — page background.
- Orange: `#EC5E27`— primary navigation, headings, active states

Visual direction: premium institutional analytics software, modern data intelligence platform, restrained and professional.

Use a Milk background, Forest sidebar, white or Milk-toned cards, subtle borders, generous spacing, readable typography, and minimal shadows. Reserve Orange for meaningful highlights rather than decorating everything.

Avoid excessive gradients, glassmorphism, oversized rounded cards, unnecessary animations, emoji-based icons, and generic AI landing-page styling.

## 4. Application layout

Create a collapsible left sidebar with:

- Overview
- Airfare Index
- Route Explorer
- Data Sources
- Methodology
- Settings

Add a persistent top bar containing the page title, reporting period selector, last-updated timestamp, and a small demo-data status indicator.

On mobile, collapse the sidebar into a navigation drawer. All tables, charts, and filters must remain usable on smaller screens.

## 5. Page 1: Overview dashboard

Create a data-rich dashboard with these KPI cards:

- Current Airfare Price Index
- Daily Index Change (%)
- Weekly Index Change (%)
- Monthly Index Change (%)
- Routes Tracked
- Fare Observations

Below the KPIs, create:

1. **Airfare Index Trend:** Interactive line chart with daily, weekly, and monthly viewing options.
2. **Route-wise Fare Comparison:** Horizontal bar chart showing average observed fares for selected routes.
3. **Airline Comparison:** Compare IndiGo, Air India, Air India Express, Akasa Air, and SpiceJet.
4. **Advance Purchase Analysis:** Compare T+1, T+7, T+15, T+30, and T+45 fares.
5. **Recent Observations:** Table showing route, airline, travel date, advance-purchase window, observed fare, and collection timestamp.
6. **Data Collection Health:** Show successful observations, failed observations, source coverage, and last collection time.

Use believable Indian rupee values and coherent sample datasets. All dashboard metrics must derive from a shared mock-data source rather than independently hardcoded numbers.

Label all simulated data clearly as DEMO DATA. Never imply that scraping is live when it is not.

## 6. Page 2: Airfare Index

Create a dedicated index analytics page with:

- Daily, weekly, and monthly views.
- Date-range selection.
- Index trend chart.
- Period-over-period percentage changes.
- Route contribution comparison.
- Airline segment comparison.
- A historical index-value table.
- CSV export for the currently displayed dataset.

Display the base period and index methodology transparently.

Use a documented baseline-normalized index approach. Keep the calculation in a separate, reusable TypeScript module so it can later be replaced or reproduced by the FastAPI backend.

Do not label arbitrary sample numbers as official CPI or MoSPI figures.

## 7. Page 3: Route Explorer

This is the second core feature.

Provide filters for:

- Origin and destination cities.
- Airline.
- Travel date.
- Advance-purchase window: T+1, T+7, T+15, T+30, T+45.
- Date range for historical analysis.

Include a route selector with representative city pairs:

DEL–BOM, DEL–BLR, BOM–BLR, DEL–CCU, BLR–HYD, MAA–DEL.

Display:

- Lowest observed fare.
- Average observed fare.
- Highest observed fare.
- Airline-wise fare comparison chart.
- Historical fare trend.
- Fare observations table with timestamps.
- Clear empty states when filters return no results.

Add sorting, pagination, filter reset, and CSV export. Keep filtering logic separate from the visual components.

## 8. Page 4: Data Sources

Build a source monitoring interface for airline and OTA sources.

Include source name, source type, last attempted collection, last successful collection, status, observations collected, and error summary.

Include representative airline sources and clearly mark OTA sources as configurable placeholders until actual sources are implemented.

Use mock collection records and statuses. Do not implement scraping in the frontend, bypass CAPTCHAs, or imply that a source has been successfully accessed without actual evidence.

Design this page to accommodate future ingestion workers and a FastAPI source-health endpoint.

## 9. Page 5: Methodology

Create a professional methodology page explaining:

- Route-basket selection based on passenger-traffic data.
- Fare normalization and duplicate handling.
- Treatment of missing observations and outliers.
- Baseline period and index calculation.
- Daily, weekly, and monthly aggregation.
- Advance-purchase windows.
- Data limitations and source coverage.

Use an illustrative formula:

Route fare relative index = (Current comparable fare / Base-period comparable fare) × 100.

Explain that the overall index must use a documented aggregation and weighting method. Do not claim that this illustrative route formula alone constitutes an official CPI methodology.

Provide a clear distinction between the prototype methodology and any future officially validated methodology.

## 10. Page 6: Settings

Build a simple settings interface with:

- Reporting currency (INR).
- Default reporting period.
- Preferred index view.
- Theme-independent chart preferences.
- Data refresh interval as a configurable display preference.
- Backend connection status placeholder.

Persist appropriate user preferences locally. Do not create unnecessary settings or a complex administration system.

## 11. Architecture and future backend integration

This requirement is critical: make the frontend easy to modify and connect to a real backend later.

Use a structure similar to:

src/
  components/
    layout/
    dashboard/
    charts/
    tables/
    filters/
    ui/
  pages/
    Overview.tsx
    AirfareIndex.tsx
    RouteExplorer.tsx
    DataSources.tsx
    Methodology.tsx
    Settings.tsx
  services/
    api/
      client.ts
      airfareService.ts
      indexService.ts
      sourceService.ts
    data/
      mockData.ts
  hooks/
  types/
  utils/
    indexCalculation.ts
    fareNormalization.ts
  config/
    appConfig.ts

You may adjust the structure when useful, but maintain clear separation of concerns.

Requirements:

- Define TypeScript interfaces for FareObservation, Route, Airline, IndexObservation, DataSourceStatus, and DashboardMetrics.
- Centralize API calls in service modules.
- Use a configurable API base URL, with the future production endpoint supplied through a Vite environment variable.
- Provide a mock-data implementation and a service interface that can be switched to real API responses without rewriting page components.
- Separate calculation logic, filtering, formatting, and presentation.
- Add loading, error, empty, and success states.
- Avoid giant page components, duplicated data, hardcoded chart series, and tightly coupled mock data.
- Add an `.env.example` containing placeholder configuration only. Never commit credentials.
- Include concise setup and backend integration instructions in the README.

## 12. Supabase and FastAPI readiness

Do not spend time implementing complex authentication or the actual scraper.

Prepare the application for a future Supabase integration for persistent fare observations, historical index values, and user preferences.

Keep the future FastAPI endpoints configurable and centralized. Design the service layer around endpoints such as:

GET /api/v1/dashboard/summary
GET /api/v1/index?period=daily
GET /api/v1/index/history
GET /api/v1/fares?origin=DEL&destination=BOM
GET /api/v1/sources/status

These are proposed interface contracts, not endpoints that already exist. Implement mock service responses for the initial frontend.

The eventual backend can run on Render and use Supabase for persistent storage. Do not require a backend to preview the application.

## 13. Interaction and quality requirements

- All navigation links must work.
- Charts must support tooltips and appropriate responsive behavior.
- Filters must actually change the displayed data.
- Date and period selectors must work.
- Tables must support sorting and pagination where specified.
- CSV exports must contain the currently filtered data.
- Provide consistent INR formatting and date formatting.
- Use accessible labels, keyboard-friendly controls, and sufficient contrast.
- Avoid decorative buttons that do nothing.
- Use realistic demo data, not Lorem Ipsum.
- Keep animations subtle and fast.
- Ensure the initial dashboard looks populated and polished immediately after launch.

## 14. Implementation instructions

First build the complete frontend with working navigation, shared demo data, functional charts and filters, and responsive layouts.

Prioritize these two end-to-end demonstration features:

1. Airfare Price Index dashboard with daily, weekly, and monthly trends.
2. Airline fare comparison for a selected city pair and advance-purchase window.

Build the remaining pages as coherent supporting interfaces, without overengineering their backend.

Make sensible design decisions independently. Do not stop to ask for minor preferences. Keep the codebase understandable and extensible because additional features and backend integrations will be implemented later.

**Final acceptance criteria:** The application must run without backend credentials, have a cohesive institutional design, use consistent demo data across all pages, implement the two core features interactively, and be structured for future Supabase + FastAPI integration.

## Setup and backend integration

```sh
npm install
npm run dev        # http://localhost:8080 — runs on DEMO DATA, no backend or credentials needed
npm test           # index / filter / CSV unit tests
npm run build
```

**Where things live**

| Concern | File |
| --- | --- |
| Index math (Jevons within route, traffic-weighted across routes, daily/weekly/monthly) | `src/utils/indexCalculation.ts` |
| Cleaning (failed, duplicates, MAD outliers) | `src/utils/fareNormalization.ts` |
| Route filters, low/avg/high, airline × window matrix | `src/utils/fareFilters.ts` |
| Shock Radar detection (rolling median / MAD) | `src/utils/shockDetection.ts` |
| Explain-this-change attribution, what-if simulator | `explainIndexChange`, `simulateIndex` in `src/utils/indexCalculation.ts` |
| Seeded demo dataset (incl. `DEMO_SHOCK_EVENTS`) | `src/services/data/mockData.ts` |
| API endpoints + mock/live switch | `src/config/appConfig.ts`, `src/services/api/*` |
| Pages | `src/routes/*.tsx` (TanStack file routes) |

**Switching to the FastAPI backend.** Copy `.env.example` to `.env.local`, set `VITE_API_BASE_URL` to the Render URL and `VITE_USE_MOCK_DATA=false`. Each service method already calls the matching endpoint (`/api/v1/dashboard/summary`, `/api/v1/index`, `/api/v1/index/history`, `/api/v1/index/contributions`, `/api/v1/index/airlines`, `/api/v1/fares`, `/api/v1/fares/comparisons`, `/api/v1/fares/recent`, `/api/v1/sources/status`, `/api/v1/health`, plus Shock Radar: `/api/v1/shocks`, `/api/v1/index/explain`, `/api/v1/index/route-relatives`) and expects JSON matching `src/types/index.ts`. Pages need no changes.

**Supabase.** Run `supabase/schema.sql` in the Supabase SQL editor. The FastAPI service writes with the `service_role` key (Render env var, server-side only); the frontend never needs it.

Requires Node.js 20+. Logo plane glyph from [Lucide](https://lucide.dev) (ISC licence).
