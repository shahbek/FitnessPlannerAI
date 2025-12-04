import { useMemo } from 'react';
import { Activity, Clock } from 'lucide-react';

interface BMRAndMetabolicAgeProps {
  plan: any;
  userProfile?: {
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    bodyFat?: number;
  };
}

/**
 * Calculate BMR using Katch-McArdle (if body fat available) or Mifflin-St Jeor
 */
function calculateBMR(
  weight: number,
  height: number,
  age: number,
  gender: string,
  bodyFat?: number
): {
  bmr: number;
  formula: string;
  source: string;
  method: 'katch-mcardle' | 'mifflin-st-jeor';
} {
  const hasBodyFat = typeof bodyFat === 'number' && bodyFat > 0 && bodyFat < 50;

  if (hasBodyFat) {
    // Katch-McArdle: More accurate when body fat is known
    // BMR = 370 + (21.6 × lean body mass in kg)
    const leanBodyMass = weight * (1 - bodyFat! / 100);
    const bmr = Math.round(370 + 21.6 * leanBodyMass);

    return {
      bmr,
      formula: `370 + (21.6 × ${leanBodyMass.toFixed(1)} kg LBM)`,
      source: 'Katch & McArdle (1996)',
      method: 'katch-mcardle',
    };
  } else {
    // Mifflin-St Jeor: Standard calculation
    const sex = gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'm' ? 'male' : 'female';
    const genderFactor = sex === 'male' ? 5 : -161;
    const bmr = Math.round(
      10 * weight + 6.25 * height - 5 * age + genderFactor
    );

    return {
      bmr,
      formula: `(10 × ${weight}) + (6.25 × ${height}) - (5 × ${age}) + ${genderFactor}`,
      source: 'Mifflin et al. (1990)',
      method: 'mifflin-st-jeor',
    };
  }
}

/**
 * Calculate expected BMR for a given age, gender, weight, and height
 */
function calculateExpectedBMRForAge(
  targetAge: number,
  weight: number,
  height: number,
  gender: string
): number {
  const sex = gender?.toLowerCase() === 'male' || gender?.toLowerCase() === 'm' ? 'male' : 'female';
  const genderFactor = sex === 'male' ? 5 : -161;
  return Math.round(10 * weight + 6.25 * height - 5 * targetAge + genderFactor);
}

/**
 * Estimate metabolic age by comparing actual BMR to age-normative BMR values
 * 
 * Metabolic age represents how your metabolism compares to others of different ages.
 * A lower metabolic age indicates a faster metabolism (more youthful).
 */
function calculateMetabolicAge(
  actualBMR: number,
  chronologicalAge: number,
  weight: number,
  height: number,
  gender: string
): {
  metabolicAge: number;
  difference: number;
  interpretation: string;
  status: 'youthful' | 'normal' | 'elevated';
} {
  // Calculate expected BMR for chronological age
  const expectedBMR = calculateExpectedBMRForAge(chronologicalAge, weight, height, gender);
  
  // Calculate BMR difference
  const bmrDifference = actualBMR - expectedBMR;
  const percentDifference = (bmrDifference / expectedBMR) * 100;

  // Estimate metabolic age by finding the age where expected BMR matches actual BMR
  // BMR decreases approximately 1-2% per decade after age 30
  // We'll use a linear approximation: BMR ≈ base - (age - 30) * 0.01 * base (for age > 30)
  
  let metabolicAge = chronologicalAge;
  
  if (Math.abs(percentDifference) > 2) {
    // If BMR is significantly different, estimate metabolic age
    // For every 1% difference, approximate 1 year difference in metabolic age
    // This is a simplified model - actual metabolic aging is more complex
    const ageAdjustment = percentDifference / 1.5; // 1.5% per year after 30 is a reasonable estimate
    metabolicAge = Math.round(chronologicalAge - ageAdjustment);
    
    // Clamp to reasonable range (15-80 years)
    metabolicAge = Math.max(15, Math.min(80, metabolicAge));
  }

  // Determine status and interpretation
  const ageDifference = chronologicalAge - metabolicAge;
  let status: 'youthful' | 'normal' | 'elevated';
  let interpretation: string;

  if (ageDifference > 5) {
    status = 'youthful';
    interpretation = `Your metabolism is ${ageDifference} years younger than your chronological age. Excellent metabolic health!`;
  } else if (ageDifference < -5) {
    status = 'elevated';
    interpretation = `Your metabolic age is ${Math.abs(ageDifference)} years older. Focus on strength training and muscle preservation.`;
  } else {
    status = 'normal';
    interpretation = `Your metabolic age aligns with your chronological age. Maintain your current fitness routine.`;
  }

  return {
    metabolicAge,
    difference: ageDifference,
    interpretation,
    status,
  };
}

