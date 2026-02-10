"""
MySQL 数据库连接管理模块。

实现简单的数据库连接池，提供 cursor 上下文管理器以自动处理连接和事务。
"""

import pymysql
import pymysql.cursors
from contextlib import contextmanager
from threading import Lock
from queue import Queue
from collections.abc import Generator
from typing import cast

from server.infrastructure.config.settings import get_settings

# 连接池单例
connection_pool = None
pool_lock = Lock()


class ConnectionPool:
    """
    数据库连接池类。
    """

    def __init__(self, config: dict, max_connections=10):
        """
        初始化连接池。

        Args:
            config: 数据库配置字典。
            max_connections: 最大连接数，默认 10。
        """
        self.max_connections = max_connections
        self.config = config
        self.pool = Queue(max_connections)
        self.current_connections = 0

    def get_connection(self):
        """
        从连接池获取一个连接。

        Returns:
            pymysql.connections.Connection: 数据库连接对象。

        Raises:
            Exception: 当连接池耗尽且无法创建新连接时抛出。
        """
        with pool_lock:
            if not self.pool.empty():
                return self.pool.get()
            elif self.current_connections < self.max_connections:
                self.current_connections += 1
                return self._create_connection()
            else:
                raise Exception("Connection pool exhausted")

    def return_connection(self, conn):
        """
        将连接返回到池中。

        Args:
            conn: 数据库连接对象。
        """
        with pool_lock:
            self.pool.put(conn)

    def _create_connection(self):
        """
        创建一个新的数据库连接。
        """
        return pymysql.connect(**self.config)  # type: ignore


def init_connection_pool(max_connections=10):
    """
    初始化全局连接池。

    Args:
        max_connections: 最大连接数，默认 10。
    """
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
    获取数据库连接。

    如果连接池尚未初始化，则根据设置自动初始化。

    Returns:
        pymysql.connections.Connection: 数据库连接对象。
    """
    if connection_pool is None:
        # 初始化连接池
        settings = get_settings()
        init_connection_pool(settings.db_pool_size)

    assert connection_pool is not None
    return connection_pool.get_connection()


def close_connection(conn):
    """
    关闭数据库连接。

    实际上是将连接放回连接池。

    Args:
        conn: 数据库连接对象。
    """
    if connection_pool and conn:
        connection_pool.return_connection(conn)


@contextmanager
def get_cursor() -> Generator[pymysql.cursors.DictCursor, None, None]:
    """
    获取数据库游标的上下文管理器。

    自动管理连接的获取、游标的关闭以及事务的提交与回滚。

    Yields:
        pymysql.cursors.DictCursor: 数据库游标。

    Raises:
        Exception: 数据库操作过程中发生的任何异常，会被重新抛出（在回滚之后）。
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
