const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function appendChangeLogEntry(message) {
  const root = process.cwd();
  const changelogPath = path.join(root, 'docs', 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0,10);
  const entry = `\n## ${date} — Commit\n- ${message.trim().replace(/\n/g, '\n- ')}\n`;
  fs.appendFileSync(changelogPath, entry, 'utf8');
}

(function main(){
  try {
    const out = execSync('git log -1 --pretty=format:%s\n%b', { encoding: 'utf8' });
    const message = out.trim() || 'Update';
    appendChangeLogEntry(message);
  } catch (e) {
    console.warn('Could not read last commit message:', e.message);
  }
  try {
    require('./update-readme');
  } catch (e) {
    console.error('Failed to update README:', e.message);
    process.exitCode = 1;
  }
})();
