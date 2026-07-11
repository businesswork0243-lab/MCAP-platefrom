const axios = require('axios');

const AI_URL = 'https://mcap-ai-engine.onrender.com';

async function main() {
  console.log('🔍 Testing AI Engine\n');

  // Test 1: Health
  console.log('1. Health check...');
  try {
    const r = await axios.get(`${AI_URL}/health`, { timeout: 60000 });
    console.log('   ✅', r.data);
  } catch (e) {
    console.log('   ❌', e.message);
    return;
  }

  // Test 2: Simple pipeline
  console.log('\n2. Full pipeline test...');
  try {
    const start = Date.now();
    const r = await axios.post(
      `${AI_URL}/pipeline/run`,
      {
        topic: 'What is blockchain',
        objective: 'Educate',
        audience: 'Tech beginners',
        perspective: 'Educator',
        writing_structure: 'thesis',
        targetPlatforms: ['linkedin_post'],
        enableHumanization: false,
        enableQA: false,
        language: 'English',
      },
      { timeout: 180000 }
    );
    const dur = Date.now() - start;
    console.log(`   ✅ Success (${dur}ms)`);
    console.log(`   Tokens: ${r.data.totalTokensUsed}`);
    console.log(`   Content preview: ${r.data.canonicalDraft?.slice(0, 150)}...`);
  } catch (e) {
    console.log('   ❌ Failed:', e.message);
    if (e.response) {
      console.log('   Response:', e.response.data);
    }
  }
}

main();
