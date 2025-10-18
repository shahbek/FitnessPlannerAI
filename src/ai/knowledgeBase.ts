// Knowledge Base for Research Papers
// Parses research papers once and creates a searchable knowledge base

export interface ResearchFact {
  id: string;
  content: string;
  category: 'nutrition' | 'training' | 'physiology' | 'metabolism' | 'body_composition';
  confidence: number;
  source: string;
  authors: string[];
  year: number;
  studyType: 'meta_analysis' | 'rct' | 'cohort' | 'review' | 'consensus';
  formulas: string[];
  dataPoints: Array<{
    description: string;
    value: number;
    units: string;
    context: string;
  }>;
}

export interface KnowledgeBase {
  facts: ResearchFact[];
  categories: {
    [key: string]: ResearchFact[];
  };
  isInitialized: boolean;
}

class ResearchKnowledgeBase {
  private knowledgeBase: KnowledgeBase = {
    facts: [],
    categories: {},
    isInitialized: false
  };

  async initialize(): Promise<void> {
    if (this.knowledgeBase.isInitialized) return;

    console.log('Initializing Research Knowledge Base...');
    
    // Parse the research papers and extract structured facts
    this.knowledgeBase.facts = this.parseResearchPapers();
    
    // Organize by categories
    this.knowledgeBase.categories = this.categorizeFacts(this.knowledgeBase.facts);
    
    this.knowledgeBase.isInitialized = true;
    console.log(`Knowledge base initialized with ${this.knowledgeBase.facts.length} facts`);
  }

