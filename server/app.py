# app.py

from server.interfaces.http.app import create_app

app = create_app()  # Need Explain: Is it necessary to seperate this from main func?  


def main():
    import uvicorn

    uvicorn.run(app, host="localhost", port=8000, reload=True)


if __name__ == "__main__":
    main()


# uvicorn server.app:app --reload
# python -m http.server 5500
