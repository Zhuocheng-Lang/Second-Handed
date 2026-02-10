"""
HTTP 接口应用模块。

负责初始化 FastAPI 应用实例，配置中间件、生命周期管理和路由挂载。
"""

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.interfaces.http.routers.trade import router as trade_router
from server.interfaces.http.routers.chat import (
    router as chat_ws_router,
    http_router as chat_http_router,
)
from server.interfaces.http.routers.block import router as block_router
from server.infrastructure.config.logging import configure_logging
from server.infrastructure.config.settings import get_settings
from server.application.chat import service as chat_service
from server.application.chat.broker import NoopChatBroker
from server.infrastructure.messaging.redis_chat_broker import RedisChatBroker


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI 应用生命周期管理。

    在应用启动时初始化日志、配置消息代理并启动监听任务；
    在应用关闭时取消任务并关闭代理连接。
    """
    settings = get_settings()
    configure_logging(settings.log_level)

    broker = NoopChatBroker()
    listener_task = None

    if settings.chat_broker_enabled:
        try:
            broker = RedisChatBroker(settings.redis_url)
            await broker.connect()
        except Exception as e:
            import logging
            logger = logging.getLogger("server.app")
            logger.error(f"Failed to connect to Redis chat broker: {e}. Chat features will be disabled.")
            broker = NoopChatBroker()

    chat_service.set_broker(broker)
    
    if isinstance(broker, RedisChatBroker):
        listener_task = asyncio.create_task(chat_service.run_broker_listener())

    app.state.chat_broker = broker
    app.state.chat_listener_task = listener_task
    try:
        yield
    finally:
        if listener_task:
            listener_task.cancel()
            try:
                await listener_task
            except asyncio.CancelledError:
                pass
        await broker.close()


def create_app() -> FastAPI:
    """
    创建并配置 Web 应用程序实例。

    Returns:
        FastAPI: 已初始化的应用程序对象。
    """
    settings = get_settings()
    app = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # 添加 CORS 中间件，允许跨域请求
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_routes(app)

    return app


def register_routes(app: FastAPI) -> None:
    """
    注册系统路由。

    Args:
        app: FastAPI 应用程序实例。
    """
    app.include_router(trade_router)
    app.include_router(chat_ws_router)
    app.include_router(chat_http_router)
    app.include_router(block_router)
