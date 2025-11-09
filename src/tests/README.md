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
# Test Meal Generation Pipeline
tsx src/tests/integration/MealGenerationPipeline.test.ts

# Test Workout Generation Pipeline
tsx src/tests/integration/WorkoutGenerationPipeline.test.ts

# Test Complete Integrated Generator
tsx src/tests/integration/IntegratedPlanGenerator.test.ts
```

### Run All Tests

```bash
# Run all unit tests
npm run test

# Run specific test suite
tsx src/tests/integration/MealGenerationPipeline.test.ts
```

## Test Structure

```
src/tests/
├── unit/
│   └── USDANutritionService.test.ts    # USDA API unit tests
├── integration/
│   ├── MealGenerationPipeline.test.ts  # Meal generation flow
│   ├── WorkoutGenerationPipeline.test.ts # Workout generation flow
│   └── IntegratedPlanGenerator.test.ts # End-to-end integration
└── README.md                           # This file
```

## What Each Test Covers

### USDANutritionService.test.ts
- ✅ API client initialization
- ✅ Food search functionality
- ✅ Food details retrieval
- ✅ Macro calculation
- ✅ Caching behavior
- ✅ Error handling (no fallback data)

### MealGenerationPipeline.test.ts
- ✅ Day-level macro distribution
- ✅ USDA API integration
- ✅ Ingredient selection with USDA lookup
- ✅ Portion calculation
- ✅ Macro verification
- ✅ End-to-end meal generation

### WorkoutGenerationPipeline.test.ts
- ✅ Exercise library filtering
- ✅ Training split determination
- ✅ Exercise selection
- ✅ Set/rep assignment
- ✅ Volume calculation
- ✅ Workout verification

### IntegratedPlanGenerator.test.ts
- ✅ Generator initialization
- ✅ State management
- ✅ Component integration
- ✅ Error handling
- ✅ USDA service integration

## Test Requirements

### Required
- ✅ USDA API Key (free)
- ✅ Node.js and npm installed
- ✅ TypeScript and tsx installed

### Optional (for full CoT tests)
- AI Model API Key (Groq, OpenAI, etc.)
- Network access for API calls

## Troubleshooting

### "USDA_API_KEY not found"
- Make sure you have a `.env` file in the project root
- Ensure the key is named `USDA_API_KEY`
- Get a free key from: https://fdc.nal.usda.gov/api-guide.html

### "Food not found" errors
- Some foods may not exist in the USDA database
- Tests use common foods (chicken breast, etc.) that should be available
- Check your API key is valid

### Network timeouts
- USDA API may be slow or rate-limited
- Tests include retry logic
- Check your internet connection

## Continuous Integration

Tests are designed to be run in CI/CD pipelines:
- All tests are deterministic
- Mock-friendly where possible
- Clear error messages
- Exit codes for automation

