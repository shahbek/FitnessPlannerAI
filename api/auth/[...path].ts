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
  
  try {
    // Prepare headers for forwarding
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
    const skipHeaders = ['connection', 'transfer-encoding', 'content-encoding'];
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!skipHeaders.includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

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
