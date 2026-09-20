// Cloudflare Worker — Claude proxy + cross-device sync
//
// Secrets (Settings → Variables & Secrets → Secret):
//   ANTHROPIC_API_KEY   your sk-ant-… key
//
// KV binding (Settings → Bindings → KV Namespace):
//   Variable name: SYNC_DATA
//   Namespace:     create one called "ib-prep-sync" in KV → Namespaces
//
// After adding the binding, redeploy this Worker.

const ALLOWED_ORIGIN = 'https://giadaverprauskus.github.io';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    // ── Sync: save ────────────────────────────────────────────────────────────
    if (url.pathname === '/sync/save') {
      try {
        const { key, data } = await request.json();
        if (!key || typeof key !== 'string' || key.length < 10) {
          return new Response('Bad key', { status: 400, headers: CORS });
        }
        await env.SYNC_DATA.put('u:' + key, JSON.stringify(data), {
          expirationTtl: 365 * 24 * 3600,
        });
        return new Response('ok', { status: 200, headers: CORS });
      } catch (e) {
        return new Response('Error: ' + e.message, { status: 500, headers: CORS });
      }
    }

    // ── Sync: load ────────────────────────────────────────────────────────────
    if (url.pathname === '/sync/load') {
      try {
        const { key } = await request.json();
        if (!key || typeof key !== 'string') {
          return new Response('null', { status: 200, headers: { ...CORS, 'content-type': 'application/json' } });
        }
        const data = await env.SYNC_DATA.get('u:' + key);
        return new Response(data || 'null', {
          status: 200,
          headers: { ...CORS, 'content-type': 'application/json' },
        });
      } catch (e) {
        return new Response('null', { status: 200, headers: CORS });
      }
    }

    // ── Claude proxy (root POST) ───────────────────────────────────────────────
    let body;
    try { body = await request.text(); } catch { return new Response('Bad request', { status: 400 }); }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body,
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS, 'content-type': 'application/json' },
    });
  },
};
