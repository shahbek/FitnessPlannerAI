// Vercel Edge Function to proxy auth requests to Convex
// This runs at the edge and properly forwards all requests

export const config = {
  runtime: 'edge',
};

const CONVEX_AUTH_URL = 'https://clean-swordfish-102.convex.cloud/api/auth';

export default async function handler(request: Request) {
  const url = new URL(request.url);
  
  // Extract the path after /api/auth/
  const pathMatch = url.pathname.match(/^\/api\/auth\/(.*)$/);
  const subPath = pathMatch ? pathMatch[1] : '';
  
  // Build destination URL
  const destinationUrl = `${CONVEX_AUTH_URL}/${subPath}${url.search}`;
  
  console.log(`[Edge Auth Proxy] ${request.method} ${url.pathname} -> ${destinationUrl}`);

  // Clone headers and set host to target (like Vite's changeOrigin: true)
  const headers = new Headers(request.headers);
  headers.set('host', 'clean-swordfish-102.convex.cloud');
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');

  try {
    // Forward the request to Convex
    const response = await fetch(destinationUrl, {
      method: request.method,
      headers,
      body: request.body,
      // @ts-ignore - duplex needed for streaming
      duplex: 'half',
      redirect: 'manual', // Don't auto-follow redirects
    });

    // Create response headers (preserve all, especially Set-Cookie)
    const responseHeaders = new Headers(response.headers);

    // Return the proxied response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[Edge Auth Proxy] Error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
