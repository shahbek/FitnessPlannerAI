import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/TextArea';
import { Progress } from '@/components/ui/Progress';
import { DEFAULT_FORM_STATE } from '@/constants';
import { 
  ChevronLeft, 
  ChevronRight, 
  User, 
  Target, 
  Dumbbell, 
  Heart,
  CheckCircle
} from 'lucide-react';

interface FormData {
  // Base fields from DEFAULT_FORM_STATE
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  bodyFat?: number;
  targetBf?: number;
  
  // Goals and Timeline
  primaryGoal: string;
  timelineWeeks: number;
  trainingDaysPerWeek: number;
  workoutLevel: string;
  
  // Training Preferences
  workoutSplit: string;
  equipment: string;
  schedule: string;
  
  // Nutrition
  preferences: string;
}

interface CompleteFormData extends FormData {
  apiKey: string;
  endpoint: string;
  model: string;
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
  bodyFat: DEFAULT_FORM_STATE.bodyFat,
  targetBf: DEFAULT_FORM_STATE.targetBf,
  primaryGoal: DEFAULT_FORM_STATE.primaryGoal,
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
      model: DEFAULT_FORM_STATE.model
    };
    onComplete(completeFormData);
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.age > 0 && formData.sex && formData.heightCm > 0 && formData.weightKg > 0;
      case 2:
        return formData.primaryGoal && formData.timelineWeeks > 0 && formData.trainingDaysPerWeek > 0 && formData.workoutLevel;
      case 3:
        return formData.workoutSplit && formData.equipment && formData.schedule.trim() !== '';
      case 4:
        return true; // Nutrition preferences are optional
      default:
        return false;
    }
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
                    <SelectItem value="other">Other</SelectItem>
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
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="primaryGoal">Primary Goal *</Label>
                <Select value={formData.primaryGoal} onValueChange={(value) => updateFormData('primaryGoal', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fat_loss">Fat Loss</SelectItem>
                    <SelectItem value="muscle_gain">Muscle Gain</SelectItem>
                    <SelectItem value="body_recomposition">Body Recomposition</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="athletic_performance">Athletic Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="timelineWeeks">Timeline (weeks) *</Label>
                <Input
                  id="timelineWeeks"
                  type="number"
                  value={formData.timelineWeeks}
                  onChange={(e) => updateFormData('timelineWeeks', parseInt(e.target.value) || 0)}
                  placeholder="16"
                  className="font-mono"
                />
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
              
              <div>
                <Label htmlFor="workoutLevel">Experience Level *</Label>
                <Select value={formData.workoutLevel} onValueChange={(value) => updateFormData('workoutLevel', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner (0-1 year)</SelectItem>
                    <SelectItem value="intermediate">Intermediate (1-4 years)</SelectItem>
                    <SelectItem value="expert">Expert (4+ years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Body Composition Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bodyFat">Current Body Fat %</Label>
                <Input
                  id="bodyFat"
                  type="number"
                  min={5}
                  max={50}
                  value={formData.bodyFat || ''}
                  onChange={(e) => updateFormData('bodyFat', parseInt(e.target.value) || undefined)}
                  placeholder="20"
                  className="font-mono"
                />
              </div>
              
              <div>
                <Label htmlFor="targetBf">Target Body Fat %</Label>
                <Input
                  id="targetBf"
                  type="number"
                  min={5}
                  max={30}
                  value={formData.targetBf || ''}
                  onChange={(e) => updateFormData('targetBf', parseInt(e.target.value) || undefined)}
                  placeholder="15"
                  className="font-mono"
                />
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
          </div>
        );


      default:
        return null;
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold font-sans">Create New Workout Program</h2>
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
            {steps.map((step, index) => {
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
