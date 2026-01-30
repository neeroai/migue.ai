---
title: Reminder Automation
summary: Automated reminders with cron jobs, Google Calendar sync, 24h window tracking
version: 1.0
date: 2026-01-29
updated: 2026-01-29
status: Draft
---

# SPEC: Reminder Automation

## Problem
Users need automated WhatsApp reminders for appointments and calendar event synchronization with Google Calendar.

## Objective
99% reminder delivery within ±1 minute, bidirectional Google Calendar sync every 5 minutes

## Scope
**In:** Reminder tools (create, list, update, delete), cron jobs, Google Calendar API, 24h window tracking
**Out:** Complex scheduling logic (recurring reminders handled in future)

## Business Rules
1. Respect 24h messaging window (use templates outside)
2. Sync Google Calendar every 5 minutes
3. Reminder accuracy ±1 minute

**Source:** specs/01-api-contracts.md L260-290, specs/06-security-compliance.md L43-89
