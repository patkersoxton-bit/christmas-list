# 🎄 Christmas List

A small, anonymous gift registry hosted on GitHub Pages. Visitors can see the
list, click **I'll get this**, and the item is marked as taken for everyone.
No names are stored anywhere, not even for the list owner.

## Files

| File | What it is |
|---|---|
| `items.json` | **The gift list.** Edit this to add, change or remove items. |
| `config.js` | Page title, subtitle, and Supabase connection settings. |
| `styles.css` | All styling. The theme colors and fonts are CSS variables at the top. |
| `app.js` | Page logic (rendering, claiming, undo). |
| `supabase/schema.sql` | Database setup for shared claims. |

## Adding items

Each item in `items.json` looks like this:

```json
{
  "id": "wool-socks",
  "name": "Merino Wool Socks",
  "description": "Cushioned crew socks, size L.",
  "price": "$25",
  "category": "Clothing",
  "priority": "high",
  "links": [
    { "store": "Darn Tough", "url": "https://darntough.com/..." },
    { "store": "REI", "url": "https://www.rei.com/..." }
  ],
  "image": "https://.../photo.jpg"
}
```

- `id`: unique, lowercase letters, numbers and dashes only. **Don't change it
  after people start claiming**, because claims are tied to the id.
- `priority`: `"high"` shows a ★ Top pick badge. Anything else is normal.
- `links`: one or more exact purchase links. Each becomes a "Buy at …" button.
- `image`: optional. Leave it empty for a 🎁 placeholder.
- `"hidden": true`: optionally hide an item without deleting it.

## How claiming stays anonymous

- The database stores only `item_id` and `claimed_at`.
- When someone claims an item, their browser gets a random secret token. Only
  that browser can **Undo** the claim. Nobody else can.
- Visitors can't read the table directly. They can only call three narrow
  functions (`get_claimed_items`, `claim_item`, `unclaim_item`).

## Setup

### 1. Shared claims (Supabase): done

Claims are stored in the Supabase project **christmas-list**, already
connected in `config.js`. The key in that file is the *publishable* key,
which is meant to be public. With this schema it can only call the three
functions above. It cannot read or edit the table.

- To see or reset claims, open the Supabase dashboard, go to the
  christmas-list project, then **Table Editor → claims**, and delete a row
  to free that item up again.
- Free-tier projects pause after about a week without visits. If the site
  says it can't load which gifts are taken, restore the project from the
  dashboard.
- To rebuild from scratch, run `supabase/schema.sql` in the SQL Editor.

### 2. Publish with GitHub Pages

1. Merge into `main`.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, then select
   `main` and `/ (root)`.
3. The site will be live at `https://<username>.github.io/christmas-list/`.

### Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
