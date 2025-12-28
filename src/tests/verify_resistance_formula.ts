
import { estimateResistanceCalories } from '../utils/planCalculations';

const weight = 80;
const duration = 60;
const mets = 3.5;

// Expected: 60 * (3.5 * 3.5 * 80) / 200
// = 60 * 980 / 200
// = 58800 / 200
// = 294

const burned = estimateResistanceCalories(duration, weight);

console.log(`Weight: ${weight}kg`);
console.log(`Duration: ${duration}min`);
console.log(`Formula: duration * (3.5 * 3.5 * weight) / 200`);
console.log(`Expected: 294`);
console.log(`Calculated: ${burned}`);

if (burned === 294) {
    console.log("✅ Verification Passed");
} else {
    console.log("❌ Verification Failed");
}
