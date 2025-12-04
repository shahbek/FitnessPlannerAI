# Testing Guide

This directory contains comprehensive tests for the MDD plan generation system.

## Setup

1. **Get USDA API Key** (Required for integration tests):
   - Visit: https://fdc.nal.usda.gov/api-guide.html
   - Sign up for a free API key
   - Add to `.env` file: `USDA_API_KEY=your-key-here`

2. **Environment Variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

## Running Tests

### Unit Tests

```bash
# Test USDA Nutrition Service
npm run test:usda

# Or directly with tsx
tsx src/tests/unit/USDANutritionService.test.ts
```

### Integration Tests

```bash
# Test Workout Generation Pipeline
tsx src/tests/integration/WorkoutGenerationPipeline.test.ts

# Test Complete Integrated Generator
tsx src/tests/integration/IntegratedPlanGenerator.test.ts

# Test Full Plan Generation (meals + workouts)
tsx src/tests/integration/FullPlanGeneration.test.ts
```

### Manual Tests

```bash
# Test Cardio Generation (see AI-generated cardio data)
tsx src/tests/manual/CardioGenerationDebug.ts

# Test Weekly Meal Generation
tsx src/tests/manual/WeeklyMealGenerationDebug.ts
```

### Run All Tests

```bash
# Run full test matrix
npm run test:all

# Run a specific integration suite
tsx src/tests/integration/IntegratedPlanGenerator.test.ts
```

## Manual Test Details

### CardioGenerationDebug.ts

Tests the cardio generation system to see what data we get from AI.

**Run with:**
```bash
tsx src/tests/manual/CardioGenerationDebug.ts
```

**What it tests:**
- Phase-specific cardio template generation (Foundation, Progression, Peak)
- Weekly cardio schedule generation with day assignments
- Full data structure validation
- Different user goals (fat loss, muscle gain)
- Template structure details (warmup, main workout, cooldown)
- Heart rate zones, calorie estimates, equipment requirements

**Output:**
- Detailed template information for each phase
- Weekly schedule with day assignments
- Validation results
- Full data structure display