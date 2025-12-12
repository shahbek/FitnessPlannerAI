"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Groq Food Photo Analysis Action
 * 
 * Uses Groq Vision API to analyze photos of actual meals and identify
 * ingredients with estimated portion sizes.
 */
export const analyzeFoodPhoto = action({
    args: {
        imageBase64: v.string(), // Base64-encoded image data
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            throw new Error("GROQ_API_KEY is not configured in environment variables");
        }

        try {
            // Prepare the request to Groq Vision API
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Analyze this food photo and identify ALL ingredients with estimated portions AND macros. Return ONLY a JSON object with this structure:
{
  "mealName": "descriptive name of the meal (e.g., 'Cheeseburger', 'Caesar Salad')",
  "ingredients": [
    {
      "name": "ingredient name (e.g., 'ground beef', 'cheddar cheese')",
      "estimatedGrams": number (estimated weight in grams),
      "description": "detailed description including cooking method (e.g., 'beef patty, cooked', '2 slices')",
      "calories": number (estimated calories for this portion),
      "protein": number (estimated protein in grams for this portion),
      "carbs": number (estimated carbs in grams for this portion),
      "fat": number (estimated fat in grams for this portion)
    }
  ]
}

IMPORTANT GUIDELINES:
- Identify ALL visible ingredients including condiments, toppings, and garnishes
- Use common ingredient names
- For cooked items, specify cooking method (e.g., "ground beef, cooked" not just "ground beef")
- Estimate portions realistically based on visual cues
- Include bread, buns, tortillas, etc. with specific type
- For cheese, specify type (e.g., "american cheese", "cheddar cheese")
- For vegetables, be specific (e.g., "iceberg lettuce", "roma tomato")

MACRO ESTIMATION:
- Base macros on standard nutrition data for each ingredient
- Account for cooking method (cooked meat has different macros than raw)
- Be realistic with portion sizes:
  - Burger patty: 100-200g (~250-500 kcal, 20-40g protein)
  - Chicken breast: 150-200g (~250-330 kcal, 45-60g protein)
  - Bun/bread: 50-80g (~150-240 kcal, 5-8g protein, 30-45g carbs)
  - Cheese slice: 20-30g (~80-120 kcal, 5-7g protein, 6-9g fat)
  - Lettuce/vegetables: 20-50g (~5-15 kcal, minimal macros)
  - Condiments: 10-20g (varies by type)

TODO: Replace AI macro estimation with USDA database lookups for accuracy
See AGENTS.md for implementation details

Be thorough and accurate with your estimates.`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: args.imageBase64,
                                    },
                                },
                            ],
                        },
                    ],
                    temperature: 0.4, // Slightly higher for better ingredient identification
                    max_completion_tokens: 1024,
                    top_p: 1,
                    response_format: { type: "json_object" },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Groq API error:", errorText);
                throw new Error(`Groq API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;

            if (!content) {
                throw new Error("No content returned from Groq API");
            }

            // Parse the JSON response
            const analysisData = JSON.parse(content);

            // Log the raw response for debugging
            console.log("Food Analysis Raw Response:", JSON.stringify(analysisData, null, 2));

            // Validate the response structure
            if (!analysisData.ingredients || !Array.isArray(analysisData.ingredients)) {
                console.error("Invalid response structure:", analysisData);
                throw new Error("Could not identify ingredients in the photo. Please try with a clearer image.");
            }

            // Ensure all ingredients have required fields
            const validatedIngredients = analysisData.ingredients.map((ing: any) => {
                // Parse macro values
                const parseNumber = (value: any): number => {
                    if (typeof value === 'number') return value;
                    if (typeof value === 'string') {
                        const parsed = parseFloat(value);
                        return isNaN(parsed) ? 0 : parsed;
                    }
                    return 0;
                };

                return {
                    name: String(ing.name || "Unknown ingredient"),
                    estimatedGrams: Math.max(1, Math.round(Number(ing.estimatedGrams) || 50)),
                    description: String(ing.description || ing.name || ""),
                    // Macros from AI (TODO: Replace with USDA lookups)
                    calories: Math.round(parseNumber(ing.calories)),
                    protein: Math.round(parseNumber(ing.protein) * 10) / 10,
                    carbs: Math.round(parseNumber(ing.carbs) * 10) / 10,
                    fat: Math.round(parseNumber(ing.fat) * 10) / 10,
                };
            });

            // Calculate totals
            const totals = validatedIngredients.reduce((acc: any, ing: any) => ({
                calories: acc.calories + ing.calories,
                protein: acc.protein + ing.protein,
                carbs: acc.carbs + ing.carbs,
                fat: acc.fat + ing.fat,
            }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

            return {
                mealName: String(analysisData.mealName || "Analyzed Meal"),
                ingredients: validatedIngredients,
                totals: {
                    calories: Math.round(totals.calories),
                    protein: Math.round(totals.protein * 10) / 10,
                    carbs: Math.round(totals.carbs * 10) / 10,
                    fat: Math.round(totals.fat * 10) / 10,
                },
            };
        } catch (error) {
            console.error("Food analysis error:", error);

            // Provide user-friendly error messages
            if (error instanceof Error) {
                if (error.message.includes("JSON")) {
                    throw new Error("Failed to analyze the food photo. Please try with a clearer image showing the meal.");
                }
                throw new Error(`Analysis failed: ${error.message}`);
            }

            throw new Error("Failed to analyze the food photo. Please try again with a clearer image.");
        }
    },
});
