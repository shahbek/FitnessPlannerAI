/**
 * Valid shopping list ingredient categories
 * These categories are used for organizing ingredients in the shopping list
 * and by the AI when categorizing unknown ingredients.
 */

export const INGREDIENT_CATEGORIES = [
  'Proteins',
  'Grains',
  'Vegetables',
  'Fruits',
  'Dairy & Eggs',
  'Oils & Condiments',
  'Nuts & Seeds',
  'Herbs & Spices',
  'Supplements'
] as const;

export type IngredientCategory = typeof INGREDIENT_CATEGORIES[number];

/**
 * Category descriptions to help AI understand what belongs in each category
 */
export const CATEGORY_DESCRIPTIONS: Record<IngredientCategory, string> = {
  'Proteins': 'Meat, poultry, fish, seafood, eggs, tofu, tempeh, seitan, legumes (lentils, chickpeas, beans)',
  'Grains': 'Rice, pasta, bread, quinoa, oats, flour, cereal, noodles, tortillas, wraps',
  'Vegetables': 'All vegetables including leafy greens, root vegetables, cruciferous vegetables, nightshades, alliums',
  'Fruits': 'All fruits including berries, citrus, stone fruits, tropical fruits, melons',
  'Dairy & Eggs': 'Milk, cheese, yogurt, butter, cream, dairy alternatives (almond milk, soy milk, etc.), eggs',
  'Oils & Condiments': 'Cooking oils, vinegar, sauces, condiments, sweeteners, broths, stocks, marinades',
  'Nuts & Seeds': 'All nuts (almonds, walnuts, cashews), nut butters, seeds (chia, flax, pumpkin, sunflower)',
  'Herbs & Spices': 'Fresh herbs (basil, cilantro, parsley), dried spices, seasonings, vanilla extract',
  'Supplements': 'Protein powder, whey protein, creatine, vitamins, supplements'
};
