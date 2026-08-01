import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
WEB_ROOT = os.path.join(PROJECT_ROOT, "web")
DATA_DIR = os.path.join(PROJECT_ROOT, "data")
CHARACTERS_FILE = os.path.join(DATA_DIR, "characters.json")
MOVIES_FILE = os.path.join(DATA_DIR, "movies.json")
FAMILY_TREES_FILE = os.path.join(DATA_DIR, "family_trees.json")
DOTENV_FILE = os.path.join(PROJECT_ROOT, ".env")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"
SUGGEST_RE = re.compile(r"^[ \t]*\[SUGGEST:([a-z0-9\-_]+)\][ \t]*$", re.IGNORECASE)

PROVIDERS = {
    "anthropic": {
        "env": "ANTHROPIC_API_KEY",
        "models": ["claude-sonnet-4-6", "claude-sonnet-4-5-20250929", "claude-sonnet-5"],
    },
    "gemini": {
        "env": "GEMINI_API_KEY",
        "models": ["gemini-2.5-flash", "gemini-2.0-flash"],
    },
    "openai": {
        "env": "OPENAI_API_KEY",
        "models": ["gpt-4o-mini", "gpt-4.1-mini"],
    },
}
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OLLAMA_URL = "http://127.0.0.1:11434"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
}

PERSONALITY_HINTS = {
    "witty": "constant quips and humor",
    "serious": "grim, no-nonsense, and to the point",
    "arrogant": "Tony Stark style confidence, sarcasm, and ego",
    "noble": "Thor / Captain America style honor, duty, and noble speech",
    "wild": "Deadpool style chaos, breaking the fourth wall, talking to the audience",
    "mystical": "Doctor Strange style mystical, cryptic, and wise",
    "goofy": "playful, lighthearted, and full of jokes",
    "fierce": "intense, aggressive, and relentlessly determined",
    "heroic": "brave, selfless, and inspiring",
}


def load_dotenv(path):
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_cache = {}


def read_json_cached(path):
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return None
    entry = _cache.get(path)
    if entry is not None and entry[0] == mtime:
        return entry[1]
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return None
    _cache[path] = (mtime, data)
    return data


def load_characters():
    data = read_json_cached(CHARACTERS_FILE)
    if data is None:
        return None
    roster = {}
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        cid = item.get("id") or item.get("characterId")
                        if cid is not None:
                            roster[str(cid)] = item
            elif isinstance(value, dict):
                cid = value.get("id") or value.get("characterId") or key
                roster[str(cid)] = value
    elif isinstance(data, list):
        for value in data:
            if isinstance(value, dict):
                cid = value.get("id") or value.get("characterId")
                if cid is not None:
                    roster[str(cid)] = value
    return roster


def field_text(value):
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(str(v) for v in value)
    return str(value)


def get_character_fields(character):
    return {
        "name": character.get("name") or "the character",
        "personality": character.get("personality") or "heroic",
        "personality_desc": field_text(character.get("personalityDesc")),
        "powers": field_text(character.get("powers")),
        "catchphrase": field_text(character.get("catchphrase")),
        "quote": field_text(character.get("quote")),
    }


def build_system_prompt(character, roster):
    f = get_character_fields(character)
    hint = PERSONALITY_HINTS.get(f["personality"], "match the character's established personality")
    roster_lines = ", ".join(
        f"{c.get('name') or cid} -> {cid}" for cid, c in roster.items()
    )
    prompt = f"""You are roleplaying as {f['name']} from the Marvel universe. Follow these rules:

1) You speak ONLY as {f['name']}. Your personality is "{f['personality']}": {hint}.
Personality details: {f['personality_desc'] or 'None given'}.
Powers: {f['powers'] or 'None given'}.
Catchphrase: {f['catchphrase'] or 'None given'}.
Signature quote: {f['quote'] or 'None given'}.

2) The full roster of available characters is: {roster_lines or 'None'}.
If the user asks about ANY OTHER character in that roster, answer the question briefly but stay fully in character, then at the very end of your reply on its OWN line output exactly: [SUGGEST:<characterId>] (for example [SUGGEST:hulk]) to nudge the user toward that character's agent.
If the question is in-domain or generic, output NO marker at all.

3) Never break character. Keep replies conversational and natural, using {f['name']}'s catchphrases when appropriate."""
    return prompt


