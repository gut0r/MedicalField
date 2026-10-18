from starlette.requests import Request

from app.main import REFRESH_COOKIE_PATH, _refresh_cookie_name, _refresh_cookie_secure


def request(scheme: str = "http", forwarded_proto: str | None = None, client_name: str | None = None) -> Request:
    headers = []
    if forwarded_proto:
        headers.append((b"x-forwarded-proto", forwarded_proto.encode()))
    if client_name:
        headers.append((b"x-medicalfield-client", client_name.encode()))
    return Request({
        "type": "http",
        "method": "POST",
        "scheme": scheme,
        "path": "/auth/login",
        "headers": headers,
        "server": ("testserver", 80),
        "client": ("127.0.0.1", 1234),
        "query_string": b"",
    })


def test_refresh_cookie_uses_public_api_path():
    assert REFRESH_COOKIE_PATH == "/api/auth"


def test_refresh_cookie_follows_external_protocol():
    assert not _refresh_cookie_secure(request("http"))
    assert _refresh_cookie_secure(request("https"))
    assert _refresh_cookie_secure(request("http", "https"))
    assert not _refresh_cookie_secure(request("https", "http"))


def test_refresh_cookie_is_separated_by_client_application():
    assert _refresh_cookie_name(request(client_name="portal")) == "medicalfield_portal_refresh"
    assert _refresh_cookie_name(request(client_name="field")) == "medicalfield_field_refresh"
    assert _refresh_cookie_name(request()) == "medicalfield_refresh"
