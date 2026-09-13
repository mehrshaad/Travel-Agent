#!/usr/bin/env python3
"""
Snapshot real OpenStreetMap places for a list of cities into `lib/data/samples/`.

Run by hand, never at build time — it takes ~30 minutes and hammers a volunteer
service:

    python3 scripts/fetch-city-samples.py

Useful while iterating:

    python3 scripts/fetch-city-samples.py --only porto-pt
    python3 scripts/fetch-city-samples.py --only porto-pt --force

Why this exists: Overpass is a volunteer service that goes down. When it does, the
app used to show an empty screen with a badge claiming an "offline sample" that did
not exist. These files are that sample — real places, per city, so an outage degrades
to genuine data for the city the traveller actually planned.

What it writes: one `<slug>.json` per city plus an `index.json` the app loads eagerly
to decide *which* city file to open. Elements are stored in Overpass's own shape,
trimmed to the tags `lib/providers/normalize.ts::toPlace` reads, so the app runs them
through its real normalizer at read time instead of a second, divergent one.

Resumable: a city whose file already exists is skipped, so a re-run after a crash or a
new city added to CITIES costs only the missing cities.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT_DIR = REPO / "lib" / "data" / "samples"

# Mirrors, in the same order `lib/providers/overpass.ts` tries them. overpass-api.de is
# the freshest; kumi.systems lags by months but answers when the others will not.
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# How far from the city centre to capture. Big enough to cover a walkable centre and the
# neighbourhoods around it, small enough that the `historic` selector does not time out
# in a European capital.
CAPTURE_RADIUS_M = 4000

# The bug this guards against: the crew endpoint once returned an all-cafe list, because
# whichever category OSM happens to be dense in swamps every other. A flat cap per
# category means no single one can dominate a city file.
PER_CATEGORY_CAP = 8

# Seconds between requests. Overpass asks for one query at a time from a given client.
PAUSE_S = 1.5
# A healthy mirror answers one of these in 2-10s. Anything past 40s is a sick mirror, and
# waiting out its own 90s gateway timeout cost more than the whole rest of the run.
TIMEOUT_S = 40

# Mirrors CATEGORIES in `lib/providers/tags.ts`, in the same order, because
# `categoryOf()` is first-match-wins and the mix we keep should match the mix the app
# will label. This table only decides which elements are *kept*; the category the app
# renders is assigned at read time by the real `categoryOf()`, so drift here changes the
# sample's balance, never a place's label.
CATEGORY_SELECTORS: list[tuple[str, str, list[tuple[str, str | None]]]] = [
    # (category, section, [(osm key, osm value or None for key-only)])
    ("museum", "explore", [("tourism", "museum")]),
    ("gallery", "explore", [("tourism", "gallery")]),
    ("landmark", "explore", [("tourism", "attraction")]),
    ("historic", "explore", [("historic", None)]),
    ("park", "explore", [("leisure", "park")]),
    ("viewpoint", "explore", [("tourism", "viewpoint")]),
    ("bookstore", "explore", [("shop", "books")]),
    ("restaurant", "eat", [("amenity", "restaurant")]),
    ("cafe", "eat", [("amenity", "cafe")]),
    ("bakery", "eat", [("shop", "bakery")]),
    ("bar", "eat", [("amenity", "bar"), ("amenity", "pub")]),
    ("hotel", "stay", [("tourism", "hotel")]),
    ("hostel", "stay", [("tourism", "hostel")]),
    ("pharmacy", "essentials", [("amenity", "pharmacy")]),
    ("grocery", "essentials", [("shop", "supermarket")]),
    ("convenience", "essentials", [("shop", "convenience")]),
    ("atm", "essentials", [("amenity", "atm")]),
    ("laundry", "essentials", [("shop", "laundry"), ("amenity", "laundry")]),
    ("tourist_info", "essentials", [("tourism", "information")]),
]

# One Overpass query per group rather than per category: 19 queries a city across 80
# cities is hours of a volunteer service's time. `historic` and `park` are split off
# from the rest of explore because both match far more than the tourism=* selectors and
# together they time out in dense European centres.
QUERY_GROUPS = [
    ["museum", "gallery", "landmark", "viewpoint", "bookstore"],
    ["historic", "park"],
    ["restaurant", "cafe", "bakery", "bar"],
    ["hotel", "hostel"],
    ["pharmacy", "grocery", "convenience", "atm", "laundry", "tourist_info"],
]

# Tags `toPlace()` actually reads, plus the selector keys `categoryOf()` matches on.
# Everything else is dropped: the whole corpus ships in the repo.
KEEP_TAGS = {
    "name", "name:en",
    "tourism", "historic", "leisure", "shop", "amenity",
    "addr:housenumber", "addr:street",
    "opening_hours", "website", "contact:website", "description",
}

# (city, country, ISO 3166-1 alpha-2, lat, lng). Every populated continent, the obvious
# destinations, and the mid-size cities that broke in the field — a traveller in St.
# Catharines or Porto is exactly who an Overpass outage strands.
CITIES: list[tuple[str, str, str, float, float]] = [
    # --- Europe ---
    ("Porto", "Portugal", "pt", 41.1496, -8.6109),
    ("Lisbon", "Portugal", "pt", 38.7223, -9.1393),
    ("Barcelona", "Spain", "es", 41.3874, 2.1686),
    ("Madrid", "Spain", "es", 40.4168, -3.7038),
    ("Seville", "Spain", "es", 37.3891, -5.9845),
    ("Paris", "France", "fr", 48.8566, 2.3522),
    ("Lyon", "France", "fr", 45.7640, 4.8357),
    ("Rome", "Italy", "it", 41.9028, 12.4964),
    ("Florence", "Italy", "it", 43.7696, 11.2558),
    ("Milan", "Italy", "it", 45.4642, 9.1900),
    ("Berlin", "Germany", "de", 52.5200, 13.4050),
    ("Munich", "Germany", "de", 48.1351, 11.5820),
    ("Amsterdam", "Netherlands", "nl", 52.3676, 4.9041),
    ("Brussels", "Belgium", "be", 50.8503, 4.3517),
    ("Vienna", "Austria", "at", 48.2082, 16.3738),
    ("Prague", "Czechia", "cz", 50.0755, 14.4378),
    ("Budapest", "Hungary", "hu", 47.4979, 19.0402),
    ("Krakow", "Poland", "pl", 50.0647, 19.9450),
    ("Copenhagen", "Denmark", "dk", 55.6761, 12.5683),
    ("Stockholm", "Sweden", "se", 59.3293, 18.0686),
    ("Oslo", "Norway", "no", 59.9139, 10.7522),
    ("Helsinki", "Finland", "fi", 60.1699, 24.9384),
    ("Dublin", "Ireland", "ie", 53.3498, -6.2603),
    ("Edinburgh", "United Kingdom", "gb", 55.9533, -3.1883),
    ("London", "United Kingdom", "gb", 51.5074, -0.1278),
    ("Zurich", "Switzerland", "ch", 47.3769, 8.5417),
    ("Athens", "Greece", "gr", 37.9838, 23.7275),
    ("Istanbul", "Turkey", "tr", 41.0082, 28.9784),
    ("Reykjavik", "Iceland", "is", 64.1466, -21.9426),
    ("Ljubljana", "Slovenia", "si", 46.0569, 14.5058),
    ("Split", "Croatia", "hr", 43.5081, 16.4402),
    # --- North America ---
    ("Montreal", "Canada", "ca", 45.5017, -73.5673),
    ("Toronto", "Canada", "ca", 43.6532, -79.3832),
    ("Vancouver", "Canada", "ca", 49.2827, -123.1207),
    ("Quebec City", "Canada", "ca", 46.8139, -71.2080),
    ("St. Catharines", "Canada", "ca", 43.1594, -79.2469),
    ("Halifax", "Canada", "ca", 44.6488, -63.5752),
    ("New York", "United States", "us", 40.7128, -74.0060),
    ("Chicago", "United States", "us", 41.8781, -87.6298),
    ("San Francisco", "United States", "us", 37.7749, -122.4194),
    ("Los Angeles", "United States", "us", 34.0522, -118.2437),
    ("New Orleans", "United States", "us", 29.9511, -90.0715),
    ("Seattle", "United States", "us", 47.6062, -122.3321),
    ("Boston", "United States", "us", 42.3601, -71.0589),
    ("Mexico City", "Mexico", "mx", 19.4326, -99.1332),
    ("Oaxaca", "Mexico", "mx", 17.0732, -96.7266),
    # --- Asia ---
    ("Tokyo", "Japan", "jp", 35.6762, 139.6503),
    ("Kyoto", "Japan", "jp", 35.0116, 135.7681),
    ("Osaka", "Japan", "jp", 34.6937, 135.5023),
    ("Seoul", "South Korea", "kr", 37.5665, 126.9780),
    ("Busan", "South Korea", "kr", 35.1796, 129.0756),
    ("Taipei", "Taiwan", "tw", 25.0330, 121.5654),
    ("Hong Kong", "Hong Kong", "hk", 22.3193, 114.1694),
    ("Shanghai", "China", "cn", 31.2304, 121.4737),
    ("Beijing", "China", "cn", 39.9042, 116.4074),
    ("Singapore", "Singapore", "sg", 1.3521, 103.8198),
    ("Bangkok", "Thailand", "th", 13.7563, 100.5018),
    ("Chiang Mai", "Thailand", "th", 18.7883, 98.9853),
    ("Hanoi", "Vietnam", "vn", 21.0285, 105.8542),
    ("Ho Chi Minh City", "Vietnam", "vn", 10.7769, 106.7009),
    ("Kuala Lumpur", "Malaysia", "my", 3.1390, 101.6869),
    ("Ubud", "Indonesia", "id", -8.5069, 115.2625),
    ("Delhi", "India", "in", 28.6139, 77.2090),
    ("Mumbai", "India", "in", 19.0760, 72.8777),
    ("Jaipur", "India", "in", 26.9124, 75.7873),
    ("Kathmandu", "Nepal", "np", 27.7172, 85.3240),
    # --- Middle East ---
    ("Dubai", "United Arab Emirates", "ae", 25.2048, 55.2708),
    ("Doha", "Qatar", "qa", 25.2854, 51.5310),
    ("Tel Aviv", "Israel", "il", 32.0853, 34.7818),
    ("Amman", "Jordan", "jo", 31.9454, 35.9284),
    # --- Africa ---
    ("Cairo", "Egypt", "eg", 30.0444, 31.2357),
    ("Marrakesh", "Morocco", "ma", 31.6295, -7.9811),
    ("Cape Town", "South Africa", "za", -33.9249, 18.4241),
    ("Nairobi", "Kenya", "ke", -1.2921, 36.8219),
    ("Lagos", "Nigeria", "ng", 6.5244, 3.3792),
    ("Accra", "Ghana", "gh", 5.6037, -0.1870),
    ("Tunis", "Tunisia", "tn", 36.8065, 10.1815),
    # --- South America ---
    ("Buenos Aires", "Argentina", "ar", -34.6037, -58.3816),
    ("Rio de Janeiro", "Brazil", "br", -22.9068, -43.1729),
    ("Sao Paulo", "Brazil", "br", -23.5505, -46.6333),
    ("Santiago", "Chile", "cl", -33.4489, -70.6693),
    ("Lima", "Peru", "pe", -12.0464, -77.0428),
    ("Cusco", "Peru", "pe", -13.5319, -71.9675),
    ("Bogota", "Colombia", "co", 4.7110, -74.0721),
    ("Medellin", "Colombia", "co", 6.2442, -75.5812),
    # --- Oceania ---
    ("Sydney", "Australia", "au", -33.8688, 151.2093),
    ("Melbourne", "Australia", "au", -37.8136, 144.9631),
    ("Auckland", "New Zealand", "nz", -36.8485, 174.7633),
    ("Wellington", "New Zealand", "nz", -41.2866, 174.7756),
    ("Queenstown", "New Zealand", "nz", -45.0312, 168.6626),
]


def user_agent() -> str:
    """
    Overpass answers 406 without a User-Agent and blocks placeholder contact details, so
    this refuses to run rather than getting the repo's IP banned mid-corpus.
    """
    ua = os.environ.get("NOMINATIM_USER_AGENT")
    if not ua:
        env = REPO / ".env.local"
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("NOMINATIM_USER_AGENT="):
                    ua = line.split("=", 1)[1].strip().strip("\"'")
                    break
    if not ua:
        sys.exit("NOMINATIM_USER_AGENT is not set — see .env.example.")
    if "example.com" in ua or "your-" in ua.lower() or ("@" not in ua and "http" not in ua):
        sys.exit(f"NOMINATIM_USER_AGENT looks like a placeholder: {ua!r}")
    return ua


def slugify(city: str, code: str) -> str:
    ascii_city = unicodedata.normalize("NFKD", city).encode("ascii", "ignore").decode()
    base = re.sub(r"[^a-z0-9]+", "-", ascii_city.lower()).strip("-")
    return f"{base}-{code}"


def build_query(categories: list[str], lat: float, lng: float) -> str:
    around = f"(around:{CAPTURE_RADIUS_M},{lat:.5f},{lng:.5f})"
    parts = []
    for category, _section, selectors in CATEGORY_SELECTORS:
        if category not in categories:
            continue
        for key, value in selectors:
            sel = f'["{key}"]' if value is None else f'["{key}"="{value}"]'
            # node AND way: big museums, parks and hotels are ways, not nodes.
            parts.append(f"node{sel}{around};")
            parts.append(f"way{sel}{around};")
    # A generous output cap: the per-category trim happens here, not on the server, so
    # the query must come back with enough of each category to choose from.
    return f"[out:json][timeout:120];({''.join(parts)});out center tags 1000;"


# Where the next query starts its rotation. Always opening on overpass-api.de earned a
# 429 within one city — it hands out slots per client — so the load is spread instead.
_next_endpoint = 0


def overpass(query: str, ua: str) -> list[dict]:
    """One query, tried against each mirror in turn. Raises only if all of them fail."""
    global _next_endpoint
    last = "no endpoint tried"
    start = _next_endpoint
    _next_endpoint = (_next_endpoint + 1) % len(ENDPOINTS)
    for offset in range(len(ENDPOINTS)):
        endpoint = ENDPOINTS[(start + offset) % len(ENDPOINTS)]
        body = urllib.parse.urlencode({"data": query}).encode()
        req = urllib.request.Request(
            endpoint,
            data=body,
            headers={"User-Agent": ua, "Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as res:
                return json.loads(res.read().decode("utf-8")).get("elements", [])
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as err:
            last = f"{endpoint}: {err}"
            print(f"    mirror failed, rotating — {last}")
        finally:
            time.sleep(PAUSE_S)
    raise RuntimeError(f"every Overpass mirror failed ({last})")


def classify(tags: dict[str, str]) -> tuple[str, str] | None:
    """First match wins, exactly as `categoryOf()` does. Returns (category, section)."""
    for category, section, selectors in CATEGORY_SELECTORS:
        for key, value in selectors:
            if value is None and key in tags:
                return category, section
            if value is not None and tags.get(key) == value:
                return category, section
    return None


def trim(el: dict) -> dict | None:
    """Overpass's own element shape, minus every tag `toPlace()` never reads."""
    tags = {k: v for k, v in (el.get("tags") or {}).items() if k in KEEP_TAGS}
    if not (tags.get("name") or tags.get("name:en")):
        return None
    # Long descriptions are dropped rather than truncated: half a sentence presented as
    # the place's own words is worse than none, and Wikipedia fills these in live anyway.
    if len(tags.get("description", "")) > 240:
        tags.pop("description")

    out: dict = {"type": el["type"], "id": el["id"], "tags": tags}
    if el.get("lat") is not None and el.get("lon") is not None:
        out["lat"] = round(el["lat"], 6)
        out["lon"] = round(el["lon"], 6)
    elif el.get("center"):
        out["center"] = {"lat": round(el["center"]["lat"], 6), "lon": round(el["center"]["lon"], 6)}
    else:
        return None
    return out


