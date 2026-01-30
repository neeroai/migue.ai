---
title: WhatsApp Flows
summary: Interactive UX with Flows v3, buttons, lists, encrypted responses
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: Draft
---

# SPEC: WhatsApp Flows

## Problem
Enable rich interactive UX for complex inputs (appointment booking, expense categorization) using WhatsApp Flows v3 and interactive messages.

## Objective
90% user preference for Flows over free-text for structured tasks

## Scope
**In:** Flows v3 JSON, AES-256 encryption, interactive messages (buttons, lists)
**Out:** Payment Flows, media-rich Flows

## Business Rules
1. AES-256 encryption required
2. 10s timeout for Flow responses
3. Fallback to free-text on error

**Source:** specs/05-whatsapp-integration.md L240-420
