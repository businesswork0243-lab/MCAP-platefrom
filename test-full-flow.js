const axios = require('axios');

const API_URL = 'https://mcap-api.onrender.com';
const AI_URL = 'https://mcap-ai-engine.onrender.com';

// ⚠️ Ye token frontend se copy karo (localStorage → accessToken)
const TOKEN = 'YOUR_JWT_TOKEN_HERE';

async function main() {
    console.log('🔍 M-CAP Full Flow Test\n');
    console.log('═'.repeat(60));

    // Test 1: API Health
    console.log('\n1️⃣  API Health');
    try {
        const r = await axios.get(`${API_URL}/health`);
        console.log('   ✅', r.data);
    } catch (e) {
        console.log('   ❌', e.message);
        return;
    }

    // Test 2: AI Engine Health
    console.log('\n2️⃣  AI Engine Health');
    try {
        const r = await axios.get(`${AI_URL}/health`, { timeout: 60000 });
        console.log('   ✅', r.data);
    } catch (e) {
        console.log('   ❌', e.message);
    }

    if (!TOKEN || TOKEN === 'YOUR_JWT_TOKEN_HERE') {
        console.log('\n⚠️  TOKEN not set. Skipping auth tests.');
        console.log('   Get token from browser: localStorage.getItem("accessToken")');
        return;
    }

    const headers = { Authorization: `Bearer ${TOKEN}` };

    // Test 3: Create Content
    console.log('\n3️⃣  Create Content Request');
    let contentId;
    try {
        const r = await axios.post(
            `${API_URL}/api/content/generate`,
            {
                topic: 'Test content ' + Date.now(),
                objective: 'Educate',
                audience: 'Developers',
                platforms: ['linkedin_post'],
                writing_structure: 'thesis',
                perspective: 'Founder',
                humanizationEnabled: false,
                qaEnabled: false,
            },
            { headers }
        );
        contentId = r.data.requestId || r.data.contentId;
        console.log('   ✅ Created:', contentId);
    } catch (e) {
        console.log('   ❌', e.response?.data || e.message);
        return;
    }

    // Test 4: Poll Status
    console.log('\n4️⃣  Polling status (30 seconds)...');
    for (let i = 1; i <= 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        try {
            const r = await axios.get(
                `${API_URL}/api/content/jobs/${contentId}`,
                { headers }
            );
            const status = r.data.request?.status;
            const agents = r.data.executions?.length || 0;
            console.log(`   Poll ${i}: status=${status}, agents=${agents}`);

            if (status === 'completed' || status === 'awaiting_review') {
                console.log('   ✅ COMPLETED!');
                break;
            }
            if (status === 'failed' || status === 'generation_failed') {
                console.log('   ❌ FAILED:', r.data.request?.error_message);
                break;
            }
        } catch (e) {
            console.log(`   ⚠️  Poll ${i} error:`, e.message);
        }
    }

    // Test 5: Get Artifacts
    console.log('\n5️⃣  Fetching artifacts');
    try {
        const r = await axios.get(
            `${API_URL}/api/content/${contentId}/artifacts`,
            { headers }
        );
        console.log('   Artifacts:', r.data.artifacts?.length || 0);
        if (r.data.artifacts?.[0]) {
            const first = r.data.artifacts[0];
            console.log('   First artifact:');
            console.log('     platform:', first.platform);
            console.log('     type:', first.content_type);
            console.log('     preview:', first.body?.slice(0, 100) + '...');
        }
    } catch (e) {
        console.log('   ❌', e.message);
    }
}

main();