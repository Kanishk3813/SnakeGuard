/**
 * Local Cron Job Script for Processing Expired Assignment Requests
 * 
 * Run this script to periodically process expired requests
 * Usage: node scripts/process-expired-requests.js
 * 
 * Or use: npm run cron:expired (if added to package.json)
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const INTERVAL_MINUTES = 10; // Process every 10 minutes

async function processExpiredRequests() {
  try {
    const response = await fetch(`${BASE_URL}/api/responders/process-expired`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`[${new Date().toISOString()}] ✅ Processed expired requests:`, {
        processed: data.processed || 0,
        moved: data.moved || 0,
        failed: data.failed || 0,
      });
    } else {
      console.error(`[${new Date().toISOString()}] ❌ Error:`, data.error || data.message);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Failed to process expired requests:`, error.message);
  }
}

// Run immediately on start
console.log(`🚀 Starting expired requests processor (every ${INTERVAL_MINUTES} minutes)`);
processExpiredRequests();

// Then run every INTERVAL_MINUTES
setInterval(processExpiredRequests, INTERVAL_MINUTES * 60 * 1000);

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n👋 Stopping expired requests processor...');
  process.exit(0);
});




