"""
服务器入口模块。

负责初始化 FastAPI 应用并启动 Uvicorn 服务器。
"""

from server.interfaces.http.app import create_app

app = create_app()


def main():
    """
    主函数，启动 Uvicorn 服务器。
    """
    import uvicorn

    uvicorn.run(app, host="localhost", port=8000, reload=True)


if __name__ == "__main__":
    main()


# uvicorn server.app:app --reload
# python -m http.server 5500
