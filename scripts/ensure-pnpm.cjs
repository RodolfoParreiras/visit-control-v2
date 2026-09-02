const fs = require('node:fs');

for (const file of ['package-lock.json', 'yarn.lock']) {
  try { fs.rmSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

if (!String(process.env.npm_config_user_agent || '').startsWith('pnpm/')) {
  console.error('Use pnpm instead');
  process.exit(1);
}
