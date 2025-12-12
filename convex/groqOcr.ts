"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Groq OCR Action for Nutrition Label Extraction
 * 
 * Uses Groq Vision API (llama-4-scout-17b-16e-instruct) to extract
 * nutrition information from food product labels.
 */
export const extractNutrition = action({
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
                                    text: `Extract nutrition information from this food product label. Return ONLY a JSON object with the following structure:
{
  "productName": "name of the product",
  "servingSize": "serving size with unit (e.g., '1 cup (240ml)', '30g', '1 bar')",
  "calories": number (total calories per serving),
  "protein": number (grams of protein per serving),
  "carbs": number (grams of total carbohydrates per serving),
  "fat": number (grams of total fat per serving),
  "sugar": number (grams of sugar per serving, optional)
}

Important:
- Extract values per serving, not per 100g
- Use only numbers for macros (no units in the values)
- If a value is not clearly visible, use 0
- Product name should be the brand and product name if visible
- Be precise with the serving size description`
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
                    temperature: 0.3, // Lower temperature for more consistent extraction
                    max_completion_tokens: 512,
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
            const nutritionData = JSON.parse(content);

            // Log the raw response for debugging
            console.log("OCR Raw Response:", JSON.stringify(nutritionData, null, 2));

            // Convert string numbers to actual numbers
            const parseNumber = (value: any): number => {
                if (typeof value === 'number') return value;
                if (typeof value === 'string') {
                    const parsed = parseFloat(value);
                    return isNaN(parsed) ? 0 : parsed;
                }
                return 0;
            };

            // Ensure all required fields exist with defaults
            // Product name is optional since most nutrition labels don't include it
            return {
                productName: String(nutritionData.productName || "Scanned Product"),
                servingSize: String(nutritionData.servingSize || "1 serving"),
                calories: Math.round(parseNumber(nutritionData.calories)),
                protein: Math.round(parseNumber(nutritionData.protein) * 10) / 10,
                carbs: Math.round(parseNumber(nutritionData.carbs) * 10) / 10,
                fat: Math.round(parseNumber(nutritionData.fat) * 10) / 10,
                sugar: nutritionData.sugar ? Math.round(parseNumber(nutritionData.sugar) * 10) / 10 : undefined,
            };
        } catch (error) {
            console.error("OCR extraction error:", error);

            // Provide user-friendly error messages
            if (error instanceof Error) {
                if (error.message.includes("JSON")) {
                    throw new Error("Failed to parse nutrition information. Please try with a clearer image.");
                }
                throw new Error(`OCR failed: ${error.message}`);
            }

            throw new Error("Failed to extract nutrition information. Please try again with a clearer image.");
        }
    },
});
