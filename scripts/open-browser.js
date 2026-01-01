#!/usr/bin/env node

/**
 * Opens browser automatically after frontend starts
 * Usage: node scripts/open-browser.js [url]
 */

const { exec } = require('child_process');

const url = process.argv[2] || 'http://localhost:5173';
const delay = parseInt(process.argv[3]) || 5000; // Wait 5 seconds for server to start

console.log(`⏳ Waiting ${delay/1000}s for server to start...`);

setTimeout(() => {
  console.log(`🌐 Opening browser at ${url}...`);

  const platform = process.platform;
  let command;

  if (platform === 'darwin') {
    // macOS
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    // Windows
    command = `start "" "${url}"`;
  } else {
    // Linux
    command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`⚠️  Could not open browser automatically: ${error.message}`);
      console.log(`📝 Please open ${url} manually in your browser`);
    } else {
      console.log(`✅ Browser opened successfully!`);
    }
  });
}, delay);
