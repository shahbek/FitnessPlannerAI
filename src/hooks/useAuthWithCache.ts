import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';

const AUTH_CACHE_KEY = 'fitness_planner_user_cache';
const CACHE_VALIDITY_DURATION = 1000 * 60 * 60 * 24; // 24 hours (increased to reduce logins)

export function useAuthWithCache() {
    // 1. Initialize from local storage if available
    const [cachedUser, setCachedUser] = useState<any | null>(() => {
        try {
            const item = localStorage.getItem(AUTH_CACHE_KEY);
            if (item) {
                const parsed = JSON.parse(item);
                // Optional: Check if cache is expired
                if (Date.now() - parsed.timestamp < CACHE_VALIDITY_DURATION) {
                    return parsed.user;
                }
            }
        } catch (e) {
            console.error('Failed to parse auth cache', e);
        }
        return null;
    });

    // 2. Fetch fresh data from Convex
    const freshUser = useQuery(api.users.getCurrentUser);
    const isConvexLoaded = freshUser !== undefined;

    // 3. Get Auth Session from Better Auth (Source of Truth for "Am I logged in?")
    const { data: sessionData, isPending: isSessionPending } = useSession();

    // 4. Update cache when fresh data arrives AND is valid
    useEffect(() => {
        // Only update cache if Convex provides a user
        if (freshUser) {
            if (JSON.stringify(freshUser) !== JSON.stringify(cachedUser)) {
                console.log('🔄 Updating auth cache with fresh user', freshUser);
                setCachedUser(freshUser);
                try {
                    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                        user: freshUser,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.error('Failed to save to auth cache', e);
                }
            }
        } else if (freshUser === null && !isSessionPending && !sessionData) {
            // Only clear cache if Convex says null AND Auth Client confirms no session
            // Otherwise we might be in the race condition window
            if (cachedUser) {
                console.log('👋 User logged out, clearing cache');
                setCachedUser(null);
                localStorage.removeItem(AUTH_CACHE_KEY);
            }
        }
    }, [freshUser, cachedUser, isSessionPending, sessionData]);

    // 5. Track if we've completed the initial check
    const [hasInitialCheckDone, setHasInitialCheckDone] = useState(false);

    useEffect(() => {
        if (!isSessionPending && (sessionData !== undefined)) {
            setHasInitialCheckDone(true);
        }
    }, [isSessionPending, sessionData]);

    // 6. Determine Effective User (The "Anti-Flicker" Logic)
    // We want to return a user if we have ONE, even if Convex is momentarily null.

    let effectiveUser = cachedUser;
    let isLoading = true;

    if (isConvexLoaded) {
        if (freshUser !== null) {
            // Best case: Convex returns a user. Trust it.
            effectiveUser = freshUser;
            isLoading = false;
        } else {
            // Edge Case: Convex returned NULL.
            // CHECK: Is it a real logout, or a race condition?

            const isRealLogout = !isSessionPending && !sessionData;

            if (isRealLogout) {
                // Confirmed logout.
                effectiveUser = null;
                isLoading = false;
            } else {
                // If we have already done the initial check and determined we are logged out,
                // ignore subsequent "pending" states (e.g. window focus revalidation)
                // UNLESS we actually have data now.
                if (hasInitialCheckDone && !sessionData && !cachedUser) {
                    effectiveUser = null;
                    isLoading = false;
                } else {
                    // Race condition: Better Auth says "maybe" (pending or has data),
                    // but Convex auth token hasn't propagated yet.
                    // ACTION: Keep showing cached user (or loading if no cache).
                    // Do NOT return null (which triggers Landing Page).
                    console.log('⏳ Auth Race Condition: Convex=null, but Session exists/pending. Holding state.');
                    effectiveUser = cachedUser; // If null, this stays null, but we set isLoading=true below

                    // If we don't have a cached user, we must show loading, NOT landing page
                    if (!cachedUser) {
                        isLoading = true;
                    } else {
                        isLoading = false; // Show cached dashboard while waiting
                    }
                }
            }
        }
    } else {
        // Convex not loaded yet.
        if (cachedUser) {
            effectiveUser = cachedUser;
            isLoading = false; // Show cached dashboard
        } else {
            // If we've already checked initially and know we're logged out, don't show loading
            // This covers the case where Convex is loading but Auth Client knows we're anon
            if (hasInitialCheckDone && !sessionData) {
                isLoading = false;
            } else {
                isLoading = true; // Show spinner
            }
        }
    }

    return {
        user: effectiveUser,
        isLoading: isLoading,
        isFresh: isConvexLoaded && (freshUser === effectiveUser)
    };
}
