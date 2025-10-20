// Test for JSON completion functionality
// This would test the attemptJsonCompletion method

const testCases = [
  {
    name: 'Incomplete JSON with missing closing brace',
    input: '{"trainingApproach": {"split": "upper_lower"',
    expected: '{"trainingApproach": {"split": "upper_lower"}}'
  },
  {
    name: 'Incomplete JSON with missing closing braces',
    input: '{"trainingApproach": {"split": "upper_lower", "frequency": 4',
    expected: '{"trainingApproach": {"split": "upper_lower", "frequency": 4}}'
  },
  {
    name: 'JSON with trailing comma',
    input: '{"trainingApproach": {"split": "upper_lower"},}',
    expected: '{"trainingApproach": {"split": "upper_lower"}}'
  },
  {
    name: 'Complete JSON should remain unchanged',
    input: '{"trainingApproach": {"split": "upper_lower"}}',
    expected: '{"trainingApproach": {"split": "upper_lower"}}'
  }
];

// Mock implementation for testing
function attemptJsonCompletion(incompleteJson: string): string {
  let completed = incompleteJson.trim();
  
  // Count unmatched braces and brackets
  let openBraces = (completed.match(/\{/g) || []).length;
  let closeBraces = (completed.match(/\}/g) || []).length;
  let openBrackets = (completed.match(/\[/g) || []).length;
  let closeBrackets = (completed.match(/\]/g) || []).length;
  
  // Add missing closing braces
  for (let i = 0; i < openBraces - closeBraces; i++) {
    completed += '}';
  }
  
  // Add missing closing brackets
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    completed += ']';
  }
  
  // If the JSON ends with a comma, remove it
  completed = completed.replace(/,\s*$/, '');
  
  return completed;
}

function testJsonCompletion() {
  console.log('🧪 Testing JSON completion...');
  
  testCases.forEach(testCase => {
    const result = attemptJsonCompletion(testCase.input);
    const passed = result === testCase.expected;
    
    console.log(`${passed ? '✅' : '❌'} ${testCase.name}`);
    if (!passed) {
      console.log(`  Expected: ${testCase.expected}`);
      console.log(`  Got: ${result}`);
    }
  });
}

export { testJsonCompletion };

