// Specific route for OAuth callback: /api/auth/callback/google
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Auth Proxy Callback] Function invoked: ${req.method} ${req.url}`);
  
  // OAuth callbacks can be HEAD (preflight) or GET (actual redirect)
  const destinationUrl = `${CONVEX_AUTH_BASE}callback/google`;
  
  // Add query params from original request
  const urlObj = new URL(destinationUrl);
  if (req.url && req.url.includes('?')) {
    const queryPart = req.url.split('?')[1];
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      params.delete('path'); // Remove Vercel's internal routing param if present
      params.forEach((value, key) => {
        urlObj.searchParams.set(key, value);
      });
    }
  }
  
  const finalUrl = urlObj.toString();
  console.log(`[Auth Proxy Callback] ${req.method} -> ${finalUrl}`);

  try {
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
    };
    
    if (req.headers.cookie) {
      forwardHeaders['cookie'] = Array.isArray(req.headers.cookie) 
        ? req.headers.cookie.join('; ') 
        : req.headers.cookie;
    }

    // Forward request to Convex (HEAD requests don't have body)
    const response = await fetch(finalUrl, {
      method: req.method || 'GET',
      headers: forwardHeaders,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body 
        ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
        : undefined,
      redirect: 'manual',
    });

    // Forward response headers
    const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length']);
    response.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // Handle redirects (critical for OAuth)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        return res.redirect(response.status, location);
      }
    }

    // For HEAD requests, don't send body
    if (req.method === 'HEAD') {
      return res.status(response.status).end();
    }

    const responseText = await response.text();
    return res.status(response.status).send(responseText);
    
  } catch (error) {
    console.error('[Auth Proxy Callback] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
