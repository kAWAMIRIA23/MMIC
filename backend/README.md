# MMIC Backend

FastAPI backend for the Sentinel Risk Ops fraud and credit operations dashboard.

## Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager

## Setup

```bash
cd backend
uv venv
uv sync --extra dev
```

Copy environment variables if needed:

```bash
cp .env.example .env
```

## Run

```bash
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or use values from `.env`:

```bash
uv run uvicorn app.main:app --reload --host $env:HOST --port $env:PORT   # PowerShell
```

## Smoke test

- Root: [http://localhost:8000/](http://localhost:8000/)
- Health: [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)
- Docs: [http://localhost:8000/docs](http://localhost:8000/docs) (when `DEBUG=true`)

Expected health response:

```json
{
  "status": "ok",
  "service": "Sentinel Risk Ops API",
  "environment": "development"
}
```

## Environment variables

See [.env.example](.env.example) for all supported variables.

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_NAME` | `Sentinel Risk Ops API` | Service label |
| `APP_ENV` | `development` | `development` / `staging` / `production` |
| `DEBUG` | `true` | Toggle OpenAPI docs |
| `API_V1_PREFIX` | `/api/v1` | Versioned route prefix |
| `HOST` | `0.0.0.0` | Uvicorn bind address |
| `PORT` | `8000` | Uvicorn port |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `DATABASE_URL` | _(empty)_ | Placeholder for Day 2+ |
| `LOG_LEVEL` | `INFO` | Logging baseline |
