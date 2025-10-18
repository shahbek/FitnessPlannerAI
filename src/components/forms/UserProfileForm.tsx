import React from 'react';
import { FormState } from '@/types';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select';

interface UserProfileFormProps {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectChange: (key: keyof FormState) => (value: string) => void;
}

const WORKOUT_LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner (0-1 year)' },
  { value: 'intermediate', label: 'Intermediate (1-4 years)' },
  { value: 'expert', label: 'Expert (4+ years)' },
];

const WORKOUT_SPLIT_OPTIONS = [
  { value: 'full_body', label: 'Full Body (3 days)' },
  { value: 'upper_lower', label: 'Upper / Lower (4 days)' },
  { value: 'push_pull_legs', label: 'Push / Pull / Legs (5-6 days)' },
  { value: 'bro_split', label: 'Body Part Split (5 days)' },
  { value: 'phul', label: 'PHUL (Power Hypertrophy Upper Lower)' },
  { value: 'upper_lower_full', label: 'Upper / Lower / Full Body Hybrid' },
];

export function UserProfileForm({ form, onChange, onSelectChange }: UserProfileFormProps) {
  return (
    <Card>
      <h3 className="font-semibold mb-2">User</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Age</Label>
          <Input type="number" value={form.age as any} onChange={onChange('age')} />
        </div>
        <div>
          <Label>Sex</Label>
          <Input value={form.sex} onChange={onChange('sex')} />
        </div>
        <div>
          <Label>Height (cm)</Label>
          <Input type="number" value={form.heightCm as any} onChange={onChange('heightCm')} />
        </div>
        <div>
          <Label>Weight (kg)</Label>
          <Input type="number" value={form.weightKg as any} onChange={onChange('weightKg')} />
        </div>
        <div>
          <Label>Body Fat %</Label>
          <Input type="number" value={form.bodyFat as any} onChange={onChange('bodyFat')} />
        </div>
        <div>
          <Label>Training Days / Week</Label>
          <Input
            type="number"
            min={1}
            max={7}
            value={form.trainingDaysPerWeek as any}
            onChange={onChange('trainingDaysPerWeek')}
            placeholder="e.g., 4"
          />
        </div>
        <div>
          <Label>Workout Level</Label>
          <Select value={form.workoutLevel as string} onValueChange={onSelectChange('workoutLevel')}>
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_LEVEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Workout Split</Label>
          <Select value={form.workoutSplit} onValueChange={onSelectChange('workoutSplit')}>
            <SelectTrigger>
              <SelectValue placeholder="Select split" />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_SPLIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Goal</Label>
          <Input value={form.goal} onChange={onChange('goal')} />
        </div>
        <div>
          <Label>Target BF % (optional)</Label>
          <Input type="number" value={form.targetBf as any} onChange={onChange('targetBf')} />
        </div>
        <div>
          <Label>Timeline (weeks)</Label>
          <Input
            type="number"
            value={form.timelineWeeks as any}
            onChange={onChange('timelineWeeks')}
            placeholder="e.g., 16"
          />
        </div>
      </div>
    </Card>
  );
}
