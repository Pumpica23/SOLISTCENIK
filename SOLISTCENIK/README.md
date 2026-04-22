# SOLISTCENIK

Server-backed digital menu with real-time updates.

## Netlify deployment

This project uses a Netlify Function and Netlify Blobs for the deployed CMS save/load API.

Netlify should build from the repository root. No build command is required. The publish directory can stay as the repository root, or be left empty if your current Netlify site already deploys the root files.

The menu API is available at `/api/menu/:lang` through `netlify.toml`, which rewrites requests to `netlify/functions/menu.js`.

On first deploy, the function reads the checked-in `menu_slo.json`, `menu_eng.json`, `menu_ita.json`, and `menu_de.json` files. After a CMS save, it stores the updated menu in Netlify Blobs and future page refreshes read from Blob storage.

## Run

```bash
node server.js
```

Then open `http://localhost:3000`.

## CMS behavior

- Admin edits are local while editing.
- Pressing **Logout** publishes all pending changes to the server.
- On Netlify, viewers with the page open refresh menu data from the API every 30 seconds while the tab is visible.
- Refreshing the page always loads the latest menu saved in Netlify Blobs.
