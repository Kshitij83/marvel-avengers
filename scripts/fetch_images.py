import json
import os
import sys
import time
import urllib.parse
import urllib.request

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
WEB_DIR = os.path.join(PROJECT_ROOT, "web")
CHARACTERS_FILE = os.path.join(DATA_DIR, "characters.json")
MOVIES_FILE = os.path.join(DATA_DIR, "movies.json")
CHARACTER_IMG_DIR = os.path.join(WEB_DIR, "images", "characters")
POSTER_IMG_DIR = os.path.join(WEB_DIR, "images", "posters")

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"

REQUEST_DELAY = 1.5
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"


def load_data_file(path, label):
    if not os.path.isfile(path):
        print(f"ERROR: {label} data file not found: {path}")
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"ERROR: failed to parse {label} data file {path}: {e}")
        return None
    return data


def api_get(base, params):
    params = dict(params)
    params.setdefault("format", "json")
    url = base + "?" + urllib.parse.urlencode(params)
    last_err = None
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                time.sleep(10 * (attempt + 1))
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


def first_thumb(data):
    pages = (data or {}).get("query", {}).get("pages") or {}
    for page in pages.values():
        if not isinstance(page, dict):
            continue
        if page.get("missing") or page.get("invalid"):
            continue
        info = page.get("imageinfo") or []
        for ii in info:
            thumb = ii.get("thumburl")
            if thumb:
                return thumb
            url = ii.get("url")
            if url:
                return url
    return None


def download(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    last_err = None
    for attempt in range(4):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest, "wb") as out:
                while True:
                    chunk = resp.read(65536)
                    if not chunk:
                        break
                    out.write(chunk)
            if os.path.getsize(dest) > 0:
                return True
            last_err = RuntimeError("downloaded file is empty")
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code == 429:
                time.sleep(10 * (attempt + 1))
                continue
            raise
        except Exception as e:
            last_err = e
            time.sleep(2 * (attempt + 1))
    raise last_err


def search_commons(name, search_terms):
    for term in search_terms:
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": term,
            "gsrnamespace": 6,
            "gsrlimit": 1,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 600,
        }
        try:
            data = api_get(COMMONS_API, params)
        except Exception as e:
            print(f"WARNING: commons search failed for '{term}': {e}")
            continue
        thumb = first_thumb(data)
        if thumb:
            return thumb
        time.sleep(REQUEST_DELAY)
    return None


def find_entry_list(data, predicate):
    if isinstance(data, list):
        if data and all(isinstance(x, dict) and predicate(x) for x in data):
            return data
        return []
    if isinstance(data, dict):
        for value in data.values():
            if isinstance(value, list) and value and all(isinstance(x, dict) and predicate(x) for x in value):
                return value
    return []


def fetch_character_avatars(characters):
    entries = find_entry_list(characters, lambda x: x.get("id"))
    if not entries:
        print("ERROR: no character entries found in characters data")
        return
    for character in entries:
        cid = str(character.get("id") or character.get("characterId") or "")
        if not cid:
            continue
        name = str(character.get("name") or cid)
        terms = [f"{name} (Marvel)", f"{name} Marvel Comics", name]
        try:
            url = search_commons(name, terms)
        except Exception as e:
            print(f"FAIL characters/{cid}.jpg ({name}): {e}")
            continue
        if not url:
            print(f"FAIL characters/{cid}.jpg ({name}): no image found")
            continue
        dest = os.path.join(CHARACTER_IMG_DIR, f"{cid}.jpg")
        try:
            download(url, dest)
            print(f"OK characters/{cid}.jpg ({name})")
        except Exception as e:
            print(f"FAIL characters/{cid}.jpg ({name}): {e}")
        time.sleep(REQUEST_DELAY)


def search_wikipedia_file(query, width=500):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": query,
        "gsrnamespace": 6,
        "gsrlimit": 1,
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": width,
    }
    return first_thumb(api_get(WIKIPEDIA_API, params))


def fetch_movie_posters(movies):
    entries = find_entry_list(movies, lambda x: x.get("title"))
    if not entries:
        print("ERROR: no movie entries found in movies data")
        return
    for movie in entries:
        mid = str(movie.get("id") or "")
        if not mid:
            continue
        title = str(movie.get("title") or movie.get("name") or mid)
        variants = [
            f"File:{title} poster.jpg",
            f"File:{title} film poster.jpg",
            f"File:{title} theatrical poster.jpg",
        ]
        thumb = None
        for variant in variants:
            params = {
                "action": "query",
                "titles": variant,
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": 500,
            }
            try:
                data = api_get(WIKIPEDIA_API, params)
            except Exception as e:
                print(f"WARNING: wikipedia query failed for '{variant}': {e}")
                time.sleep(REQUEST_DELAY)
                continue
            thumb = first_thumb(data)
            if thumb:
                break
            time.sleep(REQUEST_DELAY)
        if not thumb:
            for query in [f"{title} poster", title]:
                try:
                    thumb = search_wikipedia_file(query)
                except Exception as e:
                    print(f"WARNING: wikipedia search failed for '{query}': {e}")
                    thumb = None
                if thumb:
                    break
                time.sleep(REQUEST_DELAY)
        if not thumb:
            print(f"FAIL posters/{mid}.jpg ({title}): no image found")
            continue
        dest = os.path.join(POSTER_IMG_DIR, f"{mid}.jpg")
        try:
            download(thumb, dest)
            print(f"OK posters/{mid}.jpg ({title})")
        except Exception as e:
            print(f"FAIL posters/{mid}.jpg ({title}): {e}")
        time.sleep(REQUEST_DELAY)


def main():
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    characters = load_data_file(CHARACTERS_FILE, "characters")
    if characters is not None:
        fetch_character_avatars(characters)
    else:
        print("ERROR: skipping character avatars")
    movies = load_data_file(MOVIES_FILE, "movies")
    if movies is not None:
        fetch_movie_posters(movies)
    else:
        print("ERROR: skipping movie posters")
    print("fetch_images.py finished")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("fetch_images.py interrupted")
        sys.exit(1)
