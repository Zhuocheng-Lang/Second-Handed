# db/mysql.py - 添加连接池

# 与mysql主连接

import pymysql
import pymysql.cursors
from contextlib import contextmanager
from threading import Lock
from queue import Queue
from collections.abc import Generator
from typing import cast

from server.infrastructure.config.settings import get_settings

# 连接池
connection_pool = None
pool_lock = Lock()


class ConnectionPool:
    def __init__(self, config: dict, max_connections=10):
        self.max_connections = max_connections
        self.config = config
        self.pool = Queue(max_connections)
        self.current_connections = 0

    def get_connection(self):
        with pool_lock:
            if not self.pool.empty():
                return self.pool.get()
            elif self.current_connections < self.max_connections:
                self.current_connections += 1
                return self._create_connection()
            else:
                raise Exception("Connection pool exhausted")

    def return_connection(self, conn):
        with pool_lock:
            self.pool.put(conn)

    def _create_connection(self):
        return pymysql.connect(**self.config)  # type: ignore


def init_connection_pool(max_connections=10):
    global connection_pool
    settings = get_settings()
    config = {
        "host": settings.db_host,
        "user": settings.db_user,
        "password": settings.db_password,
        "database": settings.db_name,
        "charset": settings.db_charset,
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": False,
    }
    connection_pool = ConnectionPool(config, max_connections)


def get_connection():
    """
    获取数据库连接（从连接池）
    """
    if connection_pool is None:
        # 初始化连接池
        settings = get_settings()
        init_connection_pool(settings.db_pool_size)

    assert connection_pool is not None
    return connection_pool.get_connection()


def close_connection(conn):
    """
    关闭数据库连接（放回连接池）
    """
    if connection_pool and conn:
        connection_pool.return_connection(conn)


@contextmanager
def get_cursor() -> Generator[pymysql.cursors.DictCursor, None, None]:
    """
    提供 cursor 的上下文管理器
    自动处理 commit / rollback 和连接管理
    """
    conn = get_connection()
    cursor: pymysql.cursors.DictCursor | None = None
    try:
        cursor = cast(pymysql.cursors.DictCursor, conn.cursor())
        yield cursor
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        if cursor:
            cursor.close()
        close_connection(conn)