def coords_of(el: dict) -> tuple[float, float]:
    if "lat" in el:
        return el["lat"], el["lon"]
    return el["center"]["lat"], el["center"]["lon"]


def distance_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    import math

    r = 6371.0
    dlat = math.radians(b[0] - a[0])
    dlng = math.radians(b[1] - a[1])
    s = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    )
    return 2 * r * math.asin(math.sqrt(s))


def fetch_city(city: str, country: str, code: str, lat: float, lng: float, ua: str) -> dict:
    centre = (lat, lng)
    by_category: dict[str, list[dict]] = {}
    seen: set[tuple] = set()

    for group in QUERY_GROUPS:
        print(f"    {'+'.join(group)}…", end=" ", flush=True)
        elements = overpass(build_query(group, lat, lng), ua)
        print(f"{len(elements)} raw")
        for el in elements:
            trimmed = trim(el)
            if trimmed is None:
                continue
            kind = classify(trimmed["tags"])
            if kind is None or kind[0] not in group:
                continue
            point = coords_of(trimmed)
            # The same POI is often mapped as both a node and a way. Name plus ~100 m
            # collapses the pair without merging two real shops on one street.
            key = (trimmed["tags"].get("name", ""), round(point[0], 3), round(point[1], 3))
            if key in seen:
                continue
            seen.add(key)
            by_category.setdefault(kind[0], []).append(trimmed)

    places: list[dict] = []
    for category, found in by_category.items():
        found.sort(key=lambda e: distance_km(centre, coords_of(e)))
        places.extend(found[:PER_CATEGORY_CAP])
    places.sort(key=lambda e: distance_km(centre, coords_of(e)))

    return {
        "city": city,
        "country": country,
        "countryCode": code,
        "center": {"lat": lat, "lng": lng},
        "capturedAt": time.strftime("%Y-%m-%d"),
        "capturedRadiusMeters": CAPTURE_RADIUS_M,
        "elements": places,
    }


