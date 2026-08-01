import json
import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import server

server.load_dotenv(server.DOTENV_FILE)

STATUS_TEXT = {
    200: "200 OK",
    400: "400 Bad Request",
    404: "404 Not Found",
    500: "500 Internal Server Error",
    502: "502 Bad Gateway",
    503: "503 Service Unavailable",
}


def _respond(start_response, status_code, payload, ctype="application/json; charset=utf-8"):
    data = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
    start_response(
        STATUS_TEXT.get(status_code, "200 OK"),
        [("Content-Type", ctype), ("Content-Length", str(len(data)))],
    )
    return [data]


def _serve_json_file(start_response, path):
    data = server.read_json_cached(path)
    if data is None:
        return _respond(start_response, 500, {"error": "Data file not available"})
    return _respond(start_response, 200, data)


def application(environ, start_response):
    path = environ.get("PATH_INFO", "") or "/"
    method = environ.get("REQUEST_METHOD", "GET")

    if path == "/api/health":
        return _respond(start_response, 200, {"status": "ok"})

    if path == "/api/config":
        env_keys = {n: bool(os.environ.get(c["env"])) for n, c in server.PROVIDERS.items()}
        return _respond(
            start_response,
            200,
            {
                "providers": list(server.PROVIDERS.keys()),
                "envKeys": env_keys,
                "ollama": {"available": False, "model": None},
            },
        )

    if path == "/api/characters":
        return _serve_json_file(start_response, server.CHARACTERS_FILE)

    if path == "/api/movies":
        return _serve_json_file(start_response, server.MOVIES_FILE)

    if path == "/api/family-trees":
        return _serve_json_file(start_response, server.FAMILY_TREES_FILE)

    if path == "/api/chat" and method == "POST":
        try:
            length = int(environ.get("CONTENT_LENGTH") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return _respond(start_response, 400, {"error": "Missing request body"})
        raw = environ["wsgi.input"].read(length)
        try:
            body = json.loads(raw)
        except Exception:
            return _respond(start_response, 400, {"error": "Invalid JSON body"})

        def get_header(name):
            return environ.get("HTTP_" + name.upper().replace("-", "_")) or ""

        status, payload = server.process_chat(body, get_header)
        return _respond(start_response, status, payload)

    return _respond(start_response, 404, {"error": "Not found"})


app = application
