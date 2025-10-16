import { useState, useEffect } from 'react';
import { ProgressivePlan } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useMealSuggestions } from '@/hooks/useMealSuggestions';
import { generateWaterManipulation, generateSodiumCycling, generateCarbCycling, getContestPrepSupplements, getTrainingAdjustments } from '@/utils/contestPrepKnowledge';

interface MealSuggestionsProps {
  plan: ProgressivePlan;
  selectedWeek?: number;
  userPreferences: string[];
  form: any; // FormState type
}

export function MealSuggestions({ plan, selectedWeek, userPreferences, form }: MealSuggestionsProps) {
  const [activeTab, setActiveTab] = useState<'meals' | 'water' | 'supplements' | 'training'>('meals');

  const currentCheckpoint = selectedWeek 
    ? plan.timeline.checkpoints.find(cp => cp.week === selectedWeek)
    : plan.timeline.checkpoints[0];

  const currentPhase = selectedWeek 
    ? plan.timeline.phases.find(p => selectedWeek >= p.startWeek + 1 && selectedWeek <= p.endWeek + 1)
    : plan.timeline.phases[0];

  // Use AI meal suggestions hook
  const {
    suggestions: mealSuggestions,
    weeklyPlan,
    loading: mealLoading,
    error: mealError,
    generateMealSuggestions,
    regenerateSuggestions,
    clearError
  } = useMealSuggestions({
    form,
    checkpoint: currentCheckpoint!,
    phase: currentPhase!,
    userPreferences
  });

  // Auto-generate suggestions when component mounts or week changes
  useEffect(() => {
    if (currentCheckpoint && currentPhase && form.apiKey) {
      generateMealSuggestions();
    }
  }, [currentCheckpoint, currentPhase, form.apiKey, generateMealSuggestions]);

  if (!currentCheckpoint || !currentPhase) {
    return (
      <Card>
        <div className="p-6 text-center text-gray-500">
          Select a week to view meal suggestions
        </div>
      </Card>
    );
  }

  // Generate water manipulation schedule
  const waterSchedule = generateWaterManipulation(plan.timeline.totalWeeks);
  const currentWaterWeek = waterSchedule.find(w => w.week === selectedWeek || w.week === 1);

  // Generate sodium cycling (for future use)
  generateSodiumCycling(plan.timeline.totalWeeks);

  // Generate carb cycling
  const carbCycling = generateCarbCycling({
    name: currentPhase.name,
    weeks: currentPhase.endWeek - currentPhase.startWeek + 1,
    bodyFatTarget: 0,
    waterIntake: 50,
    sodiumIntake: 3000,
    carbCycling: true,
    refeedFrequency: 7,
    cardioMinutes: 120,
    trainingVolume: 100,
    description: '',
    keyStrategies: []
  });

  // Get supplements for current phase
  const supplements = getContestPrepSupplements(currentPhase.name);

  // Get training adjustments
  const trainingAdjustments = getTrainingAdjustments(currentPhase.name, selectedWeek || 1);

  const renderMeals = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold">AI-Generated Meal Suggestions</h4>
        <p className="text-sm text-gray-600">
          Week {selectedWeek || 1} • {currentPhase.name} • Based on: {userPreferences.join(', ')}
        </p>
        <div className="flex justify-center gap-2 mt-2">
          <Button
            variant="secondary"
            onClick={regenerateSuggestions}
            disabled={mealLoading}
            className="text-sm px-3 py-1"
          >
            {mealLoading ? 'Generating...' : 'Generate New Suggestions'}
          </Button>
        </div>
      </div>

      {mealError && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-red-600 text-sm">
            Error generating meal suggestions: {mealError}
          </div>
          <Button
            variant="secondary"
            onClick={clearError}
            className="mt-2 text-sm px-3 py-1"
          >
            Dismiss
          </Button>
        </Card>
      )}

      {mealLoading && (
        <Card className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-sm text-gray-600">
            AI is analyzing your preferences and generating personalized meal suggestions...
          </div>
        </Card>
      )}

      {!mealLoading && weeklyPlan.length > 0 && (
        <div className="space-y-8">
          <div className="text-center mb-6">
            <h4 className="text-xl font-bold text-gray-900">Complete Weekly Meal Plan</h4>
            <p className="text-sm text-gray-600">
              Week {selectedWeek || 1} • {currentPhase.name} • Goal: {form.targetBf || 12}% Body Fat
            </p>
          </div>

          {weeklyPlan.map((dayPlan, dayIndex) => (
            <Card key={dayIndex} className="p-6">
              <h5 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                {dayPlan.day}
              </h5>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {dayPlan.meals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h6 className="font-semibold text-gray-900">{meal.name}</h6>
                        <p className="text-xs text-gray-500">{meal.timing}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {meal.calories} cal
                        </div>
                        <div className="text-xs text-gray-500">
                          {meal.protein}g P • {meal.carbs}g C • {meal.fat}g F
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="font-medium text-gray-800 text-sm">Ingredients:</div>
                        <ul className="text-xs text-gray-600 space-y-1 mt-1">
                          {meal.foods.map((food, foodIndex) => (
                            <li key={foodIndex}>
                              • {food.name}: {food.amount}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <div className="font-medium text-gray-800 text-sm">Instructions:</div>
                        <ol className="text-xs text-gray-600 space-y-1 mt-1">
                          {meal.instructions.map((instruction, instIndex) => (
                            <li key={instIndex}>
                              {instIndex + 1}. {instruction}
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Prep: {meal.prepTime}min</span>
                        <span>Phase: {meal.phase}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <div className="text-center text-sm text-gray-500">
            <p>Total: {weeklyPlan.length} days × 6 meals = {weeklyPlan.length * 6} meals</p>
            <p>All meals designed to help you reach {form.targetBf || 12}% body fat</p>
          </div>
        </div>
      )}

      {!mealLoading && mealSuggestions.length > 0 && weeklyPlan.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mealSuggestions.map((meal, index) => (
            <Card key={index} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-semibold text-lg">{meal.name}</h5>
                <div className="text-right text-sm text-gray-500">
                  <div>{meal.timing}</div>
                  <div>{meal.prepTime} min prep</div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 mb-3">
                {meal.description}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <div className="bg-blue-50 p-2 rounded">
                  <div className="font-medium">Calories</div>
                  <div className="text-lg font-bold">{meal.calories}</div>
                </div>
                <div className="bg-red-50 p-2 rounded">
                  <div className="font-medium">Protein</div>
                  <div className="text-lg font-bold">{meal.protein}g</div>
                </div>
                <div className="bg-green-50 p-2 rounded">
                  <div className="font-medium">Carbs</div>
                  <div className="text-lg font-bold">{meal.carbs}g</div>
                </div>
                <div className="bg-yellow-50 p-2 rounded">
                  <div className="font-medium">Fat</div>
                  <div className="text-lg font-bold">{meal.fat}g</div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Ingredients:</div>
                <div className="space-y-1">
                  {meal.foods.map((food, foodIndex) => (
                    <div key={foodIndex} className="flex justify-between text-sm">
                      <span>{food.name}</span>
                      <span className="text-gray-500">{food.amount}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm font-medium mb-2">Instructions:</div>
                <ol className="text-sm text-gray-600 space-y-1">
                  {meal.instructions.map((instruction, instIndex) => (
                    <li key={instIndex} className="flex">
                      <span className="font-medium mr-2">{instIndex + 1}.</span>
                      {instruction}
                    </li>
                  ))}
                </ol>
              </div>

              {meal.tips && meal.tips.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Tips:</div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {meal.tips.map((tip, tipIndex) => (
                      <li key={tipIndex} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {meal.variations && meal.variations.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Variations:</div>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {meal.variations.map((variation, varIndex) => (
                      <li key={varIndex} className="flex items-start">
                        <span className="text-green-500 mr-2">→</span>
                        {variation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
                <span>Phase: {meal.phase}</span>
                <span>AI Generated</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!mealLoading && mealSuggestions.length === 0 && !mealError && (
        <Card className="p-6 text-center text-gray-500">
          <div className="text-lg mb-2">No meal suggestions available</div>
          <div className="text-sm">Click "Generate New Suggestions" to create personalized meals</div>
        </Card>
      )}
    </div>
  );

  const renderWaterManipulation = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold">Water & Sodium Manipulation</h4>
        <p className="text-sm text-gray-600">Week {selectedWeek || 1} Protocol</p>
      </div>

      {currentWaterWeek && (
        <Card className="p-4 mb-4">
          <h5 className="font-semibold mb-2">Current Week Protocol</h5>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {currentWaterWeek.waterIntake}ml/kg
              </div>
              <div className="text-sm text-gray-600">Water Intake</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {currentWaterWeek.sodiumIntake}mg
              </div>
              <div className="text-sm text-gray-600">Sodium</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {currentWaterWeek.potassiumIntake}mg
              </div>
              <div className="text-sm text-gray-600">Potassium</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {currentWaterWeek.strategy}
              </div>
              <div className="text-sm text-gray-600">Strategy</div>
            </div>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            <strong>Rationale:</strong> {currentWaterWeek.rationale}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        <h5 className="font-semibold">Full Water Manipulation Schedule</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left">Week</th>
                <th className="px-3 py-2 text-left">Water (ml/kg)</th>
                <th className="px-3 py-2 text-left">Sodium (mg)</th>
                <th className="px-3 py-2 text-left">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {waterSchedule.map((week) => (
                <tr key={week.week} className={week.week === (selectedWeek || 1) ? 'bg-blue-50' : ''}>
                  <td className="px-3 py-2 font-medium">Week {week.week}</td>
                  <td className="px-3 py-2">{week.waterIntake}</td>
                  <td className="px-3 py-2">{week.sodiumIntake}</td>
                  <td className="px-3 py-2">{week.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderSupplements = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold">Supplement Recommendations</h4>
        <p className="text-sm text-gray-600">For {currentPhase.name} Phase</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h5 className="font-semibold text-green-600 mb-3">Essential Supplements</h5>
          <ul className="space-y-2">
            {supplements.essential.map((supplement, index) => (
              <li key={index} className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                {supplement}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h5 className="font-semibold text-blue-600 mb-3">Optional Supplements</h5>
          <ul className="space-y-2">
            {supplements.optional.map((supplement, index) => (
              <li key={index} className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                {supplement}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-4">
        <h5 className="font-semibold mb-2">Timing Instructions</h5>
        <p className="text-sm text-gray-600">{supplements.timing}</p>
      </Card>
    </div>
  );

  const renderTraining = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h4 className="text-lg font-semibold">Training Adjustments</h4>
        <p className="text-sm text-gray-600">For {currentPhase.name} Phase - Week {selectedWeek || 1}</p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center mb-4">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {trainingAdjustments.volume}%
            </div>
            <div className="text-sm text-gray-600">Volume</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {trainingAdjustments.intensity}%
            </div>
            <div className="text-sm text-gray-600">Intensity</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {trainingAdjustments.frequency}x
            </div>
            <div className="text-sm text-gray-600">Frequency</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">
              {trainingAdjustments.focus}
            </div>
            <div className="text-sm text-gray-600">Focus</div>
          </div>
        </div>

        <div>
          <h5 className="font-semibold mb-2">Key Notes:</h5>
          <ul className="space-y-1 text-sm text-gray-600">
            {trainingAdjustments.notes.map((note, index) => (
              <li key={index} className="flex items-start">
                <span className="w-2 h-2 bg-orange-500 rounded-full mr-2 mt-1.5 flex-shrink-0"></span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-4">
        <h5 className="font-semibold mb-2">Carb Cycling Schedule</h5>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2 text-left">Day</th>
                <th className="px-3 py-2 text-left">Carbs (g)</th>
                <th className="px-3 py-2 text-left">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {carbCycling.map((day, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 font-medium">{day.day}</td>
                  <td className="px-3 py-2">{day.carbs}</td>
                  <td className="px-3 py-2">{day.strategy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );

  return (
    <Card>
      <div className="p-4">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4">
          {[
            { id: 'meals', label: 'Meals' },
            { id: 'water', label: 'Water/Sodium' },
            { id: 'supplements', label: 'Supplements' },
            { id: 'training', label: 'Training' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'meals' && renderMeals()}
        {activeTab === 'water' && renderWaterManipulation()}
        {activeTab === 'supplements' && renderSupplements()}
        {activeTab === 'training' && renderTraining()}
      </div>
    </Card>
  );
}
