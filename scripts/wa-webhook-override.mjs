#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });
loadEnv();

const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v23.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function usage() {
  console.log(`
WhatsApp Webhook Override CLI

Usage:
  node scripts/wa-webhook-override.mjs status [--waba-id <id>]
  node scripts/wa-webhook-override.mjs set --url <callback_url> [--verify-token <token>] [--waba-id <id>]
  node scripts/wa-webhook-override.mjs reset [--waba-id <id>]

Environment variables:
  WHATSAPP_TOKEN                     Required
  WHATSAPP_PHONE_ID                  Required (used to discover WABA ID if not provided)
  WHATSAPP_BUSINESS_ACCOUNT_ID       Optional (if omitted, script discovers via phone ID)
  WHATSAPP_VERIFY_TOKEN              Optional default verify token
  GRAPH_VERSION                      Optional (default: v23.0)
`);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command, url: undefined, verifyToken: undefined, wabaId: undefined };

  for (let i = 0; i < rest.length; i += 1) {
    const item = rest[i];
    if (item === '--url') {
      args.url = rest[i + 1];
      i += 1;
      continue;
    }
    if (item === '--verify-token') {
      args.verifyToken = rest[i + 1];
      i += 1;
      continue;
    }
    if (item === '--waba-id') {
      args.wabaId = rest[i + 1];
      i += 1;
    }
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

async function graphGet(path, token, query = '') {
  const url = `${GRAPH_BASE_URL}${path}${query ? `?${query}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Graph GET failed (${res.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function graphPost(path, token, formData) {
  const body = new URLSearchParams(formData);
  const url = `${GRAPH_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`Graph POST failed (${res.status}): ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function resolveWabaId({ token, phoneId, explicitWabaId }) {
  if (explicitWabaId) return explicitWabaId;

  const response = await graphGet(
    `/${phoneId}`,
    token,
    new URLSearchParams({ fields: 'whatsapp_business_account' }).toString()
  );

  const wabaId = response?.whatsapp_business_account?.id;
  if (!wabaId) {
    throw new Error([
      'Could not resolve WHATSAPP_BUSINESS_ACCOUNT_ID automatically.',
      'Set WHATSAPP_BUSINESS_ACCOUNT_ID in env or pass --waba-id.',
      'Tip: find WABA ID in Meta WhatsApp Manager > API Setup.',
    ].join(' '));
  }

  return wabaId;
}

async function run() {
  const { command, url, verifyToken, wabaId: argWabaId } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(0);
  }

  const token = requireEnv('WHATSAPP_TOKEN');
  const phoneId = requireEnv('WHATSAPP_PHONE_ID');
  const explicitWabaId = argWabaId?.trim() || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
  const defaultVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  const wabaId = await resolveWabaId({ token, phoneId, explicitWabaId });

  if (command === 'status') {
    const response = await graphGet(`/${wabaId}/subscribed_apps`, token);
    console.log(JSON.stringify({ wabaId, response }, null, 2));
    return;
  }

  if (command === 'set') {
    if (!url) {
      throw new Error('Missing required argument: --url');
    }
    const effectiveVerifyToken = verifyToken || defaultVerifyToken;
    if (!effectiveVerifyToken) {
      throw new Error('Missing verify token. Provide --verify-token or WHATSAPP_VERIFY_TOKEN.');
    }

    const response = await graphPost(`/${wabaId}/subscribed_apps`, token, {
      override_callback_uri: url,
      verify_token: effectiveVerifyToken,
    });
    console.log(JSON.stringify({ ok: true, action: 'set', wabaId, url, response }, null, 2));
    return;
  }

  if (command === 'reset') {
    const response = await graphPost(`/${wabaId}/subscribed_apps`, token, {});
    console.log(JSON.stringify({ ok: true, action: 'reset', wabaId, response }, null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

run().catch((error) => {
  console.error('wa-webhook-override failed:', error.message);
  process.exit(1);
});
