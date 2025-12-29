# Meal Target Mismatch & Plan Generation Inconsistency — Findings

## Scope / methodology

This report is a static code audit of the current plan-generation pipeline in `FitnessPlannerAI`. I did **not** reproduce the issue by running the app or generating plans; findings are based on tracing the code paths and data flows.

## TL;DR (what’s most likely happening)

1. **“Weekly deficit” is not a stable, deterministic output** because multiple parts of the UI compute it from **LLM-produced numeric targets** (`weeklyOutlines[].dailyTargets`) rather than from a single deterministic calculator.
2. **Bulking plans can display a positive “deficit”** because the plan framework model uses **deficit-shaped fields even for surplus goals**, and `extractPlanMetrics()` prefers those values when present.
3. **Meals “not meeting targets” is often a comparison bug**: the meal generator can use `dailyTargetsOverride` (per-day cycling), but most UI/metrics code compares against `dailyTargets` (weekly average) and ignores the override entirely.
4. RAG exists, but it’s not applied where it matters most (goal strategy + numeric targets). In several places it’s effectively “static prompt decoration” rather than retrieval-grounded constraints.

---

## 1) Pipeline map (where numbers are coming from)

### Integrated pipeline (default UI path)

Entry point: `src/components/layout/FitnessLayout.tsx`

1. Build `userProfile` from form: `formToUserProfile()` (`src/utils/formToPlanModels.ts`)
2. Compute deterministic metrics for the *RAG weekly outlines prompt*: `dynamicCalculator.*` (`src/ai/dynamicCalculator.ts`)
3. Generate `weeklyOutlines` via LLM: `AISdkRagService.generateDetailedWeeklyOutlines()` (`src/services/aiSdkRagService.ts`)
4. Generate full plan (workouts + meals):
   - `IntegratedPlanGenerator.generatePlan()` (`src/services/IntegratedPlanGenerator.ts`)
   - Cardio templates/schedule via LLM (+ cardio RAG): `CardioGenerationService` (`src/services/CardioGenerationService.ts`)
   - **Daily macro targets override (bulking/maintenance only)**:
     - `IntegratedPlanGenerator.calculateDailyNutritionTargets()` writes `(outline as any).dailyTargetsOverride`
   - Meals:
     - `BatchMealGenerator.generateWeeklyMeals()` (`src/services/BatchMealGenerator.ts`)
     - Uses LLM to propose meals + ingredients, then USDA batch lookup, then macro recalculation, then LP/heuristic adjustments.

### Legacy “RAG full plan” pipeline (still present)

Main orchestrator: `src/services/aiSdkRagService.ts`

This path generates **phase framework**, **weekly outlines**, **workouts**, **meals**, etc. via LLM calls, with some validation.

---

## 2) Symptom: “2 aggressive bulk plans → weekly deficit 3000+ vs 885”

### 2.1 Root cause A: “Weekly deficit” is computed from LLM-produced `dailyTargets` (not deterministic)

Several UI components treat `weeklyOutlines[].dailyTargets.calories` as the “actual intake” used for energy balance/deficit:

- `src/components/plan-overview/EnergyBalanceVisualization.tsx`
  - Uses `weekData.dailyTargets?.calories` as `dailyMealCalories` (no `dailyTargetsOverride` handling).
- `src/utils/planCalculations.ts`
  - `calculateWeeklyDeficitSummary()` selects `caloriesConsumed` from:
    1) `plan.weeklyTargetMacros.dailyTargets` (DB metadata)
    2) `weeklyOutline.dailyTargetsOverride[index].calories` (generated override)
    3) else fallback: `weeklyOutline.dailyTargets.calories`
  - Importantly, this is “planned intake”, not the actual macros summed from generated meals.

Because `AISdkRagService.generateDetailedWeeklyOutlines()` is a **model call** that asks the LLM to emit per-week numeric `dailyTargets`, those numbers can drift between runs (temperature, token sampling, partial constraint-following).

