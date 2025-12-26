import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_URL = 'https://clean-swordfish-102.convex.cloud/api/auth';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  const { path } = req.query;
  const pathString = Array.isArray(path) ? path.join('/') : path || '';
  
  // Build the destination URL with query string
  const queryString = req.url?.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const destinationUrl = `${CONVEX_AUTH_URL}/${pathString}${queryString}`;
  
  // Debug logging (remove in production if needed)
  console.log(`[Auth Proxy] ${req.method} ${req.url} -> ${destinationUrl}`);
  
  try {
    // Prepare headers for forwarding
    // CRITICAL: Match Vite's proxy behavior with changeOrigin: true
    const targetHost = new URL(CONVEX_AUTH_URL).host;
    const forwardHeaders: Record<string, string> = {};
    
    Object.entries(req.headers).forEach(([key, value]) => {
      const lowerKey = key.toLowerCase();
      // Skip headers that shouldn't be forwarded
      if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
        if (value) {
          forwardHeaders[key] = Array.isArray(value) ? value[0] : value;
        }
      }
    });
    
    // CRITICAL: Set Host header to match target (like Vite's changeOrigin: true)
    // This is essential for servers that validate the Host header
    forwardHeaders['host'] = targetHost;
    
    // Add X-Forwarded-* headers (like Vite proxy does)
    // These help the backend understand the original request
    const originalProtocol = req.headers['x-forwarded-proto'] || 'https';
    const originalHost = req.headers['x-forwarded-host'] || req.headers.host || 'www.supercomp.app';
    forwardHeaders['x-forwarded-proto'] = Array.isArray(originalProtocol) ? originalProtocol[0] : originalProtocol;
    forwardHeaders['x-forwarded-host'] = Array.isArray(originalHost) ? originalHost[0] : originalHost;
    if (req.headers['x-forwarded-for']) {
      forwardHeaders['x-forwarded-for'] = Array.isArray(req.headers['x-forwarded-for']) 
        ? req.headers['x-forwarded-for'][0] 
        : req.headers['x-forwarded-for'];
    }
    
    // Ensure cookies are forwarded (critical for auth sessions)
    if (req.headers.cookie) {
      forwardHeaders['cookie'] = Array.isArray(req.headers.cookie) 
        ? req.headers.cookie.join('; ') 
        : req.headers.cookie;
    }

    // Prepare body
    let body: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      if (typeof req.body === 'string') {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    }

    // Forward the request to Convex
    const response = await fetch(destinationUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });

    // Forward response headers (except some that Vercel manages)
    // Exclude set-cookie since we handle it separately below
    const skipHeaders = ['connection', 'transfer-encoding', 'content-encoding', 'set-cookie'];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });
    
    // Ensure Set-Cookie headers are forwarded (critical for auth sessions)
    // CRITICAL: Vite proxy automatically handles cookie domain/path rewriting
    // We need to preserve all Set-Cookie headers and potentially adjust domain/path
    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      // Use getSetCookie() if available (Node 18+), otherwise fall back to get()
      setCookieHeaders.forEach((cookie) => {
        // Preserve the cookie as-is - Vercel will handle domain/path automatically
        res.appendHeader('Set-Cookie', cookie);
      });
    } else {
      // Fallback for environments without getSetCookie()
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        if (Array.isArray(setCookieHeader)) {
          setCookieHeader.forEach((cookie) => {
            res.appendHeader('Set-Cookie', cookie);
          });
        } else {
          res.setHeader('Set-Cookie', setCookieHeader);
        }
      }
    }

    // Handle redirects
    if (response.status === 302 || response.status === 301 || response.status === 307 || response.status === 308) {
      const location = response.headers.get('location');
      if (location) {
        return res.redirect(response.status, location);
      }
    }
    
    // Set status
    res.status(response.status);
    
    // Get response body
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const json = await response.json();
      return res.json(json);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    console.error('Error proxying auth request to Convex:', error);
    console.error('Destination URL:', destinationUrl);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
