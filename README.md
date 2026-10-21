# Warehouse Gate

Inventory, sales, and production management system built for small businesses.

## What it does

- **Catalog** — products, variants (size/color/etc.), photos, pricing
- **Stock** — multi-location tracking, transfers, batch receiving, movement history
- **Sales** — order creation, line items, discounts, finalization with automatic stock deduction
- **Production** — queue management with priority levels, auto stock fulfillment
- **Dashboard** — stock value overview, recent activity, low stock alerts

## Tech stack

| Layer    | Stack                                      |
|----------|--------------------------------------------|
| Backend  | Django + Django REST Framework              |
| Frontend | React + TypeScript + Material UI           |
| POS      | Lightweight React terminal (separate build) |
| Deploy   | Docker Compose                             |

## Quick start

```bash
docker compose up -d --build
```

Frontend: `http://localhost:3000`
Backend API: `http://localhost:8000/api/`

See [GETTING_STARTED.md](GETTING_STARTED.md) for first-time setup (locations, products, stock).

## Deploying updates

```bash
git pull
docker compose up -d --build
```

Database and uploads live in `data/` — untouched by builds.