def is_model_error(status, text):
    if status == 404:
        return True
    if status in (400, 401, 403):
        low = (text or "").lower()
        if any(k in low for k in (
            "not found", "does not exist", "unknown model", "model_not_found",
            "no such model", "invalid model",
        )):
            return True
    return False


def call_anthropic(api_key, payload):
    data = json.dumps(payload).encode("utf-8")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    req = urllib.request.Request(ANTHROPIC_URL, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        msg = raw
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                err = parsed.get("error")
                if isinstance(err, dict):
                    msg = err.get("message") or raw
                elif isinstance(err, str):
                    msg = err
        except Exception:
            pass
        return None, (e.code, msg)
    except Exception as e:
        return None, (0, str(e))
    if not isinstance(body, dict):
        return None, (0, "Unexpected API response shape")
    content = body.get("content")
    if isinstance(content, str):
        return content, None
    if isinstance(content, list):
        text = "".join(
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        )
        if text:
            return text, None
    return None, (0, "No text content in API response")


def call_anthropic_with_fallback(api_key, payload):
    last_model_error = None
    for model in PROVIDERS["anthropic"]["models"]:
        payload["model"] = model
        result, error = call_anthropic(api_key, payload)
        if result is not None:
            print(f"[chat] anthropic model in use: {model}")
            return result
        status, msg = error
        if not is_model_error(status, msg):
            return error
        print(f"[chat] anthropic model {model} unavailable (status {status}), trying next")
        last_model_error = msg
    return last_model_error or "No model available"


def call_gemini(api_key, system, messages, model):
    payload = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [
            {
                "role": "user" if m["role"] == "user" else "model",
                "parts": [{"text": m["content"]}],
            }
            for m in messages
        ],
        "generationConfig": {"maxOutputTokens": 1024},
    }
    url = GEMINI_URL.format(model=model) + "?key=" + urllib.parse.quote(api_key)
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["candidates"][0]["content"]["parts"][0]["text"], None
    except urllib.error.HTTPError as e:
        return None, (e.code, e.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return None, (0, str(e))


def call_openai(api_key, system, messages, model):
    payload = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{"role": "system", "content": system}] + messages,
    }
    req = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "authorization": "Bearer " + api_key,
            "content-type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"], None
    except urllib.error.HTTPError as e:
        return None, (e.code, e.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return None, (0, str(e))


def ollama_models():
    try:
        with urllib.request.urlopen(OLLAMA_URL + "/api/tags", timeout=2) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return [m.get("name") for m in body.get("models", []) if m.get("name")]
    except Exception:
        return []


def pick_ollama_model():
    configured = os.environ.get("OLLAMA_MODEL") or "llama3.2:1b"
    available = ollama_models()
    if not available:
        return None
    if configured in available:
        return configured
    preferred = [
        "qwen2.5:3b", "qwen2.5:7b", "llama3.1:8b", "gemma3:4b",
        "llama3.2:1b", "gemma3:270m",
    ]
    for name in preferred:
        if name in available:
            return name
    return available[0]


def call_ollama(model, system, messages):
    payload = {
        "model": model,
        "stream": False,
        "messages": [{"role": "system", "content": system}] + messages,
    }
    req = urllib.request.Request(
        OLLAMA_URL + "/api/chat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            body = json.loads(resp.read().decode("utf-8"))
        return body.get("message", {}).get("content"), None
    except urllib.error.HTTPError as e:
        return None, (e.code, e.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return None, (0, str(e))


def detect_provider(key):
    if not key:
        return None
    if key.startswith("sk-ant"):
        return "anthropic"
    if key.startswith("AIza"):
        return "gemini"
    if key.startswith("sk-") or key.startswith("sk-proj-"):
        return "openai"
    return None


def provider_call(provider, api_key, system, messages):
    if provider == "anthropic":
        payload = {
            "max_tokens": 1024,
            "system": system,
            "messages": messages,
        }
        return call_anthropic_with_fallback(api_key, payload)
    last_model_error = None
    for model in PROVIDERS[provider]["models"]:
        if provider == "gemini":
            result, error = call_gemini(api_key, system, messages, model)
        elif provider == "openai":
            result, error = call_openai(api_key, system, messages, model)
        else:
            return "No model available"
        if result is not None:
            print(f"[chat] {provider} model in use: {model}")
            return result
        status, msg = error
        if not is_model_error(status, msg):
            return error
        print(f"[chat] {provider} model {model} unavailable (status {status}), trying next")
        last_model_error = msg
    return last_model_error or "No model available"


def extract_suggestion(reply, roster):
    lines = reply.splitlines()
    suggestion = None
    kept = []
    for line in lines:
        m = SUGGEST_RE.match(line)
        if m:
            if suggestion is None:
                suggestion = m.group(1)
            continue
        kept.append(line)
    if suggestion is not None and suggestion not in roster:
        suggestion = None
    return "\n".join(kept).strip(), suggestion


def process_chat(body, get_header):
    roster = load_characters()
    if roster is None:
        return 500, {"error": "Character data unavailable"}
    character_id = body.get("characterId")
    character = roster.get(str(character_id)) if character_id is not None else None
    if character is None:
        return 404, {"error": f"Unknown characterId: {character_id}"}
    messages = body.get("messages") or []
    filtered = []
    for m in messages:
        if isinstance(m, dict) and m.get("role") in ("user", "assistant"):
            filtered.append({"role": m["role"], "content": m.get("content", "")})
    while filtered and filtered[-1]["role"] != "user":
        filtered.pop()
    if not filtered:
        filtered = [{"role": "user", "content": ""}]

    explicit_provider = (body.get("provider") or get_header("x-provider") or "").strip().lower()
    explicit_key = (body.get("apiKey") or get_header("x-api-key") or "").strip()
    if explicit_provider not in PROVIDERS:
        explicit_provider = ""
    if explicit_provider:
        provider = explicit_provider
    else:
        provider = detect_provider(explicit_key) or "ollama"

    if provider == "ollama":
        ollama_model = pick_ollama_model()
        if ollama_model is None:
            return 503, {
                "reply": "",
                "error": "NO_MODEL",
                "provider": "ollama",
                "message": (
                    "No local AI model found. Install Ollama and run "
                    "`ollama pull llama3.2:1b`, or paste an API key in "
                    "the ⚙ Settings."
                ),
            }
    else:
        api_key = explicit_key or os.environ.get(PROVIDERS[provider]["env"]) or ""
        if not api_key:
            return 400, {
                "reply": "",
                "error": "NO_KEY",
                "provider": provider,
                "message": (
                    f"No {provider} API key configured. Paste one in the "
                    "⚙ Settings (free tiers: Google AI Studio for Gemini, "
                    "OpenAI, Anthropic) or run Ollama for a 100% free "
                    "local option."
                ),
            }

    system = build_system_prompt(character, roster)
    if provider == "ollama":
        result = call_ollama(ollama_model, system, filtered)
    else:
        result = provider_call(provider, api_key, system, filtered)
    if isinstance(result, tuple):
        text, err = result
        if err is None:
            result = text
        else:
            status, msg = err
            return 502, {"reply": "An error occurred...", "error": f"status={status} {msg}"}
    reply, suggestion = extract_suggestion(result, roster)
    return 200, {"reply": reply, "suggestedCharacterId": suggestion}


class Handler(BaseHTTPRequestHandler):
    server_version = "MarvelAvengersServer/1.0"

    def log_message(self, fmt, *args):
        print(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} {self.command} {self.path} -> {fmt % args}")

    def _send_headers(self, status, content_type, length=None, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        if length is not None:
            self.send_header("Content-Length", str(length))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()

    def json_response(self, obj, status=200):
        data = json.dumps(obj).encode("utf-8")
        self._send_headers(status, "application/json; charset=utf-8", len(data))
        self.wfile.write(data)

    def serve_json_file(self, path):
        data = read_json_cached(path)
        if data is None:
            return self.json_response(
                {"error": f"Data file not available: {os.path.basename(path)}"}, 500
            )
        self.json_response(data)

    def serve_static(self, path):
        if path in ("", "/"):
            rel = "index.html"
        else:
            parts = [p for p in path.lstrip("/").split("/") if p and p != "."]
            if any(p == ".." for p in parts):
                return self.json_response({"error": "Forbidden"}, 403)
            rel = os.path.join(*parts) if parts else "index.html"
        full = os.path.normpath(os.path.join(WEB_ROOT, rel))
        if full != WEB_ROOT and not full.startswith(WEB_ROOT + os.sep):
            return self.json_response({"error": "Forbidden"}, 403)
        if not os.path.isfile(full):
            return self.json_response({"error": "Not found"}, 404)
        ext = os.path.splitext(full)[1].lower()
        ctype = CONTENT_TYPES.get(ext, "application/octet-stream")
        with open(full, "rb") as f:
            data = f.read()
        self._send_headers(200, ctype, len(data))
        self.wfile.write(data)

    def handle_chat(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return self.json_response({"error": "Missing request body"}, 400)
        raw = self.rfile.read(length)
        try:
            body = json.loads(raw)
        except Exception:
            return self.json_response({"error": "Invalid JSON body"}, 400)
        status, payload = process_chat(body, self.headers.get)
        self.json_response(payload, status)

    def handle_config(self):
        env_keys = {}
        for name, conf in PROVIDERS.items():
            env_keys[name] = bool(os.environ.get(conf["env"]))
        self.json_response(
            {
                "providers": list(PROVIDERS.keys()),
                "envKeys": env_keys,
                "ollama": {
                    "available": bool(pick_ollama_model()),
                    "model": pick_ollama_model(),
                },
            }
        )

    def do_OPTIONS(self):
        self._send_headers(204, "text/plain", 0, {
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, x-provider, anthropic-version",
            "Access-Control-Max-Age": "86400",
        })

    def do_GET(self):
        parsed = urlsplit(self.path)
        path = parsed.path
        if path == "/api/health":
            return self.json_response({"status": "ok"})
        if path == "/api/config":
            return self.handle_config()
        if path == "/api/characters":
            return self.serve_json_file(CHARACTERS_FILE)
        if path == "/api/movies":
            return self.serve_json_file(MOVIES_FILE)
        if path == "/api/family-trees":
            return self.serve_json_file(FAMILY_TREES_FILE)
        self.serve_static(path)

    def do_POST(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/api/chat":
            return self.handle_chat()
        self.json_response({"error": "Not found"}, 404)


def main():
    load_dotenv(DOTENV_FILE)
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    try:
        port = int(os.environ.get("PORT") or 8000)
    except ValueError:
        port = 8000
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--port":
            i += 1
            if i < len(args):
                try:
                    port = int(args[i])
                except ValueError:
                    print(f"Invalid port value: {args[i]}")
                    sys.exit(1)
        i += 1
    httpd = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    httpd.daemon_threads = True
    print(f"marvel-avengers backend listening on http://127.0.0.1:{port}")
    print(f"web root: {WEB_ROOT}")
    print(f"data dir: {DATA_DIR}")
    env_configured = [n for n, c in PROVIDERS.items() if os.environ.get(c["env"])]
    print("env API keys:", env_configured or "none")
    print("ollama model:", pick_ollama_model() or "not available")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
