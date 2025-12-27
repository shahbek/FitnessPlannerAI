// Vercel Serverless Function to proxy /api/auth/* requests to Convex
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Auth Proxy] Function invoked: ${req.method} ${req.url}`);

  // Log cookies for callback routes (critical for OAuth state validation)
  if (req.url?.includes('callback')) {
    console.log(`[Auth Proxy] Callback route - Cookies being sent:`, req.headers.cookie || 'NO COOKIES');
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    return res.status(200).end();
  }

  // Extract path from req.url
  // req.url format: "/api/auth/get-session?...path=get-session"
  let subPath = '';

  if (req.url) {
    // Parse the URL to separate path and query
    const urlParts = req.url.split('?');
    const pathPart = urlParts[0]; // "/api/auth/get-session"

    // Extract sub-path after /api/auth/
    const pathMatch = pathPart.match(/^\/?api\/auth\/(.+)$/);
    if (pathMatch) {
      subPath = pathMatch[1];
    } else {
      // Fallback for when the regex doesn't match but we know it's an auth route
      if (pathPart.includes('/api/auth/')) {
        subPath = pathPart.split('/api/auth/')[1];
      } else {
        // If we are at the root of the function but Vercel passed the full path
        subPath = pathPart.replace(/^\//, '');
      }
    }
  }

  // Build destination URL - preserves raw query string to avoid double-encoding issues
  const queryIndex = req.url ? req.url.indexOf('?') : -1;
  let queryString = queryIndex !== -1 ? req.url!.substring(queryIndex) : '';

  // Strip 'path' param if it was added by Vercel's legacy routing (rare but safe)
  if (queryString.includes('path=')) {
    const params = new URLSearchParams(queryString);
    params.delete('path');
    const newQuery = params.toString();
    queryString = newQuery ? `?${newQuery}` : '';
  }

  const finalUrl = `${CONVEX_AUTH_BASE}${subPath}${queryString}`;
  console.log(`[Auth Proxy] Sub-path: "${subPath}"`);
  console.log(`[Auth Proxy] ${req.method} -> ${finalUrl}`);

  try {
    // Prepare headers
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
    };

    console.log(`[Auth Proxy] Incoming Host: ${req.headers.host}`);
    console.log(`[Auth Proxy] All incoming headers:`, JSON.stringify(req.headers));

    // Forward important headers
    const headersToForward = ['content-type', 'accept', 'cookie', 'authorization', 'user-agent', 'origin', 'referer', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host'];
    for (const header of headersToForward) {
      if (req.headers[header]) {
        console.log(`[Auth Proxy] Forwarding header ${header}: ${header === 'cookie' ? 'REDACTED' : req.headers[header]}`);
        forwardHeaders[header] = Array.isArray(req.headers[header])
          ? req.headers[header]![0]
          : req.headers[header] as string;
      }
    }

    // Fallback: If Origin is missing but required for CSRF (POST requests), try to derive it from Referer or Host
    if (req.method !== 'GET' && req.method !== 'HEAD' && !forwardHeaders['origin']) {
      const fallbackOrigin = req.headers.referer ? new URL(req.headers.referer).origin : `https://${req.headers.host || 'www.supercomp.app'}`;
      console.log(`[Auth Proxy] Warning: Missing Origin header for ${req.method} request. Using fallback: ${fallbackOrigin}`);
      forwardHeaders['origin'] = fallbackOrigin;
    }

    // Prepare body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      console.log(`[Auth Proxy] Request body detected (type: ${typeof req.body})`);
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      console.log(`[Auth Proxy] Body snippet: ${body.substring(0, 100)}`);
      if (body && !forwardHeaders['content-type']) {
        forwardHeaders['content-type'] = 'application/json';
      }
    }

    // Forward request to Convex
    const response = await fetch(finalUrl, {
      method: req.method || 'GET',
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    // Forward response headers (CRITICAL: Handle Set-Cookie for OAuth state/session)
    const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie', 'cache-control']);
    response.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    // FORCE NO CACHE (Critical for Auth Flows)
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Handle Set-Cookie headers separately (critical for OAuth state and sessions)
    const cookies = response.headers.getSetCookie?.() || [];
    if (cookies.length > 0) {
      console.log(`[Auth Proxy] Found ${cookies.length} Set-Cookie headers from Convex`);
      cookies.forEach(cookie => {
        console.log(`[Auth Proxy] Setting cookie: ${cookie.split(';')[0]}...`);
        res.appendHeader('Set-Cookie', cookie);
      });
      if (req.url?.includes('callback')) {
        console.log(`[Auth Proxy] Callback - Set-Cookie headers forwarded:`, cookies.length);
      }
    } else {
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        console.log(`[Auth Proxy] Found fallback set-cookie header: ${setCookieHeader.split(';')[0]}...`);
        res.setHeader('Set-Cookie', setCookieHeader);
      }
    }

    // Handle redirects (critical for OAuth)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        console.log(`[Auth Proxy] Redirecting to: ${location} (preservng cookies via manual headers)`);
        res.setHeader('Location', location);
        return res.status(response.status).end();
      }
    }

    // Return response
    const responseText = await response.text();
    return res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[Auth Proxy] Error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