  private parseResearchPapers(): ResearchFact[] {
    // This is where we would parse the actual PDF files
    // For now, we'll create structured facts based on the research papers
    return [
      // Helms et al., 2014 - Contest preparation
      {
        id: 'helms_protein_cut',
        content: 'Protein intakes of 2.3-3.1 g/kg of lean body mass during energy restriction for natural bodybuilders',
        category: 'nutrition',
        confidence: 0.94,
        source: 'Evidence-based recommendations for natural bodybuilding contest preparation nutrition and supplementation',
        authors: ['Eric R. Helms', 'Alan A. Aragon', 'Peter J. Fitschen'],
        year: 2014,
        studyType: 'meta_analysis',
        formulas: ['Protein = 2.3-3.1 × LBM_kg'],
        dataPoints: [
          { description: 'Protein per kg LBM during cut', value: 2.7, units: 'g/kg', context: 'contest_prep' },
          { description: 'Minimum protein during cut', value: 2.3, units: 'g/kg', context: 'contest_prep' },
          { description: 'Maximum protein during cut', value: 3.1, units: 'g/kg', context: 'contest_prep' }
        ]
      },
      {
        id: 'helms_fat_loss_rate',
        content: 'Fat-loss rate between 0.5–1.0% of bodyweight per week for natural bodybuilders',
        category: 'physiology',
        confidence: 0.92,
        source: 'Evidence-based recommendations for natural bodybuilding contest preparation nutrition and supplementation',
        authors: ['Eric R. Helms', 'Alan A. Aragon', 'Peter J. Fitschen'],
        year: 2014,
        studyType: 'meta_analysis',
        formulas: ['FatLossRate = 0.5-1.0% × bodyweight per week'],
        dataPoints: [
          { description: 'Minimum safe fat loss rate', value: 0.5, units: '%/week', context: 'contest_prep' },
          { description: 'Maximum safe fat loss rate', value: 1.0, units: '%/week', context: 'contest_prep' }
        ]
      },
      {
        id: 'helms_calorie_deficit',
        content: 'Caloric deficit of 10-20% below maintenance for sustainable fat loss',
        category: 'nutrition',
        confidence: 0.90,
        source: 'Evidence-based recommendations for natural bodybuilding contest preparation nutrition and supplementation',
        authors: ['Eric R. Helms', 'Alan A. Aragon', 'Peter J. Fitschen'],
        year: 2014,
        studyType: 'meta_analysis',
        formulas: ['CalorieDeficit = TDEE × (0.10-0.20)'],
        dataPoints: [
          { description: 'Minimum calorie deficit', value: 10, units: '%', context: 'fat_loss' },
          { description: 'Maximum calorie deficit', value: 20, units: '%', context: 'fat_loss' }
        ]
      },

      // Trexler et al., 2014 - Metabolic adaptation
      {
        id: 'trexler_metabolic_adaptation',
        content: 'Metabolic rate reductions of 10–15% during prolonged energy restriction',
        category: 'metabolism',
        confidence: 0.88,
        source: 'Metabolic adaptation to weight loss: implications for the athlete',
        authors: ['Eric T. Trexler', 'Abbie E. Smith-Ryan', 'Layne E. Norton'],
        year: 2014,
        studyType: 'review',
        formulas: ['MetabolicAdaptation = 0.10-0.15 × BMR'],
        dataPoints: [
          { description: 'Minimum metabolic adaptation', value: 10, units: '%', context: 'prolonged_deficit' },
          { description: 'Maximum metabolic adaptation', value: 15, units: '%', context: 'prolonged_deficit' }
        ]
      },
      {
        id: 'trexler_diet_breaks',
        content: 'Refeeds or diet breaks every 6–8 weeks help restore metabolic rate',
        category: 'metabolism',
        confidence: 0.85,
        source: 'Metabolic adaptation to weight loss: implications for the athlete',
        authors: ['Eric T. Trexler', 'Abbie E. Smith-Ryan', 'Layne E. Norton'],
        year: 2014,
        studyType: 'review',
        formulas: ['DietBreakFrequency = every 6-8 weeks'],
        dataPoints: [
          { description: 'Minimum diet break interval', value: 6, units: 'weeks', context: 'metabolic_restoration' },
          { description: 'Maximum diet break interval', value: 8, units: 'weeks', context: 'metabolic_restoration' }
        ]
      },

      // Peos et al., 2021 - Practical recommendations
      {
        id: 'peos_fat_loss_ceiling',
        content: 'Weekly fat-loss ceilings of ~0.7–0.9 kg for experienced competitors',
        category: 'physiology',
        confidence: 0.91,
        source: 'Practical Recommendations for Competition Preparation of Natural Bodybuilders',
        authors: ['Matthew Peos', 'Eric R. Helms', 'Jackson J. Peos'],
        year: 2021,
        studyType: 'consensus',
        formulas: ['WeeklyFatLoss = 0.7-0.9 kg'],
        dataPoints: [
          { description: 'Minimum weekly fat loss ceiling', value: 0.7, units: 'kg/week', context: 'experienced_competitors' },
          { description: 'Maximum weekly fat loss ceiling', value: 0.9, units: 'kg/week', context: 'experienced_competitors' }
        ]
      },
      {
        id: 'peos_protein_peak',
        content: 'Protein at ≥2.2 g/kg bodyweight with higher targets during peak phases',
        category: 'nutrition',
        confidence: 0.93,
        source: 'Practical Recommendations for Competition Preparation of Natural Bodybuilders',
        authors: ['Matthew Peos', 'Eric R. Helms', 'Jackson J. Peos'],
        year: 2021,
        studyType: 'consensus',
        formulas: ['Protein = ≥2.2 × bodyweight_kg'],
        dataPoints: [
          { description: 'Minimum protein requirement', value: 2.2, units: 'g/kg', context: 'peak_phase' },
          { description: 'Peak phase protein target', value: 2.5, units: 'g/kg', context: 'peak_phase' }
        ]
      },

      // BMR Formulas
      {
        id: 'katch_mcardle_bmr',
        content: 'Katch-McArdle BMR formula: BMR = 370 + (21.6 × LBM_kg)',
        category: 'metabolism',
        confidence: 0.95,
        source: 'Katch & McArdle, 2000',
        authors: ['Katch', 'McArdle'],
        year: 2000,
        studyType: 'rct',
        formulas: ['BMR = 370 + (21.6 × LBM_kg)'],
        dataPoints: [
          { description: 'Base metabolic rate constant', value: 370, units: 'kcal/day', context: 'bmr_calculation' },
          { description: 'LBM multiplier', value: 21.6, units: 'kcal/kg/day', context: 'bmr_calculation' }
        ]
      },
      {
        id: 'mifflin_st_jeor_bmr',
        content: 'Mifflin-St Jeor BMR formula: BMR = (10 × weight) + (6.25 × height) - (5 × age) + gender_factor',
        category: 'metabolism',
        confidence: 0.94,
        source: 'Mifflin et al., 1990',
        authors: ['Mifflin', 'St Jeor', 'Hill', 'Scott', 'Daugherty', 'Koh'],
        year: 1990,
        studyType: 'rct',
        formulas: ['BMR = (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + gender_factor'],
        dataPoints: [
          { description: 'Weight multiplier', value: 10, units: 'kcal/kg', context: 'bmr_calculation' },
          { description: 'Height multiplier', value: 6.25, units: 'kcal/cm', context: 'bmr_calculation' },
          { description: 'Age multiplier', value: 5, units: 'kcal/year', context: 'bmr_calculation' },
          { description: 'Male gender factor', value: 5, units: 'kcal/day', context: 'bmr_calculation' },
          { description: 'Female gender factor', value: -161, units: 'kcal/day', context: 'bmr_calculation' }
        ]
      },

      // Activity Factors
      {
        id: 'activity_factors',
        content: 'Activity factors for TDEE calculation: Sedentary 1.2, Light 1.375, Moderate 1.55, Active 1.725, Very Active 1.9',
        category: 'metabolism',
        confidence: 0.90,
        source: 'Harris-Benedict equation modifications',
        authors: ['Harris', 'Benedict'],
        year: 1919,
        studyType: 'consensus',
        formulas: ['TDEE = BMR × activity_factor'],
        dataPoints: [
          { description: 'Sedentary activity factor', value: 1.2, units: 'multiplier', context: 'tdee_calculation' },
          { description: 'Light activity factor', value: 1.375, units: 'multiplier', context: 'tdee_calculation' },
          { description: 'Moderate activity factor', value: 1.55, units: 'multiplier', context: 'tdee_calculation' },
          { description: 'Active activity factor', value: 1.725, units: 'multiplier', context: 'tdee_calculation' },
          { description: 'Very active activity factor', value: 1.9, units: 'multiplier', context: 'tdee_calculation' }
        ]
      }
    ];
  }

