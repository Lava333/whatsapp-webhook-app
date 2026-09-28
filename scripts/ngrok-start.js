/**
 * tunnel-start.js
 * Starts a Cloudflare Quick Tunnel (100% free, no signup, no IP verification).
 * Parses the public URL from cloudflared output and prints it.
 *
 * Usage:  npm run ngrok
 */
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

const PORT         = parseInt(process.env.PORT || '3001', 10);
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'my_webhook_verify_token';

// cloudflared.exe lives in the project root
const CLOUDFLARED  = path.join(__dirname, '..', 'cloudflared.exe');

// ── Pretty box printer ────────────────────────────────────────────
function printBox(lines) {
  const max = Math.max(...lines.map(l => l.length));
  const bar = '═'.repeat(max + 4);
  console.log(`\n╔${bar}╗`);
  lines.forEach(l => console.log(`║  ${l.padEnd(max)}  ║`));
  console.log(`╚${bar}╝\n`);
}

// ── Main ──────────────────────────────────────────────────────────
function main() {
  console.log(`[tunnel] Starting Cloudflare tunnel to http://localhost:${PORT}...`);
  console.log('[tunnel] Waiting for URL (takes ~5 seconds)...\n');

  const proc = spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let urlFound = false;

  // cloudflared prints the URL to stderr
  function handleOutput(data) {
    const text = data.toString();

    // Extract the trycloudflare.com URL
    const match = text.match(/https:\/\/[a-z0-9\-]+\.trycloudflare\.com/);
    if (match && !urlFound) {
      urlFound = true;
      const url        = match[0];
      const webhookUrl = `${url}/whatsapp/webhook`;

      printBox([
        '🚀  Cloudflare Tunnel Active!',
        '',
        `  Public URL  : ${url}`,
        `  Webhook URL : ${webhookUrl}`,
        '',
        '  📋  Paste these into Meta for Developers:',
        `  Callback URL →  ${webhookUrl}`,
        `  Verify Token →  ${VERIFY_TOKEN}`,
        '',
        '  ✅  No IP verification needed — works immediately!',
        '  Press Ctrl+C to stop the tunnel.',
      ]);
    }

    // Show any errors
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
      console.error('[cloudflared]', text.trim());
    }
  }

  proc.stdout.on('data', handleOutput);
  proc.stderr.on('data', handleOutput);

  proc.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('\n❌ cloudflared.exe not found!');
      console.error('   Run this to download it:');
      console.error('   Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"\n');
    } else {
      console.error('\n❌ Tunnel error:', err.message);
    }
    process.exit(1);
  });

  proc.on('close', (code) => {
    console.log(`\n[tunnel] Cloudflare tunnel closed (code ${code}).`);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('\n[tunnel] Stopping tunnel...');
    proc.kill();
  });
}

main();
