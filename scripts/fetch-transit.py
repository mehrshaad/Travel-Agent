"""
Capture Montreal metro lines and their station order from OpenStreetMap, once.

Overpass 504s often under load, and a demo cannot depend on that. Station geometry
is cheap to query live; line membership is not, so it is fetched here and committed
as seed data. Re-run to refresh: python3 scripts/fetch-transit.py
"""
import json, pathlib, time, urllib.parse, urllib.request

UA = "Waylo/0.1 (+https://github.com/mehrshaad/Travel-Agent)"
EP = "https://overpass-api.de/api/interpreter"
BBOX = "45.40,-73.75,45.62,-73.45"

def overpass(query, attempts=8):
    for i in range(attempts):
        try:
            req = urllib.request.Request(
                EP, data=urllib.parse.urlencode({"data": query}).encode(),
                headers={"User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded"},
            )
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except Exception as e:
            print(f"  attempt {i+1}: {str(e)[:60]}")
            time.sleep(3)
    raise SystemExit("Overpass unavailable after retries")

print("1/2 lines + members…")
rels = overpass(f'[out:json][timeout:90];relation["route"="subway"]({BBOX});out body;')

lines, wanted = [], set()
for el in rels.get("elements", []):
    t = el.get("tags", {})
    if not t.get("ref"):
        continue
    stops = [m["ref"] for m in el.get("members", []) if m["type"] == "node" and "stop" in (m.get("role") or "")]
    if not stops:
        stops = [m["ref"] for m in el.get("members", []) if m["type"] == "node"]
    wanted.update(stops)
    lines.append({
        "ref": t["ref"],
        "name": t.get("name", ""),
        "colour": t.get("colour"),
        "to": t.get("to") or (t.get("name", "").split(" vers ")[-1] if " vers " in t.get("name", "") else None),
        "stopIds": stops,
    })
print(f"   {len(lines)} directions, {len(wanted)} stop nodes")

print("2/2 stop names + coordinates…")
ids = "".join(f"node({i});" for i in sorted(wanted))
nodes = overpass(f"[out:json][timeout:120];({ids});out tags center;")

stops = {}
for el in nodes.get("elements", []):
    t = el.get("tags", {})
    name = t.get("name")
    if not name:
        continue
    stops[el["id"]] = {"name": name, "lat": el.get("lat"), "lng": el.get("lon")}
print(f"   {len(stops)} named stops")

# Collapse the two directions of each line into one, keeping the longer stop list.
by_ref = {}
for l in lines:
    named = [stops[s]["name"] for s in l["stopIds"] if s in stops]
    seen, ordered = set(), []
    for n in named:
        if n not in seen:
            seen.add(n); ordered.append(n)
    cur = by_ref.get(l["ref"])
    if not cur or len(ordered) > len(cur["stations"]):
        by_ref[l["ref"]] = {
            "ref": l["ref"], "name": l["name"], "colour": l["colour"],
            "terminus": l["to"], "stations": ordered,
        }

out = {
    "city": "Montréal",
    "operator": "Société de transport de Montréal",
    "mode": "subway",
    "source": "OpenStreetMap via Overpass",
    "fetchedAt": time.strftime("%Y-%m-%d"),
    "lines": sorted(by_ref.values(), key=lambda x: x["ref"]),
    "stops": [{"name": v["name"], "lat": v["lat"], "lng": v["lng"]} for v in stops.values() if v["lat"]],
}
pathlib.Path("lib/data/montreal-transit.json").write_text(json.dumps(out, ensure_ascii=False, indent=2))
for l in out["lines"]:
    print(f"   line {l['ref']:<3} {str(l['colour']):<9} {len(l['stations']):>3} stations  {l['name'][:44]}")
print(f"stops with coords: {len(out['stops'])} -> lib/data/montreal-transit.json")
