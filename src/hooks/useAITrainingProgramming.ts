import { useState, useCallback } from 'react';
import { FormState, WeeklyCheckpoint, ProgressionPhase } from '@/types';

interface AITrainingProgram {
  week: number;
  phase: string;
  trainingDays: Array<{
    day: string;
    focus: string;
    duration: number;
    intensity: 'Low' | 'Moderate' | 'High' | 'Very High';
    volume: number;
    exercises: Array<{
      name: string;
      sets: number;
      reps: string;
      rir: number;
      rest: string;
      tempo: string;
      technique: string;
      progression: string;
      scientificRationale: string;
      references: string[];
    }>;
    cardio: {
      type: string;
      duration: number;
      intensity: string;
      heartRate: string;
      rationale: string;
    };
    recovery: {
      sleep: string;
      nutrition: string;
      mobility: string[];
      stressManagement: string;
    };
  }>;
  weeklyVolume: {
    totalSets: number;
    totalDuration: number;
    intensity: number;
    progression: string;
  };
  periodization: {
    phase: string;
    goals: string[];
    adaptations: string[];
    deloadSchedule: string;
  };
  scientificBasis: string[];
  confidence: number;
}

export function useAITrainingProgramming(form: FormState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [trainingProgram, setTrainingProgram] = useState<AITrainingProgram | null>(null);

  const generateAITrainingProgram = useCallback(async (checkpoint: WeeklyCheckpoint, phase: ProgressionPhase) => {
    setLoading(true);
    setError('');

    // Validate API key and endpoint
    if (!form.apiKey || !form.endpoint) {
      setError('API key and endpoint are required');
      setLoading(false);
      return;
    }

    try {
      const trainingPrompt = `You are a world-class strength and conditioning coach and exercise physiologist specializing in bodybuilding and contest preparation. Your task is to create a comprehensive, scientifically-backed training program.

CRITICAL REQUIREMENTS:
1. You must provide scientific references for ALL training recommendations
2. Your confidence level must be 90%+ for all programming decisions
3. Use only peer-reviewed research from reputable exercise science journals
4. Cite specific studies with authors, year, and key findings
5. Explain the physiological mechanisms behind each training decision
6. Consider contest prep protocols, fatigue management, and recovery optimization

USER PROFILE:
- Age: ${form.age} years
- Sex: ${form.sex}
- Weight: ${checkpoint.predictedWeight}kg
- Current Body Fat: ${checkpoint.predictedBodyFat}%
- Target Body Fat: ${form.targetBf || 12}%
- Training Experience: ${form.trainingAge}
- Equipment: ${form.equipment || 'Basic gym equipment'}
- Schedule: ${form.schedule || 'Not specified'}

CURRENT PHASE: ${phase.name} (${phase.type})
- Phase Description: ${phase.description}
- Target Deficit: ${phase.targetDeficit}%
- Volume Adjustment: ${phase.volumeAdjustment}
- Training Volume: ${checkpoint.trainingVolume} sets per week
- Cardio: ${checkpoint.cardioMinutes} minutes per week

SCIENTIFIC REQUIREMENTS:

1. PERIODIZATION PRINCIPLES:
- Reference Bompa & Haff (2009) for periodization theory
- Apply block periodization for contest prep (Issurin, 2010)
- Consider phase-specific adaptations and goals

2. VOLUME AND INTENSITY MANAGEMENT:
- Reference Schoenfeld et al. (2017) for volume recommendations
- Apply RPE-based autoregulation (Helms et al., 2018)
- Consider fatigue accumulation and recovery needs

3. EXERCISE SELECTION:
- Reference Contreras et al. (2017) for muscle activation patterns
- Optimize for muscle hypertrophy during caloric restriction
- Consider joint health and injury prevention

4. CONTEST PREP PROTOCOLS:
- Reference Helms et al. (2014) for contest prep training
- Plan for peak week tapering and deloading
- Consider psychological factors and motivation

5. RECOVERY OPTIMIZATION:
- Reference Halson (2014) for recovery strategies
- Plan sleep, nutrition, and stress management
- Consider overreaching and overtraining prevention

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{
  "week": ${checkpoint.week},
  "phase": "${phase.name}",
  "trainingDays": [
    {
      "day": "Monday",
      "focus": "Upper Body Hypertrophy",
      "duration": 75,
      "intensity": "High",
      "volume": 18,
      "exercises": [
        {
          "name": "Barbell Bench Press",
          "sets": 4,
          "reps": "6-8",
          "rir": 2,
          "rest": "3-4 minutes",
          "tempo": "3-1-1-0",
          "technique": "Full range of motion, controlled eccentric",
          "progression": "Add 2.5kg when all sets completed with RIR 2",
          "scientificRationale": "Compound movement for maximal chest and tricep activation",
          "references": [
            "Schoenfeld et al. (2017) - Volume and muscle hypertrophy",
            "Contreras et al. (2017) - Chest muscle activation"
          ]
        }
      ],
      "cardio": {
        "type": "Moderate Intensity Steady State",
        "duration": 30,
        "intensity": "65-75% HRmax",
        "heartRate": "130-150 bpm",
        "rationale": "Fat oxidation optimization during caloric restriction"
      },
      "recovery": {
        "sleep": "8-9 hours minimum",
        "nutrition": "Post-workout protein within 2 hours",
        "mobility": ["Hip flexor stretches", "Thoracic spine mobility"],
        "stressManagement": "Meditation or deep breathing"
      }
    }
  ],
  "weeklyVolume": {
    "totalSets": 72,
    "totalDuration": 450,
    "intensity": 8.5,
    "progression": "Linear progression with autoregulation"
  },
  "periodization": {
    "phase": "Hypertrophy Block",
    "goals": ["Muscle mass preservation", "Strength maintenance", "Fat loss optimization"],
    "adaptations": ["Muscle protein synthesis", "Metabolic efficiency", "Neuromuscular coordination"],
    "deloadSchedule": "Every 4th week or when RPE > 8.5"
  },
  "scientificBasis": [
    "Schoenfeld et al. (2017) - Volume and muscle hypertrophy",
    "Helms et al. (2018) - Autoregulation in resistance training"
  ],
  "confidence": 0.94
}

Generate a complete 7-day training program optimized for contest preparation with scientific backing for every recommendation.`;

      const request = {
        model: form.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a world-class strength and conditioning coach and exercise physiologist. Create scientifically-backed training programs with high confidence and proper citations.' 
          },
          { role: 'user', content: trainingPrompt },
        ],
        temperature: 0.3, // Lower temperature for more consistent, scientific responses
      };

      const res = await fetch(form.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${form.apiKey}`,
        },
        body: JSON.stringify(request),
      }).catch(fetchError => {
        console.error('Fetch error:', fetchError);
        throw new Error(`Network error: ${fetchError.message}`);
      });

      if (!res.ok) {
        const text = await res.text();
        console.error('API Error:', res.status, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content || '';
      
      console.log('AI Training Program received:', {
        status: res.status,
        contentLength: content.length,
        firstChars: content.substring(0, 200)
      });
      
      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/```json([\s\S]*?)```/i) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        console.log('Extracted JSON string:', jsonStr.substring(0, 500));
        
        const parsedProgram = JSON.parse(jsonStr) as AITrainingProgram;
        
        // Validate the program structure
        if (parsedProgram.week && parsedProgram.phase && parsedProgram.trainingDays && parsedProgram.weeklyVolume) {
          setTrainingProgram(parsedProgram);
          console.log('Successfully generated AI training program with confidence:', parsedProgram.confidence);
          setError(''); // Clear any previous errors
        } else {
          throw new Error('Invalid training program structure - missing required fields');
        }
      } catch (parseError) {
        console.error('Failed to parse AI training program:', parseError);
        console.log('Raw response:', content);
        
        setError('AI training programming failed. Please try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate training program');
      console.error('Training program generation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [form]);

  return {
    trainingProgram,
    loading,
    error,
    generateAITrainingProgram,
    clearError: () => setError('')
  };
}
