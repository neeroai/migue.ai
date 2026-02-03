#!/usr/bin/env tsx

/**
 * @file CLAUDE.md Generator
 * @description Auto-generates sections in CLAUDE.md from code analysis
 * @module docs-global/scripts/docs/generate-claude-md
 * @exports generateClaudeMd (CLI)
 * @date 2026-02-02 16:00
 * @updated 2026-02-02 16:00
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { basename, dirname, join, relative } from 'path';

// ============================================================================
// Types
// ============================================================================

interface GeneratedSections {
  moduleIndex: string;
  techStack: string;
  commands: string;
  structure: string;
  envVars: string;
}

interface FrontmatterData {
  title?: string;
  summary?: string;
  description?: string;
  version?: string;
  date?: string;
  updated?: string;
  tokens?: string;
  [key: string]: string | undefined;
}

interface CLAUDEContent {
  frontmatter: FrontmatterData;
  manualSections: Map<string, string>;
  autoSections: Map<string, string>;
}

interface ModuleInfo {
  name: string;
  purpose: string;
  exports: string;
}

// ============================================================================
// Configuration
// ============================================================================

const MANUAL_SECTIONS = [
  'WHAT/WHY/HOW',
  'P0 Features',
  'Current Work',
  'Critical Constraints',
  'Architecture Decisions',
  'Standards',
  'Overview',
  'Philosophy',
  'Patterns',
];

const AUTO_SECTIONS = [
  'Module Index',
  'Tech Stack',
  'Stack',
  'Commands',
  'Structure',
  'File Structure',
  'Environment Variables',
  'Env Vars',
];

// ============================================================================
// Module Index Generation
// ============================================================================

/**
 * Generates Module Index from lib/ structure
 * @param projectPath - Project root path
 * @returns Module Index markdown
 */
async function generateModuleIndex(projectPath: string): Promise<string> {
  const libPath = join(projectPath, 'lib');
  if (!existsSync(libPath)) {
    return '## Module Index\n\nNo lib/ directory found\n';
  }

  const modules: ModuleInfo[] = [];

  // Get all subdirectories in lib/
  const entries = readdirSync(libPath);
  for (const entry of entries) {
    const fullPath = join(libPath, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (entry.startsWith('__')) continue; // Skip __tests__, etc.

    const module = await analyzeModule(fullPath);
    if (module) modules.push(module);
  }

  if (modules.length === 0) {
    return '## Module Index\n\nNo modules found in lib/\n';
  }

  let content = '## Module Index\n\n| Module | Purpose | Key Exports |\n|---|---|---|\n';

  for (const module of modules) {
    content += `| ${module.name}/ | ${module.purpose} | ${module.exports} |\n`;
  }

  return content;
}

/**
 * Analyzes a single module directory
 * @param modulePath - Module directory path
 * @returns Module info
 */
async function analyzeModule(modulePath: string): Promise<ModuleInfo | null> {
  const name = basename(modulePath);
  let purpose = '';
  let exports = '';

  // Try to read CLAUDE.md or INDEX.md
  const claudePath = join(modulePath, 'CLAUDE.md');
  const indexPath = join(modulePath, 'INDEX.md');

  if (existsSync(claudePath)) {
    const content = readFileSync(claudePath, 'utf-8');
    purpose = extractPurpose(content);
    exports = extractExports(content);
  } else if (existsSync(indexPath)) {
    const content = readFileSync(indexPath, 'utf-8');
    purpose = extractPurpose(content);
    exports = extractExports(content);
  }

  // Fallback: read index.ts @file header
  if (!purpose) {
    const indexTs = join(modulePath, 'index.ts');
    if (existsSync(indexTs)) {
      const content = readFileSync(indexTs, 'utf-8');
      const descMatch = content.match(/@description\s+([^\n*]+)/);
      if (descMatch) purpose = descMatch[1].trim();

      const exportsMatch = content.match(/@exports\s+([^\n*]+)/);
      if (exportsMatch) exports = exportsMatch[1].trim();
    }
  }

  if (!purpose) purpose = 'No description';
  if (!exports) exports = 'See index.ts';

  return { name, purpose, exports };
}

/**
 * Extracts purpose from markdown
 * @param content - File content
 * @returns Purpose description
 */
function extractPurpose(content: string): string {
  // Try frontmatter description
  const frontmatterMatch = content.match(/description:\s*["']?([^"'\n]+)["']?/);
  if (frontmatterMatch) return frontmatterMatch[1].trim();

  // Try "Purpose:" line
  const purposeMatch = content.match(/Purpose:\s*([^\n]+)/i);
  if (purposeMatch) return purposeMatch[1].trim();

  return '';
}

/**
 * Extracts exports from markdown
 * @param content - File content
 * @returns Exports list
 */
function extractExports(content: string): string {
  // Try "Exports:" section
  const exportsMatch = content.match(/Exports?:\s*([^\n]+)/i);
  if (exportsMatch) return exportsMatch[1].trim();

  // Try bullet list after "Exports"
  const listMatch = content.match(/Exports?:\s*\n((?:[-*]\s+[^\n]+\n?)+)/i);
  if (listMatch) {
    const items = listMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*]\s+/, '').trim())
      .filter((line) => line);
    return items.join(', ');
  }

  return '';
}

