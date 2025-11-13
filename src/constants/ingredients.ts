import { normalizeFoodName } from '../utils/usdaMapper';

/**
 * Descriptor words that do not materially change the ingredient identity.
 * We strip these so lookups can fall back to the core ingredient term.
 */
export const INGREDIENT_DESCRIPTOR_WORDS = new Set([
  'fresh',
  'organic',
  'boneless',
  'skinless',
  'shredded',
  'sliced',
  'diced',
  'chopped',
  'minced',
  'ground',
  'grilled',
  'baked',
  'roasted',
  'smoked',
  'seared',
  'broiled',
  'sauteed',
  'fried',
  'steamed',
  'boiled',
  'poached',
  'fillet',
  'fillets',
  'filet',
  'filets',
  'whole',
  'plain',
  'unsweetened',
  'sweetened',
  'reduced',
  'low',
  'fat-free',
  'lean',
  'extra',
  'large',
  'medium',
  'small',
  'crushed',
  'powdered',
  'powder',
  'flakes',
  'flaked',
  'julienned',
  'ripe',
  'baby',
]);

const ZERO_IMPACT_EXACT_NAMES = [
  'salt',
  'sea salt',
  'kosher salt',
  'table salt',
  'pink salt',
  'pepper',
  'black pepper',
  'white pepper',
  'peppercorn',
  'pepper flakes',
  'red pepper flakes',
  'chili flakes',
  'chili powder',
  'garlic',
  'garlic powder',
  'garlic granules',
  'onion powder',
  'onion flakes',
  'scallion greens',
  'italian seasoning',
  'mixed herbs',
  'herbs',
  'spice',
  'spices',
  'paprika',
  'smoked paprika',
  'cumin',
  'oregano',
  'basil',
  'thyme',
  'rosemary',
  'cilantro',
  'parsley',
  'sage',
  'dill',
  'bay leaf',
  'bay leaves',
  'tarragon',
  'marjoram',
  'mint',
  'turmeric',
  'curry powder',
  'five spice powder',
  'ginger',
  'ginger powder',
  'ginger root',
  'cardamom',
  'coriander',
  'clove',
  'cloves',
  'allspice',
  'nutmeg',
  'cinnamon',
  'star anise',
  'saffron',
  'sumac',
  'harissa',
  'lemongrass',
  'seasoning',
  'seasoning blend',
  'steak seasoning',
  'everything bagel seasoning',
  'cajun seasoning',
  'taco seasoning',
  'ranch seasoning',
  'herb blend',
  'hot sauce',
  'sriracha',
  'vinegar',
  'apple cider vinegar',
  'balsamic vinegar',
  'red wine vinegar',
  'white vinegar',
  'rice vinegar',
  'malt vinegar',
  'lemon juice',
  'lime juice',
  'lemon zest',
  'lime zest',
  'citrus zest',
  'orange zest',
  'mustard',
  'yellow mustard',
  'dijon mustard',
  'stone ground mustard',
  'horseradish',
  'fish sauce',
  'soy sauce',
  'tamari',
  'worcestershire sauce',
];

const ZERO_IMPACT_EXACT = new Set(
  ZERO_IMPACT_EXACT_NAMES.map((name) => normalizeFoodName(name))
);

const ZERO_IMPACT_KEYWORDS = [
  'seasoning',
  'spice',
  'herb',
  'sprig',
  'zest',
  'garnish',
  'extract',
];

/**
 * Strip descriptors from an ingredient name so searches focus on the core food.
 */
export function stripDescriptorWords(name: string): string {
  const normalized = normalizeFoodName(name);
  const parts = normalized.split(' ').filter(Boolean);
  const filtered = parts.filter((part) => !INGREDIENT_DESCRIPTOR_WORDS.has(part));
  return filtered.join(' ').trim();
}

/**
 * Determine whether an ingredient should be treated as zero-impact
 * (seasonings, herbs, and condiments with negligible macros).
 */
export function isZeroImpactIngredient(name: string): boolean {
  const stripped = stripDescriptorWords(name);
  if (!stripped) {
    return true;
  }

  if (ZERO_IMPACT_EXACT.has(stripped)) {
    return true;
  }

  return ZERO_IMPACT_KEYWORDS.some((keyword) => stripped.includes(keyword));
}

export { ZERO_IMPACT_KEYWORDS };
