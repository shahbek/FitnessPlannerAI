/**
 * Exercise Library Database
 * 
 * Comprehensive exercise database with categorization by:
 * - Muscle group
 * - Equipment required
 * - Difficulty level
 * - Movement type (compound/isolation)
 * - Injury considerations
 */

import { Exercise } from '../models/PlanModels';

/**
 * Exercise Library Data
 * Comprehensive list of exercises with full metadata
 */
export const EXERCISE_LIBRARY: Exercise[] = [
  // CHEST EXERCISES
  {
    exerciseId: 'chest-001',
    name: 'Barbell Bench Press',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['barbell', 'bench'],
    difficulty: 'intermediate',
    formCues: [
      'Keep feet flat on floor',
      'Retract shoulder blades',
      'Lower bar to chest with control',
      'Press explosively but controlled',
    ],
    progressionOptions: ['Increase weight', 'Add pause at bottom', 'Close grip variation'],
    regressionOptions: ['Dumbbell bench press', 'Incline bench press', 'Machine press'],
    contraindications: ['Shoulder impingement', 'Rotator cuff injury'],
  },
  {
    exerciseId: 'chest-002',
    name: 'Dumbbell Bench Press',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['dumbbells', 'bench'],
    difficulty: 'beginner',
    formCues: [
      'Control the descent',
      'Press through full range of motion',
      'Keep wrists neutral',
    ],
    progressionOptions: ['Increase weight', 'Incline variation', 'Decline variation'],
    regressionOptions: ['Push-ups', 'Machine press', 'Cable flyes'],
    contraindications: ['Shoulder instability'],
  },
  {
    exerciseId: 'chest-003',
    name: 'Push-ups',
    muscleGroups: ['chest', 'shoulders', 'triceps', 'core'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    formCues: [
      'Keep body in straight line',
      'Lower until chest nearly touches ground',
      'Push through full range',
    ],
    progressionOptions: ['Weighted vest', 'Archer push-ups', 'Pike push-ups'],
    regressionOptions: ['Knee push-ups', 'Incline push-ups', 'Wall push-ups'],
    contraindications: ['Wrist pain', 'Lower back injury'],
  },
  {
    exerciseId: 'chest-004',
    name: 'Incline Dumbbell Press',
    muscleGroups: ['upper chest', 'shoulders', 'triceps'],
    equipment: ['dumbbells', 'incline bench'],
    difficulty: 'intermediate',
    formCues: [
      'Set bench to 30-45 degree angle',
      'Keep shoulder blades retracted',
      'Control the weight',
    ],
    progressionOptions: ['Increase angle', 'Increase weight', 'Add pause'],
    regressionOptions: ['Flat dumbbell press', 'Machine press'],
    contraindications: ['Shoulder impingement'],
  },
  {
    exerciseId: 'chest-005',
    name: 'Cable Flyes',
    muscleGroups: ['chest'],
    equipment: ['cable machine'],
    difficulty: 'beginner',
    formCues: [
      'Slight forward lean',
      'Squeeze at peak contraction',
      'Control the stretch',
    ],
    progressionOptions: ['Increase weight', 'Decline flyes', 'Single arm'],
    regressionOptions: ['Dumbbell flyes', 'Machine flyes'],
    contraindications: ['Shoulder instability'],
  },

  // BACK EXERCISES
  {
    exerciseId: 'back-001',
    name: 'Barbell Rows',
    muscleGroups: ['lats', 'rhomboids', 'biceps'],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    formCues: [
      'Hinge at hips',
      'Pull bar to lower chest/upper abs',
      'Squeeze back muscles',
    ],
    progressionOptions: ['Increase weight', 'Pause at peak', 'T-bar rows'],
    regressionOptions: ['Dumbbell rows', 'Cable rows', 'Machine rows'],
    contraindications: ['Lower back injury'],
  },
  {
    exerciseId: 'back-002',
    name: 'Pull-ups',
    muscleGroups: ['lats', 'biceps', 'rhomboids'],
    equipment: ['pull-up bar'],
    difficulty: 'intermediate',
    formCues: [
      'Full range of motion',
      'Pull with back, not just arms',
      'Control the descent',
    ],
    progressionOptions: ['Weighted pull-ups', 'L-sit pull-ups', 'Archer pull-ups'],
    regressionOptions: ['Assisted pull-ups', 'Lat pulldowns', 'Inverted rows'],
    contraindications: ['Shoulder impingement', 'Elbow tendinitis'],
  },
  {
    exerciseId: 'back-003',
    name: 'Lat Pulldowns',
    muscleGroups: ['lats', 'biceps'],
    equipment: ['cable machine'],
    difficulty: 'beginner',
    formCues: [
      'Pull to upper chest',
      'Lean back slightly',
      'Squeeze lats at bottom',
    ],
    progressionOptions: ['Increase weight', 'Wide grip', 'Close grip'],
    regressionOptions: ['Assisted pull-ups', 'Cable rows'],
    contraindications: ['Shoulder instability'],
  },
  {
    exerciseId: 'back-004',
    name: 'Dumbbell Rows',
    muscleGroups: ['lats', 'rhomboids', 'biceps'],
    equipment: ['dumbbells', 'bench'],
    difficulty: 'beginner',
    formCues: [
      'Brace core',
      'Pull elbow back',
      'Squeeze at top',
    ],
    progressionOptions: ['Increase weight', 'Single arm', 'Chest supported'],
    regressionOptions: ['Cable rows', 'Machine rows'],
    contraindications: ['Lower back injury'],
  },
  {
    exerciseId: 'back-005',
    name: 'Cable Rows',
    muscleGroups: ['lats', 'rhomboids', 'biceps'],
    equipment: ['cable machine'],
    difficulty: 'beginner',
    formCues: [
      'Pull to lower chest',
      'Squeeze shoulder blades together',
      'Control the return',
    ],
    progressionOptions: ['Increase weight', 'One arm', 'Wide grip'],
    regressionOptions: ['Machine rows', 'Resistance bands'],
    contraindications: ['Lower back injury'],
  },

  // LEGS EXERCISES
  {
    exerciseId: 'legs-001',
    name: 'Barbell Squats',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['barbell', 'squat rack'],
    difficulty: 'intermediate',
    formCues: [
      'Keep chest up',
      'Break at hips first',
      'Knees track over toes',
      'Depth to parallel or below',
    ],
    progressionOptions: ['Increase weight', 'Pause squats', 'Front squats'],
    regressionOptions: ['Goblet squats', 'Bodyweight squats', 'Leg press'],
    contraindications: ['Knee injury', 'Lower back injury', 'Ankle mobility issues'],
  },
  {
    exerciseId: 'legs-002',
    name: 'Romanian Deadlifts',
    muscleGroups: ['hamstrings', 'glutes', 'lower back'],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    formCues: [
      'Hinge at hips',
      'Keep back straight',
      'Feel stretch in hamstrings',
      'Squeeze glutes at top',
    ],
    progressionOptions: ['Increase weight', 'Single leg', 'Stiff leg deadlifts'],
    regressionOptions: ['Dumbbell RDL', 'Good mornings', 'Cable pull-through'],
    contraindications: ['Lower back injury', 'Hamstring strain'],
  },
  {
    exerciseId: 'legs-003',
    name: 'Leg Press',
    muscleGroups: ['quads', 'glutes'],
    equipment: ['leg press machine'],
    difficulty: 'beginner',
    formCues: [
      'Full range of motion',
      'Knees track over toes',
      'Don\'t lock out knees',
    ],
    progressionOptions: ['Increase weight', 'Single leg', 'Narrow stance'],
    regressionOptions: ['Bodyweight squats', 'Goblet squats'],
    contraindications: ['Knee injury'],
  },
  {
    exerciseId: 'legs-004',
    name: 'Walking Lunges',
    muscleGroups: ['quads', 'glutes', 'hamstrings'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    formCues: [
      'Step forward into lunge',
      'Front knee tracks over toes',
      'Back knee nearly touches ground',
      'Push through front heel',
    ],
    progressionOptions: ['Add weight', 'Reverse lunges', 'Jumping lunges'],
    regressionOptions: ['Stationary lunges', 'Split squats'],
    contraindications: ['Knee injury', 'Balance issues'],
  },
  {
    exerciseId: 'legs-005',
    name: 'Leg Curls',
    muscleGroups: ['hamstrings'],
    equipment: ['leg curl machine'],
    difficulty: 'beginner',
    formCues: [
      'Control the weight',
      'Full range of motion',
      'Squeeze at top',
    ],
    progressionOptions: ['Increase weight', 'Single leg', 'Lying leg curls'],
    regressionOptions: ['Resistance band curls', 'Glute ham raises'],
    contraindications: ['Hamstring strain'],
  },
  {
    exerciseId: 'legs-006',
    name: 'Leg Extensions',
    muscleGroups: ['quads'],
    equipment: ['leg extension machine'],
    difficulty: 'beginner',
    formCues: [
      'Control the movement',
      'Full extension',
      'Don\'t lock out',
    ],
    progressionOptions: ['Increase weight', 'Single leg', 'Pause at top'],
    regressionOptions: ['Bodyweight squats', 'Wall sits'],
    contraindications: ['Knee injury', 'Patellar tendinitis'],
  },

  // SHOULDER EXERCISES
  {
    exerciseId: 'shoulders-001',
    name: 'Overhead Press',
    muscleGroups: ['shoulders', 'triceps', 'core'],
    equipment: ['barbell'],
    difficulty: 'intermediate',
    formCues: [
      'Brace core',
      'Press straight up',
      'Don\'t arch back excessively',
    ],
    progressionOptions: ['Increase weight', 'Push press', 'Behind neck press'],
    regressionOptions: ['Dumbbell press', 'Machine press', 'Seated press'],
    contraindications: ['Shoulder impingement', 'Lower back injury'],
  },
  {
    exerciseId: 'shoulders-002',
    name: 'Dumbbell Lateral Raises',
    muscleGroups: ['shoulders'],
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    formCues: [
      'Slight lean forward',
      'Raise to shoulder height',
      'Control the descent',
    ],
    progressionOptions: ['Increase weight', 'Cable lateral raises', 'Single arm'],
    regressionOptions: ['Resistance bands', 'Machine lateral raises'],
    contraindications: ['Shoulder impingement'],
  },
  {
    exerciseId: 'shoulders-003',
    name: 'Dumbbell Shoulder Press',
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    formCues: [
      'Press straight up',
      'Full range of motion',
      'Control the weight',
    ],
    progressionOptions: ['Increase weight', 'Seated variation', 'Arnold press'],
    regressionOptions: ['Machine press', 'Resistance bands'],
    contraindications: ['Shoulder impingement'],
  },
  {
    exerciseId: 'shoulders-004',
    name: 'Face Pulls',
    muscleGroups: ['rear delts', 'rhomboids'],
    equipment: ['cable machine'],
    difficulty: 'beginner',
    formCues: [
      'Pull to face level',
      'External rotation at end',
      'Squeeze rear delts',
    ],
    progressionOptions: ['Increase weight', 'Single arm', 'Resistance bands'],
    regressionOptions: ['Band pull-aparts', 'Reverse flyes'],
    contraindications: ['Shoulder instability'],
  },

  // ARMS EXERCISES
  {
    exerciseId: 'arms-001',
    name: 'Barbell Bicep Curls',
    muscleGroups: ['biceps'],
    equipment: ['barbell'],
    difficulty: 'beginner',
    formCues: [
      'Keep elbows stationary',
      'Full range of motion',
      'Control the negative',
    ],
    progressionOptions: ['Increase weight', '21s', 'Close grip'],
    regressionOptions: ['Dumbbell curls', 'Cable curls', 'Resistance bands'],
    contraindications: ['Elbow tendinitis'],
  },
  {
    exerciseId: 'arms-002',
    name: 'Tricep Dips',
    muscleGroups: ['triceps', 'shoulders'],
    equipment: ['parallel bars'],
    difficulty: 'intermediate',
    formCues: [
      'Keep body upright',
      'Lower until elbows at 90 degrees',
      'Push through full range',
    ],
    progressionOptions: ['Add weight', 'Ring dips', 'Weighted dips'],
    regressionOptions: ['Assisted dips', 'Bench dips', 'Cable pushdowns'],
    contraindications: ['Shoulder impingement', 'Elbow pain'],
  },
  {
    exerciseId: 'arms-003',
    name: 'Tricep Cable Pushdowns',
    muscleGroups: ['triceps'],
    equipment: ['cable machine'],
    difficulty: 'beginner',
    formCues: [
      'Keep elbows at sides',
      'Push down fully',
      'Control the return',
    ],
    progressionOptions: ['Increase weight', 'Rope attachment', 'Single arm'],
    regressionOptions: ['Overhead extensions', 'Kickbacks'],
    contraindications: ['Elbow tendinitis'],
  },
  {
    exerciseId: 'arms-004',
    name: 'Hammer Curls',
    muscleGroups: ['biceps', 'forearms'],
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    formCues: [
      'Neutral grip',
      'Full range of motion',
      'Control the negative',
    ],
    progressionOptions: ['Increase weight', 'Cable hammer curls', 'Cross body'],
    regressionOptions: ['Resistance bands', 'Machine curls'],
    contraindications: ['Elbow tendinitis'],
  },

  // CORE EXERCISES
  {
    exerciseId: 'core-001',
    name: 'Plank',
    muscleGroups: ['core'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    formCues: [
      'Straight line from head to heels',
      'Brace core',
      'Don\'t sag or arch',
    ],
    progressionOptions: ['Add time', 'Weighted plank', 'Side plank'],
    regressionOptions: ['Knee plank', 'Wall plank'],
    contraindications: ['Lower back injury'],
  },
  {
    exerciseId: 'core-002',
    name: 'Dead Bug',
    muscleGroups: ['core'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    formCues: [
      'Lower back stays flat',
      'Move opposite arm and leg',
      'Control the movement',
    ],
    progressionOptions: ['Add resistance', 'Slow tempo', 'Both sides simultaneously'],
    regressionOptions: ['Single limb only', 'Knees only'],
    contraindications: ['Lower back injury'],
  },
  {
    exerciseId: 'core-003',
    name: 'Russian Twists',
    muscleGroups: ['core'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    formCues: [
      'Lean back slightly',
      'Rotate through core',
      'Keep chest up',
    ],
    progressionOptions: ['Add weight', 'Feet elevated', 'Weighted ball'],
    regressionOptions: ['Feet on ground', 'No weight'],
    contraindications: ['Lower back injury'],
  },
  {
    exerciseId: 'core-004',
    name: 'Hanging Leg Raises',
    muscleGroups: ['core'],
    equipment: ['pull-up bar'],
    difficulty: 'intermediate',
    formCues: [
      'Control the movement',
      'Raise legs to parallel',
      'Lower slowly',
    ],
    progressionOptions: ['Straight legs', 'Add weight', 'Toes to bar'],
    regressionOptions: ['Knee raises', 'Lying leg raises', 'Cable crunches'],
    contraindications: ['Lower back injury', 'Shoulder issues'],
  },
];

/**
 * Muscle Group Categories
 */
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'lats',
  'rhomboids',
  'shoulders',
  'rear delts',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'biceps',
  'triceps',
  'forearms',
  'core',
] as const;

/**
 * Equipment Types
 */
export const EQUIPMENT_TYPES = [
  'barbell',
  'dumbbells',
  'bodyweight',
  'cable machine',
  'bench',
  'incline bench',
  'pull-up bar',
  'squat rack',
  'leg press machine',
  'leg curl machine',
  'leg extension machine',
  'parallel bars',
] as const;

/**
 * Difficulty Levels
 */
export const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'expert'] as const;

/**
 * Movement Types
 */
export const MOVEMENT_TYPES = ['compound', 'isolation'] as const;