// ============================================================================
// Tech Stack Generation
// ============================================================================

/**
 * Generates Tech Stack from package.json
 * @param projectPath - Project root path
 * @returns Tech Stack markdown
 */
async function generateTechStack(projectPath: string): Promise<string> {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return '**Stack:** No package.json found\n';
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };

  const stack: string[] = [];

  // Map key dependencies
  if (deps.next) stack.push(`Next.js ${deps.next.replace(/^[\^~]/, '')}`);
  if (deps.react) stack.push(`React ${deps.react.replace(/^[\^~]/, '')}`);
  if (deps.typescript) stack.push(`TypeScript ${deps.typescript.replace(/^[\^~]/, '')}`);
  if (deps['@supabase/supabase-js']) stack.push(`Supabase ${deps['@supabase/supabase-js'].replace(/^[\^~]/, '')}`);
  if (deps['@ai-sdk/anthropic']) stack.push('AI SDK');
  if (deps.zod) stack.push('Zod');
  if (deps['tailwindcss']) stack.push('Tailwind CSS');

  if (stack.length === 0) {
    return '**Stack:** See package.json\n';
  }

  return `**Stack:** ${stack.join(' • ')}\n`;
}

// ============================================================================
// Commands Generation
// ============================================================================

/**
 * Generates Commands table from package.json scripts
 * @param projectPath - Project root path
 * @returns Commands markdown
 */
