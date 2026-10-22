"""Pick the route basket from DGCA city-pair traffic and write collector/routes.json.

Data: DGCA Monthly Statistics (Domestic Air Transport), city-pair wise, via the
india-aviation-traffic dataset (ODbL 1.0). Attribution: DGCA (https://www.dgca.gov.in/)
and Ministry of Civil Aviation (https://www.civilaviation.gov.in/).

    python collector/select_routes.py                 # downloads the latest CSV
    python collector/select_routes.py --csv city.csv --top 12 --months 12

Each pair's weight = its passengers (both directions) / passengers of all selected pairs.
Fares are collected in the busier direction of each pair.
"""
import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

DATA_URL = "https://raw.githubusercontent.com/Vonter/india-aviation-traffic/main/aggregated/domestic/city.csv"
OUT = Path(__file__).with_name("routes.json")

# DGCA city name -> IATA airport code. Cities missing here are skipped and reported.
IATA = {
    "DELHI": "DEL", "MUMBAI": "BOM", "BENGALURU": "BLR", "BANGALORE": "BLR", "HYDERABAD": "HYD",
    "KOLKATA": "CCU", "CHENNAI": "MAA", "AHMEDABAD": "AMD", "PUNE": "PNQ",
    "GOA": "GOX",  # assumption: DGCA lists DABOLIM separately, so "GOA" is taken as Mopa (GOX) — verify
    "DABOLIM": "GOI", "GUWAHATI": "GAU", "KOCHI": "COK", "COCHIN": "COK", "LUCKNOW": "LKO",
    "JAIPUR": "JAI", "BHUBANESWAR": "BBI", "PATNA": "PAT", "INDORE": "IDR", "VARANASI": "VNS",
    "CHANDIGARH": "IXC", "BAGDOGRA": "IXB", "SRINAGAR": "SXR", "COIMBATORE": "CJB", "NAGPUR": "NAG",
    "RAIPUR": "RPR", "RANCHI": "IXR", "AMRITSAR": "ATQ", "MANGALORE": "IXE", "UDAIPUR": "UDR",
    "PORT BLAIR": "IXZ", "DEHRADUN": "DED", "VISHAKHAPATNAM": "VTZ", "VISAKHAPATNAM": "VTZ",
    "SURAT": "STV", "BHOPAL": "BHO", "AGARTALA": "IXA", "JAMMU": "IXJ", "THIRUVANANTHAPURAM": "TRV",
    "TRIVANDRUM": "TRV", "VADODARA": "BDQ", "IMPHAL": "IMF", "GORAKHPUR": "GOP",
}


def norm(name: str) -> str:
    """'MUMBAI (MUMBAI)' / 'BAGDOGRA ' -> 'MUMBAI' / 'BAGDOGRA'."""
    return re.sub(r"\s+", " ", re.sub(r"\(.*?\)", "", name)).strip().upper()


def months_back(latest: str, n: int) -> str:
    y, m = map(int, latest.split("-"))
    m -= n - 1
    while m <= 0:
        y, m = y - 1, m + 12
    return f"{y}-{m:02d}"


def select(rows, top: int, months: int):
    rows = list(rows)
    latest = max(f"{r['Year']}-{int(r['Month']):02d}" for r in rows)
    first = months_back(latest, months)
    flows = defaultdict(lambda: [0.0, 0.0])  # (a, b) sorted -> [pax a->b, pax b->a]
    for r in rows:
        ym = f"{r['Year']}-{int(r['Month']):02d}"
        if not first <= ym <= latest:
            continue
        c1, c2 = norm(r["City1"]), norm(r["City2"])
        to2, from2 = float(r["PaxToCity2"] or 0), float(r["PaxFromCity2"] or 0)
        if c1 > c2:
            c1, c2, to2, from2 = c2, c1, from2, to2
        flows[(c1, c2)][0] += to2
        flows[(c1, c2)][1] += from2

    total = sum(a + b for a, b in flows.values())
    ranked = sorted(flows.items(), key=lambda kv: -sum(kv[1]))
    picked, skipped = [], []
    for (a, b), (ab, ba) in ranked:
        if len(picked) == top:
            break
        if a not in IATA or b not in IATA:
            skipped.append(f"{a}-{b}")
            continue
        o, d = (a, b) if ab >= ba else (b, a)
        picked.append({"origin": IATA[o], "destination": IATA[d], "originCity": o.title(), "destinationCity": d.title(), "passengers": round(ab + ba)})

    basket = sum(p["passengers"] for p in picked)
    for p in picked:
        p["id"] = f"{p['origin']}-{p['destination']}"
        p["trafficWeight"] = round(p["passengers"] / basket, 4)
    return {
        "source": "DGCA city-pair wise domestic traffic (via Vonter/india-aviation-traffic, ODbL 1.0)",
        "period": {"from": first, "to": latest},
        "generatedOn": date.today().isoformat(),
        "basketShareOfDomesticPax": round(basket / total, 4),
        "skippedUnmappedPairs": skipped,
        "routes": picked,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", help="local city.csv (default: download latest)")
    ap.add_argument("--top", type=int, default=12)
    ap.add_argument("--months", type=int, default=12)
    args = ap.parse_args()
    if args.csv:
        text = Path(args.csv).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(DATA_URL, timeout=60) as r:
            text = r.read().decode("utf-8")
    result = select(csv.DictReader(io.StringIO(text)), args.top, args.months)
    OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    for r in result["routes"]:
        print(f"{r['id']:8} {r['originCity']:>12} -> {r['destinationCity']:<12} {r['passengers']:>11,} pax  weight {r['trafficWeight']:.4f}")
    print(f"Basket = {result['basketShareOfDomesticPax']:.1%} of domestic passengers, {result['period']['from']}..{result['period']['to']}")
    if result["skippedUnmappedPairs"]:
        print("Skipped (no IATA mapping):", ", ".join(result["skippedUnmappedPairs"]), file=sys.stderr)


if __name__ == "__main__":
    main()
