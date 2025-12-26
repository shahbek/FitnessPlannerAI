// Vercel Serverless Function to proxy /api/auth/* requests to Convex
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log(`[Auth Proxy] Function invoked: ${req.method} ${req.url}`);
  
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
    const headersToForward = ['content-type', 'accept', 'cookie', 'authorization', 'user-agent'];
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