async function generateCommands(projectPath: string): Promise<string> {
  const pkgPath = join(projectPath, 'package.json');
  if (!existsSync(pkgPath)) {
    return '## Commands\n\nNo package.json found\n';
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const scripts = pkg.scripts || {};

  // Filter out internal scripts
  const userScripts = Object.entries(scripts).filter(
    ([name]) => !name.startsWith('docs:') && name !== 'prepare' && !name.startsWith('post')
  );

  if (userScripts.length === 0) {
    return '## Commands\n\nNo user scripts found\n';
  }

  let content = '## Commands\n\n| Command | Description |\n|---|---|\n';

  for (const [name, script] of userScripts) {
    const description = inferDescription(name, script as string);
    content += `| \`${name}\` | ${description} |\n`;
  }

  return content;
}

/**
 * Infers description from script name and command
 * @param name - Script name
 * @param script - Script command
 * @returns Human-readable description
 */
function inferDescription(name: string, script: string): string {
  if (name === 'dev') return 'Start development server';
  if (name === 'build') return 'Build for production';
  if (name === 'start') return 'Start production server';
  if (name === 'test') return 'Run tests';
  if (name === 'lint') return 'Lint code';
  if (name === 'format') return 'Format code';
  if (name === 'type-check') return 'Check TypeScript types';
  if (name.includes('deploy')) return 'Deploy application';

  // Fallback: use script command
  return `\`${script}\``;
}

// ============================================================================
// File Structure Generation
// ============================================================================

/**
 * Generates File Structure tree
 * @param projectPath - Project root path
 * @returns Structure markdown
 */
async function generateStructure(projectPath: string): Promise<string> {
  let content = '## Structure\n\n```\n';

  const tree = generateTree(projectPath, '', 0);
  content += tree;
  content += '```\n';

  return content;
}

/**
 * Recursively generates directory tree
 * @param dirPath - Directory path
 * @param prefix - Tree prefix
 * @param depth - Current depth
 * @returns Tree string
 */
function generateTree(dirPath: string, prefix: string, depth: number): string {
  if (depth > 2) return ''; // Limit depth to 2 levels

  const ignore = ['node_modules', '.next', 'dist', 'build', '.git', '.claude', 'coverage'];
  let tree = '';

  try {
    const entries = readdirSync(dirPath);
    const filtered = entries.filter((entry) => !ignore.includes(entry) && !entry.startsWith('.'));

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      const fullPath = join(dirPath, entry);
      const isLast = i === filtered.length - 1;
      const connector = isLast ? '└── ' : '├── ';

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          tree += `${prefix}${connector}${entry}/\n`;

          const newPrefix = prefix + (isLast ? '    ' : '│   ');
          tree += generateTree(fullPath, newPrefix, depth + 1);
        } else {
          tree += `${prefix}${connector}${entry}\n`;
        }
      } catch (error) {
        // Skip files we can't stat
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return tree;
}

// ============================================================================
// Environment Variables Generation
// ============================================================================

/**
 * Generates Environment Variables from .env.example
 * @param projectPath - Project root path
 * @returns Env Vars markdown
 */
async function generateEnvVars(projectPath: string): Promise<string> {
  const envPath = join(projectPath, '.env.example');
  if (!existsSync(envPath)) {
    return '## Environment Variables\n\nNo .env.example found\n';
  }

  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');

  let markdown = '## Environment Variables\n\n| Variable | Description |\n|---|---|\n';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [varName, ...valueParts] = trimmed.split('=');
    if (!varName) continue;

    const comment = valueParts.join('=');
    const description = comment || 'See .env.example';

    markdown += `| \`${varName.trim()}\` | ${description} |\n`;
  }

  return markdown;
}

// ============================================================================
// CLAUDE.md Parsing & Merging
// ============================================================================

/**
 * Parses existing CLAUDE.md
 * @param claudePath - CLAUDE.md file path
 * @returns Parsed content
 */
