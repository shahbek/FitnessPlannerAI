import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_FORM_STATE, GOAL_CATEGORY_OPTIONS } from '@/constants';
import { GoalCategory, BodyFatGoal } from '@/models/UserProfile';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Target,
  Dumbbell,
  Heart,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface FormData {
  // Base fields from DEFAULT_FORM_STATE
  age: number | '';
  sex: string;
  heightCm: number | '';
  weightKg: number | '';
  bodyFat?: number; // Optional: current body fat for BMR calculation (non-body_fat_goal modes)

  // New goal category system
  goalCategory: GoalCategory;
  bodyFatGoal?: BodyFatGoal; // Only used when goalCategory === 'body_fat_goal'

  // Timeline
  timelineWeeks: number | '';
  trainingDaysPerWeek: number | '';
  workoutLevel: string;

  // Training Preferences
  workoutSplit: string;
  equipment: string;
  schedule: string;

  // Nutrition
  preferences: string; // Keeping as "Additional Notes"
  mealFrequency?: number;

  // New Nutrition Fields
  dietType: string;
  allergies: string; // Changed from string[] to string for user-written input
  cuisinePreferences: string[]; // Keep badges for quick selection
  customCuisines: string; // New field for custom cuisines
  mealComplexity: string;
  mealPrepPreference: string;
  cookingTimePerMeal: number;
  likedIngredients: string;
  dislikedIngredients: string;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'; // New field
}

// Override string fields with arrays for the API
interface CompleteFormData extends Omit<FormData, 'likedIngredients' | 'dislikedIngredients' | 'allergies' | 'customCuisines'> {
  apiKey: string;
  endpoint: string;
  model: string;
  primaryGoal?: string;
  targetBf?: number;
  likedIngredients: string[];
  dislikedIngredients: string[];
  allergies: string[];
  cuisinePreferences: string[];
}

interface MultistepProfileFormProps {
  onComplete: (formData: CompleteFormData) => void;
  onCancel: () => void;
}

const steps = [
  { id: 1, title: 'Personal Info', icon: User, description: 'Basic information' },
  { id: 2, title: 'Goals & Timeline', icon: Target, description: 'Fitness objectives' },
  { id: 3, title: 'Training Setup', icon: Dumbbell, description: 'Workout preferences' },
  { id: 4, title: 'Nutrition', icon: Heart, description: 'Dietary preferences' }
];

const defaultFormData: FormData = {
  age: DEFAULT_FORM_STATE.age,
  sex: DEFAULT_FORM_STATE.sex,
  heightCm: DEFAULT_FORM_STATE.heightCm,
  weightKg: DEFAULT_FORM_STATE.weightKg,
  bodyFat: undefined, // Optional by default
  goalCategory: DEFAULT_FORM_STATE.goalCategory,
  bodyFatGoal: undefined, // Only set when body_fat_goal is selected
  timelineWeeks: DEFAULT_FORM_STATE.timelineWeeks,
  trainingDaysPerWeek: DEFAULT_FORM_STATE.trainingDaysPerWeek,
  workoutLevel: DEFAULT_FORM_STATE.workoutLevel,
  workoutSplit: DEFAULT_FORM_STATE.workoutSplit,
  equipment: DEFAULT_FORM_STATE.equipment,
  schedule: DEFAULT_FORM_STATE.schedule,
  preferences: DEFAULT_FORM_STATE.preferences,

  // New Defaults
  dietType: 'omnivore',
  allergies: '',
  cuisinePreferences: [],
  customCuisines: '',
  mealComplexity: 'moderate',
  mealPrepPreference: 'fresh_daily',
  cookingTimePerMeal: 30,
  likedIngredients: '',
  dislikedIngredients: '',
  activityLevel: 'moderate'
};

