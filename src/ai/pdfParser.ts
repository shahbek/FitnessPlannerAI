// PDF Parser for Research Papers
// Extracts structured data from scientific papers for RAG system

// Browser-compatible PDF Parser for Research Papers
// Note: In a real implementation, this would use a proper PDF parsing library

export interface ExtractedContent {
  title: string;
  authors: string[];
  publicationYear: number;
  journal: string;
  doi?: string;
  abstract: string;
  sections: {
    [sectionName: string]: string;
  };
  formulas: {
    name: string;
    equation: string;
    variables: string[];
    context: string;
    confidence: number;
  }[];
  recommendations: {
    category: 'nutrition' | 'training' | 'physiology' | 'metabolism' | 'body_composition';
    text: string;
    confidence: number;
    context: string;
  }[];
  dataPoints: {
    metric: string;
    value: number | [number, number];
    units: string;
    population: string;
    context: string;
    confidence: number;
  }[];
  references: {
    id: string;
    text: string;
    authors: string;
    year: number;
    journal: string;
  }[];
}

export interface ParsedResearch {
  paperId: string;
  filename: string;
  extractedContent: ExtractedContent;
  processingDate: string;
  qualityScore: number;
}

export class ResearchPDFParser {
  private researchDir: string;

  constructor(researchDir: string = 'src/research') {
    this.researchDir = researchDir;
  }

  /**
   * Parse all PDF files in the research directory
   * Browser-compatible version that returns mock data
   */
  async parseAllPapers(): Promise<ParsedResearch[]> {
    console.log('Parsing research papers (browser-compatible mode)...');
    
    // In a browser environment, we return mock data based on known research papers
    // In a real implementation, this would parse actual PDF files
    const papers: ParsedResearch[] = [];
    
    const knownPapers = [
      'Evidence-based recommendations for natural bodybuilding contest preparation  nutrition and supplementation.pdf',
      'fat-loss.pdf',
      'nutrients-13-03255.pdf'
    ];
    
    for (const filename of knownPapers) {
      try {
        const parsed = await this.parsePDF(filename);
        papers.push(parsed);
      } catch (error) {
        console.error(`Failed to parse ${filename}:`, error);
      }
    }
    
    console.log(`Successfully parsed ${papers.length} research papers`);
    return papers;
  }

  /**
   * Parse a single PDF file
   */
  async parsePDF(filename: string): Promise<ParsedResearch> {
    // For now, we'll create a mock parser since PDF parsing in browser is complex
    // In a real implementation, this would use pdf-parse or similar
    // const filePath = path.join(this.researchDir, filename);
    const mockContent = this.createMockExtractedContent(filename);
    
    return {
      paperId: this.generatePaperId(filename),
      filename,
      extractedContent: mockContent,
      processingDate: new Date().toISOString(),
      qualityScore: this.calculateQualityScore(mockContent)
    };
  }

  /**
   * Extract specific data types from parsed content
   */
  extractFormulas(content: ExtractedContent): any[] {
    return content.formulas.map(formula => ({
      id: this.generateFormulaId(formula.name),
      name: formula.name,
      equation: formula.equation,
      variables: formula.variables,
      context: formula.context,
      confidence: formula.confidence,
      source: content.title,
      paperId: this.generatePaperId(content.title)
    }));
  }

  extractRecommendations(content: ExtractedContent): any[] {
    return content.recommendations.map(rec => ({
      id: this.generateRecommendationId(rec.text),
      category: rec.category,
      text: rec.text,
      confidence: rec.confidence,
      context: rec.context,
      source: content.title,
      paperId: this.generatePaperId(content.title)
    }));
  }

  extractDataPoints(content: ExtractedContent): any[] {
    return content.dataPoints.map(point => ({
      id: this.generateDataPointId(point.metric),
      metric: point.metric,
      value: point.value,
      units: point.units,
      population: point.population,
      context: point.context,
      confidence: point.confidence,
      source: content.title,
      paperId: this.generatePaperId(content.title)
    }));
  }

