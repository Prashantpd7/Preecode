#!/usr/bin/env node
/**
 * OpenRouter Configuration Test Script
 * Tests the nvidia/nemotron model configuration
 * 
 * Usage: node test-openrouter.js
 */

require('dotenv').config({ path: './preecode-backend/.env' });

async function testOpenRouterConfig() {
  console.log('🔍 Testing OpenRouter Configuration...\n');

  // Check environment variable
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment');
    console.log('   Please set it in preecode-backend/.env');
    process.exit(1);
  }
  console.log('✅ OPENROUTER_API_KEY is set');

  // Import the AI service
  try {
    const aiService = require('./preecode-backend/services/aiService.js');
    console.log('✅ AI Service loaded successfully');

    // Test a simple chat request
    console.log('\n🧪 Testing AI chat with nvidia/nemotron model...');
    const response = await aiService.chat(
      'Say "Hello from NVIDIA Nemotron!" if you can read this.',
      null,
      []
    );

    console.log('\n✅ SUCCESS! Model responded:');
    console.log('─'.repeat(60));
    console.log(response);
    console.log('─'.repeat(60));
    console.log('\n🎉 OpenRouter is working correctly with nvidia/nemotron model!');
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);
    
    if (error.code === 'OPENROUTER_API_KEY_MISSING') {
      console.log('\n💡 Fix: Set OPENROUTER_API_KEY in preecode-backend/.env');
    } else if (error.code === 'OPENROUTER_FALLBACK_EXHAUSTED') {
      console.log('\n💡 The model may be temporarily unavailable. Check:');
      console.log('   1. Your OpenRouter API key is valid');
      console.log('   2. The model nvidia/nemotron-3-super-120b-a12b:free is available');
      console.log('   3. Your OpenRouter account has no restrictions');
    } else {
      console.log('\n💡 Check the error details above and:');
      console.log('   1. Verify your internet connection');
      console.log('   2. Check OpenRouter status at https://openrouter.ai/status');
      console.log('   3. Review backend logs for more details');
    }
    
    process.exit(1);
  }
}

// Run the test
testOpenRouterConfig().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
