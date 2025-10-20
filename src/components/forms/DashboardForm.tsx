import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Badge } from '@/components/ui/Badge';
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { 
  Brain, 
  ChevronDown, 
  Info, 
  Settings, 
  Target, 
  User, 
  Zap 
} from 'lucide-react';

interface DashboardFormProps {
  form: any;
  onChange: (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSelectChange: (field: string) => (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string;
}

const WORKOUT_LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner (0-1 year)', description: 'New to structured training' },
  { value: 'intermediate', label: 'Intermediate (1-4 years)', description: 'Some experience with programming' },
  { value: 'expert', label: 'Expert (4+ years)', description: 'Advanced training knowledge' },
];

const WORKOUT_SPLIT_OPTIONS = [
  { value: 'full_body', label: 'Full Body', description: '3 days/week' },
  { value: 'upper_lower', label: 'Upper/Lower', description: '4 days/week' },
  { value: 'push_pull_legs', label: 'Push/Pull/Legs', description: '5-6 days/week' },
  { value: 'bro_split', label: 'Body Part Split', description: '5 days/week' },
  { value: 'phul', label: 'PHUL', description: 'Power Hypertrophy Upper Lower' },
];

const GOAL_OPTIONS = [
  { value: 'fat_loss', label: 'Fat Loss', description: 'Reduce body fat percentage' },
  { value: 'muscle_gain', label: 'Muscle Gain', description: 'Build lean muscle mass' },
  { value: 'body_recomposition', label: 'Body Recomposition', description: 'Lose fat while gaining muscle' },
  { value: 'maintenance', label: 'Maintenance', description: 'Maintain current physique' },
  { value: 'athletic_performance', label: 'Athletic Performance', description: 'Improve sports performance' },
];

export function DashboardForm({ form, onChange, onSelectChange, onSubmit, loading, error }: DashboardFormProps) {
  const [activeSection, setActiveSection] = useState('profile');

  const sections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'preferences', label: 'Preferences', icon: Settings },
    { id: 'api', label: 'API Config', icon: Brain },
  ];

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <Card className="p-4">
        <div className="flex gap-2 overflow-x-auto">
          {sections.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveSection(section.id)}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile Section */}
      {activeSection === 'profile' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={form.age}
                onChange={onChange('age')}
                placeholder="e.g., 25"
              />
            </div>
            
            <div>
              <Label htmlFor="sex">Sex</Label>
              <Select value={form.sex} onValueChange={onSelectChange('sex')}>
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
              <Label htmlFor="heightCm">Height (cm)</Label>
              <Input
                id="heightCm"
                type="number"
                value={form.heightCm}
                onChange={onChange('heightCm')}
                placeholder="e.g., 175"
              />
            </div>
            
            <div>
              <Label htmlFor="weightKg">Weight (kg)</Label>
              <Input
                id="weightKg"
                type="number"
                value={form.weightKg}
                onChange={onChange('weightKg')}
                placeholder="e.g., 70"
              />
            </div>
            
            <div>
              <Label htmlFor="bodyFat">Body Fat % (optional)</Label>
              <Input
                id="bodyFat"
                type="number"
                value={form.bodyFat}
                onChange={onChange('bodyFat')}
                placeholder="e.g., 15"
              />
            </div>
            
            <div>
              <Label htmlFor="trainingDaysPerWeek">Training Days/Week</Label>
              <Input
                id="trainingDaysPerWeek"
                type="number"
                min={1}
                max={7}
                value={form.trainingDaysPerWeek}
                onChange={onChange('trainingDaysPerWeek')}
                placeholder="e.g., 4"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Goals Section */}
      {activeSection === 'goals' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Fitness Goals
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="goal">Primary Goal</Label>
              <Select value={form.goal} onValueChange={onSelectChange('goal')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your primary goal" />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="targetBf">Target Body Fat %</Label>
                <Input
                  id="targetBf"
                  type="number"
                  value={form.targetBf}
                  onChange={onChange('targetBf')}
                  placeholder="e.g., 12"
                />
              </div>
              
              <div>
                <Label htmlFor="timelineWeeks">Timeline (weeks)</Label>
                <Input
                  id="timelineWeeks"
                  type="number"
                  value={form.timelineWeeks}
                  onChange={onChange('timelineWeeks')}
                  placeholder="e.g., 16"
                />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Preferences Section */}
      {activeSection === 'preferences' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Training Preferences
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="workoutLevel">Experience Level</Label>
              <Select value={form.workoutLevel} onValueChange={onSelectChange('workoutLevel')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your experience level" />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="workoutSplit">Preferred Split</Label>
              <Select value={form.workoutSplit} onValueChange={onSelectChange('workoutSplit')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your preferred split" />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_SPLIT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="equipment">Available Equipment</Label>
              <TextArea
                id="equipment"
                value={form.equipment}
                onChange={onChange('equipment')}
                placeholder="e.g., barbell, dumbbells, gym access, bodyweight"
                rows={2}
              />
            </div>
            
            <div>
              <Label htmlFor="avoid">Foods to Avoid</Label>
              <TextArea
                id="avoid"
                value={form.avoid}
                onChange={onChange('avoid')}
                placeholder="e.g., dairy, gluten, nuts"
                rows={2}
              />
            </div>
          </div>
        </Card>
      )}

      {/* API Configuration Section */}
      {activeSection === 'api' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Configuration
          </h3>
          
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Configure your AI provider to generate personalized fitness plans. 
                We support OpenAI, Groq, and other OpenAI-compatible endpoints.
              </AlertDescription>
            </Alert>
            
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={form.apiKey}
                onChange={onChange('apiKey')}
                placeholder="Enter your API key"
              />
            </div>
            
            <div>
              <Label htmlFor="endpoint">Endpoint</Label>
              <Input
                id="endpoint"
                value={form.endpoint}
                onChange={onChange('endpoint')}
                placeholder="https://api.groq.com/openai/v1/chat/completions"
              />
            </div>
            
            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={form.model}
                onChange={onChange('model')}
                placeholder="llama-3.3-70b-versatile"
              />
            </div>
            
            {form.endpoint.includes('groq.com') && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  <strong>Groq Rate Limiting:</strong> Requests are limited to 30 per minute. 
                  The system will automatically queue and delay requests to stay within limits.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      )}

      {/* Generate Button */}
      <Card className="p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Generate Your AI Fitness Plan</h3>
          <p className="text-muted-foreground mb-4">
            Create a personalized fitness plan based on scientific evidence and research
          </p>
          
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            <Badge variant="outline">90%+ Confidence</Badge>
            <Badge variant="outline">Research-Based</Badge>
            <Badge variant="outline">Zero Hallucinations</Badge>
            <Badge variant="outline">Real-Time Generation</Badge>
          </div>
          
          <Button 
            onClick={onSubmit} 
            disabled={loading || !form.apiKey?.trim()}
            size="lg"
            className="w-full"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating Plan...
              </div>
            ) : !form.apiKey?.trim() ? (
              'API Key Required'
            ) : (
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Generate AI Fitness Plan
              </div>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
