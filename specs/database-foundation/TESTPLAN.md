---
title: Database Test Plan
version: 1.0
date: 2026-01-29
---

# Database Test Plan

## Tests
- RLS policies (user can only access own data)
- Migration reversibility (up/down)
- pgvector semantic search
- Cascading deletes
- Index performance (<100ms queries)

**Coverage:** 80% critical (RLS enforcement)
