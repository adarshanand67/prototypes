/**
 * Cloudflare Workers Edge Logic Proof-of-Concept
 * 
 * Static HTML is served from the /public directory by the Assets binding.
 * This Worker only handles dynamic API routes.
 * 
 * Routes:
 *   GET /api/info      → JSON with visitor country, UA, timestamp
 *   GET /experiment    → A/B test group assignment
 *   GET /message       → Simple hello message
 *   GET /random        → Random UUID
 */

export interface Env { }

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const ipCountry = request.headers.get('cf-ipcountry') || 'Local Dev (Unknown)';

		// ── 1. JSON Edge Info API ──────────────────────────────────────────────────
		if (url.pathname === '/api/info') {
			const data = {
				message: "Hello from the Cloudflare Edge!",
				timestamp: new Date().toISOString(),
				edgeProcessed: true,
				visitor: {
					country: ipCountry,
					userAgent: request.headers.get('user-agent') ?? 'Unknown',
					isBot: (request.headers.get('user-agent') ?? '').toLowerCase().includes('bot'),
				},
			};
			return Response.json(data, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'X-Edge-Processed': 'true',
				},
			});
		}

		// ── 2. A/B Testing Simulation ─────────────────────────────────────────────
		// Deterministic: uses the cf-ray ID to assign the user to a "split"
		if (url.pathname === '/experiment') {
			const rayId = request.headers.get('cf-ray') ?? 'anon';
			const group = rayId.charCodeAt(0) % 2 === 0 ? 'Group-A' : 'Group-B';
			return new Response(`You are in experiment: ${group}`, {
				headers: {
					'Content-Type': 'text/plain',
					'X-Experiment-Group': group,
					'Access-Control-Allow-Origin': '*',
				},
			});
		}

		// ── 3. Simple Utility Routes ──────────────────────────────────────────────
		if (url.pathname === '/message') {
			return new Response('Hello from the Cloudflare Edge!', {
				headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
			});
		}

		if (url.pathname === '/random') {
			return new Response(crypto.randomUUID(), {
				headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
			});
		}

		// ── 4. Fallback: let static assets binding handle everything else ─────────
		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
