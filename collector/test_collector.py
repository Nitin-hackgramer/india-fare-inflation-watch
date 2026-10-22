"""python -m unittest discover collector"""
import csv
import io
import tempfile
import unittest
from pathlib import Path

from collect import load_feed, lowest_by_airline
from select_routes import select


def offer(code, total):
    return {"itineraries": [{"segments": [{"carrierCode": code}]}], "price": {"grandTotal": total}}


class AmadeusParsing(unittest.TestCase):
    def test_lowest_fare_per_airline_ignores_bad_offers(self):
        got = lowest_by_airline([offer("6E", "5400.00"), offer("6E", "4999.50"), offer("AI", "6100"), {"price": {}}, offer("SG", "abc")])
        self.assertEqual(got, {"6E": 4999.5, "AI": 6100.0})
        self.assertEqual(lowest_by_airline(None), {})


class Feed(unittest.TestCase):
    def test_keeps_only_valid_permitted_rows(self):
        text = (
            "route_id,airline_code,travel_date,advance_days,fare,collected_at\n"
            "DEL-BOM,6E,2026-11-01,7,5400,2026-10-25T03:00:00+00:00\n"  # ok
            "DEL-BOM,XX,2026-11-01,7,5400,2026-10-25T03:00:00+00:00\n"  # unknown airline
            "DEL-BOM,6E,2026-11-01,3,5400,2026-10-25T03:00:00+00:00\n"  # window not tracked
            "DEL-BOM,6E,2026-11-01,7,0,2026-10-25T03:00:00+00:00\n"  # bad fare
            "DEL-BOM,6E,2026-11-01,7,5400,2026-10-25T03:00:00\n"  # no timezone
        )
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False, encoding="utf-8") as f:
            f.write(text)
        rows = load_feed(f.name, {"DEL-BOM"}, "src-indigo")
        Path(f.name).unlink()
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["observed_date"], "2026-10-25")
        self.assertEqual(rows[0]["source_id"], "src-indigo")
        self.assertEqual(rows[0]["status"], "success")


class RouteSelection(unittest.TestCase):
    def test_ranks_pairs_weights_and_direction(self):
        data = io.StringIO(
            "Year,Month,City1,City2,PaxToCity2,PaxFromCity2,FreightToCity2,FreightFromCity2,MailToCity2,MailFromCity2\n"
            "2026,07,MUMBAI (MUMBAI),DELHI,300,500,,,,\n"  # Delhi->Mumbai busier
            "2026,07,CHENNAI,DELHI,100,100,,,,\n"
            "2026,07,NOWHERE,DELHI,999,999,,,,\n"  # unmapped -> skipped
            "2024,01,CHENNAI,DELHI,9999,9999,,,,\n"  # outside window
        )
        out = select(csv.DictReader(data), top=2, months=12)
        self.assertEqual([r["id"] for r in out["routes"]], ["DEL-BOM", "MAA-DEL"])
        self.assertAlmostEqual(out["routes"][0]["trafficWeight"], 0.8)
        self.assertEqual(out["skippedUnmappedPairs"], ["DELHI-NOWHERE"])


if __name__ == "__main__":
    unittest.main()