export function MultistepProfileForm({ onComplete, onCancel }: MultistepProfileFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleCuisineSelection = (value: string) => {
    setFormData(prev => {
      const current = prev.cuisinePreferences;
      if (current.includes(value)) {
        return { ...prev, cuisinePreferences: current.filter(item => item !== value) };
      } else {
        return { ...prev, cuisinePreferences: [...current, value] };
      }
    });
  };

  const updateBodyFatGoal = (field: keyof BodyFatGoal, value: number | undefined) => {
    setFormData(prev => ({
      ...prev,
      bodyFatGoal: {
        currentBf: prev.bodyFatGoal?.currentBf ?? 20,
        targetBf: prev.bodyFatGoal?.targetBf ?? 12,
        [field]: value
      }
    }));
  };

  const handleGoalCategoryChange = (value: GoalCategory) => {
    setFormData(prev => {
      const newData = { ...prev, goalCategory: value };

      // If switching to body_fat_goal, initialize bodyFatGoal
      if (value === 'body_fat_goal') {
        newData.bodyFatGoal = {
          currentBf: prev.bodyFat ?? 20,
          targetBf: 12
        };
      } else {
        // Clear body fat goal when switching away
        newData.bodyFatGoal = undefined;
      }

      return newData;
    });
  };

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Parse comma-separated strings into arrays
    const liked = formData.likedIngredients.split(',').map(s => s.trim()).filter(Boolean);
    const disliked = formData.dislikedIngredients.split(',').map(s => s.trim()).filter(Boolean);
    const allergiesList = formData.allergies.split(',').map(s => s.trim()).filter(Boolean);

    // Combine selected cuisines with custom ones
    const customCuisinesList = formData.customCuisines.split(',').map(s => s.trim()).filter(Boolean);
    const allCuisines = [...new Set([...formData.cuisinePreferences, ...customCuisinesList])];

    // Merge form data with API configuration from DEFAULT_FORM_STATE
    const completeFormData: CompleteFormData = {
      ...formData,
      likedIngredients: liked,
      dislikedIngredients: disliked,
      allergies: allergiesList,
      cuisinePreferences: allCuisines,
      apiKey: DEFAULT_FORM_STATE.apiKey,
      endpoint: 'groq',
      model: DEFAULT_FORM_STATE.model,
      primaryGoal: goalCategoryToLegacyGoal(formData.goalCategory),
      targetBf: formData.bodyFatGoal?.targetBf
    } as any; // Cast for compatibility with expected prop type if needed, but fields are handled
    onComplete(completeFormData as any);
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.age !== '' && formData.age > 0 && formData.sex && formData.heightCm !== '' && formData.heightCm > 0 && formData.weightKg !== '' && formData.weightKg > 0);
      case 2: {
        const baseValid = !!(
          formData.goalCategory &&
          formData.timelineWeeks !== '' && formData.timelineWeeks > 0 &&
          formData.timelineWeeks <= 24 &&
          formData.trainingDaysPerWeek !== '' && formData.trainingDaysPerWeek > 0 &&
          formData.workoutLevel
        );

        // If body_fat_goal, require body fat inputs
        if (formData.goalCategory === 'body_fat_goal') {
          return baseValid &&
            formData.bodyFatGoal !== undefined &&
            formData.bodyFatGoal.currentBf > 0 &&
            formData.bodyFatGoal.targetBf > 0 &&
            formData.bodyFatGoal.currentBf !== formData.bodyFatGoal.targetBf;
        }

        return baseValid;
      }
      case 3:
        return !!(formData.workoutSplit && formData.equipment && formData.schedule.trim() !== '');
      case 4:
        return true; // Nutrition preferences are optional
      default:
        return false;
    }
  };

  // Helper to get goal category option by value
  const getGoalCategoryOption = (value: GoalCategory) => {
    return GOAL_CATEGORY_OPTIONS.find(opt => opt.value === value);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="age">Age *</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateFormData('age', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="25"
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="sex">Sex *</Label>
                <Select value={formData.sex} onValueChange={(value) => updateFormData('sex', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="heightCm">Height (cm) *</Label>
                <Input
                  id="heightCm"
                  type="number"
                  value={formData.heightCm}
                  onChange={(e) => updateFormData('heightCm', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="175"
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="weightKg">Weight (kg) *</Label>
                <Input
                  id="weightKg"
                  type="number"
                  value={formData.weightKg}
                  onChange={(e) => updateFormData('weightKg', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="70"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Optional body fat for BMR accuracy */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <Label htmlFor="bodyFat" className="text-muted-foreground">Current Body Fat % (optional)</Label>
              </div>
              <Input
                id="bodyFat"
                type="number"
                min={5}
                max={50}
                value={formData.bodyFat ?? ''}
                onChange={(e) => updateFormData('bodyFat', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 20"
                className="font-mono max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Providing body fat % improves calorie calculation accuracy
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            {/* Goal Category Selection */}
            <div>
              <Label htmlFor="goalCategory" className="text-base font-medium">What's your goal? *</Label>
              <Select
                value={formData.goalCategory}
                onValueChange={(value) => handleGoalCategoryChange(value as GoalCategory)}
              >
                <SelectTrigger className="mt-2 text-left h-auto py-3">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="font-medium text-base">{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Show selected goal description */}
              {formData.goalCategory && (
                <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    {getGoalCategoryOption(formData.goalCategory)?.description}
                  </p>
                </div>
              )}
            </div>

            {/* Body Fat Goal Inputs - Only shown when body_fat_goal is selected */}
            {formData.goalCategory === 'body_fat_goal' && (
              <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg space-y-4">
                <div className="flex items-center gap-2 text-primary">
                  <Target className="h-4 w-4" />
                  <span className="font-medium">Body Fat Target</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="currentBf">Current Body Fat % *</Label>
                    <Input
                      id="currentBf"
                      type="number"
                      min={5}
                      max={50}
                      value={formData.bodyFatGoal?.currentBf ?? ''}
                      onChange={(e) => updateBodyFatGoal('currentBf', parseInt(e.target.value) || undefined)}
                      placeholder="e.g., 22"
                      className="font-mono"
                    />
                  </div>

                  <div>
                    <Label htmlFor="targetBf">Target Body Fat % *</Label>
                    <Input
                      id="targetBf"
                      type="number"
                      min={5}
                      max={50}
                      value={formData.bodyFatGoal?.targetBf ?? ''}
                      onChange={(e) => updateBodyFatGoal('targetBf', parseInt(e.target.value) || undefined)}
                      placeholder="e.g., 12"
                      className="font-mono"
                    />
                  </div>
                </div>

                {/* Body fat goal validation feedback */}
                {formData.bodyFatGoal && formData.bodyFatGoal.currentBf && formData.bodyFatGoal.targetBf && (
                  <BodyFatGoalFeedback
                    currentBf={formData.bodyFatGoal.currentBf}
                    targetBf={formData.bodyFatGoal.targetBf}
                    timelineWeeks={formData.timelineWeeks}
                    weightKg={formData.weightKg}
                    sex={formData.sex as 'male' | 'female'}
                  />
                )}
              </div>
            )}

            {/* Timeline and Training */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timelineWeeks">Timeline (weeks) *</Label>
                <Input
                  id="timelineWeeks"
                  type="number"
                  min={1}
                  max={24}
                  value={formData.timelineWeeks}
                  onChange={(e) => {
                    if (e.target.value === '') {
                      updateFormData('timelineWeeks', '');
                      return;
                    }
                    const value = parseInt(e.target.value);
                    const clampedValue = Math.min(Math.max(value, 1), 24); // Still clamp but only if valid
                    updateFormData('timelineWeeks', clampedValue);
                  }}
                  placeholder="16"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Maximum 24 weeks</p>
              </div>

              <div>
                <Label htmlFor="trainingDaysPerWeek">Training Days/Week *</Label>
                <Input
                  id="trainingDaysPerWeek"
                  type="number"
                  min={1}
                  max={7}
                  value={formData.trainingDaysPerWeek}
                  onChange={(e) => updateFormData('trainingDaysPerWeek', e.target.value === '' ? '' : parseInt(e.target.value))}
                  placeholder="4"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workoutLevel">Gym Experience Level *</Label>
                <Select value={formData.workoutLevel} onValueChange={(value) => updateFormData('workoutLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner (0-1 year)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (1-4 years)</SelectItem>
                    <SelectItem value="advanced">Advanced (4-7 years)</SelectItem>
                    <SelectItem value="expert">Expert (7+ years)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">Affects workout volume & exercise selection</p>
              </div>

              <div>
                <Label htmlFor="activityLevel">Daily Activity Level (TDEE) *</Label>
                <Select value={formData.activityLevel} onValueChange={(value) => updateFormData('activityLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary (Office job, little movement)</SelectItem>
                    <SelectItem value="light">Lightly Active (Occasional walks/movement)</SelectItem>
                    <SelectItem value="moderate">Moderately Active (Active job or daily walking)</SelectItem>
                    <SelectItem value="active">Very Active (Construction, intense manual labor)</SelectItem>
                    <SelectItem value="very_active">Extra Active (Professional athlete, zero sitting)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">Determines calorie tracking accuracy</p>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="workoutSplit">Workout Split *</Label>
                <Select value={formData.workoutSplit} onValueChange={(value) => updateFormData('workoutSplit', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select split" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_body">Full Body</SelectItem>
                    <SelectItem value="upper_lower">Upper/Lower</SelectItem>
                    <SelectItem value="push_pull_legs">Push/Pull/Legs</SelectItem>
                    <SelectItem value="body_part">Body Part Split</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="equipment">Available Equipment *</Label>
                <Select value={formData.equipment} onValueChange={(value) => updateFormData('equipment', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gym_membership">Gym Membership</SelectItem>
                    <SelectItem value="bodyweight">Bodyweight Only</SelectItem>
                    <SelectItem value="calisthenics">Calisthenics Equipment</SelectItem>
                    <SelectItem value="home_gym">Home Gym (Basic)</SelectItem>
                    <SelectItem value="home_gym_advanced">Home Gym (Advanced)</SelectItem>
                    <SelectItem value="minimal">Minimal Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="schedule">Training Schedule *</Label>
              <Textarea
                id="schedule"
                value={formData.schedule}
                onChange={(e) => updateFormData('schedule', e.target.value)}
                placeholder="Describe your available training times, e.g., 'Monday-Friday: 6-7 AM before work, Saturday: 10-11 AM, Sunday: rest day'"
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        const DIET_TYPES = [
          { value: 'omnivore', label: 'Standard (Omnivore)' },
          { value: 'vegetarian', label: 'Vegetarian' },
          { value: 'vegan', label: 'Vegan' },
          { value: 'pescatarian', label: 'Pescatarian' },
          { value: 'keto', label: 'Keto' },
          { value: 'paleo', label: 'Paleo' },
          { value: 'gluten_free', label: 'Gluten Free' }
        ];

        const ALLERGIES = ['Peanuts', 'Tree Nuts', 'Dairy', 'Gluten', 'Soy', 'Eggs', 'Fish', 'Shellfish'];
        const CUISINES = ['Italian', 'Mexican', 'Asian', 'Mediterranean', 'American', 'Indian', 'Middle Eastern', 'Thai'];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dietType">Diet Type *</Label>
                <Select value={formData.dietType} onValueChange={(value) => updateFormData('dietType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select diet" />
                  </SelectTrigger>
                  <SelectContent>
                    {DIET_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="mealFrequency">Meals Per Day</Label>
                <Select
                  value={formData.mealFrequency?.toString()}
                  onValueChange={(value) => updateFormData('mealFrequency', parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meals</SelectItem>
                    <SelectItem value="4">4 meals</SelectItem>
                    <SelectItem value="5">5 meals</SelectItem>
                    <SelectItem value="6">6 meals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <Label htmlFor="allergies" className="mb-2 block">Allergies & Fatal Restrictions (comma separated)</Label>
              <Input
                id="allergies"
                value={formData.allergies}
                onChange={(e) => updateFormData('allergies', e.target.value)}
                placeholder="Peanuts, Shellfish, Gluten..."
              />
              <p className="text-xs text-muted-foreground mt-1">AI will strictly avoid these in every recipe</p>
            </div>

            {/* Cuisines */}
            <div className="space-y-3">
              <Label className="block">Preferred Cuisines</Label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(cuisine => {
                  const isSelected = formData.cuisinePreferences.includes(cuisine);
                  return (
                    <Badge
                      key={cuisine}
                      variant="outline"
                      className={`cursor-pointer transition-all hover:bg-primary/20 ${isSelected ? 'bg-primary/10 border-primary text-primary' : ''}`}
                      onClick={() => toggleCuisineSelection(cuisine)}
                    >
                      {cuisine}
                    </Badge>
                  );
                })}
              </div>
              <div className="mt-2">
                <Label htmlFor="customCuisines" className="text-xs text-muted-foreground">Or add custom ones (comma separated)</Label>
                <Input
                  id="customCuisines"
                  value={formData.customCuisines}
                  onChange={(e) => updateFormData('customCuisines', e.target.value)}
                  placeholder="Nordic, Middle Eastern, Ethiopian..."
                  className="h-8 text-sm mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cookingTime">Max Cook Time</Label>
                <Select
                  value={formData.cookingTimePerMeal.toString()}
                  onValueChange={(v) => updateFormData('cookingTimePerMeal', parseInt(v))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 mins</SelectItem>
                    <SelectItem value="30">30 mins</SelectItem>
                    <SelectItem value="45">45 mins</SelectItem>
                    <SelectItem value="60">60+ mins</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="complexity">Complexity</Label>
                <Select
                  value={formData.mealComplexity}
                  onValueChange={(v) => updateFormData('mealComplexity', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (Quick)</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="complex">Gourmet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="prepStyle">Prep Style</Label>
                <Select
                  value={formData.mealPrepPreference}
                  onValueChange={(v) => updateFormData('mealPrepPreference', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresh_daily">Fresh Daily</SelectItem>
                    <SelectItem value="batch_cooking">Batch Cook</SelectItem>
                    <SelectItem value="leftovers_ok">Leftovers OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="liked">Foods I Love (comma separated)</Label>
                <Input
                  id="liked"
                  value={formData.likedIngredients}
                  onChange={(e) => updateFormData('likedIngredients', e.target.value)}
                  placeholder="Avocado, Salmon, Rice..."
                />
              </div>
              <div>
                <Label htmlFor="disliked">Foods to Avoid (comma separated)</Label>
                <Input
                  id="disliked"
                  value={formData.dislikedIngredients}
                  onChange={(e) => updateFormData('dislikedIngredients', e.target.value)}
                  placeholder="Mushrooms, Cilantro..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="preferences">Additional Notes</Label>
              <Textarea
                id="preferences"
                value={formData.preferences}
                onChange={(e) => updateFormData('preferences', e.target.value)}
                placeholder="Any other details? e.g. 'I intermittent fast until 12pm'"
                rows={2}
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Goal Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium">Goal:</span> {getGoalCategoryOption(formData.goalCategory)?.label}</p>
                <p><span className="font-medium">Timeline:</span> {formData.timelineWeeks} weeks</p>
                {formData.goalCategory === 'body_fat_goal' && formData.bodyFatGoal && (
                  <p><span className="font-medium">Body Fat:</span> {formData.bodyFatGoal.currentBf}% → {formData.bodyFatGoal.targetBf}%</p>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-editorial">Create New Workout Program</h2>
              <p className="text-muted-foreground">Step {currentStep} of {steps.length}</p>
            </div>
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
              ×
            </Button>
          </div>

          {/* Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{steps[currentStep - 1]?.title}</span>
              <span className="text-sm text-muted-foreground font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8">
            {steps.map((step) => {
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              const Icon = step.icon;

              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors
                    ${isActive ? 'border-primary bg-primary text-primary-foreground' :
                      isCompleted ? 'border-primary bg-primary text-primary-foreground' :
                        'border-muted-foreground text-muted-foreground'}
                  `}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Content */}
          <div className="mb-6">
            {renderStepContent()}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              {currentStep < steps.length ? (
                <Button
                  onClick={handleNext}
                  disabled={!isStepValid(currentStep)}
                  className="flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!isStepValid(currentStep)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/90"
                >
                  <CheckCircle className="h-4 w-4" />
                  Create Program
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Body Fat Goal Feedback Component
 * Shows real-time feedback about the feasibility of body fat goals
 */
function BodyFatGoalFeedback({
  currentBf,
  targetBf,
  timelineWeeks,
  weightKg,
  sex
}: {
  currentBf: number;
  targetBf: number;
  timelineWeeks: number;
  weightKg: number;
  sex: 'male' | 'female';
}) {
  // Essential body fat minimums
  const essentialBf = sex === 'female' ? 13 : 5;

  // Calculate change
  const currentFatMass = weightKg * (currentBf / 100);
  const targetFatMass = weightKg * (targetBf / 100);
  const fatChange = currentFatMass - targetFatMass;
  const isLosing = fatChange > 0;

  // Weekly change rate
  const weeklyChange = Math.abs(fatChange) / timelineWeeks;
  const weeklyChangePercent = (weeklyChange / weightKg) * 100;

  // Determine feasibility
  let status: 'success' | 'warning' | 'error';
  let message: string;

  if (targetBf < essentialBf) {
    status = 'error';
    message = `Target ${targetBf}% is below essential body fat (${essentialBf}%). This is not safe.`;
  } else if (currentBf <= targetBf && isLosing) {
    status = 'error';
    message = 'Target body fat must be lower than current body fat for fat loss.';
  } else if (!isLosing && targetBf > currentBf) {
    status = 'warning';
    message = 'This goal would require gaining body fat. Consider a muscle gain goal instead.';
  } else if (weeklyChangePercent > 1.0) {
    status = 'warning';
    message = `Timeline is aggressive (${weeklyChangePercent.toFixed(1)}% BW/week). Consider extending to ${Math.ceil(Math.abs(fatChange) / (weightKg * 0.01))} weeks.`;
  } else if (weeklyChangePercent > 0.75) {
    status = 'warning';
    message = `Moderate pace. You'll need strict adherence and high protein (2.3g+/kg).`;
  } else {
    status = 'success';
    message = `Achievable goal: ~${fatChange.toFixed(1)}kg fat loss over ${timelineWeeks} weeks (${weeklyChangePercent.toFixed(1)}% BW/week).`;
  }

  const statusColors = {
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    error: 'text-red-600 bg-red-50 border-red-200'
  };

  const StatusIcon = status === 'error' ? AlertCircle : status === 'warning' ? AlertCircle : CheckCircle;

  return (
    <div className={`p-3 rounded-lg border ${statusColors[status]} flex items-start gap-2`}>
      <StatusIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/**
 * Convert goal category to legacy goal for backward compatibility
 */
function goalCategoryToLegacyGoal(goalCategory: GoalCategory): string {
  switch (goalCategory) {
    case 'lean_bulk':
    case 'dirty_bulk':
      return 'muscle_gain';
    case 'mini_cut':
    case 'aggressive_cut':
    case 'body_fat_goal':
      return 'fat_loss';
    case 'recomp':
    case 'maintenance':
      return 'maintenance';
    default:
      return 'maintenance';
  }
}
