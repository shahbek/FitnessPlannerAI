import { useState, useCallback } from 'react';
import { FormState } from '@/types';

interface PhysiologicalAnalysis {
  bmr: number;
  tdee: number;
  metabolicAdaptation: {
    week: number;
    tdeeReduction: number;
    leptinLevel: number;
    cortisolLevel: number;
    sleepQuality: number;
    hungerLevel: number;
    energyLevel: number;
  };
  timeline: {
    totalWeeks: number;
    phases: Array<{
      name: string;
      startWeek: number;
      endWeek: number;
      targetDeficit: number;
      proteinMultiplier: number;
      volumeAdjustment: number;
      description: string;
      rationale: string;
      scientificBasis: string[];
    }>;
  };
  weeklyProjections: Array<{
    week: number;
    predictedWeight: number;
    predictedBodyFat: number;
    predictedLeanMass: number;
    dailyCalories: number;
    proteinGrams: number;
    fatGrams: number;
    carbGrams: number;
    trainingVolume: number;
    cardioMinutes: number;
    phase: string;
    confidence: number;
    scientificReferences: string[];
  }>;
  confidence: number;
  scientificReferences: string[];
}

export function useAIPhysiologyModeling(form: FormState) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [analysis, setAnalysis] = useState<PhysiologicalAnalysis | null>(null);

  const generatePhysiologicalAnalysis = useCallback(async () => {
    setLoading(true);
    setError('');

    // Validate API key and endpoint
    if (!form.apiKey || !form.endpoint) {
      setError('API key and endpoint are required');
      setLoading(false);
      return;
    }

    try {
      const physiologyPrompt = `You are a world-class exercise physiologist and bodybuilding expert with access to the latest scientific research. Your task is to create a comprehensive physiological analysis and multi-week progression plan for contest preparation.

CRITICAL REQUIREMENTS:
1. You must provide scientific references for ALL calculations and recommendations
2. Your confidence level must be 90%+ for all physiological predictions
3. Use only peer-reviewed research from reputable journals
4. Cite specific studies with authors, year, and key findings
5. Explain the physiological mechanisms behind each recommendation

USER PROFILE:
- Age: ${form.age} years
- Sex: ${form.sex}
- Weight: ${form.weightKg}kg
- Height: ${form.heightCm}cm
- Current Body Fat: ${form.bodyFat}%
- Target Body Fat: ${form.targetBf || 12}%
- Training Experience: ${form.trainingAge}
- Activity Level: ${form.activity}
- Goal: ${form.goal}

SCIENTIFIC CALCULATIONS REQUIRED:

1. BASAL METABOLIC RATE (BMR):
- Use Katch-McArdle equation (most accurate with body fat %)
- BMR = 370 + (21.6 × LBM in kg)
- Provide confidence level and cite Katch & McArdle (1996)

2. TOTAL DAILY ENERGY EXPENDITURE (TDEE):
- Apply appropriate activity factor based on training experience
- Consider non-exercise activity thermogenesis (NEAT)
- Cite Levine (2005) for NEAT calculations

3. METABOLIC ADAPTATION MODELING:
- Model adaptive thermogenesis over time
- Reference Rosenbaum & Leibel (2010) for metabolic adaptation
- Include leptin suppression, cortisol elevation, sleep disruption
- Provide week-by-week adaptation predictions

4. PROGRESSION TIMELINE:
- Calculate realistic timeline from ${form.bodyFat}% to ${form.targetBf || 12}% body fat
- Use industry-standard rates: 0.5-1.5% body weight per week
- Include diet breaks every 6-8 weeks (reference Helms et al., 2014)
- Plan refeed days based on leptin restoration (reference Dirlewanger et al., 2000)

5. PHASE STRUCTURE:
- Design 4-5 distinct phases with specific physiological goals
- Each phase must have scientific rationale
- Include contest prep protocols for final weeks
- Reference contest prep literature (Morton et al., 2019)

6. MACRO PERIODIZATION:
- Calculate protein requirements (2.2-3.0g/kg based on phase)
- Reference Phillips & Van Loon (2011) for protein recommendations
- Plan fat intake for hormone production (0.3-0.5g/lb)
- Reference Helms et al. (2014) for contest prep nutrition

7. TRAINING ADJUSTMENTS:
- Adjust volume based on caloric deficit
- Reference Helms et al. (2018) for training during caloric restriction
- Include deload weeks to prevent overreaching
- Plan cardio progression for fat loss

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{
  "bmr": 1650,
  "tdee": 2200,
  "metabolicAdaptation": {
    "week": 8,
    "tdeeReduction": 12.5,
    "leptinLevel": 0.65,
    "cortisolLevel": 1.25,
    "sleepQuality": 7.2,
    "hungerLevel": 6.8,
    "energyLevel": 7.5
  },
  "timeline": {
    "totalWeeks": 20,
    "phases": [
      {
        "name": "Aggressive Cut Phase 1",
        "startWeek": 0,
        "endWeek": 7,
        "targetDeficit": 30,
        "proteinMultiplier": 2.5,
        "volumeAdjustment": 0.9,
        "description": "High-intensity cutting phase with aggressive caloric deficit",
        "rationale": "Maximum fat loss while preserving lean mass during initial weeks",
        "scientificBasis": [
          "Helms et al. (2014) - Contest prep nutrition guidelines",
          "Morton et al. (2019) - Bodybuilding competition preparation"
        ]
      }
    ]
  },
  "weeklyProjections": [
    {
      "week": 1,
      "predictedWeight": 79.5,
      "predictedBodyFat": 22.0,
      "predictedLeanMass": 62.0,
      "dailyCalories": 1600,
      "proteinGrams": 200,
      "fatGrams": 50,
      "carbGrams": 100,
      "trainingVolume": 18,
      "cardioMinutes": 200,
      "phase": "Aggressive Cut Phase 1",
      "confidence": 0.95,
      "scientificReferences": [
        "Katch & McArdle (1996) - BMR calculation",
        "Helms et al. (2014) - Contest prep protocols"
      ]
    }
  ],
  "confidence": 0.92,
  "scientificReferences": [
    "Katch, F.I., & McArdle, W.D. (1996). Introduction to nutrition, exercise, and health. Lea & Febiger.",
    "Helms, E.R., et al. (2014). Evidence-based recommendations for natural bodybuilding contest preparation. Journal of the International Society of Sports Nutrition.",
    "Morton, R.W., et al. (2019). A systematic review and meta-analysis of the effect of resistance training on muscle mass. Sports Medicine."
  ]
}

Generate a complete 20-30 week progression plan with scientific backing for every recommendation.`;

      const request = {
        model: form.model,
        messages: [
          { 
            role: 'system', 
            content: 'You are a world-class exercise physiologist and bodybuilding expert. Provide scientifically-backed physiological analysis with high confidence and proper citations.' 
          },
          { role: 'user', content: physiologyPrompt },
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
      
      console.log('AI Physiological Analysis received:', {
        status: res.status,
        contentLength: content.length,
        firstChars: content.substring(0, 200)
      });
      
      try {
        // Try to parse JSON from the response
        const jsonMatch = content.match(/```json([\s\S]*?)```/i) || content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
        console.log('Extracted JSON string:', jsonStr.substring(0, 500));
        
        const parsedAnalysis = JSON.parse(jsonStr) as PhysiologicalAnalysis;
        
        // Validate the analysis structure
        if (parsedAnalysis.bmr && parsedAnalysis.tdee && parsedAnalysis.timeline && parsedAnalysis.weeklyProjections) {
          setAnalysis(parsedAnalysis);
          console.log('Successfully generated physiological analysis with confidence:', parsedAnalysis.confidence);
          setError(''); // Clear any previous errors
        } else {
          throw new Error('Invalid analysis structure - missing required fields');
        }
      } catch (parseError) {
        console.error('Failed to parse AI physiological analysis:', parseError);
        console.log('Raw response:', content);
        
        setError('AI physiological analysis failed. Please try again.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to generate physiological analysis');
      console.error('Physiological analysis generation failed:', e);
    } finally {
      setLoading(false);
    }
  }, [form]);

  return {
    analysis,
    loading,
    error,
    generatePhysiologicalAnalysis,
    clearError: () => setError('')
  };
}
