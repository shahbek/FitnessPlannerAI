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
    const pathMatch = pathPart.match(/^\/api\/auth\/(.+)$/);
    if (pathMatch) {
      subPath = pathMatch[1];
    }
  }

  // Build destination URL - construct it manually to avoid URL resolution issues
  const destinationUrl = `${CONVEX_AUTH_BASE}${subPath}`;

  // Parse and add query params from req.url (excluding 'path')
  const urlObj = new URL(destinationUrl);
  if (req.url && req.url.includes('?')) {
    const queryPart = req.url.split('?')[1];
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      params.delete('path'); // Remove Vercel's internal routing param
      // Add remaining params to destination URL
      params.forEach((value, key) => {
        urlObj.searchParams.set(key, value);
      });
    }
  }

  const finalUrl = urlObj.toString();
  console.log(`[Auth Proxy] ${req.method} /api/auth/${subPath || '(empty)'} -> ${finalUrl}`);

  try {
    // Prepare headers
    const forwardHeaders: Record<string, string> = {
      'host': 'clean-swordfish-102.convex.site',
      'x-forwarded-host': req.headers.host || 'www.supercomp.app',
      'x-forwarded-proto': 'https',
    };

    // Forward important headers
    const headersToForward = ['content-type', 'accept', 'cookie', 'authorization', 'user-agent', 'origin', 'referer'];
    console.log(`[Auth Proxy] Sub-path extracted: "${subPath}"`);
    for (const header of headersToForward) {
      if (req.headers[header]) {
        forwardHeaders[header] = Array.isArray(req.headers[header])
          ? req.headers[header]![0]
          : req.headers[header] as string;
      }
    }

    // Prepare body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
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
    const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie']);
    response.headers.forEach((value, key) => {
      if (!skipHeaders.has(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

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
