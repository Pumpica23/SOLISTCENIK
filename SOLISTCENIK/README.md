# SOLISTCENIK

Server-backed digital menu with real-time updates.

## Run

```bash
node server.js
```

Then open `http://localhost:3000`.

## CMS behavior

- Admin edits are local while editing.
- Pressing **Logout** publishes all pending changes to the server.
- All connected viewers receive updates instantly via server-sent events.
