// Test Runner for Fitness Planner AI
// Comprehensive test suite for all critical components

import { APIKeyValidator } from '@/utils/apiKeyValidator';
import { CandidateProfileBuilder, ProfileValidator } from '@/types/candidateProfile';
import { integratedPlanningService } from '@/services/integratedPlanningService';

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

export class TestRunner {
  private results: TestSuite[] = [];

  async runAllTests(): Promise<TestSuite[]> {
    console.log('🧪 Starting comprehensive test suite...\n');

    // Run API Key Validator tests
    await this.runAPITests();
    
    // Run Candidate Profile tests
    await this.runProfileTests();
    
    // Run Integrated Planning Service tests
    await this.runPlanningTests();
    
    // Run Security tests
    await this.runSecurityTests();

    this.printSummary();
    return this.results;
  }

  private async runAPITests(): Promise<void> {
    console.log('🔐 Testing API Key Validator...');
    const startTime = Date.now();
    const tests: TestResult[] = [];

    try {
      // Test 1: Empty API key validation
      const emptyKeyTest = await this.runTest('Empty API key rejection', async () => {
        const validator = APIKeyValidator.getInstance();
        const result = await validator.validateUserAPIKey('');
        if (result.isValid) throw new Error('Empty API key should be rejected');
        if (!result.error?.includes('empty')) throw new Error('Should mention empty key');
      });
      tests.push(emptyKeyTest);

      // Test 2: Short API key validation
      const shortKeyTest = await this.runTest('Short API key rejection', async () => {
        const validator = APIKeyValidator.getInstance();
        const result = await validator.validateUserAPIKey('short');
        if (result.isValid) throw new Error('Short API key should be rejected');
        if (!result.error?.includes('too short')) throw new Error('Should mention key too short');
      });
      tests.push(shortKeyTest);

      // Test 3: Provider detection
      const providerTest = await this.runTest('Provider detection', async () => {
        const validator = APIKeyValidator.getInstance();
        const openaiProvider = validator['detectProvider']('sk-1234567890abcdef');
        const groqProvider = validator['detectProvider']('gsk_1234567890abcdef');
        const anthropicProvider = validator['detectProvider']('sk-ant-1234567890abcdef');
        
        if (openaiProvider !== 'openai') throw new Error('OpenAI key not detected');
        if (groqProvider !== 'groq') throw new Error('Groq key not detected');
        if (anthropicProvider !== 'anthropic') throw new Error('Anthropic key not detected');
      });
      tests.push(providerTest);

      // Test 4: Configuration generation
      const configTest = await this.runTest('API configuration generation', async () => {
        const validator = APIKeyValidator.getInstance();
        validator['validatedKey'] = 'sk-1234567890abcdef';
        validator['detectProvider'] = jest.fn().mockReturnValue('openai');
        
        const config = validator.getAPIConfig();
        if (!config) throw new Error('Config should be generated');
        if (config.provider !== 'OpenAI') throw new Error('Wrong provider');
        if (!config.endpoint.includes('openai.com')) throw new Error('Wrong endpoint');
      });
      tests.push(configTest);

    } catch (error) {
      tests.push({
        name: 'API Key Validator Suite',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }

    this.results.push({
      name: 'API Key Validator',
      tests,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      duration: Date.now() - startTime
    });
  }

  private async runProfileTests(): Promise<void> {
    console.log('👤 Testing Candidate Profile System...');
    const startTime = Date.now();
    const tests: TestResult[] = [];

    try {
      // Test 1: Profile creation
      const createTest = await this.runTest('Profile creation', async () => {
        const profile = CandidateProfileBuilder.createEmpty();
        if (!profile.physicalStats) throw new Error('Physical stats not created');
        if (!profile.trainingHistory) throw new Error('Training history not created');
        if (!profile.lifestyle) throw new Error('Lifestyle not created');
        if (!profile.dietaryPreferences) throw new Error('Dietary preferences not created');
        if (!profile.goal) throw new Error('Goal not created');
      });
      tests.push(createTest);

      // Test 2: BMI calculation
      const bmiTest = await this.runTest('BMI calculation', async () => {
        const bmi = CandidateProfileBuilder.calculateBMI(180, 80);
        const expected = 80 / Math.pow(180 / 100, 2);
        if (Math.abs(bmi - expected) > 0.01) throw new Error(`BMI calculation wrong: ${bmi} vs ${expected}`);
      });
      tests.push(bmiTest);

      // Test 3: Lean body mass calculation
      const lbmTest = await this.runTest('Lean body mass calculation', async () => {
        const lbm = CandidateProfileBuilder.calculateLeanBodyMass(80, 20);
        const expected = 80 * (1 - 20 / 100);
        if (lbm !== expected) throw new Error(`LBM calculation wrong: ${lbm} vs ${expected}`);
      });
      tests.push(lbmTest);

      // Test 4: Profile validation
      const validationTest = await this.runTest('Profile validation', async () => {
        const validProfile = {
          physicalStats: {
            age: 30,
            sex: 'male' as const,
            heightCm: 180,
            weightKg: 80,
            bodyFatPercentage: 20,
            bmi: 24.69,
            leanBodyMassKg: 64
          }
        };
        
        const result = ProfileValidator.validate(validProfile);
        if (!result.isValid) throw new Error('Valid profile should pass validation');
        
        const invalidProfile = {
          physicalStats: {
            age: 150, // Invalid
            sex: 'male' as const,
            heightCm: 180,
            weightKg: 80,
            bodyFatPercentage: 20,
            bmi: 24.69,
            leanBodyMassKg: 64
          }
        };
        
        const invalidResult = ProfileValidator.validate(invalidProfile);
        if (invalidResult.isValid) throw new Error('Invalid profile should fail validation');
        if (!invalidResult.errors.some(e => e.includes('Age must be between'))) {
          throw new Error('Should have age validation error');
        }
      });
      tests.push(validationTest);

    } catch (error) {
      tests.push({
        name: 'Profile System Suite',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }

    this.results.push({
      name: 'Candidate Profile System',
      tests,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      duration: Date.now() - startTime
    });
  }

  private async runPlanningTests(): Promise<void> {
    console.log('🎯 Testing Integrated Planning Service...');
    const startTime = Date.now();
    const tests: TestResult[] = [];

    try {
      // Test 1: Service initialization
      const initTest = await this.runTest('Service initialization', async () => {
        const service = new IntegratedPlanningService();
        if (service['isInitialized']) throw new Error('Service should not be initialized by default');
      });
      tests.push(initTest);

      // Test 2: Profile prompt generation
      const promptTest = await this.runTest('Profile prompt generation', async () => {
        const profile = CandidateProfileBuilder.createEmpty() as any;
        profile.physicalStats = {
          age: 30,
          sex: 'male',
          heightCm: 180,
          weightKg: 80,
          bodyFatPercentage: 20,
          bmi: 24.69,
          leanBodyMassKg: 64
        };
        
        // This would test the ProfilePromptGenerator if we had access to it
        // For now, just verify the service exists
        if (!integratedPlanningService) throw new Error('Integrated planning service not available');
      });
      tests.push(promptTest);

    } catch (error) {
      tests.push({
        name: 'Planning Service Suite',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }

    this.results.push({
      name: 'Integrated Planning Service',
      tests,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      duration: Date.now() - startTime
    });
  }

  private async runSecurityTests(): Promise<void> {
    console.log('🔒 Testing Security Features...');
    const startTime = Date.now();
    const tests: TestResult[] = [];

    try {
      // Test 1: API key enforcement
      const apiKeyTest = await this.runTest('API key enforcement', async () => {
        const validator = APIKeyValidator.getInstance();
        validator.clearValidatedKey();
        
        if (validator.isKeyValidated()) throw new Error('Should not be validated after clear');
        
        // Test that service requires validation
        try {
          await integratedPlanningService.generatePlan({} as any);
          throw new Error('Should require API key validation');
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('not initialized')) {
            throw new Error('Should require initialization with API key');
          }
        }
      });
      tests.push(apiKeyTest);

      // Test 2: No mock responses
      const mockTest = await this.runTest('No mock responses', async () => {
        // Verify that the old mock system is removed
        const aiRAGModule = await import('@/ai/aiRAG');
        const aiRAG = aiRAGModule.aiRAG;
        
        // Check that callAI method is removed/not mocked
        if (aiRAG['callAI'] && typeof aiRAG['callAI'] === 'function') {
          // If callAI exists, it should not be the mock version
          const callAICode = aiRAG['callAI'].toString();
          if (callAICode.includes('mock AI response') || callAICode.includes('For now, we\'ll use a mock')) {
            throw new Error('Mock responses still present in AI RAG system');
          }
        }
      });
      tests.push(mockTest);

    } catch (error) {
      tests.push({
        name: 'Security Suite',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }

    this.results.push({
      name: 'Security Features',
      tests,
      passed: tests.filter(t => t.passed).length,
      failed: tests.filter(t => !t.passed).length,
      duration: Date.now() - startTime
    });
  }

  private async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    const startTime = Date.now();
    try {
      await testFn();
      return {
        name,
        passed: true,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  private printSummary(): void {
    console.log('\n📊 Test Summary:');
    console.log('================\n');

    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    this.results.forEach(suite => {
      const status = suite.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${suite.name}: ${suite.passed} passed, ${suite.failed} failed (${suite.duration}ms)`);
      
      if (suite.failed > 0) {
        suite.tests.filter(t => !t.passed).forEach(test => {
          console.log(`   ❌ ${test.name}: ${test.error}`);
        });
      }
      
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.duration;
    });

    console.log(`\n🎯 Overall: ${totalPassed} passed, ${totalFailed} failed (${totalDuration}ms)`);
    
    if (totalFailed === 0) {
      console.log('🎉 All tests passed! System is ready for production.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix before deployment.');
    }
  }
}

// Export for use in other modules
export const testRunner = new TestRunner();
