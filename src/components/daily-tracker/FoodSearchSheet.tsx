import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search, X, Loader2, Plus, Star, Save, Trash2, ChevronLeft, Camera, Upload, ScanLine } from 'lucide-react';
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

  const handleQuickEntry = async () => {
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

    // Save to custom meals
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

    // Add to journal
    onSelectFood(foodData);

    // Reset form
    setQuickEntryName('');
    setQuickEntryCalories('');
    setQuickEntryProtein('');
    setQuickEntryCarbs('');
    setQuickEntryFat('');
    setQuickEntrySugar('');
  };

  // OCR Handlers
  const handleCameraCapture = (imageBase64: string) => {
    setOcrImage(imageBase64);
    setShowCamera(false);
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
          'p-4 mb-3 rounded-2xl transition-all duration-300 group',
          'bg-white/40 border border-white/60 backdrop-blur-sm',
          'hover:bg-white/90 hover:border-white/80',
          'hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08),0_4px_6px_-2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]',
          'hover:-translate-y-0.5'
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {isCommon && (
                <div className="p-1 rounded-full bg-amber-100/50">
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                </div>
              )}
              <span className="font-semibold text-slate-800 line-clamp-2 leading-tight">
                {food.description}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
              <span className="font-bold text-slate-900 bg-slate-100/80 px-2 py-1 rounded-lg">
                {adjustedCalories} <span className="text-[10px] font-normal text-slate-500">kcal</span>
              </span>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex gap-2">
                <span className="font-medium text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded-md border border-emerald-100/50">{adjustedProtein}g P</span>
                <span className="font-medium text-amber-700 bg-amber-50/80 px-1.5 py-0.5 rounded-md border border-amber-100/50">{adjustedCarbs}g C</span>
                <span className="font-medium text-rose-700 bg-rose-50/80 px-1.5 py-0.5 rounded-md border border-rose-100/50">{adjustedFat}g F</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                Portion
              </span>
              <div className="flex items-center bg-white/50 rounded-lg p-0.5 border border-white/60 shadow-sm">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateServingMultiplier(food.fdcId, -0.5);
                  }}
                  className="w-6 h-6 rounded-md hover:bg-slate-100/80 text-slate-600 flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <span className="text-xs font-medium w-16 text-center text-slate-700">
                  {Math.round((food.servingSize || 100) * multiplier)}
                  {food.servingSizeUnit || 'g'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateServingMultiplier(food.fdcId, 0.5);
                  }}
                  className="w-6 h-6 rounded-md hover:bg-slate-100/80 text-slate-600 flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

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
      </div>
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[90vh] rounded-t-[2.5rem] px-0 flex flex-col border-t border-white/60 bg-gradient-to-b from-slate-50/95 via-slate-100/95 to-blue-50/95 backdrop-blur-2xl shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)]"
      >
        <SheetHeader className="px-6 pb-4 pt-6 flex-shrink-0 border-b border-slate-200/50">
          <SheetDescription className="hidden">Search for food or create a custom meal</SheetDescription>
          {isBuilderOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsBuilderOpen(false)}
                  className="h-9 w-9 -ml-2 rounded-full hover:bg-white/50"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-600" />
                </Button>
                <SheetTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
                  Build Custom Meal
                </SheetTitle>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl font-black tracking-tight text-slate-800">
                {mode === 'swap' ? 'Swap Meal' : 'Add Food'}
              </SheetTitle>
              {/* Removed duplicate close button - default SheetContent has one */}
            </div>
          )}

          {!isBuilderOpen && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-4 h-11 bg-slate-200/50 p-1 rounded-2xl">
                <TabsTrigger
                  value="search"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all font-semibold text-xs sm:text-sm"
                >
                  Search
                </TabsTrigger>
                <TabsTrigger
                  value="quick-entry"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all font-semibold text-xs sm:text-sm"
                >
                  Quick Entry
                </TabsTrigger>
                <TabsTrigger
                  value="scan-label"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all font-semibold text-xs sm:text-sm"
                >
                  Scan Label
                </TabsTrigger>
                <TabsTrigger
                  value="my-meals"
                  className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md transition-all font-semibold text-xs sm:text-sm"
                >
                  My Meals
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {!isBuilderOpen && activeTab === 'search' && (
            <div className="relative mt-4">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-white/50 rounded-lg">
                <Search className="h-4 w-4 text-slate-400" />
              </div>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ingredients (e.g., 'Chicken', 'Oats')..."
                className="pl-12 h-12 rounded-2xl bg-white/60 border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.02),0_2px_10px_rgba(255,255,255,1)] focus:ring-4 focus:ring-slate-200/50 focus:bg-white/90 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                autoFocus
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500 animate-spin" />
              )}
            </div>
          )}
        </SheetHeader>

        {isBuilderOpen ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Meal Name</label>
                  <Input
                    placeholder="e.g. My Breakfast Bowl"
                    value={customMealName}
                    onChange={(e) => setCustomMealName(e.target.value)}
                    className="rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Ingredients ({builderIngredients.length})</label>
                    <Button variant="ghost" size="sm" onClick={() => setIsBuilderOpen(false)} className="text-orange-600 h-6 text-xs">
                      <Plus className="h-3 w-3 mr-1" /> Add more
                    </Button>
                  </div>
                  {builderIngredients.map((ing, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="font-medium text-sm">{ing.name}</p>
                        <p className="text-xs text-slate-500">{ing.servingSize} • {ing.calories} kcal</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => setBuilderIngredients(prev => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-300">Total Macros</span>
                    <span className="text-lg font-bold">
                      {builderIngredients.reduce((acc, i) => acc + i.calories, 0)} kcal
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-emerald-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.protein, 0))}g
                      </span>
                      <span className="text-slate-400">Protein</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-amber-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.carbs, 0))}g
                      </span>
                      <span className="text-slate-400">Carbs</span>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <span className="block text-rose-400 font-mono text-sm">
                        {Math.round(builderIngredients.reduce((acc, i) => acc + i.fat, 0))}g
                      </span>
                      <span className="text-slate-400">Fat</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="p-4 border-t bg-white">
              <Button onClick={handleSaveCustomMeal} className="w-full h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold"
                disabled={!customMealName || builderIngredients.length === 0}
              >
                Save & Log Meal
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-2">
              {activeTab === 'search' ? (
                <>
                  {!isBuilderOpen && builderIngredients.length > 0 && (
                    <div className="mb-4 p-3 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-orange-900">Building Meal...</span>
                        <span className="text-xs text-orange-600 block">{builderIngredients.length} ingredients selected</span>
                      </div>
                      <Button size="sm" onClick={() => setIsBuilderOpen(true)} className="bg-orange-500 text-white h-8">
                        Continue
                      </Button>
                    </div>
                  )}

                  {showCommon && (
                    <>
                      <div className="flex items-center gap-2 mb-3">
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
                </>
              ) : activeTab === 'quick-entry' ? (
                /* Quick Entry Tab */
                <div className="space-y-4 max-w-md mx-auto">
                  <div className="p-6 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Manual Entry</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Meal Name *</label>
                        <Input
                          placeholder="e.g., Homemade Pasta"
                          value={quickEntryName}
                          onChange={(e) => setQuickEntryName(e.target.value)}
                          className="rounded-xl border-slate-200 bg-white/80 focus:bg-white h-11"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700">Calories (kcal) *</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={quickEntryCalories}
                          onChange={(e) => setQuickEntryCalories(e.target.value)}
                          className="rounded-xl border-slate-200 bg-white/80 focus:bg-white h-11"
                          min="0"
                          step="1"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-emerald-700">Protein (g)</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={quickEntryProtein}
                            onChange={(e) => setQuickEntryProtein(e.target.value)}
                            className="rounded-xl border-emerald-200 bg-emerald-50/50 focus:bg-white h-11 text-center"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-amber-700">Carbs (g)</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={quickEntryCarbs}
                            onChange={(e) => setQuickEntryCarbs(e.target.value)}
                            className="rounded-xl border-amber-200 bg-amber-50/50 focus:bg-white h-11 text-center"
                            min="0"
                            step="0.1"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-rose-700">Fat (g)</label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={quickEntryFat}
                            onChange={(e) => setQuickEntryFat(e.target.value)}
                            className="rounded-xl border-rose-200 bg-rose-50/50 focus:bg-white h-11 text-center"
                            min="0"
                            step="0.1"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                          Sugar (g)
                          <span className="text-xs font-normal text-slate-500">(Optional)</span>
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={quickEntrySugar}
                          onChange={(e) => setQuickEntrySugar(e.target.value)}
                          className="rounded-xl border-purple-200 bg-purple-50/30 focus:bg-white h-11"
                          min="0"
                          step="0.1"
                        />
                      </div>

                      <Button
                        onClick={handleQuickEntry}
                        disabled={!quickEntryName.trim() || !quickEntryCalories || parseFloat(quickEntryCalories) <= 0}
                        className={cn(
                          "w-full h-12 rounded-xl text-white font-bold shadow-md transition-all mt-6",
                          "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                          "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                          "hover:shadow-[0_6px_16px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5",
                          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        )}
                      >
                        Add to Journal
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100">
                    <p className="text-xs text-blue-800">
                      <span className="font-semibold">💡 Tip:</span> Use this when you know your meal's nutrition info but don't want to search for ingredients.
                    </p>
                  </div>
                </div>

              ) : activeTab === 'scan-label' ? (
                /* OCR Scan Label Tab */
                <div className="space-y-4 max-w-md mx-auto">
                  {showCamera ? (
                    <CameraCapture
                      onCapture={handleCameraCapture}
                      onCancel={() => setShowCamera(false)}
                      mode={analysisMode}
                    />
                  ) : !ocrImage ? (
                    /* Initial state - Choose scan mode */
                    <div className="space-y-4">
                      <div className="p-6 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                        <div className="text-center mb-6">
                          <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 mb-4">
                            <ScanLine className="h-8 w-8 text-slate-700" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800 mb-2">Choose Scan Mode</h3>
                          <p className="text-sm text-slate-600">
                            Scan a nutrition label or analyze an entire meal
                          </p>
                        </div>

                        <div className="space-y-3">
                          <Button
                            onClick={() => {
                              setAnalysisMode('label');
                              setShowCamera(true);
                            }}
                            className={cn(
                              "w-full h-16 rounded-xl text-white font-bold shadow-md transition-all flex-col gap-1",
                              "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600",
                              "shadow-[0_4px_12px_rgba(30,41,59,0.5),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                              "hover:shadow-[0_6px_16px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <ScanLine className="h-5 w-5" />
                              <span>Scan Nutrition Label</span>
                            </div>
                            <span className="text-xs text-white/70 font-normal">Extract macros from product labels</span>
                          </Button>

                          <Button
                            onClick={() => {
                              setAnalysisMode('meal');
                              setShowCamera(true);
                            }}
                            className={cn(
                              "w-full h-16 rounded-xl text-white font-bold shadow-md transition-all flex-col gap-1",
                              "bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400",
                              "shadow-[0_4px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                              "hover:shadow-[0_6px_16px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <Camera className="h-5 w-5" />
                              <span>Analyze Meal Photo</span>
                            </div>
                            <span className="text-xs text-white/70 font-normal">AI identifies ingredients & calculates macros</span>
                          </Button>

                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                handleGalleryUpload(e);
                                // Mode will be determined by which button was last clicked
                              }}
                              className="hidden"
                              id="gallery-upload"
                            />
                            <Button
                              onClick={() => document.getElementById('gallery-upload')?.click()}
                              variant="outline"
                              className="w-full h-12 rounded-xl font-bold border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                            >
                              <Upload className="h-5 w-5 mr-2" />
                              Upload from Gallery
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                        <p className="text-xs text-amber-800">
                          <span className="font-semibold">📸 Tip:</span> For best results, ensure good lighting and the food/label is clearly visible.
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
                            onClick={handleExtractNutrition}
                            disabled={isProcessingOcr}
                            className={cn(
                              "w-full h-12 rounded-xl text-white font-bold shadow-md transition-all",
                              "bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400",
                              "shadow-[0_4px_12px_rgba(16,185,129,0.5),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)]",
                              "hover:shadow-[0_6px_16px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.2)] hover:-translate-y-0.5",
                              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            )}
                          >
                            {isProcessingOcr ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Extracting...
                              </>
                            ) : (
                              <>
                                <ScanLine className="h-5 w-5 mr-2" />
                                Extract Nutrition Info
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
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              ) : (
                /* My Meals Tab */
                <div className="space-y-3">
                  {customMeals === undefined ? (
                    <div className="text-center p-8"><Loader2 className="animate-spin h-6 w-6 mx-auto text-slate-400" /></div>
                  ) : customMeals.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                      <p>No saved meals yet.</p>
                      <p className="text-xs mt-1">Create one by selecting ingredients in the Search tab!</p>
                    </div>
                  ) : (
                    customMeals.map(meal => (
                      <div key={meal._id} className="group relative p-4 rounded-xl border border-slate-100 bg-white hover:border-orange-200 transition-all">
                        <div
                          className="flex justify-between items-start cursor-pointer"
                          onClick={() => onSelectFood({
                            name: meal.name,
                            calories: meal.totalMacros.calories,
                            protein: meal.totalMacros.protein,
                            carbs: meal.totalMacros.carbs,
                            fat: meal.totalMacros.fat,
                            servingSize: '1 meal'
                          })}
                        >
                          <div>
                            <h4 className="font-bold text-slate-800">{meal.name}</h4>
                            <p className="text-xs text-slate-500 mt-1">{meal.ingredients.length} ingredients</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-8 w-8 text-orange-500 hover:bg-orange-50">
                            <Plus className="h-5 w-5" />
                          </Button>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex gap-3 text-xs font-mono">
                            <span className="font-bold text-slate-700">{meal.totalMacros.calories} kcal</span>
                            <span className="text-emerald-600">{meal.totalMacros.protein}g P</span>
                            <span className="text-amber-600">{meal.totalMacros.carbs}g C</span>
                            <span className="text-rose-600">{meal.totalMacros.fat}g F</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Delete this custom meal?')) {
                                await deleteCustomMeal({ id: meal._id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet >
  );
}

