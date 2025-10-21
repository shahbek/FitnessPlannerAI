# Fitness Planner AI

An intelligent fitness planning application that generates personalized workout and nutrition plans using scientific research and evidence-based calculations. Built with advanced AI integration to create comprehensive, realistic fitness programs tailored to individual goals and constraints.

## Purpose

Fitness Planner AI addresses the gap between generic fitness advice and truly personalized, scientifically-grounded fitness planning. Traditional fitness apps provide one-size-fits-all solutions, but this application leverages AI to create detailed, research-backed plans that consider:

- **Individual body composition** and metabolic calculations
- **Realistic timelines** based on evidence-based fat loss rates
- **Dietary preferences and restrictions** with strict compliance validation
- **Training experience and equipment availability**
- **Personal schedules and time constraints**

## Key Features

### 🔬 **Research-Grounded Approach**
- All numerical values (BMR, TDEE, safe fat-loss rates, training volume) are derived from deterministic calculators
- Refuses or adjusts timelines that exceed evidence-based safety limits
- Surfaces metrics and citations so coaches can inspect every recommendation

### 🎯 **Phase-Aware Generation**
- Splits plans into explicit phases (Foundation → Progression → Peak)
- Each phase includes specific macro targets, training emphases, and recovery tactics
- Generates concise seed templates per phase rather than overwhelming 12-week plans at once

### 🍽️ **Nutritional Accuracy**
- Researches actual nutritional data from USDA FoodData Central
- Provides exact ingredient weights, calories, and macro breakdowns
- Validates meal compliance with dietary constraints at ingredient level
- Ensures meal macros equal sum of ingredient macros

### 📊 **Deterministic Expansion**
- Expands phase seeds with TypeScript logic for weekly workout scheduling
- Honors progressive overload and deloads
- Alternates meals to hit macro shifts (higher carbs on training days)
- Injects domain-specific tactics from vetted research when goals demand it

### ✅ **Strict Validation**
- Validates JSON structure and semantics after each AI generation
- Checks macro totals vs. calculated targets
- Ensures each muscle group hits recommended sets
- Confirms high-risk instructions only appear when explicitly needed

### 🔍 **Transparent Output**
- Returns detailed metrics and per-item citations
- Flags assumptions and extreme protocols in reasoning
- Provides complete audit trail for every recommendation

## Technology

Built with modern web technologies and AI integration:
- **React + TypeScript** for robust frontend development
- **AI SDK** with Groq and OpenAI integration for intelligent plan generation
- **Zod schemas** for structured, validated AI outputs
- **Research knowledge base** with scientific literature integration
- **Deterministic calculators** for evidence-based metrics

## Getting Started

1. Clone the repository and install dependencies
2. Configure your API key (Groq or OpenAI)
3. Fill in your profile with body metrics, goals, and preferences
4. Generate your personalized, research-backed fitness plan

## Philosophy

This application represents a new approach to fitness planning that prioritizes scientific accuracy, personalization, and transparency. Instead of generic templates, it creates truly individualized plans grounded in research, validated for safety, and optimized for your specific circumstances.

Every recommendation is traceable to its source, every calculation is deterministic, and every constraint is respected. This is fitness planning elevated to the level of precision it deserves.