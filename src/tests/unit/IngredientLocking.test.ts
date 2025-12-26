/**
 * Unit Tests for Ingredient Locking Logic
 * 
 * Run with: tsx src/tests/unit/IngredientLocking.test.ts
 */

import { isSensitiveIngredient } from '../../constants/ingredients';
import { HybridMealOptimizer } from '../../services/optimizers/HybridMealOptimizer';
import { normalizeFoodName } from '../../utils/usdaMapper';

async function runTests() {
    console.log('🧪 Testing Ingredient Locking Logic');
    console.log('==================================\n');

    let passed = 0;
    let failed = 0;

    const test = (name: string, fn: () => void) => {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error: any) {
            console.error(`❌ ${name}`);
            console.error(`   Error: ${error.message}`);
            failed++;
        }
    };

    // Test 1: Sensitive Ingredient Identification
    test('Identifies oils as sensitive', () => {
        const oils = ['olive oil', 'vegetable oil', 'peanut oil', 'oil'];
        oils.forEach(o => {
            if (!isSensitiveIngredient(o)) throw new Error(`${o} should be sensitive`);
        });
    });

    test('Identifies butter and fats as sensitive', () => {
        const fats = ['butter', 'ghee', 'lard', 'margarine'];
        fats.forEach(f => {
            if (!isSensitiveIngredient(f)) throw new Error(`${f} should be sensitive`);
        });
    });

    test('Identifies sugars and syrups as sensitive', () => {
        const sugars = ['sugar', 'honey', 'maple syrup', 'agave syrup'];
        sugars.forEach(s => {
            if (!isSensitiveIngredient(s)) throw new Error(`${s} should be sensitive`);
        });
    });

    // Test 2: Whole Food Identification (Not Sensitive)
    test('Identifies whole foods as NOT sensitive', () => {
        const wholeFoods = ['chicken breast', 'carrot', 'beef', 'spinach', 'apple', 'sweet potato'];
        wholeFoods.forEach(w => {
            if (isSensitiveIngredient(w)) throw new Error(`${w} should NOT be sensitive`);
        });
    });

    test('Avoids false positives for "sugar snap peas"', () => {
        if (isSensitiveIngredient('sugar snap peas')) throw new Error('Sugar snap peas should NOT be sensitive');
    });

    // Test 3: HybridMealOptimizer locking check
    test('HybridMealOptimizer.prepareIngredients locks sensitive items', () => {
        const mealIngredients = [
            { name: 'Chicken Breast', amount: 150, nutrition: { calories: 247, protein: 46, carbs: 0, fats: 5 }, fdcId: 123 },
            { name: 'Olive Oil', amount: 15, nutrition: { calories: 135, protein: 0, carbs: 0, fats: 15 }, fdcId: 456 },
            { name: 'Honey', amount: 10, nutrition: { calories: 30, protein: 0, carbs: 8, fats: 0 }, fdcId: 789 },
            { name: 'Carrots', amount: 100, nutrition: { calories: 41, protein: 1, carbs: 10, fats: 0 }, fdcId: 321 },
        ];

        // Mock USDA data
        const usdaData = {
            [normalizeFoodName('Chicken Breast')]: { nutrition: { calories: 247, protein: 46, carbs: 0, fats: 5 }, fdcId: 123 },
            [normalizeFoodName('Olive Oil')]: { nutrition: { calories: 884, protein: 0, carbs: 0, fats: 100 }, fdcId: 456 },
            [normalizeFoodName('Honey')]: { nutrition: { calories: 304, protein: 0, carbs: 82, fats: 0 }, fdcId: 789 },
            [normalizeFoodName('Carrots')]: { nutrition: { calories: 41, protein: 1, carbs: 10, fats: 0 }, fdcId: 321 },
        };

        const optimizable = HybridMealOptimizer.prepareIngredients(mealIngredients, usdaData);

        const chicken = optimizable.find(i => i.name === 'Chicken Breast');
        const oil = optimizable.find(i => i.name === 'Olive Oil');
        const honey = optimizable.find(i => i.name === 'Honey');
        const carrots = optimizable.find(i => i.name === 'Carrots');

        if (chicken?.isLocked) throw new Error('Chicken should be adjustable');
        if (!oil?.isLocked) throw new Error('Olive oil should be locked');
        if (!honey?.isLocked) throw new Error('Honey should be locked');
        if (carrots?.isLocked) throw new Error('Carrots should be adjustable');

        console.log('   Locking logic verified in HybridMealOptimizer');
    });

    // Summary
    console.log('\n==================================');
    console.log(`Tests: ${passed + failed} total`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});
