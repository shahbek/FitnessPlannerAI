import React from 'react';
import { FormState } from '@/types';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';

interface ScheduleDietFormProps {
  form: FormState;
  onChange: (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function ScheduleDietForm({ form, onChange }: ScheduleDietFormProps) {
  return (
    <Card>
      <h3 className="font-semibold mb-2">Schedule & Diet</h3>
      <Label>Schedule (free text)</Label>
      <TextArea
        value={form.schedule}
        onChange={onChange('schedule')}
        placeholder="e.g., Mon–Fri 45m AM; Tue/Thu 30m PM; weekends off"
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div>
          <Label>Likes</Label>
          <Input value={form.preferences} onChange={onChange('preferences')} />
        </div>
        <div>
          <Label>Avoid</Label>
          <Input value={form.avoid} onChange={onChange('avoid')} />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="repOK"
          type="checkbox"
          checked={form.repetitionOk}
          onChange={(e) => onChange('repetitionOk')(e as any)}
        />
        <Label htmlFor="repOK">Repetition OK (repeat meals)</Label>
      </div>
      <div className="mt-2">
        <Label>Equipment</Label>
        <Input value={form.equipment} onChange={onChange('equipment')} />
      </div>
    </Card>
  );
}
