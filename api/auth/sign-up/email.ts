// Route for POST /api/auth/sign-up/email
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Auth Proxy SignUp] Function invoked: ${req.method} ${req.url}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const destinationUrl = `${CONVEX_AUTH_BASE}sign-up/email`;
  console.log(`[Auth Proxy SignUp] POST -> ${destinationUrl}`);

  try {
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
    };
    
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

    const response = await fetch(destinationUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    // Forward response headers (including Set-Cookie)
    const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length']);
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.has(lowerKey)) {
        if (lowerKey === 'set-cookie') {
          const cookies = response.headers.getSetCookie?.() || [];
          if (cookies.length > 0) {
            cookies.forEach(cookie => res.appendHeader('Set-Cookie', cookie));
          } else {
            res.setHeader(key, value);
          }
        } else {
          res.setHeader(key, value);
        }
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
    console.error('[Auth Proxy SignUp] Error:', error);
    return res.status(500).json({ 
      error: 'Proxy error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
