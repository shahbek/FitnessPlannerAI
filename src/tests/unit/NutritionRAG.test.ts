/**
 * Unit Tests for Nutrition RAG System
 * 
 * Run with: tsx src/tests/unit/NutritionRAG.test.ts
 */

import { searchNutritionKnowledge, getNutritionRecommendations, NUTRITION_KNOWLEDGE_BASE } from '../../rag/nutrition/nutritionKnowledgeBase';

async function runTests() {
    console.log('🧪 Testing Nutrition RAG System');
    console.log('==============================\n');

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

    // Test 1: Category Filtering
    test('Filters by category: sugar', () => {
        const sugarFacts = searchNutritionKnowledge('', { category: 'sugar' });
        if (sugarFacts.length === 0) throw new Error('No sugar facts found');
        if (!sugarFacts.every(f => f.category === 'sugar')) throw new Error('Category filtering failed');
        console.log(`   Found ${sugarFacts.length} sugar facts`);
    });

    // Test 2: Generic Food Category Lookup
    test('Retrieves processed sugary foods truth', () => {
        const sugaryFacts = searchNutritionKnowledge('processed');
        const sugaryFact = sugaryFacts.find(f => f.id === 'processed-sugary-foods');
        if (!sugaryFact) throw new Error('Processed foods warning not found');
        if (!sugaryFact.content.includes('Ultra-processed')) throw new Error('Incorrect content for processed foods');
        console.log(`   Fact found: ${sugaryFact.content.substring(0, 50)}...`);
    });

    // Test 3: Water Zero Calorie Truth
    test('Retrieves Water zero calorie truth', () => {
        const waterFacts = searchNutritionKnowledge('water');
        const waterFact = waterFacts.find(f => f.id === 'water-zero-calories');
        if (!waterFact) throw new Error('Water zero calorie truth not found');
        console.log(`   Fact found: ${waterFact.content}`);
    });

    // Test 4: Cooking Fat limit truth
    test('Retrieves Cooking fat limit truth', () => {
        const fatFacts = searchNutritionKnowledge('butter');
        const fatFact = fatFacts.find(f => f.id === 'cooking-fat-limit');
        if (!fatFact) throw new Error('Cooking fat limit truth not found');
        if (!fatFact.content.includes('5-15g')) throw new Error('Incorrect content for fat limit');
        console.log(`   Fact found: ${fatFact.content}`);
    });

    // Test 5: Cuisine authenticity truths
    test('Retrieves Cuisine authenticity truths', () => {
        const cuisineFacts = searchNutritionKnowledge('cuisine');
        if (!cuisineFacts.some(f => f.id === 'cuisine-authenticity')) throw new Error('Cuisine authenticity fact not found');
        if (!cuisineFacts.some(f => f.id === 'ingredient-decomposition')) throw new Error('Ingredient decomposition fact not found');
        console.log(`   Found ${cuisineFacts.length} cuisine related facts`);
    });

    // Test 6: Snack Calorie limit truth
    test('Retrieves Snack calorie limit truth', () => {
        const snackFacts = searchNutritionKnowledge('snack');
        const snackFact = snackFacts.find(f => f.id === 'snack-calorie-limit');
        if (!snackFact) throw new Error('Snack calorie limit truth not found');
        if (!snackFact.content.includes('350')) throw new Error('Incorrect content for snack limit');
        console.log(`   Fact found: ${snackFact.content}`);
    });

    // Test 5: Priority Ranking
    test('Sorts by priority', () => {
        const allFacts = searchNutritionKnowledge('');
        for (let i = 0; i < allFacts.length - 1; i++) {
            if (allFacts[i].priority < allFacts[i + 1].priority) {
                throw new Error('Facts not sorted by priority');
            }
        }
        console.log('   Priority sorting verified');
    });

    // Test 5: Recommendations Limit
    test('getNutritionRecommendations respects limit', () => {
        const recs = getNutritionRecommendations(2);
        if (recs.length !== 2) throw new Error(`Expected 2 recommendations, got ${recs.length}`);
        console.log('   Recommendations limit verified');
    });

    // Summary
    console.log('\n==============================');
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
