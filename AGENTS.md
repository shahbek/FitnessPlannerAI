# AGENTS.md - AI Fitness Planner Development Guide

## Test Commands
- Run single test: `tsx src/tests/integration/FullPlanGeneration.test.ts` (or any other test file)
- Run all tests: `npm run test:all`
- Unit test: `npm run test:usda`
- Integration tests: `npm run test:meal-pipeline`, `npm run test:workout-pipeline`, `npm run test:integration`, `npm run test:full-generation`
- Type checking: `npm run type-check`
- Linting: `npm run lint` or `npm run lint:fix`

## Architecture
- **Frontend**: React + TypeScript + Vite, Tailwind CSS, shadcn/ui components
- **Backend**: Convex (serverless backend) in `/convex` directory - handles auth, DB (mealPlans, workoutPlans, users), and payments
- **Services**:
  - **Meal Generation**: `BatchMealGenerator` (single AI call per week, USDA reconciliation, macro adjustment)
  - **Workout Generation**: `WeeklyWorkoutGenerator` (single AI call per week for all 7 days, ensures exercise variation)
  - **Plan Assembly**: `IntegratedPlanGenerator` orchestrates both meal and workout generation
- **AI Integration**: Groq AI via `@ai-sdk/groq` for Chain-of-Thought reasoning; deterministic fallbacks when AI unavailable
- **Data**: USDA FoodData Central API for nutrition data (USDANutritionService)
- **Models**: `/src/models` contains UserProfile, PlanModels (CompletePlan, WeeklyOutline), ConsistentPlanModels

## Workout Generation System

### Overview
The workout generation system has been redesigned to generate all workouts for an entire week in a **single AI call**, ensuring proper exercise variation, preventing duplicates, and allowing for progressive programming.

### Key Components

1. **WeeklyWorkoutGenerator** (`src/services/WeeklyWorkoutGenerator.ts`)
   - Generates complete 7-day workout plan in one AI call
   - Ensures exercise variation between similar training days (e.g., two "push" days use different exercises)
   - Validates against duplicate sessions and high similarity (>70% overlap)
   - Supports week-to-week progression by passing previous week's sessions

2. **TrainingSplitService** (`src/services/TrainingSplitService.ts`)
   - Determines optimal training split (upper/lower, push/pull/legs, full body, etc.)
   - Validates structure and recovery patterns
   - Quality scoring system (recovery, balance, structure)

3. **SessionTemplateGenerator** (`src/services/SessionTemplateGenerator.ts`) - LEGACY
   - ⚠️ Still exists but replaced by WeeklyWorkoutGenerator
   - Previously generated sessions one-by-one (caused duplicates)
   - Keep for backward compatibility if needed

### How It Works

```typescript
// 1. Generate training split
const trainingSplit = await trainingSplitService.determineSplit(userProfile, [weeklyOutline]);

// 2. Generate ALL workouts for the week in ONE AI call
const weekSessions = await weeklyWorkoutGenerator.generateWeeklyWorkouts(
  trainingSplit,
  userProfile,
  weeklyOutline,
  { previousWeekSessions } // Optional: for week-to-week variation
);

// Result: Array of SessionTemplate[] with unique exercises per similar day
```

### Benefits of Single AI Call Per Week

1. **Full Week Context**: AI sees all 7 days at once, enabling better programming
2. **Exercise Variation**: Automatically varies exercises between similar days (e.g., "Push Day 1" vs "Push Day 2")
3. **No Duplicates**: Validates templateIds and exercise similarity (<70% overlap threshold)
4. **Progressive Overload**: Passes previous week context for week-to-week variation
5. **Better Performance**: One AI call instead of 4-6 separate calls
6. **User Profile Awareness**: Respects equipment availability, experience level, and primary goals

### User Profile Integration

The system intelligently adapts workouts based on:

1. **Equipment Availability**:
   - `gym_membership`: Full gym equipment (barbells, machines, cables)
   - `home_gym`: Dumbbells, bench, pull-up bar, resistance bands
   - `bodyweight`: Calisthenics only (NO weights or machines)
   - `minimal_equipment`: Dumbbells and resistance bands only

2. **Experience Level**:
   - `beginner`: Focus on form, basic movements, machines for safety, 2-3 sets
   - `intermediate`: Mix of compound/isolation, free weights, 3-4 sets
   - `expert`: Advanced techniques, Olympic lifts, high volume, 4-6 sets

3. **Primary Goal**:
   - `muscle_gain`: Hypertrophy rep ranges (8-12), higher volume
   - `fat_loss`: Maintain muscle, shorter rest, circuit-style options
   - `strength`: Heavy compounds (3-6 reps), longer rest, lower reps
   - `endurance`: Higher reps (15-20+), shorter rest, bodyweight focus
   - `general_fitness`: Balanced approach, moderate volume/intensity

### Validation

The system includes multiple validation layers:
- **Duplicate templateId detection**: Throws error if duplicate IDs found
- **Exercise similarity check**: Warns if >70% overlap between similar days
- **Volume validation**: Ensures 6+ sets per muscle group per week
- **Structure validation**: 4-8 exercises per session, proper sets/reps/rest
- **Equipment compliance**: Exercises must match user's available equipment
- **Experience appropriateness**: Exercise complexity matches user level

### Testing

Run the integration test:
```bash
tsx src/tests/integration/WeeklyWorkoutGeneration.test.ts
```

Tests cover:
- Complete week generation
- Exercise variation between similar days
- Unique session IDs
- Volume distribution
- Progressive programming across weeks

## Code Style & Conventions
- **Imports**: Use `@/*` path aliases (defined in tsconfig.json); external packages first, then relative imports
- **TypeScript**: Strict mode enabled; use explicit types, avoid `any` (warn only); prefix unused vars with `_`
- **Formatting**: Prettier (single quotes, 2 spaces, 80 char width, trailing commas ES5)
- **Naming**: camelCase for variables/functions, PascalCase for types/classes/components
- **Error Handling**: Use custom error types (e.g., NutritionError with NutritionErrorType enum)
- **Testing**: Tests use tsx runner, dotenv for env vars (VITE_USDA_API_KEY, VITE_GROQ_API_KEY)
