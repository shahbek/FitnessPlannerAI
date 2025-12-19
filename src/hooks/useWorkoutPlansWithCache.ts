import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useEffect, useState, useRef, useMemo } from 'react';
import { dbRequest } from '@/utils/db'; // Import IndexedDB wrapper

const PLANS_CACHE_KEY = 'fitness_planner_workout_plans_cache';

// Helper to calculate a stable numeric ID from plan data
// (Same logic as in FitnessLayout to ensure consistency)
const calculatePlanId = (plan: any): number => {
    const hashString = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    };

    const convexIdString = plan._id.toString();
    const hashValue = hashString(convexIdString);
    const nameHash = hashString(plan.name || '');
    const createdAtSuffix = plan.createdAt % 1000000;

    // Ensure we return a safe integer
    return (hashValue * 1000000000 + nameHash * 1000 + createdAtSuffix) % Number.MAX_SAFE_INTEGER;
};

// Type definition for the transformed plan object used in the app
export interface WorkoutPlanDisplay {
    id: number;
    convexId?: any; // Made optional to support local optimistic plans
    title: string;
    createdAt: string;
    data?: any; // Made optional to match component state
}

export function useWorkoutPlansWithCache(localHistory: WorkoutPlanDisplay[], shouldFetch: boolean = true) {
    // 1. Initialize State
    const [cachedPlans, setCachedPlans] = useState<WorkoutPlanDisplay[]>([]);
    const [isCacheLoaded, setIsCacheLoaded] = useState(false); // Track if we've read from DB

    // 2. Load from IndexedDB on Mount
    useEffect(() => {
        const loadCache = async () => {
            try {
                const stored = await dbRequest.get(PLANS_CACHE_KEY);
                if (stored) {
                    console.log('📦 Loaded plans from IndexedDB cache:', stored.length);
                    setCachedPlans(stored);
                }
            } catch (e) {
                console.error('Failed to load plans from IndexedDB', e);
            } finally {
                setIsCacheLoaded(true);
            }
        };
        loadCache();
    }, []); // Run once on mount

    // 3. Fetch fresh data from Convex (Only if shouldFetch is true)
    const savedWorkoutPlans = useQuery(api.workoutPlans.getUserWorkoutPlans, shouldFetch ? {} : "skip");
    const isFreshDataLoaded = savedWorkoutPlans !== undefined;

    // 4. Process and Deduplicate Plans
    const processedPlans = useMemo(() => {
        // If we haven't loaded fresh data yet, return cached plans
        if (!isFreshDataLoaded) {
            return cachedPlans;
        }

        if (!savedWorkoutPlans) return [];

        console.log('📥 Processing fresh workout plans from Convex');

        // Convert Convex plans to App format
        const convertedPlans: WorkoutPlanDisplay[] = savedWorkoutPlans.map(plan => {
            let planData = plan.fullPlanData;

            if (planData) {
                if (!planData.hasOwnProperty('isActive')) {
                    planData = { ...planData, isActive: plan.isActive };
                }
                // ✅ Inject startDate from root document if available
                if (plan.startDate) {
                    planData = { ...planData, startDate: plan.startDate };
                }
            } else {
                // Fallback for legacy plans
                planData = {
                    weeklyOutlines: Array.isArray(plan.phases) ? plan.phases : [],
                    phaseAwareFramework: {
                        trainingApproach: {
                            split: plan.description?.includes('Full Body') ? 'Full Body' : 'Progressive',
                            periodization: plan.description || 'Progressive',
                        }
                    },
                    isActive: plan.isActive,
                    startDate: plan.startDate, // also inject here
                };
            }

            return {
                id: calculatePlanId(plan),
                convexId: plan._id,
                title: plan.name,
                createdAt: new Date(plan.createdAt).toISOString(),
                data: planData,
            };
        });

        return convertedPlans;
    }, [savedWorkoutPlans, isFreshDataLoaded, cachedPlans]);


    // 5. Update Cache (IndexedDB) when fresh data changes
    useEffect(() => {
        // Only update cache if we have fresh data AND we have already loaded the initial cache state
        // (To avoid overwriting existing cache with empty array if processing is delayed)
        if (isFreshDataLoaded && processedPlans.length > 0 && isCacheLoaded) {

            // Deep comparison via stringify is expensive but safe for now.
            // Could optimize by checking IDs + UpdatedAt timestamps if available.
            const currentCacheStr = JSON.stringify(cachedPlans);
            const newPlansStr = JSON.stringify(processedPlans);

            if (currentCacheStr !== newPlansStr) {
                console.log('💾 Updating workout plans cache (IndexedDB)');
                setCachedPlans(processedPlans);
                try {
                    // Async save to IndexedDB
                    dbRequest.set(PLANS_CACHE_KEY, processedPlans).catch(err => {
                        console.error('Failed to async save plans to IndexedDB', err);
                    });
                } catch (e) {
                    console.error('Failed to trigger save to IndexedDB', e);
                }
            }
        }
    }, [processedPlans, isFreshDataLoaded, cachedPlans, isCacheLoaded]);

    return {
        plans: processedPlans.length > 0 ? processedPlans : cachedPlans,
        isLoaded: isFreshDataLoaded || (isCacheLoaded && cachedPlans.length > 0),
        isFresh: isFreshDataLoaded
    };
}