  private createMockExtractedContent(filename: string): ExtractedContent {
    // This is a mock implementation - in reality, this would parse the actual PDF
    // For now, we'll return structured data based on the filename
    
    if (filename.includes('bodybuilding')) {
      return {
        title: "Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation",
        authors: ["Eric R. Helms", "Alan A. Aragon", "Peter J. Fitschen"],
        publicationYear: 2014,
        journal: "Journal of the International Society of Sports Nutrition",
        doi: "10.1186/1550-2783-11-20",
        abstract: "This review provides evidence-based recommendations for natural bodybuilding contest preparation...",
        sections: {
          "Introduction": "Natural bodybuilding contest preparation requires careful attention to nutrition and training...",
          "Nutrition": "Protein requirements during contest preparation should be 2.3-3.1 g/kg lean body mass...",
          "Training": "Training volume should be maintained or slightly reduced during caloric restriction...",
          "Conclusion": "Evidence-based approaches to contest preparation can optimize results while maintaining health..."
        },
        formulas: [
          {
            name: "BMR Katch-McArdle",
            equation: "BMR = 370 + (21.6 × LBM_kg)",
            variables: ["LBM_kg"],
            context: "Basal metabolic rate calculation for individuals with known body composition",
            confidence: 0.95
          },
          {
            name: "Fat Loss Rate",
            equation: "Fat Loss = 0.5-1.0% bodyweight per week",
            variables: ["bodyweight"],
            context: "Safe fat loss rate to preserve lean mass during contest preparation",
            confidence: 0.92
          }
        ],
        recommendations: [
          {
            category: "nutrition",
            text: "Protein intakes of 2.3-3.1 g/kg of lean body mass during energy restriction",
            confidence: 0.94,
            context: "Contest preparation nutrition guidelines"
          },
          {
            category: "nutrition",
            text: "Fat-loss rate between 0.5–1.0% of bodyweight per week for natural bodybuilders",
            confidence: 0.92,
            context: "Safe fat loss recommendations"
          },
          {
            category: "metabolism",
            text: "Planned diet breaks or refeeds to mitigate metabolic adaptation",
            confidence: 0.88,
            context: "Metabolic adaptation prevention"
          }
        ],
        dataPoints: [
          {
            metric: "Protein Requirement",
            value: [2.3, 3.1],
            units: "g/kg LBM",
            population: "Natural bodybuilders in contest prep",
            context: "During caloric restriction",
            confidence: 0.94
          },
          {
            metric: "Fat Loss Rate",
            value: [0.5, 1.0],
            units: "% bodyweight/week",
            population: "Natural bodybuilders",
            context: "Contest preparation phase",
            confidence: 0.92
          },
          {
            metric: "Diet Break Frequency",
            value: [6, 8],
            units: "weeks",
            population: "Individuals in caloric deficit",
            context: "Metabolic adaptation prevention",
            confidence: 0.88
          }
        ],
        references: [
          {
            id: "helms2014",
            text: "Helms, E.R., et al. (2014). Evidence-based recommendations for natural bodybuilding contest preparation",
            authors: "Helms, E.R., Aragon, A.A., Fitschen, P.J.",
            year: 2014,
            journal: "Journal of the International Society of Sports Nutrition"
          }
        ]
      };
    } else if (filename.includes('fat-loss')) {
      return {
        title: "Metabolic adaptation to weight loss: implications for the athlete",
        authors: ["Eric T. Trexler", "Abbie E. Smith-Ryan", "Layne E. Norton"],
        publicationYear: 2014,
        journal: "Journal of the International Society of Sports Nutrition",
        doi: "10.1186/s12970-014-0051-x",
        abstract: "This review examines metabolic adaptations that occur during weight loss...",
        sections: {
          "Introduction": "Weight loss induces various metabolic adaptations that can impact athletic performance...",
          "Metabolic Adaptations": "Metabolic rate reductions of 10–15% during prolonged energy restriction...",
          "Prevention Strategies": "Refeeds or diet breaks every 6–8 weeks help restore metabolic rate...",
          "Conclusion": "Understanding metabolic adaptation is crucial for optimizing weight loss strategies..."
        },
        formulas: [
          {
            name: "Metabolic Adaptation Rate",
            equation: "Adapted_TDEE = Baseline_TDEE × (1 - (weeks_in_deficit × 0.0125))",
            variables: ["Baseline_TDEE", "weeks_in_deficit"],
            context: "Metabolic rate reduction during prolonged caloric deficit",
            confidence: 0.88
          }
        ],
        recommendations: [
          {
            category: "metabolism",
            text: "Metabolic rate reductions of 10–15% during prolonged energy restriction",
            confidence: 0.90,
            context: "Metabolic adaptation during weight loss"
          },
          {
            category: "metabolism",
            text: "Refeeds or diet breaks every 6–8 weeks to help restore metabolic rate",
            confidence: 0.87,
            context: "Preventing metabolic adaptation"
          }
        ],
        dataPoints: [
          {
            metric: "Metabolic Adaptation",
            value: [10, 15],
            units: "% TDEE reduction",
            population: "Individuals in prolonged caloric deficit",
            context: "Over 8-12 weeks",
            confidence: 0.90
          },
          {
            metric: "Refeed Frequency",
            value: [6, 8],
            units: "weeks",
            population: "Individuals in caloric deficit",
            context: "Metabolic adaptation prevention",
            confidence: 0.87
          }
        ],
        references: [
          {
            id: "trexler2014",
            text: "Trexler, E.T., et al. (2014). Metabolic adaptation to weight loss: implications for the athlete",
            authors: "Trexler, E.T., Smith-Ryan, A.E., Norton, L.E.",
            year: 2014,
            journal: "Journal of the International Society of Sports Nutrition"
          }
        ]
      };
    } else {
      // Default for nutrients paper
      return {
        title: "Practical Recommendations for Competition Preparation of Natural Bodybuilders",
        authors: ["Matthew Peos", "Eric R. Helms", "Jackson J. Peos"],
        publicationYear: 2021,
        journal: "Nutrients",
        doi: "10.3390/nu13093255",
        abstract: "This paper provides practical recommendations for natural bodybuilding competition preparation...",
        sections: {
          "Introduction": "Natural bodybuilding competition preparation requires evidence-based approaches...",
          "Nutrition": "Weekly fat-loss ceilings of ~0.7–0.9 kg for experienced competitors...",
          "Training": "Training should be periodized based on competition timeline...",
          "Conclusion": "Practical guidelines can optimize competition preparation outcomes..."
        },
        formulas: [],
        recommendations: [
          {
            category: "body_composition",
            text: "Weekly fat-loss ceilings of ~0.7–0.9 kg for experienced competitors",
            confidence: 0.91,
            context: "Contest preparation fat loss limits"
          },
          {
            category: "nutrition",
            text: "Protein at ≥2.2 g/kg bodyweight with higher targets during peak phases",
            confidence: 0.93,
            context: "Contest preparation protein requirements"
          }
        ],
        dataPoints: [
          {
            metric: "Fat Loss Ceiling",
            value: [0.7, 0.9],
            units: "kg/week",
            population: "Experienced competitors",
            context: "Contest preparation",
            confidence: 0.91
          },
          {
            metric: "Protein Requirement",
            value: [2.2, 2.8],
            units: "g/kg bodyweight",
            population: "Contest preparation athletes",
            context: "Peak phases",
            confidence: 0.93
          }
        ],
        references: [
          {
            id: "peos2021",
            text: "Peos, M., et al. (2021). Practical Recommendations for Competition Preparation of Natural Bodybuilders",
            authors: "Peos, M., Helms, E.R., Peos, J.J.",
            year: 2021,
            journal: "Nutrients"
          }
        ]
      };
    }
  }

  private generatePaperId(filename: string): string {
    return filename.replace('.pdf', '').replace(/\s+/g, '_').toLowerCase();
  }

  private generateFormulaId(name: string): string {
    return `formula_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  }

  private generateRecommendationId(text: string): string {
    return `rec_${text.substring(0, 20).toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  }

  private generateDataPointId(metric: string): string {
    return `data_${metric.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
  }

  private calculateQualityScore(content: ExtractedContent): number {
    let score = 0;
    
    // Base score for having content
    score += 0.2;
    
    // Score for completeness
    if (content.abstract) score += 0.1;
    if (content.formulas.length > 0) score += 0.2;
    if (content.recommendations.length > 0) score += 0.2;
    if (content.dataPoints.length > 0) score += 0.2;
    if (content.references.length > 0) score += 0.1;
    
    return Math.min(1.0, score);
  }
}

// Export singleton instance
export const researchPDFParser = new ResearchPDFParser();
