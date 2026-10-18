from contextlib import contextmanager
from typing import Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import get_settings


_pool: ConnectionPool | None = None


def open_pool() -> None:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(get_settings().database_url, min_size=1, max_size=5, kwargs={"row_factory": dict_row})


def close_pool() -> None:
    global _pool
    if _pool:
        _pool.close()
        _pool = None


@contextmanager
def connection() -> Iterator[Connection]:
    if _pool is None:
        open_pool()
    assert _pool is not None
    with _pool.connection() as conn:
        yield conn

