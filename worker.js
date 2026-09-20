// Deploy to Cloudflare Workers (free tier).
// Set ANTHROPIC_API_KEY as a Worker secret:
//   wrangler secret put ANTHROPIC_API_KEY
// Or via the Cloudflare dashboard → Workers → Settings → Variables → Secret.

const ALLOWED_ORIGIN = 'https://giadaverprauskus.github.io';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

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
