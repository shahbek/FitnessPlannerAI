import { ConvexReactClient } from 'convex/react';

if (!import.meta.env.VITE_CONVEX_URL) {
    throw new Error('VITE_CONVEX_URL environment variable is not set');
}

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);
