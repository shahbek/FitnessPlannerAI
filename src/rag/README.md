# RAG (Retrieval-Augmented Generation) Knowledge Bases

This folder contains specialized knowledge bases for different aspects of fitness planning. Each knowledge base provides evidence-based facts, research findings, and recommendations that inform AI-generated plans.

## Structure

```
src/rag/
├── index.ts                    # Centralized access to all RAG modules
├── cardio/
│   └── cardioKnowledgeBase.ts  # Cardiovascular training research
├── nutrition/                  # (Planned)
│   └── nutritionKnowledgeBase.ts
├── training/                   # (Planned)
│   └── trainingKnowledgeBase.ts
├── recovery/                   # (Planned)
│   └── recoveryKnowledgeBase.ts
└── supplementation/            # (Planned)
    └── supplementationKnowledgeBase.ts
```

## Purpose

RAG (Retrieval-Augmented Generation) enhances AI responses by:
1. **Providing Evidence**: Grounding AI responses in scientific research
2. **Reducing Hallucinations**: Using verified facts instead of generating from training data
3. **Improving Accuracy**: Ensuring recommendations are based on peer-reviewed research
4. **Enabling Specialization**: Separate knowledge bases for different domains

## Current Knowledge Bases

### Cardio Knowledge Base

**Location**: `cardio/cardioKnowledgeBase.ts`

**Contents**:
- HIIT research and protocols
- Zone 2 / LISS training guidelines
- Fat loss cardio strategies
- Muscle gain cardio recommendations
- Endurance training protocols
- Cardio timing research
- Phase-specific recommendations

**Usage**:
```typescript
import { searchCardioKnowledge, getCardioRecommendations } from '@/rag/cardio/cardioKnowledgeBase';

// Search for specific topics
const facts = searchCardioKnowledge('HIIT fat loss', {
  goal: 'fat_loss',
  phase: 'peak'
});

// Get recommendations
const recommendations = getCardioRecommendations('fat_loss', 'peak', 'intermediate');
```

## Planned Knowledge Bases

### Nutrition Knowledge Base
- Macro cycling research
- Meal timing studies
- Nutrient timing for performance
- Dietary strategies by goal
- Supplementation evidence

### Training Knowledge Base
- Volume and frequency research
- Progressive overload principles
- Periodization strategies
- Exercise selection guidelines
- Recovery protocols

### Recovery Knowledge Base
- Sleep and performance
- Active recovery methods
- Deload protocols
- Stress management
- Overtraining prevention

### Supplementation Knowledge Base
- Evidence-based supplements
- Dosage recommendations
- Timing and protocols
- Safety considerations
- Research-backed benefits

## Adding a New Knowledge Base

1. **Create the knowledge base file**:
   ```typescript
   // src/rag/[domain]/[domain]KnowledgeBase.ts
   export interface [Domain]ResearchFact {
     // Define structure
   }
   
   export const [DOMAIN]_KNOWLEDGE_BASE: [Domain]ResearchFact[] = [
     // Add research facts
   ];
   
   export function search[Domain]Knowledge(...) {
     // Implement search
   }
   ```

2. **Export from index.ts**:
   ```typescript
   export * from './[domain]/[domain]KnowledgeBase';
   ```

3. **Update searchAllRAG**:
   ```typescript
   if (!categories || categories.includes('[domain]')) {
     const { search[Domain]Knowledge } = await import('./[domain]/[domain]KnowledgeBase');
     results.push(...search[Domain]Knowledge(query));
   }
   ```

## Knowledge Base Standards

### Research Fact Structure

Each research fact should include:
- **id**: Unique identifier
- **content**: Main finding/statement
- **category**: Domain category
- **confidence**: 0-1 confidence score
- **source**: Research paper/source
- **authors**: Author names
- **year**: Publication year
- **studyType**: Type of study (meta_analysis, rct, review, etc.)
- **formulas**: Relevant formulas
- **dataPoints**: Quantitative data points

### Search Functions

Each knowledge base should provide:
- `search[Domain]Knowledge(query, filters)` - Search with filters
- `get[Domain]Recommendations(...)` - Get recommendations based on context

### Quality Standards

- **Evidence-Based**: Only include peer-reviewed research
- **Recent**: Prioritize recent studies (last 10 years)
- **Relevant**: Focus on practical, applicable findings
- **Accurate**: Verify all numbers and formulas
- **Categorized**: Proper categorization for filtering

## Usage in Services

Knowledge bases are used in:
- **Prompt Building**: Inject evidence into AI prompts
- **Validation**: Verify AI-generated content
- **Recommendations**: Provide context-specific guidance
- **Education**: Explain why recommendations are made

## Example: Using Cardio RAG

```typescript
import { searchCardioKnowledge, getCardioRecommendations } from '@/rag';

// In CardioGenerationService
const recommendations = getCardioRecommendations(
  userProfile.goal,
  phase,
  userProfile.workoutLevel
);

const cardioKnowledge = searchCardioKnowledge('', {
  goal: userProfile.goal,
  phase: phase
});

// Use in prompt
const prompt = `
EVIDENCE-BASED RECOMMENDATIONS:
- Frequency: ${recommendations.frequency.min}-${recommendations.frequency.max} sessions/week
- Duration: ${recommendations.duration.min}-${recommendations.duration.max} minutes

SCIENTIFIC CONTEXT:
${cardioKnowledge.map(f => `- ${f.content} (${f.source})`).join('\n')}
`;
```

## Maintenance

- **Regular Updates**: Add new research as it's published
- **Review Accuracy**: Periodically review facts for accuracy
- **Expand Coverage**: Add more facts to improve recommendations
- **Version Control**: Track changes to knowledge base

## References

- Cardio research: Helms et al. (2014), Boutcher (2011), Seiler & Kjerland (2006)
- Training research: Schoenfeld (2016), Helms (2014)
- Nutrition research: (To be added)
- Recovery research: (To be added)

