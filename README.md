# Presence App

Minimal prototype of the "ここいる" concept. Users visiting the same URL share their presence as floating dots.

## Run
```
node server.js
```
Open `http://localhost:8080/` (or any custom path for a room like `/campus-2025`).

Pick a vibe color at the bottom. Dots of others will fade in. Status text hides exact numbers when fewer than three people are present.

The service worker caches assets so the last state can show a quiet waiting room while offline.
