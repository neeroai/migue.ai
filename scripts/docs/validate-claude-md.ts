#!/usr/bin/env tsx

/**
 * @file CLAUDE.md Validator
 * @description Validates CLAUDE.md files based on tier requirements
 * @module docs-global/scripts/docs/validate-claude-md
 * @exports validateClaudeMd (CLI)
 * @date 2026-02-02 16:00
 * @updated 2026-02-02 16:00
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { relative } from 'path';

// ============================================================================
// Types
// ============================================================================

interface FrontmatterData {
  title?: string;
  summary?: string;
  description?: string;
  version?: string;
  date?: string;
  updated?: string;
  tokens?: string;
  scope?: string;
}

interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  filePath: string;
  tier: 1 | 2 | 3;
  valid: boolean;
  errors: ValidationError[];
  frontmatter: FrontmatterData | null;
}

type Tier = 1 | 2 | 3;

// ============================================================================
// Configuration
// ============================================================================

const TIER_CONFIG = {
  1: {
    name: 'Critical',
    paths: ['.claude/CLAUDE.md', 'CLAUDE.md'],
    requiredFields: ['title', 'summary', 'description', 'version', 'date', 'updated'],
    requiredSections: ['WHAT/WHY/HOW', 'Overview', 'Commands', 'Structure'],
    maxTokens: 200,
    maxLines: 100,
    blocking: true,
  },
  2: {
    name: 'Global',
    paths: ['docs-global/CLAUDE.md', '/neero/CLAUDE.md'],
    requiredFields: ['title', 'summary', 'description', 'version', 'date', 'updated'],
    requiredSections: ['WHAT/WHY/HOW'],
    maxTokens: 400,
    maxLines: 200,
    blocking: false,
  },
  3: {
    name: 'Project',
    paths: [],
    requiredFields: ['title', 'date', 'updated'],
    requiredSections: [],
    maxTokens: 600,
    maxLines: 150,
    blocking: false,
  },
} as const;

const VALIDATION_RULES = {
  version: /^\d+\.\d+$/,
  date: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
  updated: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determines tier based on file path
 * @param filePath - Relative file path
 * @returns Tier number (1, 2, or 3)
 */
function determineTier(filePath: string): Tier {
  // Tier 1: Critical files
  for (const path of TIER_CONFIG[1].paths) {
    if (filePath.includes(path) || filePath.endsWith(path)) {
      return 1;
    }
  }

  // Tier 2: Global docs
  for (const path of TIER_CONFIG[2].paths) {
    if (filePath.includes(path) || filePath.endsWith(path)) {
      return 2;
    }
  }

  // Tier 3: Everything else
  return 3;
}

/**
 * Parses YAML frontmatter from markdown file
 * @param content - File content
 * @returns Parsed frontmatter or null
 */
function parseFrontmatter(content: string): FrontmatterData | null {
  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const data: FrontmatterData = {};

  const lines = yaml.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) continue;

    const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
    const cleanKey = key.trim();

    if (cleanKey === 'title') data.title = value;
    else if (cleanKey === 'summary') data.summary = value;
    else if (cleanKey === 'description') data.description = value;
    else if (cleanKey === 'version') data.version = value;
    else if (cleanKey === 'date') data.date = value;
    else if (cleanKey === 'updated') data.updated = value;
    else if (cleanKey === 'tokens') data.tokens = value;
    else if (cleanKey === 'scope') data.scope = value;
  }

  return data;
}

/**
 * Estimates token count (chars / 4)
 * @param content - File content
 * @returns Estimated token count
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/**
 * Extracts section headings from markdown
 * @param content - File content
 * @returns Array of section names
 */
function extractSections(content: string): string[] {
  const sections: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^##?\s+(.+)$/);
    if (match) {
      sections.push(match[1].trim());
    }
  }

  return sections;
}

/**
 * Extracts links from Navigation Map section
 * @param content - File content
 * @returns Array of file paths
 */
