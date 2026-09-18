import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'config.json');

const token = process.env.ORB_API_TOKEN || process.argv[2];

if (!token) {
  console.error('Usage: ORB_API_TOKEN=your_token node scripts/set-orb-token.js');
  console.error('Or: node scripts/set-orb-token.js "your_token"');
  process.exit(1);
}

const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);
config.orb = config.orb || {};
config.orb.apiToken = token;
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log(`Saved Orb API token into ${configPath}`);
console.log(`Token length: ${token.length}`);
