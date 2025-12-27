const fs = require('fs');
const path = require('path');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function generateReadme(changelog) {
  const recent = changelog.trim().split('\n').slice(0, 200).join('\n');
  return `# Autozynq\n\nA Next.js app with Prisma + NextAuth (GitHub/Google), Tailwind v3, and shadcn-style components.\n\n## Overview\n- Foundation: Next.js 15.5.9 (App Router), Prisma v5, NextAuth v4\n- Database: Neon PostgreSQL\n- UI: Tailwind v3, Radix UI wrappers, lucide-react icons\n- Theme: next-themes with global ThemeProvider\n\n## Setup\n1. Install dependencies:\n   \`\`\`bash\n   npm install\n   \`\`\`\n2. Configure environment:\n   - .env / .env.local: DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GitHub/Google OAuth keys\n3. Generate Prisma client:\n   \`\`\`bash\n   npx prisma generate\n   \`\`\`\n4. Run dev server:\n   \`\`\`bash\n   npm run dev\n   \`\`\`\n\n## Auth\n- Providers: GitHub + Google\n- Persistence: Database session strategy via Prisma Adapter\n- Prisma models include User.emailVerified and VerificationToken\n\n## UI\n- Components: Button, Tooltip, Dropdown Menu wrappers\n- Navbar with centered links; Sidebar with tooltips; ModeToggle at bottom\n\n## Known Issues & Resolutions\n- Prisma v7 adapter runtime: Downgraded to Prisma v5 and standard client\n- Tailwind v4 PostCSS error: Moved to Tailwind v3; fixed globals.css\n- NextAuth account linking: Enabled, added missing models & DB sessions\n- Route layout error: Added valid default export for (main)/layout\n\n## Recent Changes\nThis section is auto-generated from docs/CHANGELOG.md by scripts/post-commit.js.\n\n${recent}\n`; 
}

(function main(){
  const root = process.cwd();
  const changelogPath = path.join(root, 'docs', 'CHANGELOG.md');
  const readmePath = path.join(root, 'README.md');
  const changelog = readFileSafe(changelogPath) || '# Changelog\n';
  const content = generateReadme(changelog);
  fs.writeFileSync(readmePath, content, 'utf8');
  console.log('README.md updated from docs/CHANGELOG.md');
})();
