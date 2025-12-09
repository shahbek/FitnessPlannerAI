import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  bodyFat?: number; // Optional: current body fat for BMR calculation (non-body_fat_goal modes)

  // New goal category system
  goalCategory: GoalCategory;
  bodyFatGoal?: BodyFatGoal; // Only used when goalCategory === 'body_fat_goal'

  // Timeline
  timelineWeeks: number;
  trainingDaysPerWeek: number;
  workoutLevel: string;

  // Training Preferences
  workoutSplit: string;
  equipment: string;
  schedule: string;

  // Nutrition
  preferences: string;
  mealFrequency?: number;
}

interface CompleteFormData extends FormData {
  apiKey: string;
  endpoint: string;
  model: string;
  // Legacy fields for backward compatibility
  primaryGoal?: string;
  targetBf?: number;
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
  preferences: DEFAULT_FORM_STATE.preferences
};

export function MultistepProfileForm({ onComplete, onCancel }: MultistepProfileFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(defaultFormData);

  const updateFormData = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
    // Merge form data with API configuration from DEFAULT_FORM_STATE
    const completeFormData: CompleteFormData = {
      ...formData,
      apiKey: DEFAULT_FORM_STATE.apiKey,
      endpoint: 'groq', // Use simplified endpoint identifier
      model: DEFAULT_FORM_STATE.model,
      // Add legacy fields for backward compatibility
      primaryGoal: goalCategoryToLegacyGoal(formData.goalCategory),
      targetBf: formData.bodyFatGoal?.targetBf
    };
    onComplete(completeFormData);
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return !!(formData.age > 0 && formData.sex && formData.heightCm > 0 && formData.weightKg > 0);
      case 2: {
        const baseValid = !!(
          formData.goalCategory && 
          formData.timelineWeeks > 0 && 
          formData.timelineWeeks <= 24 && 
          formData.trainingDaysPerWeek > 0 && 
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
                  onChange={(e) => updateFormData('age', parseInt(e.target.value) || 0)}
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
                  onChange={(e) => updateFormData('heightCm', parseInt(e.target.value) || 0)}
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
                  onChange={(e) => updateFormData('weightKg', parseInt(e.target.value) || 0)}
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
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select your goal" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
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
                    const value = parseInt(e.target.value) || 0;
                    const clampedValue = Math.min(Math.max(value, 1), 24);
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
                  onChange={(e) => updateFormData('trainingDaysPerWeek', parseInt(e.target.value) || 0)}
                  placeholder="4"
                  className="font-mono"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="workoutLevel">Experience Level *</Label>
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
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="preferences">Food Preferences & Dietary Restrictions</Label>
              <Textarea
                id="preferences"
                value={formData.preferences}
                onChange={(e) => updateFormData('preferences', e.target.value)}
                placeholder="List your food preferences, dietary restrictions, allergies, or foods you enjoy/dislike, e.g., 'Vegetarian, allergic to nuts, love Mediterranean food, dislike spicy food'"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="mealFrequency">Preferred Meal Frequency</Label>
              <Select
                value={formData.mealFrequency?.toString()}
                onValueChange={(value) => updateFormData('mealFrequency', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meal frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meals per day</SelectItem>
                  <SelectItem value="4">4 meals per day</SelectItem>
                  <SelectItem value="5">5 meals per day</SelectItem>
                  <SelectItem value="6">6 meals per day</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Goal Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Goal Summary</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><span className="font-medium">Goal:</span> {getGoalCategoryOption(formData.goalCategory)?.label}</p>
                <p><span className="font-medium">Timeline:</span> {formData.timelineWeeks} weeks</p>
                <p><span className="font-medium">Training:</span> {formData.trainingDaysPerWeek} days/week</p>
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
