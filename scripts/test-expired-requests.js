/**
 * One-time test script to process expired requests
 * Run: node scripts/test-expired-requests.js
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

async function test() {
  console.log('Testing expired requests processing...');
  console.log(`Calling: ${BASE_URL}/api/responders/process-expired`);
  
  try {
    const response = await fetch(`${BASE_URL}/api/responders/process-expired`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    console.log('\n📊 Response:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('\n✅ Success!');
    } else {
      console.log('\n❌ Error occurred');
    }
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
  }
}

test();




