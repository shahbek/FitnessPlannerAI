import React from 'react';
import { FormState } from '@/types';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';

interface UserProfileFormProps {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UserProfileForm({ form, onChange }: UserProfileFormProps) {
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
          <Label>Activity Factor</Label>
          <Input type="number" step={0.05} value={form.activity as any} onChange={onChange('activity')} />
        </div>
        <div>
          <Label>Training Age</Label>
          <Input value={form.trainingAge} onChange={onChange('trainingAge')} />
        </div>
        <div>
          <Label>Goal</Label>
          <Input value={form.goal} onChange={onChange('goal')} />
        </div>
        <div>
          <Label>Target BF % (optional)</Label>
          <Input type="number" value={form.targetBf as any} onChange={onChange('targetBf')} />
        </div>
      </div>
    </Card>
  );
}
