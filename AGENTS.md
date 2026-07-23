# Agent notes

This project deploys to Cloudflare Workers via `@cloudflare/vite-plugin` + Wrangler.
It is no longer connected to Lovable — force-pushing/rebasing published history is fine.

- `npm run dev` — local dev server
- `npm run build` — production build (client + Worker)
- `npm run deploy` — build and deploy to Cloudflare Workers
- `npm run cf-typegen` — regenerate Cloudflare binding types after editing `wrangler.jsonc`
