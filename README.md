# SOLISTCENIK

Simple menu site with inline on-page CMS.

## Run

```bash
node server.js
```

Then open `http://localhost:3000`.

## Why this now updates for everyone

When admin edits content, the site now sends updates to server API endpoints (`PUT /api/menu/:lang`) that overwrite `menu_<lang>.json` files on disk.
Everyone who opens the site reads the same files via `GET /api/menu/:lang`, so they see the same updated menu.

## Admin login

Default server credentials:
- username: `Oli`
- password: `izvOli123`

You can override these with environment variables:
- `ADMIN_USER`
- `ADMIN_PASS`
