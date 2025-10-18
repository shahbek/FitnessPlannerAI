// Vector Database for Research Knowledge Base
// Provides semantic search capabilities for research content

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    paperId: string;
    section: string;
    category: string;
    confidence: number;
    source: string;
    authors: string[];
    year: number;
  };
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  relevanceScore: number;
}

export interface SearchQuery {
  text: string;
  category?: string;
  minConfidence?: number;
  limit?: number;
  threshold?: number;
}

export class VectorDatabase {
  private documents: VectorDocument[] = [];
  private isInitialized = false;

  /**
   * Initialize the vector database with research content
   */
  async initialize(researchData: any[]): Promise<void> {
    console.log('Initializing vector database with research data...');
    
    // Process each research paper
    for (const paper of researchData) {
      await this.addPaper(paper);
    }
    
    this.isInitialized = true;
    console.log(`Vector database initialized with ${this.documents.length} documents`);
  }

  /**
   * Add a research paper to the vector database
   */
  async addPaper(paper: any): Promise<void> {
    const paperId = paper.paperId;
    
    // Add formulas
    for (const formula of paper.extractedContent.formulas) {
      const content = `Formula: ${formula.name}\nEquation: ${formula.equation}\nVariables: ${formula.variables.join(', ')}\nContext: ${formula.context}`;
      const embedding = await this.generateEmbedding(content);
      
      this.documents.push({
        id: formula.id,
        content,
        embedding,
        metadata: {
          paperId,
          section: 'formulas',
          category: 'physiology',
          confidence: formula.confidence,
          source: paper.extractedContent.title,
          authors: paper.extractedContent.authors,
          year: paper.extractedContent.publicationYear
        }
      });
    }

    // Add recommendations
    for (const rec of paper.extractedContent.recommendations) {
      const content = `Recommendation: ${rec.text}\nCategory: ${rec.category}\nContext: ${rec.context}`;
      const embedding = await this.generateEmbedding(content);
      
      this.documents.push({
        id: rec.id,
        content,
        embedding,
        metadata: {
          paperId,
          section: 'recommendations',
          category: rec.category,
          confidence: rec.confidence,
          source: paper.extractedContent.title,
          authors: paper.extractedContent.authors,
          year: paper.extractedContent.publicationYear
        }
      });
    }

    // Add data points
    for (const dataPoint of paper.extractedContent.dataPoints) {
      const valueStr = Array.isArray(dataPoint.value) 
        ? `${dataPoint.value[0]}-${dataPoint.value[1]}` 
        : dataPoint.value.toString();
      const content = `Data: ${dataPoint.metric} = ${valueStr} ${dataPoint.units}\nPopulation: ${dataPoint.population}\nContext: ${dataPoint.context}`;
      const embedding = await this.generateEmbedding(content);
      
      this.documents.push({
        id: dataPoint.id,
        content,
        embedding,
        metadata: {
          paperId,
          section: 'data_points',
          category: 'data',
          confidence: dataPoint.confidence,
          source: paper.extractedContent.title,
          authors: paper.extractedContent.authors,
          year: paper.extractedContent.publicationYear
        }
      });
    }

    // Add abstract
    if (paper.extractedContent.abstract) {
      const content = `Abstract: ${paper.extractedContent.abstract}`;
      const embedding = await this.generateEmbedding(content);
      
      this.documents.push({
        id: `${paperId}_abstract`,
        content,
        embedding,
        metadata: {
          paperId,
          section: 'abstract',
          category: 'overview',
          confidence: 0.9,
          source: paper.extractedContent.title,
          authors: paper.extractedContent.authors,
          year: paper.extractedContent.publicationYear
        }
      });
    }
  }

  /**
   * Search for relevant documents using semantic similarity
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Vector database not initialized');
    }

    const queryEmbedding = await this.generateEmbedding(query.text);
    const results: SearchResult[] = [];

    for (const doc of this.documents) {
      // Apply filters
      if (query.category && doc.metadata.category !== query.category) continue;
      if (query.minConfidence && doc.metadata.confidence < query.minConfidence) continue;

      // Calculate similarity
      const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
      
      if (similarity >= (query.threshold || 0.5)) {
        const relevanceScore = this.calculateRelevanceScore(doc, query, similarity);
        results.push({
          document: doc,
          similarity,
          relevanceScore
        });
      }
    }

    // Sort by relevance score and limit results
    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, query.limit || 10);
  }

  /**
   * Get documents by category
   */
  async getByCategory(category: string, limit: number = 10): Promise<VectorDocument[]> {
    return this.documents
      .filter(doc => doc.metadata.category === category)
      .sort((a, b) => b.metadata.confidence - a.metadata.confidence)
      .slice(0, limit);
  }

  /**
   * Get documents by paper
   */
  async getByPaper(paperId: string): Promise<VectorDocument[]> {
    return this.documents.filter(doc => doc.metadata.paperId === paperId);
  }

  /**
   * Get high-confidence documents
   */
  async getHighConfidence(minConfidence: number = 0.8): Promise<VectorDocument[]> {
    return this.documents
      .filter(doc => doc.metadata.confidence >= minConfidence)
      .sort((a, b) => b.metadata.confidence - a.metadata.confidence);
  }

  /**
   * Generate embedding for text (mock implementation)
   * In a real implementation, this would use OpenAI embeddings or similar
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // Mock embedding generation - in reality, this would call an embeddings API
    // For now, we'll create a simple hash-based embedding
    const hash = this.simpleHash(text);
    const embedding = new Array(384).fill(0); // 384-dimensional embedding
    
    // Distribute the hash across the embedding dimensions
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] = Math.sin(hash + i) * 0.1;
    }
    
    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate relevance score for a document
   */
  private calculateRelevanceScore(doc: VectorDocument, query: SearchQuery, similarity: number): number {
    let score = similarity;
    
    // Boost score for high confidence
    score += doc.metadata.confidence * 0.2;
    
    // Boost score for recent papers
    const currentYear = new Date().getFullYear();
    const age = currentYear - doc.metadata.year;
    const recencyBoost = Math.max(0, (10 - age) / 10) * 0.1;
    score += recencyBoost;
    
    // Boost score for exact category match
    if (query.category && doc.metadata.category === query.category) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Simple hash function for mock embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get database statistics
   */
  getStats(): {
    totalDocuments: number;
    categories: { [key: string]: number };
    papers: { [key: string]: number };
    averageConfidence: number;
  } {
    const categories: { [key: string]: number } = {};
    const papers: { [key: string]: number } = {};
    let totalConfidence = 0;

    for (const doc of this.documents) {
      // Count categories
      categories[doc.metadata.category] = (categories[doc.metadata.category] || 0) + 1;
      
      // Count papers
      papers[doc.metadata.paperId] = (papers[doc.metadata.paperId] || 0) + 1;
      
      // Sum confidence
      totalConfidence += doc.metadata.confidence;
    }

    return {
      totalDocuments: this.documents.length,
      categories,
      papers,
      averageConfidence: this.documents.length > 0 ? totalConfidence / this.documents.length : 0
    };
  }
}

// Export singleton instance
export const vectorDatabase = new VectorDatabase();