File: `src/services/aiSdkRagService.ts`
- `generateDetailedWeeklyOutlines()` computes a calorie progression (start/end/weeklyChange) deterministically, but then asks the LLM to output `WeeklyOutlineSchema` objects containing `dailyTargets`.
- There is no post-validation that `week.dailyTargets.calories` actually equals `startingCalories + weeklyChange*(week-1)` (within tolerance), so “same input → different daily targets → different deficit”.

### 2.2 Root cause B: Deficit fields are structurally wrong for bulking (and can override UI metrics)

The plan framework model encodes energy balance as “deficit” even for surplus goals:

- `src/models/PlanModels.ts` → `TrainingFramework.nutritionApproach.caloricStrategy`
  - `deficitMagnitude`, `dailyDeficitCalories`, `weeklyDeficitCalories`

The extractor then **prefers those values when present**:

- `src/utils/planMetricsExtractor.ts`
  - `dailyDeficit` uses `framework.nutritionApproach.caloricStrategy.dailyDeficitCalories` if it’s `> 0`
  - `weeklyDeficit` uses `framework...weeklyDeficitCalories` if it’s `> 0`

This means:
- If the LLM ever outputs positive `dailyDeficitCalories` / `weeklyDeficitCalories` inside the “phase-aware framework” for a bulk goal, the UI will show a positive deficit, even when computed `tdee - targetCalories` would be negative (surplus).

Where the problematic fields originate:
- `src/services/aiSdkRagService.ts` defines `StrategicFrameworkSchema` containing `dailyDeficitCalories`/`weeklyDeficitCalories`.
- The prompt for `generatePhaseAwareStrategicFramework()` does not strongly constrain *how* those numbers should be computed (and “deficit” wording biases the model).

### 2.3 Root cause C: inconsistent/missing plan metrics increases variance in deficit visuals

In the integrated generator output, metrics are currently placeholders:

- `src/services/IntegratedPlanGenerator.ts`
  - Returns `metrics: { bmr: 0, tdee: 0, ... }`
  - Returns `phaseAwareFramework.nutritionApproach.caloricStrategy: { dailyDeficitCalories: 0, weeklyDeficitCalories: 0 }`
  - Does not embed `userProfile` into the plan object.

Downstream, components often fallback to local calculations with partial user info, which can vary based on what’s available at runtime:

- `src/utils/planMetricsExtractor.ts` expects `userProfile.gender/height/weight/...` (not `sex/heightCm/weightKg`), so missing/mismatched fields can change computed BMR/TDEE fallbacks.

---

## 3) Symptom: “Generated meals never meet the targets”

This can be caused by **(a)** real meal-target misses, **(b)** the UI comparing against the wrong target source, or **(c)** targets themselves being inconsistent.

### 3.1 Root cause A: UI compares against `dailyTargets` while generator may use `dailyTargetsOverride`

Integrated generator calculates per-day targets for bulking/maintenance and stores them in `dailyTargetsOverride`:

- `src/services/IntegratedPlanGenerator.ts`
  - `calculateDailyNutritionTargets()` → `(outline as any).dailyTargetsOverride = dailyTargets`
  - This is the target actually passed into `BatchMealGenerator.generateWeeklyMeals()`

But most UI code uses `weeklyOutlines[].dailyTargets` and never reads `dailyTargetsOverride`:

- `rg -n "dailyTargetsOverride" src/components` returns no matches (as of this audit)

So it’s entirely possible that:
- Meals are generated to match `dailyTargetsOverride`, but the UI displays “targets” from `dailyTargets` and concludes the meals are off.

### 3.2 Root cause B: Batch meal generation only hard-enforces protein; calories/carbs/fats can drift

In `BatchMealGenerator.generateWeeklyMeals()`:

- It recalculates macros via USDA and runs adjustment (LP/heuristics).
- It produces a validation report (`validateAndReportAccuracy()`).
- It **hard-fails only on protein**, not on calories/carbs/fats:
  - Protein below tolerance throws (`PROTEIN VALIDATION FAILED`)
  - Calories/carbs/fats can be off by >10% and only show up as warnings/errors in the report.

