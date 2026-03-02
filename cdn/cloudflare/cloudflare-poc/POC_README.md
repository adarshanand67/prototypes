# Cloudflare Worker PoC - Running Locally

Since you have `wrangler` installed, you can run this edge simulation on your own Mac without even having a Cloudflare account!

### 1. Navigate to the directory
```bash
cd /Users/adarsh_anand/.gemini/antigravity/scratch/prototypes/nosql_databases/cloudflare-poc
```

### 2. Start the Local Dev Server
```bash
npm run dev
```
*Wrangler will start a local server, usually at [http://localhost:8787](http://localhost:8787).*

### 3. Test the Edge Logic
- **Main Page**: Open [http://localhost:8787](http://localhost:8787) to see your detected "Edge" geography and group.
- **JSON API**: Visit [http://localhost:8787/api/info](http://localhost:8787/api/info).
- **A/B Test**: Visit [http://localhost:8787/experiment](http://localhost:8787/experiment).

### What is this demonstrating?
1. **Low Latency**: The code is "closer" to the user, not buried in a central server.
2. **Context Awareness**: The worker knows the user's location and device type immediately.
3. **Dynamic Routing**: You can modify the request or response on the fly without touching your main backend.
