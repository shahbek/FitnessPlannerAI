import { FormState, FitnessPlan } from '@/types';

// Build user prompt from form state
export function buildUserPrompt(form: FormState): string {
  const sched = form.schedule?.trim() || '';
  const prefs = form.preferences?.trim() || '';
  const avoid = form.avoid?.trim() || '';
  const equipment = form.equipment?.trim() || '';

  return `USER_PROFILE
- age: ${form.age}
- sex: ${form.sex}
- height_cm: ${form.heightCm}
- weight_kg: ${form.weightKg}
- body_fat_pct: ${form.bodyFat || 'unknown'}
- training_days_per_week: ${form.trainingDaysPerWeek}
- workout_level: ${form.workoutLevel}
- workout_split: ${form.workoutSplit}
- goal: ${form.goal}
- target_body_fat_pct: ${form.targetBf || 'n/a'}

SCHEDULE
${sched || 'No constraints provided'}

DIET
- likes: ${prefs || ''}
- avoid: ${avoid || ''}
- repetition_ok: ${form.repetitionOk ? 'true' : 'false'}

EQUIPMENT
${equipment || 'Bodyweight'}

REQUEST
Generate a one-week plan that fits the schedule and goal. If the goal is unsafe, refuse and propose a safe timeline. Keep sessions strictly within the provided minutes per day. Prefer repetitive meals using the liked foods and excluding avoids.`;
}

// Format plan data for display
export function formatPretty(json: FitnessPlan | null, human: string): string {
  if (!json) return human || '';

  try {
    const dayLines = (json.week_plan || [])
      .map((d) => {
        const blocks = (d.blocks || [])
          .map((b) => `- ${b.name}: ${b.sets} x ${b.reps_or_time}${b.rir_or_rpe ? ` (${b.rir_or_rpe})` : ''}`)
          .join('\n  ');
        return `• ${d.day} — ${d.session_minutes}m ${d.focus}\n  ${blocks}`;
      })
      .join('\n\n');

    const mealLines = (json.meals || [])
      .map((m) => {
        const items = (m.items || []).map((i) => `- ${i.food}: ${i.grams} g`).join('\n  ');
        return `• ${m.name} ~ ${m.kcal} kcal\n  ${items}`;
      })
      .join('\n\n');

    const cal = json.calories
      ? `Calories & Macros
- daily_kcal: ${json.calories.daily_kcal}
- protein_g: ${json.calories.protein_g}
- fat_g: ${json.calories.fat_g}
- carb_g: ${json.calories.carb_g}`
      : '';

    const adj = json.adjustments
      ? `\n\nAdjustments
- missed_workout: ${json.adjustments.missed_workout}
- diet_deviation: ${json.adjustments.diet_deviation}
- low_sleep: ${json.adjustments.low_sleep}`
      : '';

    const feas = json.feasibility
      ? `Feasibility: ${json.feasibility.status}${
          json.feasibility.proposed_timeline_weeks ? ` (timeline ~${json.feasibility.proposed_timeline_weeks} weeks)` : ''
        }${json.feasibility.reason ? ` — ${json.feasibility.reason}` : ''}`
      : '';

    return [feas, cal, '\n\nWeek Plan\n' + dayLines, '\n\nMeals\n' + mealLines, adj, '\n\nSummary\n' + (json.rationale || '') + (human ? `\n\n${human}` : '')]
      .filter(Boolean)
      .join('\n\n');
  } catch {
    return human || '';
  }
}

// Parse JSON from AI response
export function parseAIResponse(content: string): { json: FitnessPlan | null; human: string } {
  const match = content.match(/```json([\s\S]*?)```/i) || content.match(/\{[\s\S]*\}/);
  
  if (match) {
    try {
      const jsonStr = Array.isArray(match) ? (match[1] ? match[1] : match[0]) : String(match);
      const parsedObj = JSON.parse(jsonStr) as FitnessPlan;
      const human = content.replace(String(match[0]), '').trim();
      return { json: parsedObj, human };
    } catch {
      return { json: null, human: content };
    }
  }
  
  return { json: null, human: content };
}

// Copy text to clipboard
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    throw new Error('Failed to copy to clipboard');
  }
}

// Validate form data
export function validateForm(form: FormState): string[] {
  const errors: string[] = [];
  
  if (!form.apiKey.trim()) {
    errors.push('API key is required');
  }
  
  if (!form.endpoint.trim()) {
    errors.push('Endpoint is required');
  }
  
  if (!form.model.trim()) {
    errors.push('Model is required');
  }
  
  if (!form.age || Number(form.age) < 1 || Number(form.age) > 120) {
    errors.push('Age must be between 1 and 120');
  }
  
  if (!form.heightCm || Number(form.heightCm) < 50 || Number(form.heightCm) > 300) {
    errors.push('Height must be between 50 and 300 cm');
  }
  
  if (!form.weightKg || Number(form.weightKg) < 20 || Number(form.weightKg) > 500) {
    errors.push('Weight must be between 20 and 500 kg');
  }
  
  if (form.bodyFat && (Number(form.bodyFat) < 1 || Number(form.bodyFat) > 50)) {
    errors.push('Body fat percentage must be between 1 and 50');
  }

  const trainingDays = Number(form.trainingDaysPerWeek);
  if (!trainingDays || trainingDays < 1 || trainingDays > 7) {
    errors.push('Training days per week must be between 1 and 7');
  }

  if (!form.workoutLevel) {
    errors.push('Workout level is required');
  }

  if (!form.workoutSplit) {
    errors.push('Workout split is required');
  }
  
  if (!form.goal.trim()) {
    errors.push('Goal is required');
  }
  
  return errors;
}
