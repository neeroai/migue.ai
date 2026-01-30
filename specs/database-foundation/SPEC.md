---
title: Database Foundation
summary: Supabase PostgreSQL schema with 14 tables, RLS policies, pgvector for memory
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: Draft
---

# SPEC: Database Foundation

## Problem
Need persistent storage for users, conversations, messages, reminders, calendar events, expenses, and semantic memory search with row-level security.

## Objective
Support 10K users, <100ms query latency, 99.99% data durability, pgvector semantic search for user memory

## Scope
**In:** 14 tables (users, conversations, messages, reminders, calendar_events, expenses, user_memory, etc.), RLS policies, pgvector extension, migrations
**Out:** Backup strategy, replication, advanced analytics

## Contracts
**Input:** SQL migrations
**Output:** Initialized Supabase database with RLS enforced

## Business Rules
1. RLS enabled on all user-facing tables
2. pgvector for semantic memory search
3. Automatic updated_at triggers
4. Cascading deletes (user → conversations → messages)

**Source:** specs/02-database-schema.md
