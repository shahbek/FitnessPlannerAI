// Dynamic Preference Parser
// Handles single and multiple dietary preferences with fuzzy matching

import { DIETARY_CONSTRAINTS, DietaryConstraints } from './dietaryConstraints';

// Keywords for fuzzy matching dietary preferences
const DIETARY_KEYWORDS: Record<string, string[]> = {
  carnivore: ['carnivore', 'zero carb', 'all meat', 'animal based', 'meat only', 'carnivore diet'],
  ketogenic: ['keto', 'ketogenic', 'low carb high fat', 'lchf', 'keto diet'],
  vegan: ['vegan', 'plant based', 'plant-based', 'vegan diet', 'no animal products'],
  vegetarian: ['vegetarian', 'veggie', 'no meat', 'vegetarian diet', 'lacto ovo'],
  paleo: ['paleo', 'paleolithic', 'primal', 'paleo diet', 'caveman diet'],
  mediterranean: ['mediterranean', 'med diet', 'mediterranean diet'],
  pescatarian: ['pescatarian', 'pesco vegetarian', 'fish only', 'no meat fish ok'],
  gluten_free: ['gluten free', 'gluten-free', 'no gluten', 'gf', 'celiac'],
  dairy_free: ['dairy free', 'dairy-free', 'no dairy', 'lactose free', 'lactose-free'],
  low_fodmap: ['low fodmap', 'low-fodmap', 'fodmap', 'ibs diet', 'digestive'],
  flexible: ['flexible', 'no restrictions', 'anything', 'normal diet', 'regular diet']
};

// Helper function to find intersection of arrays
function intersection<T>(...arrays: T[][]): T[] {
  if (arrays.length === 0) return [];
  if (arrays.length === 1) return arrays[0];
  
  return arrays[0].filter(item => 
    arrays.every(array => array.includes(item))
  );
}

// Helper function to find union of arrays
function union<T>(...arrays: T[][]): T[] {
  const set = new Set<T>();
  arrays.forEach(array => array.forEach(item => set.add(item)));
  return Array.from(set);
}

// Merge macro adjustments from multiple preferences
function mergeMacroAdjustments(parsedPreferences: DietaryConstraints[]): {
  carbs: string;
  protein: string;
  fat: string;
} {
  // If any preference requires carb minimization, prioritize that
  const carbMinimizers = parsedPreferences.filter(p => 
    p.macroAdjustments.carbs.includes('minimize') || p.macroAdjustments.carbs.includes('very_low')
  );
  
  // If any preference requires high fat, prioritize that
  const highFatPreference = parsedPreferences.find(p => 
    p.macroAdjustments.fat.includes('high')
  );
  
  // If any preference requires protein adequacy, prioritize that
  const proteinAdequacy = parsedPreferences.find(p => 
    p.macroAdjustments.protein.includes('ensure')
  );
  
  return {
    carbs: carbMinimizers.length > 0 ? carbMinimizers[0].macroAdjustments.carbs : 'flexible',
    protein: proteinAdequacy ? proteinAdequacy.macroAdjustments.protein : 'flexible',
    fat: highFatPreference ? highFatPreference.macroAdjustments.fat : 'moderate'
  };
}

export function parseDietaryPreference(preferenceString: string): DietaryConstraints {
  if (!preferenceString || preferenceString.trim() === '') {
    return DIETARY_CONSTRAINTS.flexible;
  }
  
  const normalized = preferenceString.toLowerCase().trim();
  
  // Direct match first
  if (DIETARY_CONSTRAINTS[normalized]) {
    return DIETARY_CONSTRAINTS[normalized];
  }
  
  // Fuzzy matching for variations
  for (const [diet, variations] of Object.entries(DIETARY_KEYWORDS)) {
    if (variations.some(v => normalized.includes(v))) {
      return DIETARY_CONSTRAINTS[diet];
    }
  }
  
  // Check for partial matches in the constraint keys
  for (const [diet, constraints] of Object.entries(DIETARY_CONSTRAINTS)) {
    if (normalized.includes(diet) || diet.includes(normalized)) {
      return constraints;
    }
  }
  
  // If no match, treat as flexible with custom notes
  return {
    include: ['all_foods'],
    exclude: [],
    macroAdjustments: {
      carbs: 'based_on_goals',
      protein: 'based_on_goals',
      fat: 'based_on_goals'
    },
    notes: `User specified: "${preferenceString}" - interpret and accommodate as best as possible`
  };
}

// Handle multiple preferences (e.g., "vegan and gluten-free")
export function parseMultiplePreferences(preferenceString: string): DietaryConstraints {
  if (!preferenceString || preferenceString.trim() === '') {
    return DIETARY_CONSTRAINTS.flexible;
  }
  
  // Split by common conjunctions
  const conjunctions = /\s+(and|&|\+|,)\s+/i;
  const preferences = preferenceString.split(conjunctions).filter(p => 
    p.trim() !== '' && !conjunctions.test(p)
  );
  
  if (preferences.length === 1) {
    return parseDietaryPreference(preferences[0]);
  }
  
  // Parse each preference
  const parsed = preferences.map(p => parseDietaryPreference(p.trim()));
  
  // If all preferences are the same, return that one
  const uniquePreferences = [...new Set(parsed.map(p => JSON.stringify(p)))];
  if (uniquePreferences.length === 1) {
    return parsed[0];
  }
  
  // Merge multiple constraints
  return {
    include: intersection(...parsed.map(p => p.include)),
    exclude: union(...parsed.map(p => p.exclude)),
    macroAdjustments: mergeMacroAdjustments(parsed),
    notes: `Combined preferences: ${preferences.join(', ')}`
  };
}

// Extract specific food dislikes from preference string
export function extractFoodDislikes(preferenceString: string): string[] {
  if (!preferenceString) return [];
  
  const dislikes: string[] = [];
  const text = preferenceString.toLowerCase();
  
  // Common dislike patterns
  const dislikePatterns = [
    /don'?t like\s+([^,\.]+)/gi,
    /dislike\s+([^,\.]+)/gi,
    /hate\s+([^,\.]+)/gi,
    /avoid\s+([^,\.]+)/gi,
    /not\s+([^,\.]+)/gi,
    /no\s+([^,\.]+)/gi,
    /can'?t eat\s+([^,\.]+)/gi,
    /allergic to\s+([^,\.]+)/gi
  ];
  
  dislikePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const food = match[1].trim().replace(/[.,]/g, '');
      if (food && food.length > 2) {
        dislikes.push(food);
      }
    }
  });
  
  return [...new Set(dislikes)]; // Remove duplicates
}

// Extract specific food preferences from preference string
export function extractFoodPreferences(preferenceString: string): string[] {
  if (!preferenceString) return [];
  
  const preferences: string[] = [];
  const text = preferenceString.toLowerCase();
  
  // Common preference patterns
  const preferencePatterns = [
    /love\s+([^,\.]+)/gi,
    /enjoy\s+([^,\.]+)/gi,
    /prefer\s+([^,\.]+)/gi,
    /like\s+([^,\.]+)/gi,
    /favorite\s+([^,\.]+)/gi
  ];
  
  preferencePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const food = match[1].trim().replace(/[.,]/g, '');
      if (food && food.length > 2) {
        preferences.push(food);
      }
    }
  });
  
  return [...new Set(preferences)]; // Remove duplicates
}
