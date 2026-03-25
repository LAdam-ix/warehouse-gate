# Getting Started with Warehouse Gate

A quick guide to get up and running. Not full documentation — just the things that trip people up at the start.

---

## First-time setup order

### 1. Set up your firm basics (Settings)
Go to **Settings** first and configure:
- **Warehouse mode** — controls what happens when you try to delete products/variants with stock or movement history
  - `strict` — blocks deletion if stock exists OR if there's any movement history
  - `soft` — only blocks if stock is still present
  - `disabled` — no restrictions
- **Low stock threshold** — global default for when a variant shows as "low stock" (can be overridden per product/variant)
- **Locations** — add all your physical storage locations (shelves, rooms, warehouses) before adding stock

### 2. Add your locations
Go to **Settings → Locations** and add every place you store things.
You can always add more later, but stock transfers between locations require at least 2 locations to exist.

### 3. Add products and variants
Go to **Catalog** and create your products:
- Set the item type: **Physical** (has stock) or **Service** (no stock, just appears in sales)
- For products with variations (sizes, colors, etc.) — go to the **Variants** tab and add attributes first (e.g. "Size" → S, M, L), then hit **Generate combinations**
- The default single variant gets auto-removed when you generate combinations
- Add photos, base price, and production cost if relevant

### 4. Populate initial stock
Once products and variants exist, go to **Stock → Add Stock**.
This is the bulk receiving screen — find a product, expand it, and use the quick `+1 / +5 / +10` buttons or type a custom amount. Select the destination location and confirm.

You can also add stock from the **Variants tab** of a product detail page using the `+` button on each row — better for adding to a single specific variant.

### 5. Start using it
- **Sales** — create a sale, add lines (products/services), finalize when done. Stock is deducted on finalization.
- **Production** — request production of a variant, fulfill it when ready (stock gets added automatically).
- **Stock → Transfer** — move stock between locations.
- **Dashboard** — overview of stock value, recent sales, low stock alerts.

---

## Tips

- **Service products** don't affect stock at all — they just appear as line items in sales. Use them for labor, delivery, etc.
- **Hourly services** pre-fill the unit price with the hourly rate when added to a sale — just enter the hours.
- **Primary photo** — the one with the amber frame. Click another photo to make it primary.
- **Low stock warnings** show up on the dashboard and in the catalog. Set thresholds per product or globally in settings.
- **Archiving vs deleting** — archive a variant to hide it without losing history. Delete only works on variants with no stock (depending on warehouse mode).
- **Transfers** only show locations that actually have stock in the "from" dropdown — you can still transfer to any active location.

---

## Deploying updates

On the server:
```bash
cd warehouse
git pull
docker compose up -d --build
```

Your database and uploaded photos live in `data/` and are never touched by git or Docker builds.
