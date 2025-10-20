# Token Budget Guide

Comprehensive guide for planning and managing token consumption in orchestrated development.

## Token Anatomy

### Context Window Breakdown (200K Tokens Total)
```
┌─────────────────────────────────────┐
│ System Prompts     │ 1-2K  │  1%    │
├────────────────────┴────────┴────────┤
│ Phase Context      │ 3-5K  │  2.5%  │
├────────────────────┴────────┴────────┤
│ Code Files         │ 20-40K│  20%   │
├────────────────────┴────────┴────────┤
│ Conversation       │ 20-40K│  20%   │
├────────────────────┴────────┴────────┤
│ Tool Results       │ 20-30K│  15%   │
├────────────────────┴────────┴────────┤
│ Available Buffer   │ 80-120K│ 40%+  │
└─────────────────────────────────────┘

Target: Never exceed 120K (60% of total)
```

## Phase Token Budgets

### Small Phase (1-2h)
```
Budget: 15-20K tokens

Breakdown:
├─ System: 800 tokens (optimized prompts)
├─ Phase definition: 1K tokens
├─ Code reads: 5-8K tokens (2-3 files)
├─ Conversation: 3-5K tokens
├─ Tool results: 3-5K tokens
└─ Buffer: 2-3K tokens

Subtasks: 2-3
Context peaks: ~35-40%
```

### Medium Phase (2-3h)
```
Budget: 25-35K tokens

Breakdown:
├─ System: 800 tokens
├─ Phase definition: 1.5K tokens
├─ Code reads: 10-15K tokens (4-5 files)
├─ Conversation: 5-8K tokens
├─ Tool results: 5-8K tokens
└─ Buffer: 3-5K tokens

Subtasks: 4-6
Context peaks: ~45-55%
```

### Large Phase (3-4h)
```
Budget: 40-55K tokens

Breakdown:
├─ System: 800 tokens
├─ Phase definition: 2K tokens
├─ Code reads: 15-25K tokens (6-8 files)
├─ Conversation: 8-12K tokens
├─ Tool results: 8-12K tokens
└─ Buffer: 5-8K tokens

Subtasks: 6-8
Context peaks: ~55-65%
```

### Critical Phase (>4h - AVOID)
```
Budget: >60K tokens (RISKY)

Problems:
- Will exceed 60% context
- Need multiple /compact runs
- May need /clear mid-phase
- Risk of work loss

Solution: Split into 2 phases
```

## Token Consumption by Operation

### File Operations

| Operation | Token Cost | Example |
|-----------|------------|---------|
| Read small file (<100 lines) | 300-500 | config files |
| Read medium file (100-500 lines) | 1-2K | service files |
| Read large file (>500 lines) | 2-5K | main components |
| Grep search | 100-300 | finding patterns |
| Write/Edit | 50-200 | changes only |
| Git operations | 50-100 | commits, status |

### Documentation Operations

| Operation | Token Cost | Better Alternative |
|-----------|------------|-------------------|
| Read entire API doc | 5-10K | Reference specific section |
| Load all examples | 3-5K | Load on-demand |
| Read full guide | 2-4K | Grep for relevant parts |
| Embed code examples | 1-2K | Reference external file |

### Conversation Tokens

| Message Type | Token Cost | Optimization |
|--------------|------------|--------------|
| Long explanation | 200-400 | Use bullet points |
| Status update | 50-100 | Keep concise |
| Error description | 100-200 | Essential info only |
| Phase plan | 300-500 | Bullet format |
| Completion report | 100-150 | Template format |

## Token Optimization Strategies

### 1. Load On-Demand (Save 30-50%)
```
❌ BAD: Load at start
0:00 Load all documentation (10K tokens)
0:05 Start implementation
Total: 10K wasted if not all needed

✅ GOOD: Load when needed
0:05 Start implementation
0:20 Need JWT? Load jwt.md#generation (500 tokens)
0:40 Need refresh? Load jwt.md#refresh (400 tokens)
Total: 900 tokens (91% savings)
```

### 2. Use References (Save 70-90%)
```
❌ BAD: Embed documentation
"Here's how to implement JWT:
[500 lines of documentation]"
Cost: 2K tokens

✅ GOOD: Reference external
"See: docs/auth/jwt.md#implementation"
Cost: 20 tokens (99% savings)
```

### 3. Targeted File Reading (Save 50-70%)
```
❌ BAD: Read entire file
Read: src/services/auth.service.ts (2K tokens)

✅ GOOD: Grep first, read specific
Grep "login" src/services/auth.service.ts
Read lines 45-90 only (300 tokens)
Savings: 85%
```

### 4. Concise Communication (Save 40-60%)
```
❌ BAD: Verbose
"I have now completed the implementation of the user
authentication endpoint. The endpoint accepts POST requests
to /auth/login with email and password in the request body.
It validates the input, checks the user exists in the database,
verifies the password matches, generates a JWT token, and returns
it to the client. All the tests are passing with 85% coverage."
(75 tokens)

✅ GOOD: Concise
"✅ /auth/login complete
Tests: passing
Coverage: 85%"
(12 tokens, 84% savings)
```

### 5. Smart Context Management
```
At 30min checkpoints:

If <40%: Continue normally
If 40-50%: Monitor closely
If 50-60%: Run /compact preventively
If 60-70%: Run /compact (mandatory)
If 70-80%: Checkpoint, consider /clear
If >80%: STOP, must /clear
```

## Token Budget by Task Type