function extractNavigationMapLinks(content: string): string[] {
  const links: string[] = [];
  const navMapMatch = content.match(/##\s+Navigation\s+Map[\s\S]*?(?=\n##|$)/i);
  if (!navMapMatch) return links;

  const section = navMapMatch[0];
  const linkMatches = section.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

  for (const match of linkMatches) {
    const path = match[2];
    if (path.startsWith('http')) continue; // Skip external links
    links.push(path);
  }

  return links;
}

/**
 * Checks for emoji characters
 * @param content - File content
 * @returns True if emojis found
 */
function containsEmojis(content: string): boolean {
  // Unicode ranges for common emoji
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  return emojiRegex.test(content);
}

/**
 * Validates a single CLAUDE.md file
 * @param filePath - Absolute file path
 * @returns Validation result
 */
function validateFile(filePath: string): ValidationResult {
  const relativePath = relative(process.cwd(), filePath);
  const tier = determineTier(relativePath);
  const config = TIER_CONFIG[tier];
  const errors: ValidationError[] = [];

  // Read file
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const lineCount = lines.length;

  // Parse frontmatter
  const frontmatter = parseFrontmatter(content);

  // 1. Validate frontmatter exists
  if (!frontmatter) {
    errors.push({
      field: 'frontmatter',
      message: 'Missing YAML frontmatter',
      severity: config.blocking ? 'error' : 'warning',
    });
    return { filePath: relativePath, tier, valid: !config.blocking, errors, frontmatter: null };
  }

  // 2. Validate required fields
  for (const field of config.requiredFields) {
    if (!frontmatter[field as keyof FrontmatterData]) {
      errors.push({
        field,
        message: `Missing required field: ${field}`,
        severity: config.blocking ? 'error' : 'warning',
      });
    }
  }

  // 3. Validate field formats
  if (frontmatter.version && !VALIDATION_RULES.version.test(frontmatter.version)) {
    errors.push({
      field: 'version',
      message: `Invalid version format (expected X.Y, got ${frontmatter.version})`,
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  if (frontmatter.date && !VALIDATION_RULES.date.test(frontmatter.date)) {
    errors.push({
      field: 'date',
      message: `Invalid date format (expected YYYY-MM-DD HH:MM, got ${frontmatter.date})`,
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  if (frontmatter.updated && !VALIDATION_RULES.updated.test(frontmatter.updated)) {
    errors.push({
      field: 'updated',
      message: `Invalid updated format (expected YYYY-MM-DD HH:MM, got ${frontmatter.updated})`,
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  // 4. Validate token count
  const tokens = estimateTokens(content);
  if (tokens > config.maxTokens) {
    errors.push({
      field: 'tokens',
      message: `Exceeds ${config.maxTokens}t limit (${tokens}t) by ${tokens - config.maxTokens}t`,
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  // 5. Validate line count
  if (lineCount > config.maxLines) {
    errors.push({
      field: 'lines',
      message: `Exceeds ${config.maxLines} line limit (${lineCount} lines)`,
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  // 6. Validate required sections
  const sections = extractSections(content);
  for (const reqSection of config.requiredSections) {
    const found = sections.some(
      (s) => s.toLowerCase().includes(reqSection.toLowerCase()) || reqSection.toLowerCase().includes(s.toLowerCase())
    );
    if (!found) {
      errors.push({
        field: 'sections',
        message: `Missing required section: ${reqSection}`,
        severity: config.blocking ? 'error' : 'warning',
      });
    }
  }

  // 7. Validate Navigation Map links
  const navLinks = extractNavigationMapLinks(content);
  for (const link of navLinks) {
    const absolutePath = link.startsWith('/') ? link : `${process.cwd()}/${link}`;
    if (!existsSync(absolutePath)) {
      errors.push({
        field: 'navigation',
        message: `Broken link in Navigation Map: ${link}`,
        severity: config.blocking ? 'error' : 'warning',
      });
    }
  }

  // 8. Check for emojis
  if (containsEmojis(content)) {
    errors.push({
      field: 'content',
      message: 'Contains emoji characters (use plain text instead)',
      severity: config.blocking ? 'error' : 'warning',
    });
  }

  const valid = errors.every((e) => e.severity === 'warning') || !config.blocking;

  return { filePath: relativePath, tier, valid, errors, frontmatter };
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  console.log('Validating CLAUDE.md files...\n');

  // Get staged CLAUDE.md files
  let stagedFiles: string[] = [];
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
    });
    stagedFiles = output
      .split('\n')
      .filter((f) => f.trim())
      .filter((f) => f.endsWith('CLAUDE.md'));
  } catch (error) {
    console.log('ℹ️  Not in a git repository - checking for CLAUDE.md in current directory');
    if (existsSync('CLAUDE.md')) {
      stagedFiles = ['CLAUDE.md'];
    }
  }

  if (stagedFiles.length === 0) {
    console.log('ℹ️  No CLAUDE.md files to validate');
    process.exit(0);
  }

  console.log(`Found ${stagedFiles.length} CLAUDE.md file(s) to validate\n`);

  const results: ValidationResult[] = [];
  let hasBlockingErrors = false;

  for (const file of stagedFiles) {
    const result = validateFile(file);
    results.push(result);

    const tierName = TIER_CONFIG[result.tier].name;
    console.log(`${result.valid ? 'CHECK' : 'ERROR'} ${file} (Tier ${result.tier}: ${tierName})`);

    if (result.errors.length > 0) {
      for (const error of result.errors) {
        const prefix = error.severity === 'error' ? 'ERROR' : 'WARNING';
        console.log(`  ${prefix} [${error.field}] ${error.message}`);
      }
      console.log();
    }

    if (!result.valid && TIER_CONFIG[result.tier].blocking) {
      hasBlockingErrors = true;
    }
  }

  // Summary
  const totalErrors = results.reduce((sum, r) => sum + r.errors.filter((e) => e.severity === 'error').length, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.errors.filter((e) => e.severity === 'warning').length, 0);

  console.log('---');
  console.log(`Validation complete: ${results.filter((r) => r.valid).length}/${results.length} passed`);
  if (totalErrors > 0) console.log(`ERROR: ${totalErrors} error(s)`);
  if (totalWarnings > 0) console.log(`WARNING: ${totalWarnings} warning(s)`);

  if (hasBlockingErrors) {
    console.log('\nBLOCKING: Fix errors in Tier 1 files before committing');
    process.exit(1);
  }

  console.log('\nCHECK All validations passed');
  process.exit(0);
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  process.exit(1);
});
