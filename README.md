# 🎄 Christmas List

A small gift registry hosted on GitHub Pages. Visitors see the whole list,
click **I'll get this**, enter their name, and the item is greyed out as
claimed for everyone. Other visitors never see *who* claimed something. Only
the organizer page shows names.

## Files

| File | What it is |
|---|---|
| `items.json` | **The gift list.** Edit this to add, change or remove items. |
| `config.js` | Page title, subtitle, and Supabase connection settings. |
| `styles.css` | All styling. The theme colors and fonts are CSS variables at the top. |
| `app.js` | Page logic (rendering, claiming, undo). |
| `admin.html`, `admin.js`, `admin.css` | Passphrase-protected organizer page: who claimed what. |
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
- `image`: optional. Either a full image URL or a file in `images/` (e.g. `"images/wool-socks.webp"`). Leave it empty for a 🎁 placeholder.
- `"hidden": true`: optionally hide an item without deleting it.
- `emoji`: optional icon shown when there's no `image` (default 🎁).
- `links`: may be empty (`[]`) for "any brand" items. The card then says so.

## Who can see what

- **Visitors** see every item. Claimed ones are greyed out with a "Claimed"
  label, and names are never sent to their browser.
- **The claimer** sees "You're getting this" and can **Undo** from the same
  device. A random secret token, kept in their browser, proves it's their claim.
- **The organizer** opens `admin.html` (e.g.
  `https://<username>.github.io/christmas-list/admin.html`), enters the
  passphrase, and sees claims **by person** or **by gift**, with a
  **Release** button to put an item back on the list. The page isn't linked
  from the main list and asks search engines not to index it.
- The passphrase is never stored in this repo. Only its SHA-256 hash is kept,
  in the database. To change it, see the comment in `supabase/schema.sql`.

## Setup

### 1. Shared claims (Supabase): done

Claims are stored in the Supabase project **christmas-list**, already
connected in `config.js`. The key in that file is the *publishable* key,
which is meant to be public. With this schema it can only call the three
functions above. It cannot read or edit the table.

- To see or reset claims, use the organizer page (`admin.html`), or the
  Supabase dashboard: christmas-list project, then **Table Editor → claims**.
- Free-tier projects pause after about a week without visits. If the site
  says it can't load which gifts are taken, restore the project from the
  dashboard.
- To rebuild from scratch, run `supabase/schema.sql` in the SQL Editor.

### 2. Publish with GitHub Pages

1. Merge into `main`.
2. Go to **Settings → Pages**, choose **Deploy from a branch**, then select
   `main` and `/ (root)`.
3. The site will be live at `https://<username>.github.io/christmas-list/`.

### After changing CSS or JS

Bump the `?v=` number on the `<link>`/`<script>` tags in `index.html` and
`admin.html`, so visitors' browsers fetch the new files instead of cached copies.

### Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