Files:
- `src/services/BatchMealGenerator.ts`
  - `validateAndReportAccuracy()` marks errors if `abs(accuracy - 100) > 10` but does not throw.
  - `adjustMealsToTargets()` logs per-day “accuracy” but does not enforce convergence.

This makes it plausible to observe frequent “target misses” for calories/carbs/fats even if protein looks decent.

### 3.3 Root cause C: “LLM macro math” + “USDA macro truth” is a brittle contract

The batch pipeline asks the model to output ingredient quantities that sum to targets, but then replaces the macros with USDA lookups (`recalculateMacros()`), which can materially change totals.

First principles:
- If you want USDA-grounded accuracy, the LLM should not be the final arbiter of macro math.
- The LLM should generate *structure* (meals, ingredients, constraints, preferences), and a deterministic optimizer should solve quantities against USDA per-100g values.

The current pipeline is moving in that direction (LP/hybrid optimizer exists), but it’s not enforced as a strict invariant for all macros.

---

## 4) RAG audit (is it reducing hallucinations where it matters?)

### 4.1 Goal strategy RAG exists but is effectively unused

`src/rag/goals/goalStrategyKnowledgeBase.ts` provides:
- strategies, constraints, recommended ranges, helper functions (`getCalorieAdjustment()`, `validateGoalForUser()`, etc.)

But usage is essentially nonexistent:
- `rg "getGoalStrategy\\(|searchGoalKnowledge\\(" src` only finds exports within the KB itself and `src/rag/index.ts`.
- No generator/prompt builder imports and injects goal strategy facts.

Net: the system has a “goal strategy KB”, but it does not currently ground generation.

### 4.2 “RAG” in `ai/knowledgeBase.ts` is not retrieval from a corpus

`src/ai/knowledgeBase.ts` is a hard-coded list of `ResearchFact`s (not parsed from PDFs, not fetched, not embedded).
`searchFacts()` does keyword search; it can help with consistency, but it’s not robust “RAG” in the usual sense (no vector retrieval, no expanding corpus, no provenance controls beyond static strings).

### 4.3 Nutrition/cardio RAG is used, but often as static prompt decoration

- Nutrition KB: `src/rag/nutrition/nutritionKnowledgeBase.ts`
  - `BatchMealGenerator` calls `searchNutritionKnowledge('', { minPriority: 5 })` (empty query), which means the same “hard truths” are injected regardless of goal/user context.
- Cardio KB: `src/rag/cardio/cardioKnowledgeBase.ts`
  - `CardioGenerationService` calls `searchCardioKnowledge('', { goal, phase })` (also empty query); filtering helps, but it’s still broad and not issue-specific retrieval.

### 4.4 Consequence

RAG is not being used to constrain the **numeric invariants** (targets, deltas, weekly progression) that drive your main inconsistencies. Those are still delegated to an LLM in key steps.

---

## 5) Recommendations (prioritized)

### P0 — Stop “LLM-generated numbers” from being a source of truth

1. **Compute `weeklyOutlines[].dailyTargets` deterministically** (NutritionCalculationService + goalCategory + planned progression), and pass them to the model as *read-only constraints*.
2. Add **post-generation validators** that hard-fail if:
   - `week.dailyTargets.calories` deviates from the computed progression beyond a tiny tolerance
   - macro calories don’t approximately match grams (4/4/9) within tolerance

### P0 — Fix the “deficit vs surplus” data model

3. Replace the framework fields with a neutral signed delta:
   - e.g. `dailyEnergyDeltaCalories` (positive = deficit, negative = surplus), `weeklyEnergyDeltaCalories`
4. Update `extractPlanMetrics()` to compute the delta from `tdee - targetCalories` (or from deterministic plan-calculated deltas) and **not** trust LLM-provided “deficit” fields.

### P0 — Make the UI reflect the same targets used for meal generation

5. If `dailyTargetsOverride` exists, use it in:
   - energy balance visuals
   - plan metrics dashboard
   - any “meal vs target” comparisons