def write_index() -> None:
    """Rebuilt from whatever is on disk, so a resumed run still leaves a complete index."""
    cities = []
    for city, country, code, lat, lng in CITIES:
        path = OUT_DIR / f"{slugify(city, code)}.json"
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        cities.append(
            {
                "slug": slugify(city, code),
                "city": city,
                "country": country,
                "countryCode": code,
                "lat": lat,
                "lng": lng,
                "count": len(data["elements"]),
            }
        )
    index = {"generatedAt": time.strftime("%Y-%m-%d"), "cities": cities}
    (OUT_DIR / "index.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"index.json: {len(cities)} cities, {sum(c['count'] for c in cities)} places")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", help="comma-separated slugs, e.g. porto-pt,tokyo-jp")
    parser.add_argument("--force", action="store_true", help="re-fetch cities already written")
    args = parser.parse_args()

    ua = user_agent()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wanted = set(args.only.split(",")) if args.only else None

    for n, (city, country, code, lat, lng) in enumerate(CITIES, 1):
        slug = slugify(city, code)
        if wanted and slug not in wanted:
            continue
        path = OUT_DIR / f"{slug}.json"
        if path.exists() and not args.force:
            print(f"[{n}/{len(CITIES)}] {slug}: already written, skipping")
            continue

        print(f"[{n}/{len(CITIES)}] {slug}")
        try:
            data = fetch_city(city, country, code, lat, lng, ua)
        except RuntimeError as err:
            # One dead city must not cost the whole run; the next invocation retries it.
            print(f"    FAILED: {err}")
            continue
        path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"    wrote {len(data['elements'])} places")

    write_index()


if __name__ == "__main__":
    main()
