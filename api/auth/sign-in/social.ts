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

  try {
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
      'content-type': 'application/json',
    };
    
    if (req.headers.cookie) {
      forwardHeaders['cookie'] = Array.isArray(req.headers.cookie) 
        ? req.headers.cookie.join('; ') 
        : req.headers.cookie;
    }

    const body = req.body ? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body)) : undefined;

    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    response.headers.forEach((value, key) => {
      if (!['connection', 'transfer-encoding', 'content-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        return res.redirect(response.status, location);
      }
    }

    const responseText = await response.text();
    return res.status(response.status).send(responseText);
    
  } catch (error) {
    console.error('[Auth Proxy Social] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