### Feature Implementation
```
Simple Feature (CRUD):
- Budget: 20-25K tokens
- Phases: 1
- Duration: 2-3h

Medium Feature (Auth, Payment):
- Budget: 40-50K tokens
- Phases: 2
- Duration: 4-6h

Complex Feature (Real-time, AI):
- Budget: 70-90K tokens
- Phases: 3-4
- Duration: 8-12h
```

### Bug Fixes
```
Simple Bug:
- Budget: 8-12K tokens
- Phases: 1
- Duration: 0.5-1h

Complex Bug:
- Budget: 20-30K tokens
- Phases: 1-2
- Duration: 2-3h

System-wide Issue:
- Budget: 40-60K tokens
- Phases: 2-3
- Duration: 4-6h
```

### Refactoring
```
Small Refactor:
- Budget: 15-20K tokens
- Phases: 1
- Duration: 1-2h

Medium Refactor:
- Budget: 35-45K tokens
- Phases: 2
- Duration: 3-4h

Large Refactor:
- Budget: 70-100K tokens
- Phases: 3-4
- Duration: 6-8h
```

## Phase Planning Formula

```
Phase Token Budget =
  Base Components:
    + System Prompts (800-1K)
    + Phase Definition (1-2K)
    + Initial Context (2-3K)

  Per Subtask:
    + Code Read (1-3K)
    + Implementation (0.5-1K)
    + Testing (0.5-1K)
    + Communication (0.5K)

  Checkpoints:
    + Every 30min (200 tokens)
    + Status updates (100 tokens)

  Safety Buffer:
    + 20-30% of total
```

### Example Calculation
```
3-hour phase with 5 subtasks:

Base:
  System: 800
  Phase def: 1,500
  Context: 2,500
  = 4,800 tokens

Subtasks (5x):
  Code: 5 × 2,000 = 10,000
  Implement: 5 × 750 = 3,750
  Testing: 5 × 750 = 3,750
  Comm: 5 × 500 = 2,500
  = 20,000 tokens

Checkpoints (6x):
  6 × 300 = 1,800 tokens

Subtotal: 26,600 tokens
Buffer (25%): 6,650 tokens

Total Budget: 33,250 tokens (~17% of capacity)
```

## User Approval Gates

### Before Phase Execution
```markdown
## Phase Plan Ready

**Phase**: User Authentication
**Duration**: 3 hours
**Token Budget**: 32K (16% of capacity)
**Subtasks**: 5

**Current Context**: 12% (24K tokens)
**Projected Peak**: 45% (90K tokens)
**Safety Margin**: 55% remaining

Reply "approve" to proceed
Reply "adjust" to modify plan
Reply "cancel" to stop
```

### At Critical Points
```markdown
⚠️ Context Check

**Current**: 58% (116K tokens)
**Trend**: +5K tokens/30min
**Estimated completion**: 72% (144K tokens)

Options:
1. Continue (risky)
2. Run /compact now
3. Split remaining work

Reply with option number:
```

### Token Overrun
```markdown
❗ Token Budget Exceeded

**Budgeted**: 30K tokens
**Used so far**: 28K tokens
**Remaining work**: ~15K tokens
**Total projected**: 43K tokens (+43% over)

Approve additional 15K tokens? (yes/no)
```

## Monitoring Dashboard Format

### Every 30 Minutes
```
═══════════════════════════════════
CHECKPOINT: 2025-10-16 14:30
───────────────────────────────────
Phase: Authentication API
Progress: 3/6 subtasks (50%)
Time: 1.5h of 3h (50%)
───────────────────────────────────
TOKEN USAGE:
  Current: 45% (90K)
  Budget: 35K
  Used: 28K (80% of budget)
  Remaining: 7K
  Projected: 42K (+20% over)
───────────────────────────────────
HEALTH:
  Tests: ✓ 12 passing
  Coverage: ✓ 83%
  Lint: ✓ clean
  Context: ⚠️ approaching limit
───────────────────────────────────
ACTION: Run /compact recommended
═══════════════════════════════════
```

## Emergency Procedures

### Context Critical (>75%)
```
1. STOP all operations
2. Commit current work
3. Update TodoWrite
4. Run /compact
5. If still >70%:
   - Checkpoint everything
   - Document state
   - Run /clear
   - Resume minimal
```

### Token Budget Exhausted
```
1. Complete current subtask only
2. Report to user
3. Options:
   - Approve more tokens
   - Defer remaining work
   - Create follow-up phase
```

### Runaway Token Consumption
```
Signs:
- +10K tokens in 10 minutes
- Multiple large file reads
- Verbose outputs

Actions:
1. STOP immediately
2. Identify cause
3. Optimize approach
4. Resume with limits
```

## Best Practices Summary

### DO ✅
- Monitor context every 30min
- Load docs on-demand
- Use references not embedding
- Keep messages concise
- Run /compact at 60%
- Get user approval for phases
- Show token estimates upfront
- Checkpoint before risky operations

### DON'T ❌
- Load all docs at start
- Read entire files unnecessarily
- Embed large code blocks
- Write verbose explanations
- Wait until 80% to compact
- Auto-execute without approval
- Hide token consumption
- Continue past 80% context

## Token ROI Analysis

### High-Value Token Usage
- Implementation code: High ROI
- Test creation: High ROI
- Bug fixes: High ROI
- Critical path optimization: High ROI

### Low-Value Token Usage
- Reading unchanged files: Low ROI
- Verbose explanations: Low ROI
- Duplicate documentation: Low ROI
- Retry same approach: Low ROI

### Optimization Priority
1. Eliminate low-value usage first
2. Optimize high-frequency operations
3. Batch similar operations
4. Cache frequently accessed content
5. Use references for static content

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Target Efficiency**: <60% context usage per phase
**Related**: master-examples.md, executor-examples.md, troubleshooting.md