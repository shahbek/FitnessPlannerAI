import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search, X, Loader2, Plus, Star, Save, Trash2, ChevronLeft, ChevronRight, Camera, Upload, ScanLine, Utensils } from 'lucide-react';
import {
  searchCommonFoods,
  COMMON_FOODS,
  type USDAFoodItem,
} from '@/services/USDAFoodService';
import { CameraCapture } from './CameraCapture';

interface FoodSearchSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFood: (food: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fdcId?: string;
    servingSize?: string;
  }) => void;
  mode: 'add' | 'swap';
}

export function FoodSearchSheet({
  isOpen,
  onClose,
  onSelectFood,
  mode,
}: FoodSearchSheetProps) {
  const customMeals = useQuery(api.customMeals.getUserCustomMeals);
  const createCustomMeal = useMutation(api.customMeals.createCustomMeal);
  const deleteCustomMeal = useMutation(api.customMeals.deleteCustomMeal);

  const [activeTab, setActiveTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<USDAFoodItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCommon, setShowCommon] = useState(true);
  const [servingMultiplier, setServingMultiplier] = useState<Record<string, number>>({});

  // Builder State
  const [builderIngredients, setBuilderIngredients] = useState<any[]>([]);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [customMealName, setCustomMealName] = useState('');

  // Quick Entry State
  const [quickEntryName, setQuickEntryName] = useState('');
  const [quickEntryCalories, setQuickEntryCalories] = useState('');
  const [quickEntryProtein, setQuickEntryProtein] = useState('');
  const [quickEntryCarbs, setQuickEntryCarbs] = useState('');
  const [quickEntryFat, setQuickEntryFat] = useState('');
  const [quickEntrySugar, setQuickEntrySugar] = useState('');

  // OCR State
  const [ocrImage, setOcrImage] = useState<string>('');
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrError, setOcrError] = useState<string>('');
  const [showCamera, setShowCamera] = useState(false);
  const [ocrServingMultiplier, setOcrServingMultiplier] = useState(1);

  // Food Photo Analysis State
  const [analysisMode, setAnalysisMode] = useState<'label' | 'meal'>('label');
  const [analyzedMeal, setAnalyzedMeal] = useState<any>(null);
  const [ingredientPortions, setIngredientPortions] = useState<Record<number, number>>({});
  const [isAnalyzingFood, setIsAnalyzingFood] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>('');

  const searchUSDA = useAction(api.usda.searchFoods);
  const extractNutrition = useAction(api.groqOcr.extractNutrition);
  const analyzeFoodPhoto = useAction(api.groqFoodAnalysis.analyzeFoodPhoto);
  const upsertIngredientMappings = useAction((api as any).ingredientMappings.upsertMappings);

  // Debounce search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowCommon(true);
      return;
    }

    setShowCommon(false);
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [usdaResults, commonResults] = await Promise.all([
          searchUSDA({ query, pageSize: 15 }),
          Promise.resolve(searchCommonFoods(query)),
        ]);

        const combined = [...commonResults, ...usdaResults.foods];
        const seen = new Set<string>();
        const unique = combined.filter((food) => {
          const key = food.description.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Map back to local USDAFoodItem type if necessary, or ensure types match
        // The action returns objects compatible with USDAFoodItem
        setResults(unique.slice(0, 20) as USDAFoodItem[]);
      } catch (error) {
        console.error('Search failed:', error);
        setResults(searchCommonFoods(query));
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchUSDA]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setShowCommon(true);
      setServingMultiplier({});
      setActiveTab('search');
      // Reset quick entry form
      setQuickEntryName('');
      setQuickEntryCalories('');
      setQuickEntryProtein('');
      setQuickEntryCarbs('');
      setQuickEntryFat('');
      setQuickEntrySugar('');
      // Reset OCR state
      setOcrImage('');
      setOcrResult(null);
      setIsProcessingOcr(false);
      setOcrError('');
      setShowCamera(false);
      setOcrServingMultiplier(1);
    }
  }, [isOpen]);

  const handleAddToBuilder = (food: USDAFoodItem) => {
    const multiplier = servingMultiplier[food.fdcId] || 1;
    const ingredient = {
      name: food.description,
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier * 10) / 10,
      carbs: Math.round(food.carbs * multiplier * 10) / 10,
      fat: Math.round(food.fat * multiplier * 10) / 10,
      fdcId: food.fdcId,
      servingSize: food.servingSize
        ? `${Math.round(food.servingSize * multiplier)}${food.servingSizeUnit || 'g'}`
        : '1 serving',
      originalFood: food, // Keep ref for re-editing if needed
      multiplier
    };

    setBuilderIngredients(prev => [...prev, ingredient]);
    // Optional: visual feedback trigger
    // Don't switch view immediately, let user keep searching
  };

  const handleSelectFood = (food: USDAFoodItem) => {
    // Persist a user-confirmed mapping so future plan generations pick the same USDA item for this query.
    // Best-effort and non-blocking.
    if (query.trim() && food.fdcId && !food.fdcId.startsWith('common-')) {
      const fdcIdNum = Number(food.fdcId);
      if (Number.isFinite(fdcIdNum) && fdcIdNum > 0) {
        void upsertIngredientMappings({
          mappings: [
            {
              name: query,
              fdcId: fdcIdNum,
              description: food.description,
              dataType: (food as any).dataType,
              source: 'user_confirmed',
              confidence: 1,
            },
          ],
        }).catch((err: any) =>
          console.warn('⚠️ Failed to persist ingredient mapping:', err)
        );
      }
    }

    const multiplier = servingMultiplier[food.fdcId] || 1;
    const servingStr = food.servingSize
      ? `${Math.round(food.servingSize * multiplier)}${food.servingSizeUnit || 'g'}`
      : undefined;

    onSelectFood({
      name: food.description,
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier * 10) / 10,
      carbs: Math.round(food.carbs * multiplier * 10) / 10,
      fat: Math.round(food.fat * multiplier * 10) / 10,
      fdcId: food.fdcId.startsWith('common-') ? undefined : food.fdcId,
      servingSize: servingStr,
    });
  };

  const updateServingMultiplier = (fdcId: string, delta: number) => {
    setServingMultiplier((prev) => {
      const current = prev[fdcId] || 1;
      const newValue = Math.max(0.5, Math.min(5, current + delta));
      return { ...prev, [fdcId]: newValue };
    });
  };

  const handleSaveCustomMeal = async () => {
    if (!customMealName.trim() || builderIngredients.length === 0) return;

    const totalMacros = builderIngredients.reduce((acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    try {
      await createCustomMeal({
        name: customMealName,
        mealType: 'Custom',
        ingredients: builderIngredients.map(({ originalFood, multiplier, ...rest }) => rest), // Strip extra UI fields
        totalMacros: {
          calories: Math.round(totalMacros.calories),
          protein: Math.round(totalMacros.protein * 10) / 10,
          carbs: Math.round(totalMacros.carbs * 10) / 10,
          fat: Math.round(totalMacros.fat * 10) / 10,
        }
      });

      // Also log it immediately
      onSelectFood({
        name: customMealName,
        ...totalMacros,
        servingSize: '1 meal'
      });

      // Reset
      setIsBuilderOpen(false);
      setBuilderIngredients([]);
      setCustomMealName('');
    } catch (err) {
      console.error("Failed to save custom meal:", err);
    }
  };

  const handleQuickEntry = async (shouldLog: boolean = true) => {
    const calories = parseFloat(quickEntryCalories) || 0;
    const protein = parseFloat(quickEntryProtein) || 0;
    const carbs = parseFloat(quickEntryCarbs) || 0;
    const fat = parseFloat(quickEntryFat) || 0;
    const sugar = parseFloat(quickEntrySugar) || 0;

    if (!quickEntryName.trim() || calories <= 0) {
      return;
    }

    const foodData = {
      name: quickEntryName,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      servingSize: '1 serving',
    };

    // Always save to custom meals as requested (or if this was the specific action)
    // The user asked for "add to my meals, not only to journal".
    // We'll treat the new button as "Save Only" and the existing as "Save & Log" (or just Log?)
    // Existing logic saved to custom meals ALWAYS. We will keep that for "Save & Log".

    try {
      await createCustomMeal({
        name: quickEntryName,
        mealType: 'Quick Entry',
        ingredients: [{
          name: quickEntryName,
          calories: foodData.calories,
          protein: foodData.protein,
          carbs: foodData.carbs,
          fat: foodData.fat,
          servingSize: '1 serving',
        }],
        totalMacros: {
          calories: foodData.calories,
          protein: foodData.protein,
          carbs: foodData.carbs,
          fat: foodData.fat,
        }
      });
    } catch (err) {
      console.error("Failed to save quick entry to custom meals:", err);
    }

    // Only add to journal if requested
    if (shouldLog) {
      onSelectFood(foodData);
    }

    // Reset form
    setQuickEntryName('');
    setQuickEntryCalories('');
    setQuickEntryProtein('');
    setQuickEntryCarbs('');
    setQuickEntryFat('');
    setQuickEntrySugar('');
  };

  // OCR Handlers
  const handleCameraCapture = (imageBase64: string, mode: 'label' | 'meal') => {
    setOcrImage(imageBase64);
    setShowCamera(false);
    setAnalysisMode(mode); // Set mode based on what was selected in camera
  };

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setOcrImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractNutrition = async () => {
    if (!ocrImage) return;

    setIsProcessingOcr(true);
    setOcrError('');

    try {
      const result = await extractNutrition({ imageBase64: ocrImage });
      setOcrResult(result);
    } catch (err) {
      console.error('OCR extraction failed:', err);
      setOcrError(err instanceof Error ? err.message : 'Failed to extract nutrition information');
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const addOcrToBuilder = () => {
    if (!ocrResult) return;

    const multiplier = ocrServingMultiplier;
    const ingredient = {
      name: ocrResult.productName,
      calories: Math.round(ocrResult.calories * multiplier),
      protein: Math.round(ocrResult.protein * multiplier * 10) / 10,
      carbs: Math.round(ocrResult.carbs * multiplier * 10) / 10,
      fat: Math.round(ocrResult.fat * multiplier * 10) / 10,
      servingSize: ocrResult.servingSize,
      multiplier: 1, // Already multiplied in values
    };

    setBuilderIngredients(prev => [...prev, ingredient]);
    handleResetOcr();
    // Don't close sheet, stay for more or switch to builder manually
  };

  const handleSaveOcrResult = async () => {
    if (!ocrResult) return;

    const multiplier = ocrServingMultiplier;
    const foodData = {
      name: ocrResult.productName,
      calories: Math.round(ocrResult.calories * multiplier),
      protein: Math.round(ocrResult.protein * multiplier * 10) / 10,
      carbs: Math.round(ocrResult.carbs * multiplier * 10) / 10,
      fat: Math.round(ocrResult.fat * multiplier * 10) / 10,
      servingSize: ocrResult.servingSize,
    };

    // Save to custom meals
    try {
      await createCustomMeal({
        name: ocrResult.productName,
        mealType: 'OCR Scan',
        ingredients: [{
          name: ocrResult.productName,
          calories: foodData.calories,
          protein: foodData.protein,
          carbs: foodData.carbs,
          fat: foodData.fat,
          servingSize: foodData.servingSize,
        }],
        totalMacros: {
          calories: foodData.calories,
          protein: foodData.protein,
          carbs: foodData.carbs,
          fat: foodData.fat,
        }
      });
    } catch (err) {
      console.error("Failed to save OCR result to custom meals:", err);
    }

    // Add to journal
    onSelectFood(foodData);

    // Reset OCR state
    setOcrImage('');
    setOcrResult(null);
    setOcrServingMultiplier(1);
  };

  const handleResetOcr = () => {
    setOcrImage('');
    setOcrResult(null);
    setOcrError('');
    setOcrServingMultiplier(1);
  };

  const updateOcrServingMultiplier = (delta: number) => {
    setOcrServingMultiplier(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  // Food Photo Analysis Handlers
  const handleAnalyzeMealPhoto = async () => {
    if (!ocrImage) return;

    setIsAnalyzingFood(true);
    setAnalysisError('');

    try {
      // Analyze photo to identify ingredients AND get macros from AI
      // TODO: Replace AI macro estimation with USDA lookups (see AGENTS.md)
      const analysis = await analyzeFoodPhoto({ imageBase64: ocrImage });

      // Initialize portion tracking with estimated grams
      const initialPortions: Record<number, number> = {};
      analysis.ingredients.forEach((ing: any, index: number) => {
        initialPortions[index] = ing.estimatedGrams;
      });

      setAnalyzedMeal(analysis);
      setIngredientPortions(initialPortions);
    } catch (err) {
      console.error('Food analysis failed:', err);
      setAnalysisError(err instanceof Error ? err.message : 'Failed to analyze the meal');
    } finally {
      setIsAnalyzingFood(false);
    }
  };

  const addAnalyzedMealToBuilder = () => {
    const mealData = recalculateMealMacros();
    if (!mealData) return;

    // Add all ingredients from analysis as separate items to builder
    const newIngredients = mealData.ingredients.map((ing: any) => ({
      name: ing.name,
      calories: Math.round(ing.calories),
      protein: Math.round(ing.protein * 10) / 10,
      carbs: Math.round(ing.carbs * 10) / 10,
      fat: Math.round(ing.fat * 10) / 10,
      servingSize: `${ing.estimatedGrams}g`,
      multiplier: 1,
    }));

    setBuilderIngredients(prev => [...prev, ...newIngredients]);
    handleResetAnalysis();
  };

  const updateIngredientPortion = (index: number, newGrams: number) => {
    setIngredientPortions(prev => ({
      ...prev,
      [index]: Math.max(1, newGrams),
    }));
  };

  const recalculateMealMacros = () => {
    if (!analyzedMeal) return analyzedMeal;

    const updatedIngredients = analyzedMeal.ingredients.map((ing: any, index: number) => {
      const newGrams = ingredientPortions[index] || ing.estimatedGrams;
      const originalGrams = ing.estimatedGrams;
      const multiplier = newGrams / originalGrams;

      return {
        ...ing,
        estimatedGrams: newGrams,
        calories: Math.round(ing.calories * multiplier),
        protein: Math.round(ing.protein * multiplier * 10) / 10,
        carbs: Math.round(ing.carbs * multiplier * 10) / 10,
        fat: Math.round(ing.fat * multiplier * 10) / 10,
      };
    });

    const totals = updatedIngredients.reduce((acc: any, ing: any) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    return {
      ...analyzedMeal,
      ingredients: updatedIngredients,
      totals: {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fat: Math.round(totals.fat * 10) / 10,
      },
    };
  };

  const handleSaveAnalyzedMeal = async () => {
    const mealData = recalculateMealMacros();
    if (!mealData) return;

    try {
      // Save as custom meal with all ingredients
      await createCustomMeal({
        name: mealData.mealName,
        mealType: 'Photo Analysis',
        ingredients: mealData.ingredients.map((ing: any) => ({
          name: ing.name,
          calories: ing.calories,
          protein: ing.protein,
          carbs: ing.carbs,
          fat: ing.fat,
          servingSize: `${ing.estimatedGrams}g`,
        })),
        totalMacros: mealData.totals,
      });

      // Add to journal
      onSelectFood({
        name: mealData.mealName,
        ...mealData.totals,
        servingSize: '1 meal',
      });

      // Reset state
      setOcrImage('');
      setAnalyzedMeal(null);
      setIngredientPortions({});
      setAnalysisMode('label');
    } catch (err) {
      console.error("Failed to save analyzed meal:", err);
    }
  };

  const handleResetAnalysis = () => {
    setOcrImage('');
    setAnalyzedMeal(null);
    setIngredientPortions({});
    setAnalysisError('');
    setAnalysisMode('label');
  };

  const renderFoodItem = (food: USDAFoodItem, isCommon: boolean = false) => {
    const multiplier = servingMultiplier[food.fdcId] || 1;
    const adjustedCalories = Math.round(food.calories * multiplier);
    const adjustedProtein = Math.round(food.protein * multiplier * 10) / 10;
    const adjustedCarbs = Math.round(food.carbs * multiplier * 10) / 10;
    const adjustedFat = Math.round(food.fat * multiplier * 10) / 10;

    return (
      <div
        key={food.fdcId}
        className={cn(
          'p-5 mb-4 rounded-[1.5rem] transition-all duration-300 group',
          'bg-white border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]',
          'hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-slate-200'
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <div className="flex items-start gap-2 mb-1">
                {isCommon && (
                  <div className="mt-1 p-1 rounded-full bg-amber-50">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                  </div>
                )}
                <span className="font-editorial text-xl text-slate-800 leading-tight">
                  {food.description}
                </span>
              </div>

              {/* Portion Control - Integrated Clean Look */}
              <div className="flex items-center mt-3">
                <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateServingMultiplier(food.fdcId, -0.5);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                  >
                    -
                  </button>
                  <span className="min-w-[4rem] text-center text-sm font-bold text-slate-700 font-sans mx-1">
                    {Math.round((food.servingSize || 100) * multiplier)}
                    <span className="text-xs font-normal text-slate-400 ml-0.5">{food.servingSizeUnit || 'g'}</span>
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateServingMultiplier(food.fdcId, 0.5);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 flex-shrink-0 pt-1">
              <Button
                onClick={() => handleSelectFood(food)}
                size="sm"
                className={cn(
                  "h-9 px-4 rounded-xl text-white font-bold shadow-md transition-all",
                  "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                  "shadow-[0_2px_8px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                  "hover:shadow-[0_4px_12px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                )}
              >
                Add
              </Button>
              <Button
                onClick={() => handleAddToBuilder(food)}
                size="sm"
                className={cn(
                  "h-9 px-4 rounded-xl text-white font-bold shadow-md transition-all",
                  "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                  "shadow-[0_2px_8px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                  "hover:shadow-[0_4px_12px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                )}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5 stroke-[3px]" />
                Build
              </Button>
            </div>
          </div>

          {/* Micro-grid Macros */}
          <div className="flex items-center gap-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-50">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              <span className="text-slate-700 font-extrabold text-sm">{adjustedCalories}</span>
              <span className="text-[10px]">kcal</span>
            </span>
            <div className="w-px h-3 bg-slate-200" />
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              <span className="text-slate-600">{adjustedProtein}g</span> P
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-slate-600">{adjustedCarbs}g</span> C
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-slate-600">{adjustedFat}g</span> F
            </span>
          </div>
        </div>
      </div>
    );
  };


  const addQuickEntryToBuilder = () => {
    const calories = parseFloat(quickEntryCalories) || 0;
    const protein = parseFloat(quickEntryProtein) || 0;
    const carbs = parseFloat(quickEntryCarbs) || 0;
    const fat = parseFloat(quickEntryFat) || 0;
    const sugar = parseFloat(quickEntrySugar) || 0;

    if (!quickEntryName.trim() || calories <= 0) {
      return;
    }

    const ingredient = {
      name: quickEntryName,
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      servingSize: '1 serving',
      multiplier: 1
    };

    setBuilderIngredients(prev => [...prev, ingredient]);

    // Reset form
    setQuickEntryName('');
    setQuickEntryCalories('');
    setQuickEntryProtein('');
    setQuickEntryCarbs('');
    setQuickEntryFat('');
    setQuickEntrySugar('');
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[100vh] rounded-t-[2.5rem] p-0 gap-0 flex flex-col border-t border-white/60 bg-gradient-to-b from-slate-50/95 via-slate-100/95 to-blue-50/95 backdrop-blur-2xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)] [&>button]:hidden"
      >
        <SheetHeader className="px-6 pb-0 pt-5 flex-shrink-0 z-10 relative flex flex-row items-center">
          <SheetDescription className="hidden">Search for food or create a custom meal</SheetDescription>

          {/* Custom Close Button */}
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="absolute right-6 top-5 z-20 h-8 w-8 bg-slate-200/50 hover:bg-slate-300/50 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-slate-500 stroke-[3px]" />
          </Button>

          {isBuilderOpen ? (
            <div className="flex items-center justify-start w-full gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsBuilderOpen(false)}
                className="h-8 w-8 -ml-2 rounded-full hover:bg-white/50"
              >
                <ChevronLeft className="h-6 w-6 text-slate-600" />
              </Button>
              <SheetTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                Build Custom Meal
              </SheetTitle>
            </div>
          ) : (
            <div className="w-full text-center">
              <SheetTitle className="text-xl font-black tracking-tight text-slate-800">
                {mode === 'swap' ? 'Swap Meal' : 'Add Food'}
              </SheetTitle>
            </div>
          )}
        </SheetHeader>

        {!isBuilderOpen && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-2 px-6">
            <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-200/80 p-1.5 !rounded-full shadow-[inset_0_2px_6px_rgba(0,0,0,0.12),inset_0_-1px_0_rgba(255,255,255,0.5)] border border-slate-200/50">
              <TabsTrigger
                value="search"
                className="!rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out font-semibold text-xs sm:text-sm"
              >
                Search
              </TabsTrigger>
              <TabsTrigger
                value="quick-entry"
                className="!rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out font-semibold text-xs sm:text-sm"
              >
                Quick Entry
              </TabsTrigger>
              <TabsTrigger
                value="scan-label"
                className="!rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out font-semibold text-xs sm:text-sm"
              >
                Scan Label
              </TabsTrigger>
              <TabsTrigger
                value="my-meals"
                className="!rounded-full data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-out font-semibold text-xs sm:text-sm"
              >
                My Meals
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {!isBuilderOpen && activeTab === 'search' && (
          <div className="relative mt-2 px-6">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ingredients (e.g., 'Chicken', 'Oats')..."
              className="h-12 px-6 rounded-full bg-slate-200/60 border-transparent shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] focus:ring-0 focus:bg-slate-200/80 transition-all font-medium text-slate-700 placeholder:text-slate-400/80"
              autoFocus
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 animate-spin" />
            )}
          </div>
        )}

        {isBuilderOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <div className="px-6 pt-2 pb-8 space-y-6">

                {/* Meal Name Input - Premium Style */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Meal Name
                  </label>
                  <Input
                    placeholder="e.g. My Breakfast Bowl"
                    value={customMealName}
                    onChange={(e) => setCustomMealName(e.target.value)}
                    className="h-12 px-4 rounded-xl bg-white border-slate-200 text-base font-medium text-slate-900 shadow-sm focus:ring-slate-200 focus:border-slate-300 transition-all font-sans placeholder:text-slate-300"
                  />
                </div>

                {/* Ingredients List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ingredients ({builderIngredients.length})</label>
                    <Button variant="ghost" size="sm" onClick={() => setIsBuilderOpen(false)} className="text-orange-600 h-6 text-xs hover:bg-orange-50 font-semibold">
                      <Plus className="h-3.5 w-3.5 mr-1 stroke-[3px]" /> Add more
                    </Button>
                  </div>

                  {builderIngredients.map((ing, idx) => (
                    <div key={idx} className="p-5 rounded-[1.5rem] bg-white border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-slate-200 transition-all duration-300 group">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-4">
                            <span className="font-editorial text-xl text-slate-800 leading-tight block">
                              {ing.name}
                            </span>

                            {/* Portion Display */}
                            <div className="flex items-center mt-3">
                              <div className="flex items-center bg-slate-50 rounded-lg py-1.5 px-3 border border-slate-100">
                                <span className="text-sm font-bold text-slate-700 font-sans">
                                  {ing.servingSize}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Delete Action */}
                          <div className="flex flex-col flex-shrink-0 pt-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                              onClick={() => setBuilderIngredients(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <Trash2 className="h-5 w-5 stroke-[2px]" />
                            </Button>
                          </div>
                        </div>

                        {/* Micro-grid Macros */}
                        <div className="flex items-center gap-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-50">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                            <span className="text-slate-700 font-extrabold text-sm">{Math.round(ing.calories)}</span>
                            <span className="text-[10px]">kcal</span>
                          </span>
                          <div className="w-px h-3 bg-slate-200" />
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-slate-600">{Math.round(ing.protein * 10) / 10}g</span> P
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="text-slate-600">{Math.round(ing.carbs * 10) / 10}g</span> C
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                            <span className="text-slate-600">{Math.round(ing.fat * 10) / 10}g</span> F
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Macros - Clean Summary Card */}
                <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Energy</span>
                      <span className="font-editorial text-3xl text-slate-800 leading-none">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.calories, 0))}
                        <span className="text-base font-sans font-medium text-slate-400 ml-1">kcal</span>
                      </span>
                    </div>
                    {/* Micro-grid Visual */}
                    <div className="flex gap-1 h-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={cn("w-1.5 rounded-full bg-slate-100", i < 2 && "bg-slate-800")} />
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Protein', val: builderIngredients.reduce((acc, i) => acc + i.protein, 0), unit: 'g', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                      { label: 'Carbs', val: builderIngredients.reduce((acc, i) => acc + i.carbs, 0), unit: 'g', color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'Fat', val: builderIngredients.reduce((acc, i) => acc + i.fat, 0), unit: 'g', color: 'text-rose-600', bg: 'bg-rose-50' },
                    ].map((m, i) => (
                      <div key={i} className={cn("p-3 rounded-xl flex flex-col items-center justify-center border border-transparent", m.bg)}>
                        <span className={cn("text-lg font-bold font-mono leading-none mb-1", m.color)}>
                          {Math.round(m.val)}
                          <span className="text-[10px] ml-0.5 opacity-60 text-current">{m.unit}</span>
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="p-4 border-t border-slate-100 bg-white/50 backdrop-blur-md">
              <Button onClick={handleSaveCustomMeal}
                className={cn(
                  "w-full h-11 rounded-xl text-white font-bold shadow-md transition-all",
                  "bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-700",
                  "shadow-[0_2px_8px_rgba(30,41,59,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]",
                  "hover:shadow-[0_4px_12px_rgba(30,41,59,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] hover:-translate-y-0.5"
                )}
                disabled={!customMealName || builderIngredients.length === 0}
              >
                Save & Log Meal
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="pb-8">
              {!isBuilderOpen && builderIngredients.length > 0 && (
                <div className="mx-5 mt-2 mb-4 p-4 rounded-2xl bg-gradient-to-br from-amber-50/90 to-orange-50/90 border border-orange-100/50 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.15)] flex items-center justify-between backdrop-blur-md">
                  <div>
                    <p className="font-editorial text-lg text-slate-800 leading-none mb-1">
                      Building meal...
                    </p>
                    <p className="text-xs font-bold text-orange-600 uppercase tracking-wide">
                      {builderIngredients.length} ingredients selected
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setIsBuilderOpen(true)}
                    className={cn(
                      "h-9 px-5 rounded-xl text-white font-bold shadow-md transition-all",
                      "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                      "shadow-[0_2px_8px_rgba(249,115,22,0.4),inset_0_1px_0_rgba(255,255,255,0.4)]",
                      "hover:shadow-[0_4px_12px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.4)] hover:-translate-y-0.5"
                    )}
                  >
                    Continue <ChevronRight className="h-4 w-4 ml-1 stroke-[3px]" />
                  </Button>
                </div>
              )}

              {activeTab === 'search' ? (
                <div className="px-5 pt-2 space-y-4">

                  {showCommon && (
                    <>
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-medium text-slate-600">Quick Add Ingredients</span>
                      </div>
                      {COMMON_FOODS.map((food) => renderFoodItem(food, true))}
                    </>
                  )}

                  {!showCommon && results.length > 0 && results.map((food) =>
                    renderFoodItem(food, food.fdcId.startsWith('common-'))
                  )}

                  {!showCommon && !isSearching && results.length === 0 && query && (
                    <div className="text-center py-12 text-slate-500">
                      No foods found for "{query}"
                    </div>
                  )}
                </div>
              ) : activeTab === 'quick-entry' ? (
                /* Quick Entry Tab - Premium Meal Analysis Style */
                <div className="px-6 pt-2 pb-8 max-w-lg mx-auto">
                  <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/80 to-white/40 border border-white/60 shadow-xl backdrop-blur-xl">
                    <div className="bg-white/50 rounded-[1.8rem] p-6">

                      {/* Header */}
                      <div className="text-center mb-8">
                        <h3 className="text-3xl font-editorial font-normal text-slate-800 mb-2">Manual Entry</h3>
                        <div className="w-12 h-1 bg-slate-800/10 mx-auto rounded-full" />
                      </div>

                      <div className="space-y-6">

                        {/* Meal Name Input */}
                        <div className="relative group">
                          <label className="absolute -top-2.5 left-4 px-2 z-10 bg-gradient-to-b from-white/0 via-white to-white/0 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Meal Name
                          </label>
                          <Input
                            placeholder="e.g. Grandma's Lasagna"
                            value={quickEntryName}
                            onChange={(e) => setQuickEntryName(e.target.value)}
                            className="h-14 px-6 rounded-2xl bg-white border-slate-200 text-lg font-editorial text-slate-800 shadow-sm focus:ring-slate-200 focus:border-slate-300 transition-all font-normal placeholder:text-slate-300 placeholder:font-sans relative z-0"
                          />
                        </div>

                        {/* Calories Input */}
                        <div className="relative group">
                          <label className="absolute -top-2.5 left-4 px-2 z-10 bg-gradient-to-b from-white/0 via-white to-white/0 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Energy
                          </label>
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder="0"
                              value={quickEntryCalories}
                              onChange={(e) => setQuickEntryCalories(e.target.value)}
                              className="h-14 px-6 pr-16 rounded-2xl bg-white border-slate-200 text-lg font-editorial text-slate-800 shadow-sm focus:ring-slate-200 focus:border-slate-300 transition-all font-normal placeholder:text-slate-300 placeholder:font-sans"
                              min="0"
                            />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">kcal</span>
                          </div>
                        </div>

                        {/* Macros Input Section - Mimicking 'Total Energy' Card */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center gap-4 mb-4">
                            <h4 className="font-editorial text-lg text-slate-700">Macro Profile</h4>
                            <div className="h-px flex-1 bg-slate-200/60" />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            {/* Protein */}
                            <div className="text-center">
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={quickEntryProtein}
                                  onChange={(e) => setQuickEntryProtein(e.target.value)}
                                  className="h-12 w-full rounded-xl border-slate-200 bg-white text-center font-bold text-slate-700 shadow-sm focus:border-blue-300 focus:ring-blue-100 placeholder:font-normal placeholder:text-slate-300 px-1"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300 pointer-events-none">g</span>
                              </div>
                              <div className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</div>
                            </div>

                            {/* Carbs */}
                            <div className="text-center relative">
                              {/* Dividers */}
                              <div className="absolute -left-2 top-2 bottom-6 w-px bg-slate-200/50" />
                              <div className="absolute -right-2 top-2 bottom-6 w-px bg-slate-200/50" />

                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={quickEntryCarbs}
                                  onChange={(e) => setQuickEntryCarbs(e.target.value)}
                                  className="h-12 w-full rounded-xl border-slate-200 bg-white text-center font-bold text-slate-700 shadow-sm focus:border-emerald-300 focus:ring-emerald-100 placeholder:font-normal placeholder:text-slate-300 px-1"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300 pointer-events-none">g</span>
                              </div>
                              <div className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carbs</div>
                            </div>

                            {/* Fat */}
                            <div className="text-center">
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={quickEntryFat}
                                  onChange={(e) => setQuickEntryFat(e.target.value)}
                                  className="h-12 w-full rounded-xl border-slate-200 bg-white text-center font-bold text-slate-700 shadow-sm focus:border-yellow-300 focus:ring-yellow-100 placeholder:font-normal placeholder:text-slate-300 px-1"
                                  min="0"
                                  step="0.1"
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-300 pointer-events-none">g</span>
                              </div>
                              <div className="mt-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fat</div>
                            </div>
                          </div>
                        </div>

                        {/* Action Button - Amber (Matching Build Button) */}
                        <div className="pt-2">
                          <div className="flex gap-3">
                            <Button
                              onClick={addQuickEntryToBuilder}
                              disabled={!quickEntryName.trim() || !quickEntryCalories || parseFloat(quickEntryCalories) <= 0}
                              variant="outline"
                              className={cn(
                                "flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all",
                                "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400"
                              )}
                            >
                              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" /> Build
                            </Button>
                            <Button
                              onClick={() => handleQuickEntry(true)}
                              disabled={!quickEntryName.trim() || !quickEntryCalories || parseFloat(quickEntryCalories) <= 0}
                              className={cn(
                                "flex-[2] h-12 rounded-xl text-white font-bold shadow-md transition-all",
                                "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                                "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_4px_12px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5",
                                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none disabled:bg-slate-200 disabled:border-none disabled:text-slate-400 disabled:from-slate-200 disabled:to-slate-200"
                              )}
                            >
                              Save & Log <Plus className="ml-2 h-5 w-5 stroke-[3px]" />
                            </Button>
                          </div>
                        </div>

                        {/* Usage Tip */}
                        <div className="mt-6 p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50 text-center">
                          <p className="text-xs text-blue-900/70 font-medium">
                            <span className="font-bold mr-1">💡 Tip:</span>
                            Use this when you know nutrition info but don't want to search for ingredients.
                          </p>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

              ) : activeTab === 'scan-label' ? (
                /* OCR Scan Label Tab */
                <div className="px-5 pt-2 pb-8 space-y-4 max-w-md mx-auto">
                  {showCamera ? (
                    <CameraCapture
                      onCapture={handleCameraCapture}
                      onCancel={() => setShowCamera(false)}
                      initialMode={analysisMode}
                    />
                  ) : !ocrImage ? (
                    /* Initial state - Open Camera */
                    <div className="space-y-4">
                      <div className="p-8 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                        <div className="text-center mb-6">
                          <div className="inline-flex p-5 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-4">
                            <Camera className="h-10 w-10 text-slate-700" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">Scan Food</h3>
                          <p className="text-sm text-slate-600">
                            Scan nutrition labels or analyze meal photos with AI
                          </p>
                        </div>

                        <Button
                          onClick={() => setShowCamera(true)}
                          className={cn(
                            "w-full h-14 rounded-xl text-white font-bold shadow-md transition-all",
                            "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                            "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                            "hover:shadow-[0_6px_16px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                          )}
                        >
                          <Camera className="h-5 w-5 mr-2" />
                          Open Camera
                        </Button>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                        <p className="text-xs text-blue-800">
                          <span className="font-semibold">💡 Tip:</span> Use the segmented control in the camera to switch between nutrition label scanning and meal photo analysis.
                        </p>
                      </div>
                    </div>
                  ) : !ocrResult && !analyzedMeal ? (
                    /* Image captured - Ready to process */
                    <div className="space-y-4">
                      <div className="p-6 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Preview</h3>

                        <div className="relative rounded-xl overflow-hidden mb-4 bg-slate-100">
                          <img src={ocrImage} alt="Nutrition label" className="w-full h-auto" />
                        </div>

                        {ocrError && (
                          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200">
                            <p className="text-sm text-rose-700">{ocrError}</p>
                          </div>
                        )}

                        <div className="space-y-3">
                          <Button
                            onClick={analysisMode === 'meal' ? handleAnalyzeMealPhoto : handleExtractNutrition}
                            disabled={isProcessingOcr || isAnalyzingFood}
                            className={cn(
                              "w-full h-12 rounded-xl text-white font-bold shadow-md transition-all",
                              analysisMode === 'meal'
                                ? "bg-gradient-to-br from-indigo-500 to-indigo-700 border border-indigo-400 shadow-[0_4px_12px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_16px_rgba(99,102,241,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)]"
                                : "bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                              "hover:-translate-y-0.5",
                              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            )}
                          >
                            {isProcessingOcr || isAnalyzingFood ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                {analysisMode === 'meal' ? 'Analyzing Meal...' : 'Extracting Info...'}
                              </>
                            ) : (
                              <>
                                {analysisMode === 'meal' ? (
                                  <Utensils className="h-5 w-5 mr-2" />
                                ) : (
                                  <ScanLine className="h-5 w-5 mr-2" />
                                )}
                                {analysisMode === 'meal' ? 'Analyze Meal' : 'Extract Nutrition Info'}
                              </>
                            )}
                          </Button>

                          <Button
                            onClick={handleResetOcr}
                            variant="outline"
                            disabled={isProcessingOcr}
                            className="w-full h-12 rounded-xl font-bold"
                          >
                            Try Another Image
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : analyzedMeal ? (
                    /* Meal Analysis Results */
                    <div className="space-y-6">
                      <div className="p-1 rounded-[2rem] bg-gradient-to-br from-white/80 to-white/40 border border-white/60 shadow-xl backdrop-blur-xl">
                        <div className="bg-white/50 rounded-[1.8rem] p-6">

                          {/* Header */}
                          <div className="text-center mb-8">
                            <h3 className="text-3xl font-editorial font-normal text-slate-800 mb-2">Meal Analysis</h3>
                            <div className="w-12 h-1 bg-slate-800/10 mx-auto rounded-full" />
                          </div>

                          {/* Meal Name input with premium styling */}
                          <div className="mb-8 relative group">
                            <label className="absolute -top-2.5 left-4 px-2 bg-gradient-to-b from-white/0 via-white to-white/0 text-xs font-bold text-slate-500 uppercase tracking-wider">
                              Meal Name
                            </label>
                            <Input
                              value={analyzedMeal.mealName}
                              onChange={(e) => setAnalyzedMeal({ ...analyzedMeal, mealName: e.target.value })}
                              className="h-14 px-6 rounded-2xl bg-white border-slate-200 text-lg font-editorial text-slate-800 shadow-sm focus:ring-slate-200 focus:border-slate-300 transition-all font-normal"
                            />
                          </div>

                          {/* Ingredients List */}
                          <div className="mb-8">
                            <div className="flex items-center gap-4 mb-4">
                              <h4 className="font-editorial text-xl text-slate-800">Ingredients</h4>
                              <div className="h-px flex-1 bg-slate-200" />
                            </div>

                            <div className="space-y-4">
                              {recalculateMealMacros()?.ingredients.map((ing: any, index: number) => (
                                <div key={index} className="group relative bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:shadow-md hover:border-slate-200">
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="pr-4">
                                      <div className="font-editorial text-lg text-slate-800 leading-tight mb-1">{ing.name}</div>
                                      <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">{ing.description}</div>
                                    </div>

                                    {/* Portion Control */}
                                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
                                      <button
                                        onClick={() => updateIngredientPortion(index, (ingredientPortions[index] || ing.estimatedGrams) - 10)}
                                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                                      >
                                        -
                                      </button>
                                      <span className="w-12 text-center text-sm font-bold text-slate-700 font-sans mx-1">
                                        {ingredientPortions[index] || ing.estimatedGrams}g
                                      </span>
                                      <button
                                        onClick={() => updateIngredientPortion(index, (ingredientPortions[index] || ing.estimatedGrams) + 10)}
                                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  {/* Ingredient Macros Micro-grid */}
                                  <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-50">
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                      <span className="text-slate-600">{Math.round(ing.calories)}</span> kcal
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                      <span className="text-slate-600">{ing.protein}g</span> P
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      <span className="text-slate-600">{ing.carbs}g</span> C
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                                      <span className="text-slate-600">{ing.fat}g</span> F
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Total Summary - Clean Minimal Design */}
                          <div className="mb-6 pt-2">
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200/60">
                                <span className="font-editorial text-xl text-slate-700">Total Energy</span>
                                <div className="flex items-baseline">
                                  <span className="font-editorial text-3xl text-slate-900 mr-1">
                                    {recalculateMealMacros()?.totals.calories}
                                  </span>
                                  <span className="text-sm font-medium text-slate-500">kcal</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-8">
                                <div className="text-center">
                                  <div className="text-xl font-bold text-slate-800 mb-1">
                                    {recalculateMealMacros()?.totals.protein}g
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Protein</div>
                                </div>
                                <div className="text-center relative">
                                  {/* Vertical dividers */}
                                  <div className="absolute left-0 top-1 bottom-1 w-px bg-slate-200/60" />
                                  <div className="absolute right-0 top-1 bottom-1 w-px bg-slate-200/60" />

                                  <div className="text-xl font-bold text-slate-800 mb-1">
                                    {recalculateMealMacros()?.totals.carbs}g
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carbs</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xl font-bold text-slate-800 mb-1">
                                    {recalculateMealMacros()?.totals.fat}g
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fat</div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons - Responsive Stack */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                              onClick={handleResetAnalysis}
                              variant="outline"
                              className="w-full sm:flex-1 h-12 rounded-xl font-bold order-3 sm:order-1"
                            >
                              Analyze Another
                            </Button>
                            <Button
                              onClick={handleSaveAnalyzedMeal}
                              className={cn(
                                "w-full sm:flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all order-1 sm:order-2",
                                "bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400",
                                "shadow-[0_4px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_6px_16px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                              )}
                            >
                              Save & Add
                            </Button>
                            <Button
                              onClick={addAnalyzedMealToBuilder}
                              className={cn(
                                "w-full sm:flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all order-2 sm:order-3",
                                "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                                "shadow-[0_4px_12px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_6px_16px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                              )}
                            >
                              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" /> Build
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Results extracted - Show nutrition data */
                    <div className="space-y-4">
                      <div className="p-6 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 rounded-full bg-emerald-100">
                            <ScanLine className="h-5 w-5 text-emerald-600" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">Extracted Nutrition</h3>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Product Name *</label>
                            <Input
                              value={ocrResult.productName}
                              onChange={(e) => setOcrResult({ ...ocrResult, productName: e.target.value })}
                              placeholder="Enter product name"
                              className="rounded-xl border-slate-200 bg-white/80 focus:bg-white h-11"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Serving Size</label>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                              <p className="text-sm text-slate-700">{ocrResult.servingSize}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-semibold text-slate-700">Portion</label>
                              <div className="flex items-center bg-white/50 rounded-lg p-0.5 border border-white/60 shadow-sm">
                                <button
                                  onClick={() => updateOcrServingMultiplier(-0.5)}
                                  className="w-8 h-8 rounded-md hover:bg-slate-100/80 text-slate-600 flex items-center justify-center transition-colors font-bold"
                                >
                                  -
                                </button>
                                <span className="text-sm font-medium w-16 text-center text-slate-700">
                                  {ocrServingMultiplier}x
                                </span>
                                <button
                                  onClick={() => updateOcrServingMultiplier(0.5)}
                                  className="w-8 h-8 rounded-md hover:bg-slate-100/80 text-slate-600 flex items-center justify-center transition-colors font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>


                          <div className="space-y-3">
                            {/* Calories Display */}
                            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                              <div className="flex items-baseline justify-between">
                                <span className="text-sm font-semibold text-slate-600">Total Calories</span>
                                <span className="text-2xl font-bold text-slate-800">
                                  {Math.round(ocrResult.calories * ocrServingMultiplier)}
                                  <span className="text-sm font-normal text-slate-500 ml-1">kcal</span>
                                </span>
                              </div>
                            </div>

                            {/* Macros Grid */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="p-3 rounded-xl bg-white/80 border border-slate-200 text-center">
                                <div className="text-lg font-bold text-slate-800">
                                  {Math.round(ocrResult.protein * ocrServingMultiplier * 10) / 10}g
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-1">Protein</div>
                              </div>
                              <div className="p-3 rounded-xl bg-white/80 border border-slate-200 text-center">
                                <div className="text-lg font-bold text-slate-800">
                                  {Math.round(ocrResult.carbs * ocrServingMultiplier * 10) / 10}g
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-1">Carbs</div>
                              </div>
                              <div className="p-3 rounded-xl bg-white/80 border border-slate-200 text-center">
                                <div className="text-lg font-bold text-slate-800">
                                  {Math.round(ocrResult.fat * ocrServingMultiplier * 10) / 10}g
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-1">Fat</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              onClick={handleResetOcr}
                              variant="outline"
                              className="flex-1 h-12 rounded-xl font-bold"
                            >
                              Scan Another
                            </Button>
                            <Button
                              onClick={handleSaveOcrResult}
                              className={cn(
                                "flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all",
                                "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                                "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_6px_16px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                              )}
                            >
                              Save & Add
                            </Button>
                            <Button
                              onClick={addOcrToBuilder}
                              className={cn(
                                "flex-1 h-12 rounded-xl text-white font-bold shadow-md transition-all",
                                "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                                "shadow-[0_4px_12px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                "hover:shadow-[0_6px_16px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                              )}
                            >
                              <Plus className="h-4 w-4 mr-1.5 stroke-[3px]" /> Build
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              ) : activeTab === 'my-meals' ? (
                /* My Meals Tab - Premium Design */
                <div className="px-5 pt-2 space-y-4 pb-8">
                  {customMeals === undefined ? (
                    <div className="text-center p-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-400" /></div>
                  ) : customMeals.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No saved meals yet.</p>
                      <p className="text-xs mt-1">Create one by selecting ingredients in the Search tab!</p>
                    </div>
                  ) : (
                    customMeals.map(meal => (
                      <div
                        key={meal._id}
                        className={cn(
                          'p-5 mb-4 rounded-[1.5rem] transition-all duration-300 group',
                          'bg-white border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]',
                          'hover:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-slate-200'
                        )}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start justify-between">
                            <div
                              className="flex-1 pr-4 cursor-pointer"
                              onClick={() => onSelectFood({
                                name: meal.name,
                                calories: meal.totalMacros.calories,
                                protein: meal.totalMacros.protein,
                                carbs: meal.totalMacros.carbs,
                                fat: meal.totalMacros.fat,
                                servingSize: '1 meal'
                              })}
                            >
                              <div className="flex items-start gap-2 mb-1">
                                <span className="font-editorial text-xl text-slate-800 leading-tight group-hover:text-orange-600 transition-colors">
                                  {meal.name}
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 font-medium tracking-wide uppercase mt-1">
                                {meal.ingredients.length} ingredients
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                              <Button
                                size="sm"
                                onClick={() => onSelectFood({
                                  name: meal.name,
                                  calories: meal.totalMacros.calories,
                                  protein: meal.totalMacros.protein,
                                  carbs: meal.totalMacros.carbs,
                                  fat: meal.totalMacros.fat,
                                  servingSize: '1 meal'
                                })}
                                className={cn(
                                  "h-9 px-4 rounded-xl text-white font-bold shadow-md transition-all",
                                  "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                                  "shadow-[0_2px_8px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                  "hover:shadow-[0_4px_12px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                                )}
                              >
                                Add
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this custom meal?')) {
                                    await deleteCustomMeal({ id: meal._id });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 stroke-2" />
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBuilderIngredients(prev => [...prev, {
                                    name: meal.name,
                                    calories: meal.totalMacros.calories,
                                    protein: meal.totalMacros.protein,
                                    carbs: meal.totalMacros.carbs,
                                    fat: meal.totalMacros.fat,
                                    servingSize: '1 meal',
                                    multiplier: 1
                                  }]);
                                }}
                                className={cn(
                                  "h-9 px-4 rounded-xl text-white font-bold shadow-md transition-all",
                                  "bg-gradient-to-br from-amber-400 to-orange-600 border border-orange-400",
                                  "shadow-[0_2px_8px_rgba(249,115,22,0.5),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                                  "hover:shadow-[0_4px_12px_rgba(249,115,22,0.6),inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                                )}
                              >
                                <Plus className="h-3.5 w-3.5 mr-1.5 stroke-[3px]" />
                                Build
                              </Button>
                            </div>
                          </div>

                          {/* Micro-grid Macros */}
                          <div className="flex items-center gap-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-3 border-t border-slate-50">
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                              <span className="text-slate-700 font-extrabold text-sm">{Math.round(meal.totalMacros.calories)}</span>
                              <span className="text-[10px]">kcal</span>
                            </span>
                            <div className="w-px h-3 bg-slate-200" />
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <span className="text-slate-600">{Math.round(meal.totalMacros.protein)}g</span> P
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span className="text-slate-600">{Math.round(meal.totalMacros.carbs)}g</span> C
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                              <span className="text-slate-600">{Math.round(meal.totalMacros.fat)}g</span> F
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet >
  );
}
