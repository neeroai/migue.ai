#!/usr/bin/env node

/**
 * Pre-Deploy Verification Script
 * Validates project state before deployment to Vercel
 *
 * Usage: npm run verify-deploy
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let errors = 0;
let warnings = 0;

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function error(message) {
  log(`❌ ${message}`, 'red');
  errors++;
}

function warn(message) {
  log(`⚠️  ${message}`, 'yellow');
  warnings++;
}

function info(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function section(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(title, 'blue');
  log('='.repeat(60), 'blue');
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (err) {
    if (!options.allowError) {
      throw err;
    }
    return null;
  }
}

// 1. Git Status Check
function checkGitStatus() {
  section('1. Git Status Verification');

  try {
    const status = exec('git status --porcelain', { silent: true });

    if (status && status.trim()) {
      error('Uncommitted changes detected:');
      console.log(status);
      error('Please commit or stash all changes before deploying');
    } else {
      success('Git working directory is clean');
    }

    // Check if on main branch
    const branch = exec('git rev-parse --abbrev-ref HEAD', { silent: true }).trim();
    if (branch !== 'main') {
      warn(`Currently on branch '${branch}', not 'main'`);
      info('Consider merging to main before deploying');
    } else {
      success('On main branch');
    }

    // Check if ahead of remote
    const ahead = exec('git rev-list @{u}..HEAD 2>/dev/null', { silent: true, allowError: true });
    if (ahead && ahead.trim()) {
      warn('Local commits not pushed to remote');
      info('Run: git push origin main');
    } else {
      success('Local branch is up to date with remote');
    }
  } catch (err) {
    error(`Git check failed: ${err.message}`);
  }
}

// 2. TypeScript Type Check
function checkTypes() {
  section('2. TypeScript Type Check');

  try {
    exec('npm run typecheck');
    success('TypeScript type check passed');
  } catch (err) {
    error('TypeScript type check failed');
  }
}

// 3. Build Validation
function checkBuild() {
  section('3. Build Validation');

  try {
    exec('npm run build');
    success('Next.js build successful');
  } catch (err) {
    error('Next.js build failed');
  }
}

// 4. Unit Tests
function checkTests() {
  section('4. Unit Tests');

  try {
    exec('npm run test:unit');
    success('All unit tests passed');
  } catch (err) {
    error('Unit tests failed');
  }
}

// 5. Environment Variables
function checkEnvVars() {
  section('5. Environment Variables');

  const envExample = join(ROOT_DIR, '.env.example');
  const envLocal = join(ROOT_DIR, '.env.local');

  if (!existsSync(envExample)) {
    error('.env.example not found');
  } else {
    success('.env.example exists');
  }

  if (!existsSync(envLocal)) {
    warn('.env.local not found (OK if in CI)');
  } else {
    success('.env.local exists');

    // Check that .env.example has all keys from .env.local
    try {
      const exampleVars = readFileSync(envExample, 'utf8')
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0]);

      const localVars = readFileSync(envLocal, 'utf8')
        .split('\n')
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('=')[0]);

      const missing = localVars.filter(v => !exampleVars.includes(v));

      if (missing.length > 0) {
        warn(`Missing in .env.example: ${missing.join(', ')}`);
      } else {
        success('All env vars documented in .env.example');
      }
    } catch (err) {
      warn(`Could not validate env vars: ${err.message}`);
    }
  }
}

// 6. Vercel Configuration
function checkVercelConfig() {
  section('6. Vercel Configuration');

  const vercelJson = join(ROOT_DIR, 'vercel.json');

  if (!existsSync(vercelJson)) {
    warn('vercel.json not found');
    return;
  }

  success('vercel.json exists');

  try {
    const config = JSON.parse(readFileSync(vercelJson, 'utf8'));

    // Check for functions.runtime (should not exist)
    if (config.functions && Object.values(config.functions).some(f => f.runtime)) {
      warn('Found runtime in functions config - Vercel auto-detects Edge from route exports');
    }

    // Check for crons
    if (config.crons && config.crons.length > 0) {
      success(`${config.crons.length} cron job(s) configured`);
    }

    success('vercel.json is valid JSON');
  } catch (err) {
    error(`vercel.json parse error: ${err.message}`);
  }
}

// 7. Edge Runtime Exports
function checkEdgeExports() {
  section('7. Edge Runtime Exports');

  try {
    const routes = exec('find app/api -name "route.ts" -type f 2>/dev/null || echo ""', {
      silent: true,
      allowError: true,
    });

    if (!routes || !routes.trim()) {
      info('No API routes found (OK if frontend-only)');
      return;
    }

    const routeFiles = routes.trim().split('\n');
    let missingRuntime = [];

    for (const file of routeFiles) {
      const content = readFileSync(join(ROOT_DIR, file), 'utf8');
      if (!content.includes("export const runtime = 'edge'")) {
        missingRuntime.push(file);
      }
    }

    if (missingRuntime.length > 0) {
      error('Routes missing Edge Runtime export:');
      missingRuntime.forEach(f => console.log(`  - ${f}`));
    } else {
      success(`All ${routeFiles.length} API routes have Edge Runtime export`);
    }
  } catch (err) {
    warn(`Could not check Edge exports: ${err.message}`);
  }
}

// 8. Dependencies
function checkDependencies() {
  section('8. Dependencies');

  try {
    const audit = exec('npm audit --audit-level=high --json', {
      silent: true,
      allowError: true,
    });

    if (audit) {
      const result = JSON.parse(audit);
      const vulnCount = result.metadata?.vulnerabilities?.high || 0;

      if (vulnCount > 0) {
        warn(`${vulnCount} high severity vulnerabilities found`);
        info('Run: npm audit fix');
      } else {
        success('No high severity vulnerabilities');
      }
    }
  } catch (err) {
    info('Skipping dependency audit (npm audit not available)');
  }
}

// Main execution
async function main() {
  log('\n🚀 Pre-Deploy Verification Starting...\n', 'cyan');

  checkGitStatus();
  checkTypes();
  checkBuild();
  checkTests();
  checkEnvVars();
  checkVercelConfig();
  checkEdgeExports();
  checkDependencies();

  // Summary
  section('Verification Summary');

  if (errors > 0) {
    log(`\n❌ Verification FAILED with ${errors} error(s) and ${warnings} warning(s)`, 'red');
    log('Please fix all errors before deploying\n', 'red');
    process.exit(1);
  } else if (warnings > 0) {
    log(`\n⚠️  Verification PASSED with ${warnings} warning(s)`, 'yellow');
    log('You may proceed with deployment, but review warnings\n', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ All checks PASSED! Ready to deploy 🚀\n', 'green');
    process.exit(0);
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
