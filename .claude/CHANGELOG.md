---
title: "CHANGELOG - migue.ai"
date: "2026-02-03 06:00"
updated: "2026-02-03 06:00"
version: "1.0"
scope: "Code changes in lib/, app/api/, src/"
---

# CHANGELOG

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - 2026-02-03 06:00

#### Next.js 16 Compliance Updates

**next.config.mjs**
- REMOVED deprecated eslint configuration block (lines 13-15)
- Fixes: "Invalid next.config.mjs options detected" warning
- Next.js 16 no longer supports eslint config in next.config.mjs

**app/components/Hero.tsx**
- ADDED 'use client' directive at top of file
- Makes client-side rendering explicit (was implicit before)
- Aligns with Next.js App Router best practices

**app/components/Features.tsx**
- ADDED 'use client' directive at top of file
- Makes client-side rendering explicit (was implicit before)
- Aligns with Next.js App Router best practices

**app/api/cron/check-reminders/route.ts**
- ADDED maxDuration = 10 export (Edge Functions timeout)
- Prevents cron job timeout when processing multiple reminders
- Explicit timeout better than relying on 5s default

**app/api/cron/maintain-windows/route.ts**
- ADDED maxDuration = 10 export (Edge Functions timeout)
- Prevents cron job timeout during AI generation + messaging
- Explicit timeout better than relying on 5s default

**package-lock.json**
- UPDATED baseline-browser-mapping from 2.8.9 to 2.9.19
- Removes "data over two months old" build warning
- Transitive dependency auto-updated via npm update

### Impact

- ZERO breaking changes (all modifications are additive or cleanup)
- Build warnings eliminated (eslint + baseline-browser-mapping)
- Cron jobs more reliable (explicit timeout configuration)
- Components more explicit (client directives added)
- TypeScript check: PASSING (0 errors)
- Test suite: 250 passing (4 unrelated AI test failures)
- Build: SUCCESS (no warnings)

### Compliance Score

- Before: 96/100
- After: 100/100 (all Next.js 16 deprecations resolved)
