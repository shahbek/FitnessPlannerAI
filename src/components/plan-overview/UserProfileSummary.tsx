import { Badge } from '@/components/ui/badge';
import { User, Target, Dumbbell, Calendar, Activity, Heart, Zap } from 'lucide-react';
import { calculateBMI, getBMIClassification, getTDEE } from '@/utils/planCalculations';
import { GoalCategory, getGoalCategoryLabel } from '@/models/UserProfile';
import { kgToLbs, cmToInches, formatHeight } from '@/utils/unitConversion';

// BMI Gauge Component
interface BMIGaugeProps {
  bmi: number;
  classification: string | null;
}

function BMIGauge({ bmi, classification }: BMIGaugeProps) {
  // Gauge configuration
  const minBMI = 15;
  const maxBMI = 40;
  const radius = 80;
  const strokeWidth = 20;
  const centerX = 150;
  const centerY = 130;

  // Clamp BMI and calculate angle
  const clampedBMI = Math.min(Math.max(bmi, minBMI), maxBMI);
  const percentage = (clampedBMI - minBMI) / (maxBMI - minBMI);
  // Rotation: 0 (left) to 180 (right)
  const rotation = percentage * 180;

  // Helper to get coordinates on the arc
  const getCoords = (bmiValue: number, r: number) => {
    const val = Math.max(minBMI, Math.min(maxBMI, bmiValue));
    const pct = (val - minBMI) / (maxBMI - minBMI);
    // Convert to radians. 0% = PI (left), 100% = 0 (right)
    const rad = Math.PI * (1 - pct);
    return {
      x: centerX + r * Math.cos(rad),
      y: centerY - r * Math.sin(rad)
    };
  };

  // Define ranges
  const ranges = [
    { min: 15, max: 18.5, color: '#38bdf8' }, // Underweight
    { min: 18.5, max: 25, color: '#10b981' }, // Normal
    { min: 25, max: 30, color: '#f97316' },   // Overweight
    { min: 30, max: 40, color: '#ef4444' }    // Obese
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.05)] border border-slate-100">
      <div className="flex flex-col items-center space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">BMI Score</span>
        </div>

        {/* Gauge */}
        <div className="relative w-full max-w-[280px] aspect-[2/1.1]">
          <svg viewBox="0 0 300 150" className="w-full h-full overflow-visible">
            {/* Background Track */}
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Colored Segments */}
            {ranges.map((range, i) => {
              const start = getCoords(range.min, radius);
              const end = getCoords(range.max, radius);
              return (
                <path
                  key={i}
                  d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`}
                  fill="none"
                  stroke={range.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                />
              );
            })}

            {/* Ticks & Labels */}
            {[15, 18.5, 25, 30, 40].map((val) => {
              const outerTickStart = getCoords(val, radius + 12);
              const outerTickEnd = getCoords(val, radius + 18);
              const labelPos = getCoords(val, radius + 32);

              return (
                <g key={val}>
                  <line
                    x1={outerTickStart.x} y1={outerTickStart.y}
                    x2={outerTickEnd.x} y2={outerTickEnd.y}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[11px] font-semibold fill-slate-400"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Needle Group */}
            <g
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: `${centerX}px ${centerY}px`,
                transition: 'transform 1000ms cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Needle - Points Left (180 deg) by default, so 0 rotation = Left */}
              <path
                d={`M ${centerX} ${centerY} L ${centerX - radius + 10} ${centerY}`}
                stroke="#1e293b"
                strokeWidth="4"
                strokeLinecap="round"
                className="drop-shadow-sm"
              />
              {/* Center Hub */}
              <circle cx={centerX} cy={centerY} r="6" fill="#1e293b" />
              <circle cx={centerX} cy={centerY} r="2" fill="white" />
            </g>
          </svg>
        </div>

        {/* Value Display */}
        <div className="text-center -mt-4">
          <div className="text-3xl font-black text-slate-800 tracking-tight">
            {bmi.toFixed(1)}
          </div>
          {classification && (
            <div className={`mt-1 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${classification === 'Normal' ? 'bg-emerald-100 text-emerald-700' :
              classification === 'Overweight' ? 'bg-orange-100 text-orange-700' :
                classification === 'Obese' ? 'bg-red-100 text-red-700' :
                  'bg-sky-100 text-sky-700'
              }`}>
              {classification}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UserProfileSummaryProps {
  userProfile: {
    age?: number;
    gender?: string;
    height?: number;
    weight?: number;
    // New goal category system
    goalCategory?: GoalCategory;
    // Legacy field (deprecated)
    primaryGoal?: string;
    experienceLevel?: string;
    workoutLevel?: string; // Alternative field name
    workoutDaysPerWeek?: number;
    sessionDuration?: number;
    equipmentAccess?: string[];
    dietaryRestrictions?: string[];
    units?: string;
  };
  plan: {
    metrics?: {
      tdee?: { value: number };
      bmi?: { value: number };
    };
    // Plan may also have goalCategory at top level
    goalCategory?: GoalCategory;
  };
}

export function UserProfileSummary({ userProfile, plan }: UserProfileSummaryProps) {
  // Calculate BMI if not in plan
  const bmi = plan?.metrics?.bmi?.value ||
    (userProfile?.height && userProfile?.weight
      ? calculateBMI(userProfile.height, userProfile.weight)
      : null);

  const bmiClassification = bmi ? getBMIClassification(bmi) : null;

  const units = userProfile?.units || 'metric';

  // Use CENTRALIZED TDEE calculation for consistency across all components
  const maintenanceCalories = getTDEE(plan as any, userProfile as any);



  // Format goal for display - prioritizes goalCategory over legacy primaryGoal
  const formatGoal = () => {
    // Check for goalCategory first (new system)
    const goalCategory = userProfile?.goalCategory || (plan as any)?.goalCategory;
    if (goalCategory) {
      return getGoalCategoryLabel(goalCategory);
    }

    // Fall back to legacy primaryGoal
    const legacyGoal = userProfile?.primaryGoal;
    if (!legacyGoal) return '—';

    return legacyGoal
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Format experience level with proper labels
  const formatExperience = () => {
    const level = userProfile?.experienceLevel || userProfile?.workoutLevel;
    if (!level) return '—';

    // Map common values to proper labels
    const levelMap: Record<string, string> = {
      'beginner': 'Beginner (0-1 year)',
      'intermediate': 'Intermediate (1-4 years)',
      'advanced': 'Advanced (4-7 years)',
      'expert': 'Expert (7+ years)',
    };

    const lowerLevel = level.toLowerCase();
    return levelMap[lowerLevel] || level.charAt(0).toUpperCase() + level.slice(1);
  };

  return (
    <div className="h-full">
      {/* Header with gradient pill */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-blue-400 via-indigo-500 to-purple-600 shadow-[0_8px_24px_rgba(99,102,241,0.3),inset_0_2px_4px_rgba(255,255,255,0.5),inset_0_-2px_4px_rgba(0,0,0,0.2)]">
          <User className="h-4 w-4 text-white drop-shadow-md" />
          <span className="text-sm font-bold text-white uppercase tracking-wide drop-shadow-md">Your Profile</span>
        </div>
      </div>

      {/* TDEE Hero Card - Bold & Prominent */}
      {maintenanceCalories && (
        <div className="mb-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 p-6 shadow-[0_12px_48px_rgba(20,184,166,0.4),inset_0_3px_8px_rgba(0,0,0,0.15),inset_0_-3px_6px_rgba(255,255,255,0.6)] hover:shadow-[0_16px_56px_rgba(20,184,166,0.5)] transition-all duration-300">
            {/* Glass highlight */}
            <div className="absolute top-0 left-[10%] w-[70%] h-[60%] bg-gradient-to-br from-white/80 via-white/40 to-transparent rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 right-[10%] w-[50%] h-[50%] bg-gradient-to-tl from-black/15 to-transparent rounded-full blur-2xl pointer-events-none"></div>

            <div className="relative z-10 text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Heart className="h-6 w-6 text-white drop-shadow-lg" />
                <span className="text-sm font-black text-teal-50 uppercase tracking-widest drop-shadow-md">Daily Energy</span>
              </div>
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-6xl font-black text-white drop-shadow-2xl leading-none">
                  {maintenanceCalories}
                </span>
                <span className="text-2xl font-bold text-teal-100 uppercase tracking-wide drop-shadow-lg">kcal</span>
              </div>
              <div className="text-xs font-semibold text-teal-100 uppercase tracking-wide drop-shadow-md opacity-90">
                TDEE / Maintenance Calories
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BMI Gauge Section */}
      {bmi && (
        <div className="mb-6">
          <BMIGauge bmi={bmi} classification={bmiClassification} />
        </div>
      )}

      {/* Hero Stats - Large Emphasis */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Primary Goal Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-300 via-orange-500 to-red-600 p-5 shadow-[0_10px_40px_rgba(249,115,22,0.4),inset_0_3px_6px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,0.6)] hover:shadow-[0_14px_48px_rgba(249,115,22,0.5)] transition-all duration-300">
          {/* Glass highlight */}
          <div className="absolute top-0 left-[10%] w-[60%] h-[50%] bg-gradient-to-br from-white/70 via-white/30 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-5 w-5 text-white drop-shadow-md" />
              <span className="text-xs font-bold text-orange-50 uppercase tracking-wide drop-shadow-md">Goal</span>
            </div>
            <div className={`font-black text-white drop-shadow-lg leading-tight ${(formatGoal()?.length || 0) > 12 ? 'text-lg' :
              (formatGoal()?.length || 0) > 8 ? 'text-xl' : 'text-2xl'
              }`}>
              {formatGoal()}
            </div>
          </div>
        </div>

        {/* Experience Level Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-300 via-purple-500 to-purple-700 p-5 shadow-[0_10px_40px_rgba(147,51,234,0.4),inset_0_3px_6px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,0.6)] hover:shadow-[0_14px_48px_rgba(147,51,234,0.5)] transition-all duration-300">
          {/* Glass highlight */}
          <div className="absolute top-0 left-[10%] w-[60%] h-[50%] bg-gradient-to-br from-white/70 via-white/30 to-transparent rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell className="h-5 w-5 text-white drop-shadow-md" />
              <span className="text-xs font-bold text-purple-50 uppercase tracking-wide drop-shadow-md">Level</span>
            </div>
            <div className={`font-black text-white drop-shadow-lg leading-tight ${(formatExperience()?.length || 0) > 15 ? 'text-base' : 'text-xl'
              }`}>
              {formatExperience()}
            </div>
          </div>
        </div>
      </div>

      {/* Body Metrics - Compact Pills */}
      <div className="space-y-3 mb-6">
        {/* Physical Stats Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[0_6px_20px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-2px_3px_rgba(255,255,255,0.9)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium mb-0.5">👤 Age</div>
                <div className="text-lg font-bold text-slate-800">
                  {userProfile?.age ? `${userProfile.age}` : '—'}
                  <span className="text-xs font-normal text-slate-500 ml-1">years</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-slate-50 to-slate-100 p-4 shadow-[0_6px_20px_rgba(0,0,0,0.08),inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-2px_3px_rgba(255,255,255,0.9)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium mb-0.5">⚧ Gender</div>
                <div className="text-lg font-bold text-slate-800 capitalize">
                  {userProfile?.gender || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-blue-50 to-blue-100 p-4 shadow-[0_6px_20px_rgba(59,130,246,0.15),inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-2px_3px_rgba(255,255,255,0.9)] hover:shadow-[0_8px_24px_rgba(59,130,246,0.2)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-blue-600 font-medium mb-0.5 flex items-center gap-1">
                  📏 <span>Height</span>
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {userProfile?.height ? (
                    units === 'imperial' ? formatHeight(userProfile.height, 'imperial') : userProfile.height
                  ) : '—'}
                  <span className="text-xs font-normal text-slate-500 ml-1">{units === 'imperial' ? '' : 'cm'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-emerald-50 to-emerald-100 p-4 shadow-[0_6px_20px_rgba(16,185,129,0.15),inset_0_2px_4px_rgba(0,0,0,0.05),inset_0_-2px_3px_rgba(255,255,255,0.9)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-600 font-medium mb-0.5 flex items-center gap-1">
                  ⚖️ <span>Weight</span>
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {userProfile?.weight ? (
                    units === 'imperial' ? kgToLbs(userProfile.weight).toFixed(1) : userProfile.weight
                  ) : '—'}
                  <span className="text-xs font-normal text-slate-500 ml-1">{units === 'imperial' ? 'lbs' : 'kg'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Training Schedule Pill */}
      {userProfile?.workoutDaysPerWeek && (
        <div className="mb-6">
          <div className="relative overflow-hidden rounded-full shadow-[0_8px_28px_rgba(251,146,60,0.3),inset_0_3px_6px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,0.6)]">
            <div className="bg-gradient-to-br from-amber-300 via-orange-500 to-red-600 rounded-full px-5 py-3 relative">
              <div className="absolute top-0 left-[10%] w-[50%] h-[60%] bg-gradient-to-br from-white/80 via-white/40 to-transparent rounded-full blur-lg pointer-events-none"></div>

              <div className="relative flex items-center justify-center gap-4">
                <Calendar className="h-5 w-5 text-white drop-shadow-md" />
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white drop-shadow-lg">
                    {userProfile.workoutDaysPerWeek}
                  </span>
                  <span className="text-sm font-bold text-orange-50 uppercase tracking-wide drop-shadow-md">
                    days/week
                  </span>
                </div>
                {userProfile.sessionDuration && (
                  <>
                    <div className="w-px h-6 bg-gradient-to-b from-transparent via-orange-200/80 to-transparent"></div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white drop-shadow-lg">
                        {userProfile.sessionDuration}
                      </span>
                      <span className="text-xs font-bold text-orange-50 uppercase tracking-wide drop-shadow-md">
                        min
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Equipment & Dietary Tags */}
      <div className="space-y-4">
        {userProfile?.equipmentAccess && userProfile.equipmentAccess.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Equipment
            </div>
            <div className="flex flex-wrap gap-2">
              {userProfile.equipmentAccess.slice(0, 5).map((equipment, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-slate-300 bg-white/80 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  {equipment}
                </Badge>
              ))}
              {userProfile.equipmentAccess.length > 5 && (
                <Badge
                  variant="outline"
                  className="text-xs px-2.5 py-1 rounded-full border-2 border-slate-300 bg-white/80 font-semibold shadow-sm"
                >
                  +{userProfile.equipmentAccess.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}

        {userProfile?.dietaryRestrictions && userProfile.dietaryRestrictions.length > 0 && (
          <div>
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              🥗 Dietary
            </div>
            <div className="flex flex-wrap gap-2">
              {userProfile.dietaryRestrictions.slice(0, 4).map((restriction, idx) => (
                <Badge
                  key={idx}
                  className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 text-rose-800 border border-rose-200 shadow-sm"
                >
                  {restriction}
                </Badge>
              ))}
              {userProfile.dietaryRestrictions.length > 4 && (
                <Badge
                  className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-rose-100 to-pink-100 text-rose-800 border border-rose-200 font-semibold shadow-sm"
                >
                  +{userProfile.dietaryRestrictions.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
