#!/usr/bin/env tsx
/**
 * Environment Validation Script
 * 
 * Run this script to validate environment configuration
 * Usage: npm run validate-env
 */

import { validateEnv, getEnvInfo } from '../config/env';

console.log('🔍 Validating Environment Configuration...\n');

const validation = validateEnv();
const envInfo = getEnvInfo();

// Display environment info
console.log('📋 Environment Configuration:');
console.log('─'.repeat(50));
Object.entries(envInfo).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});
console.log('─'.repeat(50));
console.log();

// Display validation results
if (validation.isValid) {
  console.log('✅ Environment configuration is valid!\n');
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
    console.log();
  }
} else {
  console.error('❌ Environment configuration has errors:\n');
  validation.errors.forEach(error => {
    console.error(`   ❌ ${error}`);
  });
  console.log();
  
  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    validation.warnings.forEach(warning => {
      console.log(`   - ${warning}`);
    });
    console.log();
  }
  
  console.log('💡 Fix the errors above and try again.');
  console.log('   See ENVIRONMENT_SETUP.md for detailed instructions.\n');
  process.exit(1);
}

console.log('✨ Validation complete!\n');
process.exit(0);

