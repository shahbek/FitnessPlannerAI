// Test handler for /api/auth/convex/token
import type { VercelRequest, VercelResponse } from '@vercel/node';

const CONVEX_AUTH_BASE = 'https://clean-swordfish-102.convex.site/api/auth/';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log(`[Convex Token] Function invoked: ${req.method} ${req.url}`);
    console.log(`[Convex Token] Cookies:`, req.headers.cookie || 'NO COOKIES');

    try {
        // Forward to Convex
        const destinationUrl = `${CONVEX_AUTH_BASE}convex/token`;
        console.log(`[Convex Token] Forwarding to: ${destinationUrl}`);

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

        // Forward request to Convex
        const response = await fetch(destinationUrl, {
            method: req.method || 'GET',
            headers: forwardHeaders,
            redirect: 'manual',
        });

        console.log(`[Convex Token] Convex response status: ${response.status}`);

        // Forward response headers
        const skipHeaders = new Set(['connection', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie']);
        response.headers.forEach((value, key) => {
            if (!skipHeaders.has(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        // Handle Set-Cookie headers separately
        const cookies = response.headers.getSetCookie?.() || [];
        if (cookies.length > 0) {
            cookies.forEach(cookie => {
                res.appendHeader('Set-Cookie', cookie);
            });
        } else {
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
                res.setHeader('Set-Cookie', setCookieHeader);
            }
        }

        // Return response
        const responseText = await response.text();
        return res.status(response.status).send(responseText);

    } catch (error) {
        console.error('[Convex Token] Error:', error);
        return res.status(500).json({
            error: 'Proxy error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
