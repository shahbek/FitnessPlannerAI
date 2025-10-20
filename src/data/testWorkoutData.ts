// Test workout data from outputObject.txt for development and testing

export const testWorkoutData = {
  "feasibility": {
    "isFeasible": false,
    "confidenceScore": 0.6,
    "reasoning": "The user's goal of fat loss in 12 weeks with 6 training days per week is ambitious, especially for an expert. While it's possible, it may not be feasible without considering potential risks and challenges.",
    "risks": [
      "over-training",
      "insufficient recovery time",
      "inadequate nutrition planning"
    ],
    "recommendations": [
      "incorporate periodization to avoid plateaus",
      "ensure adequate nutrition and recovery strategies are in place",
      "monitor progress and adjust training volume and intensity as needed"
    ]
  },
  "strategicFramework": {
    "trainingApproach": {
      "split": "push_pull_legs",
      "frequencyPerWeek": 6,
      "sessionDurationMinutes": 60,
      "periodization": "undulating",
      "volumePerMuscleWeekly": {
        "Chest": 12,
        "Back": 15,
        "Shoulders": 10,
        "Arms": 12,
        "Legs": 15
      }
    },
    "nutritionApproach": {
      "caloricStrategy": {
        "deficitMagnitude": "moderate",
        "dailyDeficitCalories": 500,
        "weeklyDeficitCalories": 3500
      },
      "macroTargets": {
        "proteinTotalGrams": 170,
        "proteinPerKg": 1.7,
        "carbPercentage": 40,
        "fatPercentage": 30
      },
      "mealFrequency": 5,
      "timing": {
        "preWorkout": "1 hour",
        "postWorkout": "within 30 minutes",
        "bedtime": "1 hour before sleep"
      }
    }
  },
  "exerciseLibrary": [
    {
      "exerciseId": "1",
      "name": "Bench Press",
      "muscleGroups": [
        "Chest",
        "Shoulders",
        "Triceps"
      ],
      "equipment": [
        "Barbell",
        "Bench"
      ],
      "difficulty": "expert",
      "formCues": [
        "Squeeze your chest muscles",
        "Lower the bar to your chest",
        "Press upwards explosively"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Shoulder injuries",
        "Chest injuries"
      ]
    },
    {
      "exerciseId": "2",
      "name": "Pull-ups",
      "muscleGroups": [
        "Back",
        "Biceps"
      ],
      "equipment": [
        "Pull-up bar"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Pull yourself up",
        "Lower yourself down slowly"
      ],
      "progressionOptions": [
        "Increase reps",
        "Add weight",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease reps",
        "Assist with a band",
        "Increase rest time"
      ],
      "contraindications": [
        "Shoulder injuries",
        "Back injuries"
      ]
    },
    {
      "exerciseId": "3",
      "name": "Squats",
      "muscleGroups": [
        "Legs",
        "Glutes"
      ],
      "equipment": [
        "Barbell"
      ],
      "difficulty": "expert",
      "formCues": [
        "Keep your back straight",
        "Lower yourself down",
        "Push through your heels"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Knee injuries",
        "Back injuries"
      ]
    },
    {
      "exerciseId": "4",
      "name": "Dumbbell Shoulder Press",
      "muscleGroups": [
        "Shoulders",
        "Triceps"
      ],
      "equipment": [
        "Dumbbells"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Press the dumbbells up",
        "Lower the dumbbells down"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Shoulder injuries"
      ]
    },
    {
      "exerciseId": "5",
      "name": "Lunges",
      "muscleGroups": [
        "Legs",
        "Glutes"
      ],
      "equipment": [
        "Barbell"
      ],
      "difficulty": "expert",
      "formCues": [
        "Keep your back straight",
        "Lower yourself down",
        "Push through your front heel"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Knee injuries",
        "Back injuries"
      ]
    },
    {
      "exerciseId": "6",
      "name": "Leg Press",
      "muscleGroups": [
        "Legs",
        "Glutes"
      ],
      "equipment": [
        "Leg press machine"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Push the platform away",
        "Lower the platform down"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Knee injuries",
        "Back injuries"
      ]
    },
    {
      "exerciseId": "7",
      "name": "Seated Row",
      "muscleGroups": [
        "Back",
        "Biceps"
      ],
      "equipment": [
        "Seated row machine"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Pull the bar towards you",
        "Release the bar slowly"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Back injuries",
        "Shoulder injuries"
      ]
    },
    {
      "exerciseId": "8",
      "name": "Bicep Curls",
      "muscleGroups": [
        "Biceps"
      ],
      "equipment": [
        "Dumbbells"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Curl the dumbbells up",
        "Lower the dumbbells down"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Elbow injuries"
      ]
    },
    {
      "exerciseId": "9",
      "name": "Tricep Pushdowns",
      "muscleGroups": [
        "Triceps"
      ],
      "equipment": [
        "Cable machine"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Extend the bar down",
        "Return the bar to the starting position"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Elbow injuries"
      ]
    },
    {
      "exerciseId": "10",
      "name": "Chest Fly",
      "muscleGroups": [
        "Chest"
      ],
      "equipment": [
        "Dumbbells"
      ],
      "difficulty": "expert",
      "formCues": [
        "Engage your core",
        "Press the dumbbells out",
        "Return the dumbbells to the starting position"
      ],
      "progressionOptions": [
        "Increase weight",
        "Increase reps",
        "Decrease rest time"
      ],
      "regressionOptions": [
        "Decrease weight",
        "Decrease reps",
        "Increase rest time"
      ],
      "contraindications": [
        "Shoulder injuries",
        "Chest injuries"
      ]
    }
  ],
  "sessionTemplates": [
    {
      "templateId": "push_day_1",
      "name": "Chest and Triceps",
      "targetMuscles": [
        "Chest",
        "Triceps",
        "Shoulders"
      ],
      "totalDurationMinutes": 60,
      "structure": [
        {
          "exerciseId": "Bench Press",
          "sets": 4,
          "reps": "8-12",
          "restSeconds": 60,
          "notes": "Warm-up with 5-10 minutes of cardio and dynamic stretching"
        },
        {
          "exerciseId": "Incline Dumbbell Press",
          "sets": 3,
          "reps": "10-15",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Chest Fly",
          "sets": 3,
          "reps": "12-15",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Tricep Pushdowns",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Shoulder Rotations",
          "sets": 3,
          "reps": "12-15",
          "restSeconds": 60,
          "notes": "Cool-down with 5-10 minutes of stretching"
        }
      ]
    },
    {
      "templateId": "pull_day_1",
      "name": "Back and Biceps",
      "targetMuscles": [
        "Back",
        "Biceps"
      ],
      "totalDurationMinutes": 60,
      "structure": [
        {
          "exerciseId": "Pull-ups",
          "sets": 3,
          "reps": "8-12",
          "restSeconds": 60,
          "notes": "Warm-up with 5-10 minutes of cardio and dynamic stretching"
        },
        {
          "exerciseId": "Seated Row",
          "sets": 4,
          "reps": "8-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Lat Pulldowns",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Bicep Curls",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Face Pulls",
          "sets": 3,
          "reps": "12-15",
          "restSeconds": 60,
          "notes": "Cool-down with 5-10 minutes of stretching"
        }
      ]
    },
    {
      "templateId": "legs_day_1",
      "name": "Legs",
      "targetMuscles": [
        "Legs",
        "Glutes"
      ],
      "totalDurationMinutes": 60,
      "structure": [
        {
          "exerciseId": "Squats",
          "sets": 4,
          "reps": "8-12",
          "restSeconds": 60,
          "notes": "Warm-up with 5-10 minutes of cardio and dynamic stretching"
        },
        {
          "exerciseId": "Leg Press",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Lunges",
          "sets": 3,
          "reps": "10-12",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Leg Extensions",
          "sets": 3,
          "reps": "12-15",
          "restSeconds": 60,
          "notes": ""
        },
        {
          "exerciseId": "Glute Bridges",
          "sets": 3,
          "reps": "12-15",
          "restSeconds": 60,
          "notes": "Cool-down with 5-10 minutes of stretching"
        }
      ]
    }
  ],
  "mealTemplates": [
    {
      "templateId": "MT001",
      "name": "Breakfast - Post-Wake Up",
      "mealType": "Breakfast",
      "totalCalories": 350,
      "macros": {
        "protein": 30,
        "carbs": 40,
        "fat": 10
      },
      "baseRecipe": {
        "name": "Greek Yogurt Parfait with Berries and Granola",
        "ingredients": [
          {
            "name": "Greek Yogurt",
            "amount": "1 cup",
            "calories": 100
          },
          {
            "name": "Mixed Berries",
            "amount": "1/2 cup",
            "calories": 60
          },
          {
            "name": "Granola",
            "amount": "2 tbsp",
            "calories": 100
          },
          {
            "name": "Egg Whites",
            "amount": "2 large",
            "calories": 140
          }
        ],
        "instructions": [
          "Combine yogurt, berries, and granola in a bowl.",
          "Top with egg whites."
        ]
      }
    },
    {
      "templateId": "MT002",
      "name": "Mid-Morning Snack",
      "mealType": "Snack",
      "totalCalories": 150,
      "macros": {
        "protein": 20,
        "carbs": 15,
        "fat": 5
      },
      "baseRecipe": {
        "name": "Apple Slices with Almond Butter and Protein Shake",
        "ingredients": [
          {
            "name": "Apple",
            "amount": "1 medium",
            "calories": 95
          },
          {
            "name": "Almond Butter",
            "amount": "2 tbsp",
            "calories": 100
          },
          {
            "name": "Whey Protein Powder",
            "amount": "1 scoop",
            "calories": 120
          },
          {
            "name": "Water",
            "amount": "8 oz",
            "calories": 0
          }
        ],
        "instructions": [
          "Spread almond butter on apple slices.",
          "Consume protein shake."
        ]
      }
    },
    {
      "templateId": "MT003",
      "name": "Lunch",
      "mealType": "Lunch",
      "totalCalories": 400,
      "macros": {
        "protein": 40,
        "carbs": 30,
        "fat": 15
      },
      "baseRecipe": {
        "name": "Grilled Chicken Breast with Quinoa and Steamed Vegetables",
        "ingredients": [
          {
            "name": "Chicken Breast",
            "amount": "4 oz",
            "calories": 120
          },
          {
            "name": "Quinoa",
            "amount": "1/2 cup cooked",
            "calories": 100
          },
          {
            "name": "Steamed Vegetables",
            "amount": "1 cup",
            "calories": 50
          }
        ],
        "instructions": [
          "Grill chicken breast.",
          "Cook quinoa according to package instructions.",
          "Steam vegetables."
        ]
      }
    },
    {
      "templateId": "MT004",
      "name": "Pre-Workout Snack",
      "mealType": "Snack",
      "totalCalories": 200,
      "macros": {
        "protein": 25,
        "carbs": 25,
        "fat": 5
      },
      "baseRecipe": {
        "name": "Banana with Peanut Butter and Protein Bar",
        "ingredients": [
          {
            "name": "Banana",
            "amount": "1 medium",
            "calories": 105
          },
          {
            "name": "Peanut Butter",
            "amount": "2 tbsp",
            "calories": 190
          },
          {
            "name": "Protein Bar",
            "amount": "1 bar",
            "calories": 250
          }
        ],
        "instructions": [
          "Spread peanut butter on banana.",
          "Consume protein bar."
        ]
      }
    },
    {
      "templateId": "MT005",
      "name": "Post-Workout Recovery",
      "mealType": "Post-Workout",
      "totalCalories": 250,
      "macros": {
        "protein": 35,
        "carbs": 30,
        "fat": 5
      },
      "baseRecipe": {
        "name": "Protein Shake with Dextrose and Water",
        "ingredients": [
          {
            "name": "Whey Protein Powder",
            "amount": "1 scoop",
            "calories": 120
          },
          {
            "name": "Dextrose",
            "amount": "30g",
            "calories": 120
          },
          {
            "name": "Water",
            "amount": "8 oz",
            "calories": 0
          }
        ],
        "instructions": [
          "Mix protein powder and dextrose in water."
        ]
      }
    },
    {
      "templateId": "MT006",
      "name": "Mid-Afternoon Snack",
      "mealType": "Snack",
      "totalCalories": 150,
      "macros": {
        "protein": 20,
        "carbs": 15,
        "fat": 5
      },
      "baseRecipe": {
        "name": "Cottage Cheese with Cucumber Slices",
        "ingredients": [
          {
            "name": "Cottage Cheese",
            "amount": "1/2 cup",
            "calories": 80
          },
          {
            "name": "Cucumber Slices",
            "amount": "1/2 cup",
            "calories": 10
          }
        ],
        "instructions": [
          "Combine cottage cheese and cucumber slices."
        ]
      }
    },
    {
      "templateId": "MT007",
      "name": "Dinner",
      "mealType": "Dinner",
      "totalCalories": 500,
      "macros": {
        "protein": 50,
        "carbs": 40,
        "fat": 20
      },
      "baseRecipe": {
        "name": "Grilled Salmon with Sweet Potato and Green Beans",
        "ingredients": [
          {
            "name": "Salmon",
            "amount": "6 oz",
            "calories": 210
          },
          {
            "name": "Sweet Potato",
            "amount": "1 medium",
            "calories": 105
          },
          {
            "name": "Green Beans",
            "amount": "1 cup",
            "calories": 55
          }
        ],
        "instructions": [
          "Grill salmon.",
          "Bake sweet potato.",
          "Steam green beans."
        ]
      }
    },
    {
      "templateId": "MT008",
      "name": "Evening Snack",
      "mealType": "Snack",
      "totalCalories": 150,
      "macros": {
        "protein": 20,
        "carbs": 15,
        "fat": 5
      },
      "baseRecipe": {
        "name": "Casein Protein Shake",
        "ingredients": [
          {
            "name": "Casein Protein Powder",
            "amount": "1 scoop",
            "calories": 120
          },
          {
            "name": "Water",
            "amount": "8 oz",
            "calories": 0
          }
        ],
        "instructions": [
          "Mix protein powder in water."
        ]
      }
    }
  ],
  "shoppingList": {
    "categories": [
      {
        "category": "Dairy",
        "items": [
          {
            "name": "Milk",
            "quantity": "2 gallons",
            "estimatedCost": 4,
            "priority": "High"
          },
          {
            "name": "Greek Yogurt",
            "quantity": "6 cups",
            "estimatedCost": 6,
            "priority": "Medium"
          },
          {
            "name": "Eggs",
            "quantity": "1 dozen",
            "estimatedCost": 2,
            "priority": "High"
          },
          {
            "name": "Cheese",
            "quantity": "1 block",
            "estimatedCost": 3,
            "priority": "Medium"
          }
        ]
      },
      {
        "category": "Meat/Protein",
        "items": [
          {
            "name": "Chicken Breast",
            "quantity": "10 lbs",
            "estimatedCost": 15,
            "priority": "High"
          },
          {
            "name": "Ground Turkey",
            "quantity": "5 lbs",
            "estimatedCost": 10,
            "priority": "Medium"
          },
          {
            "name": "Salmon Fillets",
            "quantity": "5 lbs",
            "estimatedCost": 20,
            "priority": "Medium"
          },
          {
            "name": "Tofu",
            "quantity": "2 blocks",
            "estimatedCost": 4,
            "priority": "Low"
          }
        ]
      },
      {
        "category": "Fruits",
        "items": [
          {
            "name": "Apples",
            "quantity": "6",
            "estimatedCost": 3,
            "priority": "Medium"
          },
          {
            "name": "Bananas",
            "quantity": "12",
            "estimatedCost": 2,
            "priority": "High"
          },
          {
            "name": "Berries",
            "quantity": "2 pints",
            "estimatedCost": 6,
            "priority": "Medium"
          },
          {
            "name": "Oranges",
            "quantity": "6",
            "estimatedCost": 3,
            "priority": "Medium"
          }
        ]
      }
    ],
    "totalEstimatedCost": 150,
    "notes": [
      "Prices are estimates and may vary based on location and store.",
      "Quantities can be adjusted based on individual needs and preferences.",
      "Consider buying in bulk to save money on non-perishable items."
    ]
  },
  "phaseProgression": {
    "phases": [
      {
        "phaseNumber": 1,
        "name": "High-Volume Foundation",
        "durationWeeks": 4,
        "focus": "building muscle endurance and increasing overall volume",
        "trainingModifications": [
          "3 sets of 8-12 reps for all exercises",
          "increase training volume to 18-20 sets per muscle group per week",
          "emphasize compound exercises: squats, deadlifts, bench press, rows"
        ],
        "nutritionModifications": [
          "caloric deficit of 250-500 calories per day for fat loss",
          "protein intake: 1.6-2.2 grams per kilogram of body weight",
          "balanced macronutrient distribution: 25% protein, 40% carbohydrates, 35% fat"
        ],
        "expectedOutcomes": [
          "increase muscle endurance",
          "build foundation for future phases",
          "initiate fat loss"
        ]
      },
      {
        "phaseNumber": 2,
        "name": "Hypertrophy and Strength",
        "durationWeeks": 4,
        "focus": "increasing muscle hypertrophy and strength",
        "trainingModifications": [
          "increase weight by 2.5-5kg/5-10lbs every two weeks",
          "add 1-2 sets per exercise",
          "introduce progressive overload: increase reps or sets over time"
        ],
        "nutritionModifications": [
          "adjust caloric deficit to 500-750 calories per day",
          "increase protein intake to 1.8-2.5 grams per kilogram of body weight"
        ],
        "expectedOutcomes": [
          "increase muscle hypertrophy",
          "improve strength",
          "continued fat loss"
        ]
      },
      {
        "phaseNumber": 3,
        "name": "Strength and Power",
        "durationWeeks": 3,
        "focus": "maximizing strength and power",
        "trainingModifications": [
          "increase weight by 5-10kg/10-20lbs every two weeks",
          "reduce volume to 12-15 sets per muscle group per week",
          "emphasize explosive exercises: box squats, trap bar deadlifts"
        ],
        "nutritionModifications": [
          "adjust caloric intake to maintenance level",
          "emphasize carbohydrate loading for strength and power"
        ],
        "expectedOutcomes": [
          "maximize strength and power",
          "improve muscle density"
        ]
      },
      {
        "phaseNumber": 4,
        "name": "Taper and Definition",
        "durationWeeks": 1,
        "focus": "taper and definition",
        "trainingModifications": [
          "reduce volume to 50% of previous phase",
          "emphasize isolation exercises: bicep curls, tricep extensions"
        ],
        "nutritionModifications": [
          "reduce caloric intake to 1000-1500 calories per day",
          "increase protein intake to 2.0-2.5 grams per kilogram of body weight"
        ],
        "expectedOutcomes": [
          "reveal muscle definition",
          "optimize physique for competition or show"
        ]
      }
    ]
  },
  "generatedAt": "2025-10-20T00:47:46.078Z",
  "confidenceScore": 0.6
};