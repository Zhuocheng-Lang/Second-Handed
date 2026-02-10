# Second-Handed

## Overview

Second-Handed is a WIP marketplace app with a TypeScript client and a FastAPI server.

## Client usage

### Install deps

```sh
pnpm install
```

### Build pages

```sh
pnpm build:client
```

This outputs static pages to `client/dist/`:

- `index.html`
- `publish/index.html`
- `trade/index.html`

### Serve built pages

Recommended: any static file server. For example:

```sh
python -m http.server 5500 --directory client/dist
```

Client pages assume the API is at `http://127.0.0.1:8000`.

## Server usage

### Install deps

Recommended (uv):

```sh
uv sync
```

Alternative (pip):

```sh
pip install -e .
```

### Run

```sh
uvicorn server.app:app --reload
```

Server runs on `http://127.0.0.1:8000` by default.

## Environment

Create a `.env` in the repo root:

```dotenv
ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
DB_HOST=127.0.0.1
DB_USER=secondhand
DB_PASSWORD=secondhand
DB_NAME=secondhand
DB_CHARSET=utf8mb4
DB_POOL_SIZE=10
CHAT_BROKER_ENABLED=false
REDIS_URL=redis://127.0.0.1:6379/0
LOG_LEVEL=INFO
```

Notes:

- `ALLOWED_ORIGINS` is a comma-separated list.
- Set `CHAT_BROKER_ENABLED=true` and `REDIS_URL` to enable Redis chat broker.

## Database setup (MySQL)

Use the schema at `server/infrastructure/db/schema.sql`.

Example with MySQL CLI:

```sh
mysql -u root -p -e "CREATE DATABASE secondhand CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'secondhand'@'%' IDENTIFIED BY 'secondhand';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON secondhand.* TO 'secondhand'@'%';"
mysql -u root -p secondhand < server/infrastructure/db/schema.sql
```

## Notes

- Client API base is hard-coded to `http://127.0.0.1:8000`.
- Redis is optional; when disabled, a no-op chat broker is used.