  private categorizeFacts(facts: ResearchFact[]): { [key: string]: ResearchFact[] } {
    const categories: { [key: string]: ResearchFact[] } = {};
    
    facts.forEach(fact => {
      if (!categories[fact.category]) {
        categories[fact.category] = [];
      }
      categories[fact.category].push(fact);
    });
    
    return categories;
  }

  searchFacts(query: string, category?: string, minConfidence: number = 0.8): ResearchFact[] {
    if (!this.knowledgeBase.isInitialized) {
      throw new Error('Knowledge base not initialized. Call initialize() first.');
    }

    const searchTerms = query.toLowerCase().split(' ');
    let results = this.knowledgeBase.facts;

    // Filter by category if specified
    if (category) {
      results = results.filter(fact => fact.category === category);
    }

    // Filter by confidence
    results = results.filter(fact => fact.confidence >= minConfidence);

    // Simple keyword matching
    results = results.filter(fact => {
      const content = fact.content.toLowerCase();
      return searchTerms.some(term => content.includes(term));
    });

    // Sort by confidence and relevance
    results.sort((a, b) => {
      const aRelevance = searchTerms.filter(term => a.content.toLowerCase().includes(term)).length;
      const bRelevance = searchTerms.filter(term => b.content.toLowerCase().includes(term)).length;
      
      if (aRelevance !== bRelevance) {
        return bRelevance - aRelevance;
      }
      
      return b.confidence - a.confidence;
    });

    return results;
  }

  getFactById(id: string): ResearchFact | undefined {
    return this.knowledgeBase.facts.find(fact => fact.id === id);
  }

  getFactsByCategory(category: string): ResearchFact[] {
    return this.knowledgeBase.categories[category] || [];
  }

  getAllFacts(): ResearchFact[] {
    return this.knowledgeBase.facts;
  }

  isReady(): boolean {
    return this.knowledgeBase.isInitialized;
  }
}

// Export singleton instance
export const researchKnowledgeBase = new ResearchKnowledgeBase();