### P1 — Make meal target compliance an invariant (not an aspiration)

6. In `BatchMealGenerator`, either:
   - hard-fail when calories/carbs/fats miss beyond tolerance, or
   - iterate adjustment/regeneration up to N times with clear stop conditions.
7. Persist the meal validation report into the plan object for debugging (right now it’s only logged).

### P1 — Actually use goal strategy RAG

8. In weekly outlines + strategic framework prompts, inject:
   - `getGoalFacts(goalCategory)` output (or unify this KB with `GOAL_CALORIE_ADJUSTMENTS`)
   - explicit constraints (surplus/deficit ranges, safe weekly change rates)

---

## 6) Quick “where to look next” checklist

- “Why is my bulk showing a deficit?”:
  - `src/utils/planMetricsExtractor.ts` (prefers positive `dailyDeficitCalories`)
  - `src/models/PlanModels.ts` (deficit-only schema)
- “Why are deficits inconsistent between same inputs?”:
  - `src/services/aiSdkRagService.ts` → `generateDetailedWeeklyOutlines()` (LLM emits `dailyTargets`)
  - `src/components/plan-overview/EnergyBalanceVisualization.tsx` (uses `dailyTargets`, ignores override)
- “Why do meals miss targets?”:
  - `src/services/BatchMealGenerator.ts` (only protein is hard-enforced; calories/carb/fat can drift)
  - UI not using `dailyTargetsOverride`

---

## 7) Fix plan status (implemented)

### 7.1 Deterministic targets as source of truth

- `src/services/aiSdkRagService.ts`: Post-processes LLM weekly outlines so `weeklyOutlines[].dailyTargets` are overwritten deterministically from `NutritionCalculationService` (goal-category aware) instead of trusting model-emitted numbers.
- `src/services/IntegratedPlanGenerator.ts`: When calorie cycling produces `dailyTargetsOverride`, the weekly outline `dailyTargets` is synced to the override average for consistent UI/metrics.
- UI: `src/utils/planTargets.ts` added and used so components read `dailyTargetsOverride` when present.

### 7.2 Protein targets never hard-fail

- `src/services/BatchMealGenerator.ts`: Supplements are treated as “locked invariants” so optimizers don’t shrink/remove them.
- `src/services/BatchMealGenerator.ts`: Re-runs `ensureProteinTargets()` after post-supplement calorie adjustments, making protein the final invariant before validation.
- `src/services/BatchMealGenerator.ts`: Precision shake + supplement meals are USDA-recalculated when matching USDA entries exist.

### 7.3 Keep USDA (and make it faster)

- `src/services/BatchMealGenerator.ts`: Caches AI meal templates per phase/preferences for long plans (`timelineWeeks >= 8` by default) to reduce repeated LLM calls.
- `src/services/BatchMealGenerator.ts`: Caches supplement meals per user preference key (avoids a repeated supplement-generation AI call per week).
- `src/services/BatchMealGenerator.ts`: Caches USDA batch lookup results per template key and only looks up missing ingredients.

### 7.4 Reduce per-week AI calls (speed)

- `src/services/CardioGenerationService.ts`: Adds deterministic weekly cardio scheduling (`generateWeeklyCardioScheduleDeterministic`) so weeks don’t require an AI schedule call.
- `src/services/IntegratedPlanGenerator.ts`: Adds phase-cached workout generation (generate 1 template per phase, clone + apply deterministic progression per week).

### 7.5 Regression tests added

- `src/tests/unit/SupplementMealsBypassLP.test.ts`: Ensures day-level LP is bypassed when supplements are present.
- `src/tests/unit/PhaseCachedWorkouts.test.ts`: Ensures 12-week outlines use ≤3 AI workout calls and sessions have unique `templateId`s.
- `src/tests/unit/NutritionCaloriesOverride.test.ts`, `src/tests/unit/PlanTargetsOverrideExtractor.test.ts`, `src/tests/unit/GetTDEEUserProfileShape.test.ts`: Target override + metrics shape coverage.

