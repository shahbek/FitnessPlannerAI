// Test: Specific route for POST /api/auth/sign-in/social
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Auth Proxy Social] Function invoked: ${req.method} ${req.url}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const destinationUrl = `${CONVEX_AUTH_BASE}sign-in/social`;
  console.log(`[Auth Proxy Social] POST -> ${destinationUrl}`);
  console.log(`[Auth Proxy Social] Request body:`, JSON.stringify(req.body));

  try {
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
    };
    
    // Forward content-type if present, otherwise set to application/json
    if (req.headers['content-type']) {
      forwardHeaders['content-type'] = Array.isArray(req.headers['content-type']) 
        ? req.headers['content-type'][0] 
        : req.headers['content-type'];
    } else {
      forwardHeaders['content-type'] = 'application/json';
    }
    
    if (req.headers.cookie) {
      forwardHeaders['cookie'] = Array.isArray(req.headers.cookie) 
        ? req.headers.cookie.join('; ') 
        : req.headers.cookie;
    }

    const body = req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined;
    console.log(`[Auth Proxy Social] Forwarding body:`, body?.substring(0, 200));

    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    console.log(`[Auth Proxy Social] Response status: ${response.status}`);
    console.log(`[Auth Proxy Social] Response headers:`, Object.fromEntries(response.headers.entries()));

    // Forward response headers
    const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length']);
    response.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Handle redirects (Better Auth returns redirect for OAuth)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      console.log(`[Auth Proxy Social] Redirect location: ${location}`);
      if (location) {
        return res.redirect(response.status, location);
      }
    }

    // Check if response is JSON with a URL (some auth libraries do this)
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const responseText = await response.text();
      console.log(`[Auth Proxy Social] JSON response: ${responseText}`);
      try {
        const json = JSON.parse(responseText);
        // If Better Auth returns JSON with a URL, redirect to it
        if (json.url && typeof json.url === 'string') {
          console.log(`[Auth Proxy Social] Found URL in JSON, redirecting to: ${json.url}`);
          return res.redirect(302, json.url);
        }
      } catch (e) {
        // Not JSON, continue
      }
    }

    const responseText = await response.text();
    console.log(`[Auth Proxy Social] Response body: ${responseText.substring(0, 200)}`);
    return res.status(response.status).send(responseText);
    
  } catch (error) {
    console.error('[Auth Proxy Social] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
