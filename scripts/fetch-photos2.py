"""Second pass: replace the photos that search got wrong.

Commons *categories* are curated, so they beat full-text search for a named place.
Also filters on aspect ratio — the first pass returned panorama strips that look
broken in a 3:2 card.
"""
import json, re, time, urllib.parse, urllib.request, pathlib

UA = "Waylo/0.1 (hackathon; https://github.com/mehrshaad/Travel-Agent)"
API = "https://commons.wikimedia.org/w/api.php"
OUT = pathlib.Path("public/photos")

# slug -> (category or None, search fallback, specific)
REDO = [
    ("jean-talon-market", "Category:Marché Jean-Talon", "Marché Jean-Talon produce stalls", True),
    ("mount-royal",       "Category:Kondiaronk Belvedere", "Mount Royal chalet lookout Montreal", True),
    ("old-montreal",      "Category:Rue Saint-Paul (Montreal)", "Old Montreal cobblestone street", True),
    ("place-jacques-cartier", "Category:Place Jacques-Cartier", "Place Jacques-Cartier Montreal square", True),
    ("mile-end",          "Category:Mile End", "Mile End Montreal storefronts", True),
    ("griffintown",       "Category:Griffintown", "Griffintown Montreal buildings", True),
    ("bota-bota",         "Category:Bota Bota", "spa boat Old Port Montreal", True),
    ("hotel-nelligan",    "Category:Hôtel Nelligan", "Old Montreal stone hotel facade", False),
    ("cafe-interior",     "Category:Coffeehouses in Montreal", "coffee shop interior counter", False),
    ("hotel-room",        None, "hotel room double bed interior", False),
    ("hostel-dorm",       None, "hostel bunk beds dormitory room", False),
    ("cafe-olimpico",     "Category:Caffè Olimpico", "Italian espresso bar Montreal", True),
    ("record-shop",       None, "record store interior vinyl", False),
]

def api(params):
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    return json.load(urllib.request.urlopen(req, timeout=20))

def strip(s): return re.sub(r"<[^>]+>", "", s or "").strip()

def usable(p):
    ii = (p.get("imageinfo") or [{}])[0]
    if not ii.get("thumburl"): return None
    if not re.search(r"\.(jpg|jpeg|png)$", p.get("title",""), re.I): return None
    w, h = ii.get("width") or 0, ii.get("height") or 1
    if w < 800: return None
    ar = w / h
    if ar < 1.15 or ar > 2.1: return None          # no panorama strips, no portraits
    meta = ii.get("extmetadata") or {}
    lic = strip((meta.get("LicenseShortName") or {}).get("value",""))
    if "Fair" in lic or "Non-free" in lic: return None
    return {"thumb": ii["thumburl"], "page": ii.get("descriptionurl",""),
            "artist": strip((meta.get("Artist") or {}).get("value","")) or "Unknown",
            "license": lic or "see source"}

COMMON = {"prop":"imageinfo","iiprop":"url|extmetadata|size","iiurlwidth":"1000","format":"json","action":"query"}

def from_category(cat):
    try:
        d = api({**COMMON, "generator":"categorymembers", "gcmtitle":cat, "gcmtype":"file", "gcmlimit":"25"})
    except Exception:
        return None
    for p in (d.get("query") or {}).get("pages", {}).values():
        u = usable(p)
        if u: return u
    return None

def from_search(q):
    try:
        d = api({**COMMON, "generator":"search", "gsrsearch":q, "gsrnamespace":"6", "gsrlimit":"12"})
    except Exception:
        return None
    for p in (d.get("query") or {}).get("pages", {}).values():
        u = usable(p)
        if u: return u
    return None

manifest = json.loads(pathlib.Path("lib/photo-manifest.json").read_text())
for slug, cat, query, specific in REDO:
    hit = None
    if cat:
        hit = from_category(cat); time.sleep(1.2)
    if not hit:
        hit = from_search(query); time.sleep(1.2)
    if not hit:
        print(f"  -- {slug}: still nothing"); continue
    try:
        data = urllib.request.urlopen(urllib.request.Request(hit["thumb"], headers={"User-Agent":UA}), timeout=30).read()
    except Exception as e:
        print(f"  !! {slug}: {e}"); continue
    ext = ".jpg" if hit["thumb"].lower().rsplit(".",1)[-1] in ("jpg","jpeg") else ".png"
    (OUT / f"{slug}{ext}").write_bytes(data)
    for old in OUT.glob(f"{slug}.*"):
        if old.suffix != ext: old.unlink()
    manifest[slug] = {"src": f"/photos/{slug}{ext}", "artist": hit["artist"][:120],
                      "license": hit["license"], "source": hit["page"], "specific": specific}
    print(f"  ok {slug:<20} {len(data)//1024:>5} KB  {hit['license'][:24]:<24} {hit['artist'][:30]}")
    time.sleep(0.6)

pathlib.Path("lib/photo-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
print(f"\nmanifest now {len(manifest)} photos")