function parseCLAUDEmd(claudePath: string): CLAUDEContent {
  const content = readFileSync(claudePath, 'utf-8');

  // Parse frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  const frontmatter: FrontmatterData = {};

  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    const lines = yaml.split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (!key || !valueParts.length) continue;

      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      frontmatter[key.trim()] = value;
    }
  }

  // Extract content after frontmatter
  const contentAfterFrontmatter = content.replace(/^---\n[\s\S]+?\n---\n+/, '');

  // Parse sections
  const manualSections = new Map<string, string>();
  const autoSections = new Map<string, string>();

  // Split by ## headers
  const sections = contentAfterFrontmatter.split(/\n(?=##\s+)/);

  for (const section of sections) {
    if (!section.trim()) continue;

    const headerMatch = section.match(/^##\s+(.+?)$/m);
    if (!headerMatch) {
      // Content before first header (if any)
      continue;
    }

    const sectionName = headerMatch[1].trim();
    const sectionContent = section.substring(headerMatch[0].length).trim();

    const isAuto = AUTO_SECTIONS.some((auto) =>
      sectionName.toLowerCase().includes(auto.toLowerCase()) ||
      auto.toLowerCase().includes(sectionName.toLowerCase())
    );

    if (isAuto) {
      autoSections.set(sectionName, sectionContent);
    } else {
      manualSections.set(sectionName, `## ${sectionName}\n\n${sectionContent}`);
    }
  }

  return { frontmatter, manualSections, autoSections };
}

/**
 * Merges manual sections with generated sections
 * @param existing - Existing CLAUDE content
 * @param generated - Generated sections
 * @returns Updated CLAUDE.md content
 */
function mergeCLAUDEmd(existing: CLAUDEContent, generated: GeneratedSections): string {
  // Update frontmatter
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  existing.frontmatter.updated = timestamp;

  // Increment version if exists and is valid
  if (existing.frontmatter.version && /^\d+\.\d+$/.test(existing.frontmatter.version)) {
    const [major, minor] = existing.frontmatter.version.split('.').map(Number);
    existing.frontmatter.version = `${major}.${minor + 1}`;
  }

  // Build content - Start with frontmatter if it has fields
  let content = '';

  if (Object.keys(existing.frontmatter).length > 0) {
    content += '---\n';
    for (const [key, value] of Object.entries(existing.frontmatter)) {
      if (value !== undefined && value !== '') {
        content += `${key}: "${value}"\n`;
      }
    }
    content += '---\n\n';
  }

  // Add manual sections first (already have ## headers)
  for (const sectionContent of existing.manualSections.values()) {
    content += `${sectionContent}\n\n---\n\n`;
  }

  // Add separator before auto-generated sections
  if (existing.manualSections.size > 0) {
    content += '## Auto-Generated Sections\n\n';
    content += '_These sections are auto-generated. Run `/claude-md-refresh` to update._\n\n';
  }

  // Add generated sections
  content += generated.moduleIndex + '\n\n';
  content += generated.techStack + '\n';
  content += generated.commands + '\n\n';
  content += generated.structure + '\n\n';
  content += generated.envVars + '\n\n';

  // Calculate tokens and update frontmatter
  const tokens = Math.ceil(content.length / 4);

  // Update tokens in frontmatter if it exists
  if (content.startsWith('---\n')) {
    content = content.replace(/tokens: "[^"]*"/, `tokens: "~${tokens}"`);
    // If tokens field doesn't exist, add it
    if (!/tokens:/.test(content)) {
      content = content.replace(/^(---\n[\s\S]*?)\n---/, `$1\ntokens: "~${tokens}"\n---`);
    }
  }

  return content;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const projectPath = process.cwd();
  const claudePath = join(projectPath, 'CLAUDE.md');

  console.log('Refreshing CLAUDE.md...\n');

  // Check if CLAUDE.md exists
  if (!existsSync(claudePath)) {
    console.error('ERROR: CLAUDE.md not found in current directory');
    process.exit(1);
  }

  // Parse existing
  console.log('1/3 Parsing existing CLAUDE.md...');
  const existing = parseCLAUDEmd(claudePath);

  // Generate new sections
  console.log('2/3 Generating auto sections...');
  const generated: GeneratedSections = {
    moduleIndex: await generateModuleIndex(projectPath),
    techStack: await generateTechStack(projectPath),
    commands: await generateCommands(projectPath),
    structure: await generateStructure(projectPath),
    envVars: await generateEnvVars(projectPath),
  };

  // Merge
  console.log('3/3 Merging and updating metadata...');
  const updated = mergeCLAUDEmd(existing, generated);

  // Write
  writeFileSync(claudePath, updated);

  // Report changes
  const oldTokens = existing.frontmatter.tokens?.replace(/[~,]/g, '') || '0';
  const newMatch = updated.match(/tokens: "~(\d+)"/);
  const newTokens = newMatch ? newMatch[1] : '0';

  console.log('\nCHECK CLAUDE.md updated successfully');
  console.log(`- Version: ${existing.frontmatter.version} → ${existing.frontmatter.version?.split('.').map((n, i) => i === 1 ? String(Number(n) + 1) : n).join('.')}`);
  console.log(`- Tokens: ${oldTokens}t → ${newTokens}t`);
  console.log(`- Updated: ${existing.frontmatter.updated}`);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});
