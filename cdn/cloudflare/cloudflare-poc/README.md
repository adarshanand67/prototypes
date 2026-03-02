# 🌤️ Cloudflare Worker Proof-of-Concept

A local simulation of Cloudflare's global edge network, demonstrating real-world edge computing patterns. Built with [Wrangler](https://developers.cloudflare.com/workers/wrangler/) and Cloudflare Workers.

---

## 📚 Documentation

| Document | What You'll Learn |
|---|---|
| **[CLOUDFLARE_THEORY.md](./CLOUDFLARE_THEORY.md)** | Complete theory — CDN mechanics, caching, Workers architecture, use cases |
| **[src/index.ts](./src/index.ts)** | The Worker code — all API routes with comments |
| **[public/index.html](./public/index.html)** | The interactive edge dashboard UI |

---

## 🚀 Running Locally

```bash
# Start the dev server
npm run dev
# → http://localhost:8787
```

---

## 🛣️ API Routes

| Route | Method | What it Does |
|---|---|---|
| `/` | GET | Interactive Edge Dashboard (static HTML) |
| `/api/info` | GET | JSON — visitor country, UA, edge timestamp |
| `/experiment` | GET | A/B group assignment (Group-A or Group-B) |
| `/message` | GET | Text hello from the edge |
| `/random` | GET | UUID generated at the edge |

### Example API Call

```bash
# Test the Edge Info endpoint
curl http://localhost:8787/api/info | fx

# Response:
{
  "message": "Hello from the Cloudflare Edge!",
  "timestamp": "2026-03-01T07:...",
  "edgeProcessed": true,
  "visitor": {
    "country": "Local Dev (Unknown)",
    "userAgent": "curl/8.x",
    "isBot": false
  }
}
```

---

## 🎯 What This Demonstrates

### 1. Edge Computing vs. Origin Computing
The Worker code in `src/index.ts` would run at **Cloudflare's 300+ global nodes** in production — not at your server. A user in Mumbai gets a response from a server 50km away, not 14,000km away.

### 2. A/B Testing at the Edge
The `/experiment` route deterministically assigns users to groups *without a database call*. This is zero-latency feature flagging.

### 3. Geo-IP context
The `cf-ipcountry` header is injected by Cloudflare's edge automatically. In production, your Worker knows the visitor's country before any user code runs — no IP lookup API needed.

---

## 🖥️ GUI Tools to Use Alongside This

| Tool | Purpose | How |
|---|---|---|
| **Hoppscotch** | Test API routes visually | Open app → `localhost:8787/api/info` |
| **Bruno** | Save API calls as files | Create collection → save `.bru` requests |
| **Postman** | Document & share Worker APIs | New request → your Worker URL |
| Browser DevTools | Inspect cache headers | Network tab → look for `CF-Cache-Status` |

---

## 📦 Next Steps (Production)

```bash
# 1. Login to Cloudflare
wrangler login

# 2. Deploy your Worker globally
wrangler deploy

# 3. Stream live logs from production
wrangler tail

# 4. Add a KV storage binding (for sessions/config)
wrangler kv:namespace create CACHE
```
