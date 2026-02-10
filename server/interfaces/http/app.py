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
    settings = get_settings()
    configure_logging(settings.log_level)

    if settings.chat_broker_enabled:
        broker = RedisChatBroker(settings.redis_url)
    else:
        broker = NoopChatBroker()

    await broker.connect()
    chat_service.set_broker(broker)
    listener_task = asyncio.create_task(chat_service.run_broker_listener())

    app.state.chat_broker = broker
    app.state.chat_listener_task = listener_task
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        await broker.close()


def create_app() -> FastAPI:
    """
    创建并配置 Web 应用
    """
    settings = get_settings()
    app = FastAPI(
        title=settings.app_title,
        version=settings.app_version,
        lifespan=lifespan,
    )

    # 添加CORS中间件，确保在所有路由处理之前生效
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],  # 允许所有HTTP方法
        allow_headers=["*"],  # 允许所有HTTP头
    )

    register_routes(app)

    return app


def register_routes(app: FastAPI) -> None:
    """
    把 trade_api / chat_api 挂上去
    """
    app.include_router(trade_router)
    app.include_router(chat_ws_router)
    app.include_router(chat_http_router)
    app.include_router(block_router)