export function BMRAndMetabolicAge({ plan, userProfile }: BMRAndMetabolicAgeProps) {
  // Get user data from plan or userProfile
  const planUserProfile = plan?.userProfile || userProfile;
  const weight = planUserProfile?.weight || userProfile?.weight || 0;
  const height = planUserProfile?.height || userProfile?.height || 0;
  const age = planUserProfile?.age || userProfile?.age || 0;
  const gender = planUserProfile?.gender || userProfile?.gender || 'male';
  const bodyFat = planUserProfile?.bodyFat || userProfile?.bodyFat;

  // Calculate BMR
  const bmrData = useMemo(() => {
    if (!weight || !height || !age) {
      return null;
    }
    return calculateBMR(weight, height, age, gender, bodyFat);
  }, [weight, height, age, gender, bodyFat]);

  // Calculate Metabolic Age
  const metabolicAgeData = useMemo(() => {
    if (!bmrData || !age) {
      return null;
    }
    return calculateMetabolicAge(bmrData.bmr, age, weight, height, gender);
  }, [bmrData, age, weight, height, gender]);

  if (!bmrData || !metabolicAgeData) {
    return null;
  }

  const { bmr, method } = bmrData;
  const { metabolicAge, difference } = metabolicAgeData;

  // Calculate estimated TDEE using experience level OR training days
  const experienceLevel = planUserProfile?.experienceLevel || userProfile?.experienceLevel || planUserProfile?.workoutLevel || '';
  const trainingDays = planUserProfile?.workoutDaysPerWeek || userProfile?.workoutDaysPerWeek || 3;
  
  // Determine activity factor based on experience level first, then fall back to training days
  let activityFactor = 1.55; // Default moderate
  const levelLower = experienceLevel?.toLowerCase() || '';
  
  if (levelLower === 'beginner' || levelLower === 'sedentary') {
    activityFactor = 1.375; // Light activity
  } else if (levelLower === 'intermediate' || levelLower === 'moderate') {
    activityFactor = 1.55; // Moderate activity
  } else if (levelLower === 'advanced' || levelLower === 'expert' || levelLower === 'active') {
    activityFactor = 1.725; // Active
  } else if (levelLower === 'athlete' || levelLower === 'very_active') {
    activityFactor = 1.9; // Very active
  } else {
    // Fallback to training days if no valid experience level
    if (trainingDays <= 2) activityFactor = 1.375;
    else if (trainingDays <= 3) activityFactor = 1.55;
    else if (trainingDays <= 5) activityFactor = 1.725;
    else activityFactor = 1.9;
  }
  
  const estimatedTDEE = Math.round(bmr * activityFactor);

  // Determine gradient colors based on method for BMR
  const bmrGradient = method === 'katch-mcardle' 
    ? 'from-indigo-400 via-purple-500 to-pink-600'
    : 'from-blue-400 via-cyan-500 to-teal-600';

  return (
    <>
      {/* BMR Card - Matching TDEE Style */}
      <div className="md:col-span-4 flex flex-col">
        <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bmrGradient} p-6 h-full flex flex-col ${method === 'katch-mcardle' ? 'shadow-[0_12px_48px_rgba(139,92,246,0.4),inset_0_3px_8px_rgba(0,0,0,0.15),inset_0_-3px_6px_rgba(255,255,255,0.6)] hover:shadow-[0_16px_56px_rgba(139,92,246,0.5)]' : 'shadow-[0_12px_48px_rgba(59,130,246,0.4),inset_0_3px_8px_rgba(0,0,0,0.15),inset_0_-3px_6px_rgba(255,255,255,0.6)] hover:shadow-[0_16px_56px_rgba(59,130,246,0.5)]'} transition-all duration-300`}>
          {/* Glass highlight */}
          <div className="absolute top-0 left-[10%] w-[70%] h-[60%] bg-gradient-to-br from-white/80 via-white/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-[10%] w-[50%] h-[50%] bg-gradient-to-tl from-black/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 text-center space-y-3 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-center gap-2">
              <Activity className="h-6 w-6 text-white drop-shadow-lg" />
              <span className="text-sm font-black text-white/90 uppercase tracking-widest drop-shadow-md">Basal Metabolic Rate</span>
            </div>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-6xl font-black text-white drop-shadow-2xl leading-none">
                {bmr}
              </span>
              <span className="text-2xl font-bold text-white/90 uppercase tracking-wide drop-shadow-lg">kcal</span>
            </div>
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide drop-shadow-md opacity-90">
              {method === 'katch-mcardle' ? 'Katch-McArdle Formula' : 'Mifflin-St Jeor Formula'}
            </div>
            
            {/* Additional Info Section */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="text-xs text-white/70 mb-2 uppercase tracking-wide">Estimated TDEE</div>
              <div className="text-2xl font-bold text-white drop-shadow-md">
                {estimatedTDEE} <span className="text-sm font-normal">kcal/day</span>
              </div>
              <div className="text-[10px] text-white/60 mt-2">
                BMR × {activityFactor.toFixed(2)} activity factor
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metabolic Age Card - Simplified */}
      <div className="md:col-span-4 flex flex-col">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-6 h-full flex flex-col shadow-[0_12px_48px_rgba(249,115,22,0.4),inset_0_3px_8px_rgba(0,0,0,0.15),inset_0_-3px_6px_rgba(255,255,255,0.6)] hover:shadow-[0_16px_56px_rgba(249,115,22,0.5)] transition-all duration-300">
          {/* Glass highlight */}
          <div className="absolute top-0 left-[10%] w-[70%] h-[60%] bg-gradient-to-br from-white/80 via-white/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 right-[10%] w-[50%] h-[50%] bg-gradient-to-tl from-black/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 text-center space-y-3 flex-1 flex flex-col justify-center">
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-6 w-6 text-white drop-shadow-lg" />
              <span className="text-sm font-black text-white/90 uppercase tracking-widest drop-shadow-md">Metabolic Age</span>
            </div>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-6xl font-black text-white drop-shadow-2xl leading-none">
                {metabolicAge}
              </span>
            </div>
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide drop-shadow-md opacity-90">
              {difference !== 0 ? (
                <span>
                  {difference > 0 ? '+' : ''}{difference} years vs. Chronological Age
                </span>
              ) : (
                <span>Matches Chronological Age</span>
              )}
            </div>
            
            {/* Additional Info Section */}
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="text-xs text-white/70 mb-2 uppercase tracking-wide">Chronological Age</div>
              <div className="text-2xl font-bold text-white drop-shadow-md">
                {age} <span className="text-sm font-normal">years</span>
              </div>
              {bodyFat && (
                <div className="text-[10px] text-white/60 mt-2">
                  Body Fat: {bodyFat.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

