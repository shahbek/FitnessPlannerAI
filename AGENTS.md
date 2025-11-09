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
- **Services**: Pipeline architecture in `/src/services` with 5-stage meal generation: DayMacroDistributor → MealStructurePlanner → IngredientSelector → PortionCalculator → MealCorrectionEngine
- **AI Integration**: Groq AI via `@ai-sdk/groq` for Chain-of-Thought reasoning; deterministic fallbacks when AI unavailable
- **Data**: USDA FoodData Central API for nutrition data (USDANutritionService)
- **Models**: `/src/models` contains UserProfile, PlanModels (CompletePlan, WeeklyOutline), ConsistentPlanModels

## Code Style & Conventions
- **Imports**: Use `@/*` path aliases (defined in tsconfig.json); external packages first, then relative imports
- **TypeScript**: Strict mode enabled; use explicit types, avoid `any` (warn only); prefix unused vars with `_`
- **Formatting**: Prettier (single quotes, 2 spaces, 80 char width, trailing commas ES5)
- **Naming**: camelCase for variables/functions, PascalCase for types/classes/components
- **Error Handling**: Use custom error types (e.g., NutritionError with NutritionErrorType enum)
- **Testing**: Tests use tsx runner, dotenv for env vars (VITE_USDA_API_KEY, VITE_GROQ_API_KEY)
