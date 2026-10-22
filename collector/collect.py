"""Collect permitted fare observations and store them in Supabase.

Sources (authorised only — no website scraping):
  amadeus  Amadeus Flight Offers Search (Enterprise API; Self-Service closed 17 Jul 2026)
  csv      A permitted feed file from an airline / data partner (see FEED_COLUMNS)

    python collector/collect.py --source amadeus --dry-run --routes 1   # probe: what does Amadeus return?
    python collector/collect.py --source amadeus                        # collect + write to Supabase
    python collector/collect.py --source csv --csv feed.csv --source-id src-indigo

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (writes; server-side only)
     AMADEUS_BASE_URL, AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET (amadeus source)
One row per route × airline × advance window × run, matching supabase/schema.sql `fare_observations`.
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ADVANCE_WINDOWS = (1, 7, 15, 30, 45)
TRACKED_AIRLINES = ("6E", "AI", "IX", "QP", "SG")  # must exist in the `airlines` table
IST = timezone(timedelta(hours=5, minutes=30))
ROUTES_FILE = Path(__file__).with_name("routes.json")
FEED_COLUMNS = ("route_id", "airline_code", "travel_date", "advance_days", "fare", "collected_at")


def http(method, url, headers=None, body=None, timeout=40):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        return e.code, None


# ---------- Amadeus ----------

def amadeus_token(base, client_id, secret):
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret}).encode()
    status, data = http("POST", f"{base}/v1/security/oauth2/token", {"Content-Type": "application/x-www-form-urlencoded"}, body)
    if status != 200 or not data:
        raise SystemExit(f"Amadeus auth failed (HTTP {status}). Check AMADEUS_BASE_URL and credentials.")
    return data["access_token"]


def lowest_by_airline(offers):
    """Lowest grand total per marketing carrier of the first segment (non-stop search, so one segment)."""
    best = {}
    for o in offers or []:
        try:
            code = o["itineraries"][0]["segments"][0]["carrierCode"]
            fare = float(o["price"]["grandTotal"])
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        if fare > 0 and (code not in best or fare < best[code]):
            best[code] = fare
    return best


def collect_amadeus(routes, env, now, pause=0.6):
    base = env["AMADEUS_BASE_URL"].rstrip("/")
    token = amadeus_token(base, env["AMADEUS_CLIENT_ID"], env["AMADEUS_CLIENT_SECRET"])
    rows, seen = [], {}
    for route in routes:
        for w in ADVANCE_WINDOWS:
            travel = (now.date() + timedelta(days=w)).isoformat()
            q = urllib.parse.urlencode({
                "originLocationCode": route["origin"], "destinationLocationCode": route["destination"],
                "departureDate": travel, "adults": 1, "nonStop": "true", "travelClass": "ECONOMY",
                "currencyCode": "INR", "max": 250,
            })
            status, data = http("GET", f"{base}/v2/shopping/flight-offers?{q}", {"Authorization": f"Bearer {token}"})
            stamp = datetime.now(timezone.utc).isoformat()
            fares = lowest_by_airline((data or {}).get("data")) if status == 200 else {}
            for code in TRACKED_AIRLINES:
                if status != 200:
                    rows.append(row(route["id"], code, "src-amadeus", now, travel, w, None, stamp, f"HTTP_{status}"))
                elif code in fares:
                    rows.append(row(route["id"], code, "src-amadeus", now, travel, w, fares[code], stamp))
                    seen[code] = seen.get(code, 0) + 1
            time.sleep(pause)  # stay well under rate limits
    missing = [c for c in TRACKED_AIRLINES if c not in seen]
    print(f"Amadeus coverage: {seen or 'none'}; not returned: {missing or 'none'}", file=sys.stderr)
    if missing:
        print("  -> airlines not returned need permission or an authorised feed (use --source csv).", file=sys.stderr)
    return rows


# ---------- Permitted CSV feed ----------

def load_feed(path, route_ids, source_id):
    rows, bad = [], 0
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or set(FEED_COLUMNS) - set(reader.fieldnames):
            raise SystemExit(f"Feed must have columns: {', '.join(FEED_COLUMNS)}")
        for r in reader:
            try:
                w, fare = int(r["advance_days"]), float(r["fare"])
                collected = datetime.fromisoformat(r["collected_at"].replace("Z", "+00:00"))
                ok = r["route_id"] in route_ids and r["airline_code"] in TRACKED_AIRLINES and w in ADVANCE_WINDOWS and fare > 0 and collected.tzinfo
            except (ValueError, KeyError):
                ok = False
            if not ok:
                bad += 1
                continue
            rows.append(row(r["route_id"], r["airline_code"], source_id, collected.astimezone(IST), r["travel_date"], w, fare, collected.isoformat()))
    if bad:
        print(f"Skipped {bad} invalid feed rows (unknown route/airline, window not in {ADVANCE_WINDOWS}, fare <= 0, or timestamp without timezone).", file=sys.stderr)
    return rows


# ---------- Supabase ----------

def row(route_id, airline, source_id, observed, travel_date, window, fare, collected_at, error=None):
    return {
        "route_id": route_id, "airline_code": airline, "source_id": source_id,
        "observed_date": observed.date().isoformat(), "travel_date": travel_date, "advance_days": window,
        "fare": round(fare, 2) if fare is not None else None, "currency": "INR", "collected_at": collected_at,
        "status": "success" if fare is not None else "failed", "error_code": error,
    }


def supabase(env, table, rows, upsert=False):
    url = f"{env['SUPABASE_URL'].rstrip('/')}/rest/v1/{table}" + ("?on_conflict=id" if upsert else "")
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
               "Prefer": "return=minimal" + (",resolution=merge-duplicates" if upsert else "")}
    for i in range(0, len(rows), 500):
        status, _ = http("POST", url, headers, json.dumps(rows[i:i + 500]).encode())
        if status not in (200, 201, 204):
            raise SystemExit(f"Supabase write to {table} failed (HTTP {status}). Did you run supabase/schema.sql and 002_collection.sql?")


def need(env, *keys):
    missing = [k for k in keys if not env.get(k)]
    if missing:
        raise SystemExit(f"Missing environment variables: {', '.join(missing)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", choices=["amadeus", "csv"], required=True)
    ap.add_argument("--csv", help="permitted feed file (with --source csv)")
    ap.add_argument("--source-id", default="src-feed", help="data_sources.id for a csv feed")
    ap.add_argument("--routes", type=int, help="only the first N routes (probing)")
    ap.add_argument("--dry-run", action="store_true", help="print rows, write nothing")
    args = ap.parse_args()
    env = os.environ
    basket = json.loads(ROUTES_FILE.read_text(encoding="utf-8"))
    routes = basket["routes"][: args.routes] if args.routes else basket["routes"]

    if args.source == "amadeus":
        need(env, "AMADEUS_BASE_URL", "AMADEUS_CLIENT_ID", "AMADEUS_CLIENT_SECRET")
        rows = collect_amadeus(routes, env, datetime.now(IST))
    else:
        if not args.csv:
            raise SystemExit("--csv is required with --source csv")
        rows = load_feed(args.csv, {r["id"] for r in routes}, args.source_id)

    ok = sum(r["status"] == "success" for r in rows)
    print(f"{len(rows)} observations ({ok} with fares, {len(rows) - ok} failed attempts)", file=sys.stderr)
    if args.dry_run:
        print(json.dumps(rows[:20], indent=2))
        return
    need(env, "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")
    supabase(env, "routes", [{"id": r["id"], "origin_code": r["origin"], "destination_code": r["destination"], "traffic_weight": r["trafficWeight"]} for r in basket["routes"]], upsert=True)
    supabase(env, "fare_observations", rows)
    print("Stored in Supabase.", file=sys.stderr)


if __name__ == "__main__":
    main()
