import type { ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/dashboard/Panel";
import { ADVANCE_WINDOWS, BASE_PERIOD, ROUTES, routeLabel } from "@/services/data/mockData";
import { METHOD_VERSION } from "@/utils/indexCalculation";
import { formatDate, formatNumber, formatWindow } from "@/utils/format";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — Airfare Index India" },
      { name: "description", content: "How the prototype airfare index is built: route basket, cleaning, base period, aggregation and limits." },
    ],
  }),
  component: Methodology,
});

function Formula({ children }: { children: ReactNode }) {
  return <pre className="num overflow-x-auto rounded-md border bg-background px-4 py-3 text-xs leading-relaxed text-foreground">{children}</pre>;
}

function Methodology() {
  return (
    <div className="page-enter mx-auto max-w-4xl space-y-5 text-sm leading-relaxed">
      <div role="note" className="rounded-md border border-primary/30 bg-accent/40 p-4">
        <p className="font-semibold text-heading">Prototype methodology · version {METHOD_VERSION}</p>
        <p className="mt-1 text-muted-foreground">
          This page documents how the SIH26056 prototype computes its index on DEMO DATA. It is an illustrative design, not an official CPI or MoSPI methodology. A production
          index would need validation by MoSPI, real passenger-traffic weights from DGCA, and a formally reviewed treatment of quality change and seasonality.
        </p>
      </div>

      <Panel title="1. Route basket and weights" description="Which city pairs are priced, and how much each counts.">
        <p>
          The basket covers six high-traffic domestic city pairs. Each route carries a fixed weight approximating its share of passenger traffic; weights are held constant
          from the base period (a Laspeyres-type approach). In production these weights would come from DGCA origin–destination traffic statistics and be revised on a
          documented schedule.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Route basket</caption>
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Route</th>
                <th scope="col" className="py-2 pr-3 font-medium">Cities</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Distance</th>
                <th scope="col" className="py-2 text-right font-medium">Weight</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{routeLabel(r.id)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">
                    {r.origin.name} → {r.destination.name}
                  </td>
                  <td className="num py-2 pr-3 text-right">{formatNumber(r.distanceKm)} km</td>
                  <td className="num py-2 text-right">{(r.trafficWeight * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="2. Fare normalisation and duplicates" description="Making quotes comparable before they enter the index.">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Only economy-class, lowest-available, one-way fares in INR are recorded, so each quote describes the same product.</li>
          <li>A comparable quote is identified by route × airline × advance window × collection date.</li>
          <li>If the same quote is captured more than once (for example a retry), only the earliest capture is kept.</li>
          <li>Failed collection attempts (timeouts, HTTP errors, parse errors, no fares listed) carry no price and are logged for source monitoring only.</li>
        </ul>
      </Panel>

      <Panel title="3. Missing observations and outliers">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Outliers:</strong> within each route × window group, a fare is dropped if it lies more than 5 robust deviations (median absolute deviation × 1.4826)
            from the group median. This removes data-entry spikes without trimming genuine peaks.
          </li>
          <li>
            <strong>Missing cells:</strong> a route × airline × window cell with no fare on a day is simply excluded from that day's route relative; it is not imputed.
          </li>
          <li>
            <strong>Missing routes:</strong> if a whole route has no usable fare on a day, the remaining route weights are re-scaled to sum to one for that day.
          </li>
          <li>Cells with no base-period price cannot be compared and are excluded until the base is re-set.</li>
        </ul>
      </Panel>

      <Panel title="4. Base period and index calculation">
        <p>
          The base period is {formatDate(BASE_PERIOD.from)} – {formatDate(BASE_PERIOD.to)}, set equal to 100. The illustrative route-level formula is:
        </p>
        <Formula>Route fare relative index = (Current comparable fare ÷ Base-period comparable fare) × 100</Formula>
        <p className="mt-3">The prototype implements that in three documented steps:</p>
        <Formula>
          {`1. Cell base price      B(c)   = mean fare of cell c over the base period
   (cell = route × airline × advance window)
2. Route relative          R(r,t) = 100 × geometric mean over cells c in r of [ mean fare(c,t) ÷ B(c) ]
3. Overall index           I(t)   = Σ w(r) · R(r,t)  ÷  Σ w(r)    (routes with data on day t)`}
        </Formula>
        <p className="mt-3 text-muted-foreground">
          The geometric mean (Jevons) inside each route stops one airline's price swings from dominating; the traffic-weighted arithmetic mean across routes reflects how
          many travellers each route represents. The route formula alone is not a full CPI methodology — the weighting and aggregation above are what make it an index.
          The code lives in <code className="num text-xs">src/utils/indexCalculation.ts</code> as pure functions so the FastAPI backend can reproduce it exactly.
        </p>
      </Panel>

      <Panel title="5. Daily, weekly and monthly aggregation">
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong>Daily:</strong> I(t) for each collection date.</li>
          <li><strong>Weekly:</strong> simple average of daily values within each ISO week (Monday start).</li>
          <li><strong>Monthly:</strong> simple average of daily values within each calendar month.</li>
          <li>Period-over-period change = (current period ÷ previous period − 1) × 100. Partial first and last periods are shown but contain fewer days.</li>
        </ul>
      </Panel>

      <Panel title="6. Advance-purchase windows">
        <p>
          Fares are collected for departures {ADVANCE_WINDOWS.map(formatWindow).join(", ")} days after the collection date. Each window is its own index cell, so the index
          compares like with like: a T+1 fare is only ever compared with a base-period T+1 fare. Short-notice fares are typically far higher than fares bought weeks ahead,
          which the Route Explorer shows directly.
        </p>
      </Panel>

      <Panel title="7. Data limitations and source coverage">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>All figures in this prototype are simulated DEMO DATA. No airline or OTA website is accessed.</li>
          <li>Five airline sources are modelled; OTA sources are placeholders. Low-cost carriers dominate the basket, as in the real market.</li>
          <li>Six routes do not represent all domestic travel; regional and tier-2 routes are not covered.</li>
          <li>Lowest-available fares ignore ancillaries (bags, seats), fare-family differences and tax changes.</li>
          <li>Weights are illustrative, not DGCA-derived.</li>
        </ul>
      </Panel>

      <Panel title="Prototype vs. future official methodology">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-heading">This prototype</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Simulated fares, fixed seed</li>
              <li>6 routes, illustrative weights</li>
              <li>14-day base period</li>
              <li>No seasonal adjustment</li>
            </ul>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-heading">Validated methodology (future)</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Approved live sources with audit logs</li>
              <li>DGCA traffic weights, periodic re-basing</li>
              <li>Base period aligned with CPI base year</li>
              <li>Reviewed by MoSPI before any CPI use</li>
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
