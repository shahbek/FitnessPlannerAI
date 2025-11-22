# AGENTS.md - Core Workflow Analysis

This document provides a technical deep-dive into the essential core workflows of the Fitness Planner AI system. It is designed to help developers and agents understand how the system delivers a sophisticated, in-depth fitness plan.

## 1. Hydration Strategy & Water Intake

The system calculates optimal water intake based on user biometrics and activity levels, ensuring users stay hydrated for peak performance.

- **Logic Location**: `src/utils/planCalculations.ts` (calculation), `src/components/plan-overview/HydrationAndMealTiming.tsx` (display).
- **Workflow**:
    1.  **Calculation**: The system uses the user's weight and activity level to calculate a baseline daily water intake (typically ~33ml per kg of body weight).
    2.  **Adjustments**: Adjustments are made for training days (adding 500-1000ml) to compensate for sweat loss.
    3.  **Display**: The `HydrationAndMealTiming` component visualizes this data, providing a daily target (e.g., "3.5L") and a schedule for intake (e.g., "250ml every 1-2 hours").
    4.  **Education**: The UI explains *why* this amount is recommended (metabolism, recovery) and the formula used.

## 2. Cardio Optimization

Cardio is not generic; it is tailored to the user's specific goal (fat loss vs. endurance vs. muscle gain) and schedule.

- **Logic Location**: `src/services/WeeklyWorkoutGenerator.ts`, `src/models/PlanModels.ts` (`cardioSchedule`).
- **Workflow**:
    1.  **Goal Analysis**: The `WeeklyWorkoutGenerator` (and associated prompt builders) analyzes the user's `primaryGoal`.
        -   *Fat Loss*: Prescribes HIIT or moderate-intensity steady state (MISS) to maximize calorie burn while preserving muscle.
        -   *Endurance*: Prescribes higher duration, lower intensity sessions.
        -   *Muscle Gain*: Prescribes low-impact cardio to aid recovery without burning excessive calories needed for growth.
    2.  **Scheduling**: Cardio sessions are integrated into the `WeeklyOutline`, ensuring they don't interfere with resistance training recovery (e.g., separating heavy leg days from intense running).
    3.  **Output**: The plan details frequency, duration, intensity, and specific type (e.g., "30 min Zone 2 Jog").

## 3. Nutrition & Macro Cycling

The nutrition engine goes beyond simple calorie counting, implementing macro cycling and phase-specific targets.

- **Logic Location**: `src/services/NutritionCalculationService.ts`, `src/services/BatchMealGenerator.ts`, `src/models/PlanModels.ts` (`MetabolicMetrics`, `TrainingFramework`).
- **Workflow**:
    1.  **TDEE & BMR**: Calculates Total Daily Energy Expenditure and Basal Metabolic Rate using validated formulas (Mifflin-St Jeor).
    2.  **Goal Targeting**: Applies a caloric surplus (muscle gain) or deficit (fat loss) based on the user's goal and timeline.
    3.  **Macro Split**: Determines the optimal ratio of Protein, Carbs, and Fats.
        -   *High Protein*: Prioritized for all goals to support muscle retention/growth (typically 1.6-2.2g/kg).
        -   *Carb Cycling*: (If enabled) Adjusts carbohydrate intake based on training days (higher carbs) vs. rest days (lower carbs) to optimize insulin sensitivity and fuel workouts.
    4.  **Meal Generation**: `BatchMealGenerator` creates meals that strictly adhere to these macro targets, using USDA data for accuracy.

## 4. Grocery List Generation

The system bridges the gap between planning and execution by generating a precise, cost-aware grocery list.

- **Logic Location**: `src/services/ShoppingListGenerationService.ts`.
- **Workflow**:
    1.  **Ingredient Extraction**: Iterates through every meal in the generated `WeeklyOutline` and extracts ingredients from recipes.
    2.  **Aggregation**: Sums up quantities for identical ingredients across the week (e.g., "Chicken Breast" from Monday Lunch + Wednesday Dinner).
    3.  **Categorization**: Groups items by aisle (Produce, Meat, Dairy, etc.) for efficient shopping.
    4.  **Cost Estimation**:
        -   Uses a hybrid approach: checks a local database for known prices.
        -   Uses AI (`llama-3.3-70b-versatile`) to estimate costs for unknown items based on current market rates.
    5.  **Output**: Produces a `ShoppingList` object with estimated total cost and categorized items.

## 5. Targeted Progression (Progressive Overload)

The workout system ensures users don't stagnate by programming week-over-week progression.

- **Logic Location**: `src/services/WeeklyWorkoutGenerator.ts`, `src/services/TrainingSplitService.ts`.
- **Workflow**:
    1.  **Context Awareness**: The `WeeklyWorkoutGenerator` accepts `previousWeekSessions` as input.
    2.  **Variation & Progression**:
        -   *Volume*: Gradually increases sets/reps over the weeks (e.g., Week 1: 3 sets -> Week 4: 4 sets).
        -   *Intensity*: Shifts focus from "Foundation" (higher reps, lower weight) to "Strength" (lower reps, higher weight) based on the `phase`.
        -   *Exercise Selection*: Rotates exercises to prevent accommodation while maintaining movement patterns (e.g., Barbell Bench Press -> Dumbbell Bench Press).
    3.  **Validation**: Ensures volume (sets per muscle group) stays within optimal ranges (10-20 sets/week) to prevent overtraining.

## Architecture Summary

-   **Frontend**: React, TypeScript, Vite, Tailwind CSS.
-   **Backend**: Convex (Serverless).
-   **AI**: Groq SDK (Llama 3 models) for fast, chain-of-thought reasoning.
-   **Data**: USDA FoodData Central for nutrition.

## Key Files Map

| Feature | Key Files |
| :--- | :--- |
| **Hydration** | `src/utils/planCalculations.ts`, `HydrationAndMealTiming.tsx` |
| **Cardio** | `src/services/WeeklyWorkoutGenerator.ts`, `PlanModels.ts` |
| **Macros** | `src/services/NutritionCalculationService.ts`, `BatchMealGenerator.ts` |
| **Grocery** | `src/services/ShoppingListGenerationService.ts` |
| **Progression** | `src/services/WeeklyWorkoutGenerator.ts` |
