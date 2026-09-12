"""
Pull real, reusable photos from Wikimedia Commons for every place the UI names.

Commons search gives us the file AND its license metadata in one call, so we can
credit properly. Throttled to ~1 req/s — Wikimedia 429s quickly, as we found out.

Run: python3 scripts/fetch-photos.py
"""
import json, re, time, urllib.parse, urllib.request, pathlib

UA = "Waylo/0.1 (hackathon; https://github.com/mehrshaad/Travel-Agent)"
OUT = pathlib.Path("public/photos")
API = "https://commons.wikimedia.org/w/api.php"

# slug -> (search query, is_specific_place)
# is_specific_place=False means "representative of the category", not the actual venue.
TARGETS = [
    ("pointe-a-calliere",  "Pointe-à-Callière museum Montreal", True),
    ("chateau-ramezay",    "Château Ramezay Montreal", True),
    ("jean-talon-market",  "Marché Jean-Talon Montreal", True),
    ("casino-montreal",    "Casino de Montréal building", True),
    ("schwartzs",          "Schwartz's Deli Montreal", True),
    ("habitat-67",         "Habitat 67 Montreal", True),
    ("notre-dame",         "Notre-Dame Basilica Montreal interior", True),
    ("mount-royal",        "Mount Royal Montreal lookout", True),
    ("mmfa",               "Montreal Museum of Fine Arts building", True),
    ("st-viateur",         "St-Viateur Bagel Montreal", True),
    ("old-montreal",       "Old Montreal Rue Saint-Paul", True),
    ("place-jacques-cartier", "Place Jacques-Cartier Montreal", True),
    ("mile-end",           "Mile End Montreal street", True),
    ("griffintown",        "Griffintown Montreal", True),
    ("old-port",           "Old Port of Montreal", True),
    ("bota-bota",          "Bota Bota Montreal spa", True),
    ("drawn-quarterly",    "Drawn and Quarterly Montreal", True),
    ("cafe-olimpico",      "Caffè Olimpico Montreal", True),
    ("hotel-nelligan",     "Hôtel Nelligan Montreal", True),
    ("auberge-vieux-port", "Auberge du Vieux-Port Montreal", True),
    ("hotel-gault",        "Hôtel Gault Montreal", True),
    # Category-representative — no public photo of the actual venue exists.
    ("bookstore",          "bookshop interior shelves", False),
    ("persian-food",       "Persian cuisine restaurant dish", False),
    ("cafe-interior",      "café interior Montreal", False),
    ("restaurant-table",   "restaurant dining table setting", False),
    ("hostel-dorm",        "hostel dormitory room", False),
    ("hotel-room",         "boutique hotel room bed", False),
    ("ice-cream",          "ice cream shop cone", False),
    ("record-shop",        "record shop vinyl crates", False),
]

def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=20))

def strip_html(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()

def search(query):
    d = api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": "6", "gsrlimit": "8",
        "prop": "imageinfo", "iiprop": "url|extmetadata|size",
        "iiurlwidth": "1000",
    })
    pages = (d.get("query") or {}).get("pages") or {}
    best = None
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        if not ii.get("thumburl"):
            continue
        if not re.search(r"\.(jpg|jpeg|png)$", p.get("title", ""), re.I):
            continue
        if (ii.get("width") or 0) < 700:
            continue
        meta = ii.get("extmetadata") or {}
        lic = strip_html((meta.get("LicenseShortName") or {}).get("value", ""))
        if "Fair use" in lic or "Non-free" in lic:
            continue
        cand = {
            "file": p["title"],
            "thumb": ii["thumburl"],
            "page": ii.get("descriptionurl", ""),
            "artist": strip_html((meta.get("Artist") or {}).get("value", "")) or "Unknown",
            "license": lic or "see source",
        }
        best = best or cand
    return best

manifest = {}
for slug, query, specific in TARGETS:
    try:
        hit = search(query)
    except Exception as e:
        print(f"  !! {slug}: {e}")
        hit = None
    time.sleep(1.2)
    if not hit:
        print(f"  -- {slug}: no result for '{query}'")
        continue
    try:
        req = urllib.request.Request(hit["thumb"], headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        print(f"  !! {slug} download: {e}")
        continue
    ext = ".jpg" if hit["thumb"].lower().rsplit(".", 1)[-1] in ("jpg", "jpeg") else ".png"
    path = OUT / f"{slug}{ext}"
    path.write_bytes(data)
    manifest[slug] = {
        "src": f"/photos/{slug}{ext}",
        "artist": hit["artist"][:120],
        "license": hit["license"],
        "source": hit["page"],
        "specific": specific,
    }
    print(f"  ok {slug:<22} {len(data)//1024:>5} KB  {hit['license'][:28]:<28} {hit['artist'][:34]}")
    time.sleep(0.6)

pathlib.Path("lib/photo-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
print(f"\n{len(manifest)}/{len(TARGETS)} downloaded -> lib/photo-manifest.json")
