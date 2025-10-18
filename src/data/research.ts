export interface EvidenceSource {
  id: string;
  title: string;
  authors: string;
  publicationYear: number;
  publication: string;
  doi?: string;
  url?: string;
  keyPoints: string[];
}

export interface GuidelineRange {
  min?: number;
  max?: number;
  units: string;
  notes?: string;
  sourceIds: string[];
}

export interface GuidelineValue {
  value: number;
  units: string;
  notes?: string;
  sourceIds: string[];
}

export interface GuidelineMapping<T> {
  values: T;
  units: string;
  notes?: string;
  sourceIds: string[];
}

export const EVIDENCE_SOURCES: Record<string, EvidenceSource> = {
  helms2014: {
    id: 'helms2014',
    title: 'Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation',
    authors: 'Eric R. Helms, Alan A. Aragon, Peter J. Fitschen',
    publicationYear: 2014,
    publication: 'Journal of the International Society of Sports Nutrition',
    doi: '10.1186/1550-2783-11-20',
    keyPoints: [
      'Recommends fat-loss rate between 0.5–1.0% of bodyweight per week for natural bodybuilders.',
      'Suggests protein intakes of 2.3–3.1 g/kg of lean body mass during energy restriction.',
      'Supports the use of planned diet breaks or refeeds to mitigate metabolic adaptation.'
    ]
  },
  trexler2014: {
    id: 'trexler2014',
    title: 'Metabolic adaptation to weight loss: implications for the athlete',
    authors: 'Eric T. Trexler, Abbie E. Smith-Ryan, Layne E. Norton',
    publicationYear: 2014,
    publication: 'Journal of the International Society of Sports Nutrition',
    doi: '10.1186/s12970-014-0051-x',
    keyPoints: [
      'Highlights metabolic rate reductions of 10–15% during prolonged energy restriction.',
      'Supports the inclusion of refeeds or diet breaks every 6–8 weeks to help restore metabolic rate.',
      'Emphasizes monitoring performance and endocrine markers during aggressive dieting phases.'
    ]
  },
  peos2021: {
    id: 'peos2021',
    title: 'Practical Recommendations for Competition Preparation of Natural Bodybuilders',
    authors: 'Matthew Peos, Eric R. Helms, Jackson J. Peos, et al.',
    publicationYear: 2021,
    publication: 'Nutrients',
    doi: '10.3390/nu13093255',
    keyPoints: [
      'Identifies weekly fat-loss ceilings of ~0.7–0.9 kg for experienced competitors to preserve lean mass.',
      'Recommends prioritizing protein at ≥2.2 g/kg bodyweight with higher targets during peak phases.',
      'Supports diet break insertion every 6–8 weeks and refeeds at 105–115% of TDEE primarily via carbohydrates.'
    ]
  }
};

export const GUIDELINES = {
  fatLossRatePercentBW: {
    min: 0.005,
    max: 0.01,
    units: '%/week of bodyweight',
    notes: 'Conservative range to preserve lean mass during contest preparation.',
    sourceIds: ['helms2014', 'peos2021']
  } as GuidelineRange,
  fatLossMaxKg: {
    min: 0.45,
    max: 0.9,
    units: 'kg/week',
    notes: 'Upper ceiling for experienced competitors; adjust by body size.',
    sourceIds: ['helms2014', 'peos2021']
  } as GuidelineRange,
  caloricDeficitPercent: {
    min: 0.15,
    max: 0.25,
    units: '% below TDEE',
    notes: 'Base deficit range; short peak pushes can reach 30% when closely monitored.',
    sourceIds: ['helms2014', 'trexler2014']
  } as GuidelineRange,
  metabolicAdaptationReduction: {
    min: 0.1,
    max: 0.15,
    units: '% of TDEE over 8-12 weeks',
    notes: 'Typical metabolic rate reduction during prolonged hypocaloric phases.',
    sourceIds: ['trexler2014']
  } as GuidelineRange,
  dietBreakFrequencyWeeks: {
    min: 6,
    max: 8,
    units: 'weeks',
    notes: 'Schedule diet breaks to mitigate metabolic adaptation and psychological fatigue.',
    sourceIds: ['helms2014', 'trexler2014', 'peos2021']
  } as GuidelineRange,
  refeedMultiplier: {
    value: 1.1,
    units: '× TDEE',
    notes: 'Typical refeed target utilizing primarily carbohydrates and minimal fat.',
    sourceIds: ['helms2014', 'peos2021']
  } as GuidelineValue,
  proteinRangeCut: {
    min: 2.2,
    max: 2.8,
    units: 'g/kg bodyweight',
    notes: 'Higher range prioritised in advanced athletes approaching stage condition.',
    sourceIds: ['helms2014', 'peos2021']
  } as GuidelineRange,
  leanMassRetentionByExperience: {
    values: {
      novice: 0.96,
      intermediate: 0.98,
      advanced: 0.97
    },
    units: 'fraction of lean mass retained',
    notes: 'Assumes evidence-based nutrition and resistance training adherence.',
    sourceIds: ['peos2021']
  } as GuidelineMapping<{ novice: number; intermediate: number; advanced: number }>,
  cardioCeilingMinutes: {
    value: 300,
    units: 'minutes/week',
    notes: 'Upper bound of steady-state cardio used in contest prep before risk of muscle loss increases notably.',
    sourceIds: ['peos2021']
  } as GuidelineValue
};

export function resolveEvidence(ids: string[]): EvidenceSource[] {
  const unique = Array.from(new Set(ids));
  return unique
    .map((id) => EVIDENCE_SOURCES[id])
    .filter((source): source is EvidenceSource => !!source);
}

export function mergeEvidenceSets(...sets: Array<Iterable<string>>): string[] {
  const merged = new Set<string>();
  sets.forEach((collection) => {
    for (const id of collection) {
      merged.add(id);
    }
  });
  return Array.from(merged);
}
