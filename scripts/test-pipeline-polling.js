/**
 * Test script for pipeline polling endpoint
 * Usage: npm run test:poll
 */

const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

const options = {
  hostname: HOST,
  port: PORT,
  path: '/api/detections/poll',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  },
};

console.log('🧪 Testing Pipeline Polling on Localhost\n');
console.log(`📡 Calling: http://${HOST}:${PORT}/api/detections/poll\n`);

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (res.statusCode === 200) {
        console.log('✅ Polling completed!\n');
        console.log('Results:');
        console.log(`  - Success: ${response.success}`);
        console.log(`  - Processed: ${response.processed}`);
        console.log(`  - Failed: ${response.failed}`);
        console.log(`  - Message: ${response.message}\n`);

        if (response.detections && response.detections.length > 0) {
          console.log('Detections processed:');
          response.detections.forEach((detection) => {
            const statusColor = detection.status === 'success' ? '✓' : '✗';
            console.log(`  ${statusColor} ID: ${detection.id} | Status: ${detection.status}`);
            if (detection.error) {
              console.log(`    Error: ${detection.error}`);
            }
          });
          console.log('');
        }

        if (response.errors && response.errors.length > 0) {
          console.log('⚠️  Errors:');
          response.errors.forEach((error) => {
            console.log(`  - ${error}`);
          });
          console.log('');
        }
      } else {
        console.log(`❌ Error: HTTP ${res.statusCode}`);
        console.log('Response:', data);
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.log('\n❌ Error:', error.message);
  console.log('\nMake sure:');
  console.log('  1. Your dev server is running on http://localhost:3000');
  console.log('  2. You\'ve started it with: npm run dev\n');
});

req.end();









