# Claude-Executor - Complete Usage Guide

## 📖 Overview

**Claude-Executor** is the execution specialist designed to work in tandem with **claude-master**. While claude-master focuses on PLANNING and ORCHESTRATION, claude-executor focuses on IMPLEMENTATION and EXECUTION.

### Role Definition

```
claude-master (Sonnet)
├── Analyzes requirements
├── Breaks into phases (2-4h each)
├── Creates TodoWrite with phase plan
├── Delegates phases to claude-executor
└── Monitors overall progress

claude-executor (Sonnet)
├── Receives phase from claude-master
├── Creates TodoWrite with subtasks
├── Executes subtasks (<200 lines each)
├── Checkpoints every 30min
├── Monitors context (<60% target)
├── Reports completion to claude-master
└── Ready for next phase
```

### Key Characteristics

- **Model**: Sonnet (balanced performance/cost)
- **Token Efficiency**: <60% context usage target per phase
- **Checkpoint Cadence**: Every 30 minutes (automated)
- **Subtask Size**: <200 line diffs each
- **TDD Enforcement**: Strict tests-first approach
- **Context Strategy**: Load docs on-demand

## 🎯 When to Use Claude-Executor

### Use claude-executor for:

✅ **Implementing planned phases**
- Feature implementation
- Bug fixes with test cases
- Refactoring in small chunks
- API endpoint development
- Database migrations
- UI component development

✅ **Routine development tasks**
- Writing code following established patterns
- Implementing tests for existing code
- Updating documentation
- Small optimizations
- Configuration changes

✅ **Token-constrained execution**
- Long-running implementations
- Multiple subtasks in sequence
- Context-heavy operations

### DON'T use claude-executor for:

❌ **Planning and architecture**
- That's claude-master's job
- Executor receives plans, doesn't create them

❌ **Complex decision-making**
- Delegate to appropriate specialist
- Or escalate to claude-master

❌ **Multi-phase orchestration**
- Claude-master handles coordination
- Executor handles single phase execution

## 🚀 Usage Workflow

### Step 1: Claude-Master Creates Phase Plan

Claude-master analyzes the request and creates a phase:

```markdown
@claude-master: "Implement user authentication feature"

claude-master creates:
Phase 1: Database Schema (2h)
├─ Subtask 1: Create users table (<200 lines)
├─ Subtask 2: Create sessions table (<200 lines)
├─ Subtask 3: Add indexes (<200 lines)
└─ Subtask 4: Seed test data (<200 lines)

Acceptance Criteria:
- Migrations run successfully
- Proper constraints and indexes
- Test data validates schema
- >80% test coverage
```

### Step 2: Claude-Master Delegates to Executor

```markdown
@claude-executor: "Execute Phase 1: Database Schema

Objective: Create authentication database tables
Duration: 2 hours

Subtasks:
1. Create users table migration (<200 lines)
2. Create sessions table migration (<200 lines)
3. Add performance indexes (<200 lines)
4. Seed test data for validation (<200 lines)

Acceptance Criteria:
- All migrations run successfully
- Tables have proper constraints and relationships
- Indexes improve query performance
- Test data validates complete schema

Dependencies: None
Next Phase: Phase 2 - API Endpoints"
```

### Step 3: Claude-Executor Executes Phase

Executor follows strict protocol:

```
0:00 - Receives phase, creates TodoWrite with 4 subtasks
0:05 - Reads CLAUDE.md for project conventions
0:10 - Subtask 1: Checks tests exist, they fail (red)
0:15 - Implements users table migration
0:20 - Tests pass (green), commits
0:25 - Marks subtask 1 completed in TodoWrite

0:30 - CHECKPOINT #1
       ├─ Commits all changes
       ├─ Updates TodoWrite
       ├─ Checks context: 35%
       └─ Continues

0:35 - Subtask 2: Implements sessions table
0:50 - Tests pass, commits
0:55 - Marks subtask 2 completed

1:00 - CHECKPOINT #2
       ├─ Commits
       ├─ Updates TodoWrite
       ├─ Checks context: 42%
       └─ Continues

1:05 - Subtask 3: Adds indexes
1:20 - Tests pass, commits
1:25 - Marks subtask 3 completed

1:30 - CHECKPOINT #3
       ├─ Commits
       ├─ Updates TodoWrite
       ├─ Checks context: 48%
       └─ Continues

1:35 - Subtask 4: Seeds test data
1:50 - All tests pass, coverage 85%
1:55 - Final commit, marks completed

2:00 - Phase End Protocol
       ├─ Verifies all subtasks completed
       ├─ Runs full test suite: 24 passing
       ├─ Checks coverage: 85% ✓
       ├─ Final commit with summary
       └─ Reports to claude-master

2:05 - Reports completion:
"Phase 1 complete. 4/4 subtasks done.
Tests: 24 passing. Coverage: 85%.
Context peak: 48%. Time: 2h 5min.
Ready for Phase 2."
```

### Step 4: Claude-Master Verifies and Continues

```markdown
claude-master:
- Verifies Phase 1 completion ✓
- Reviews quality gates ✓
- Delegates Phase 2 to executor
- Cycle repeats
```

## 📊 Token Optimization Strategies

### Strategy 1: Load Docs On-Demand

❌ **Anti-Pattern**:
```
Phase Start:
1. Read docs/architecture/database.md (5K tokens)
2. Read docs/api-guide.md (8K tokens)
3. Read docs/conventions.md (3K tokens)
4. Then start implementation
Total wasted: ~16K tokens if not all needed
```

✅ **Best Practice**:
```
Phase Start:
1. Read only CLAUDE.md (1K tokens)
2. Start first subtask
3. Load docs/database.md when creating tables (5K tokens)
4. Load docs/testing.md when writing tests (3K tokens)
Total: ~9K tokens (load only what's needed when needed)
```

### Strategy 2: Reference External Docs

❌ **Anti-Pattern**:
```markdown
System prompt includes full API spec:
"Authentication API has the following endpoints:
- POST /auth/register: Creates new user...
- POST /auth/login: Authenticates user...
- GET /auth/verify: Verifies token...
[500 more lines of API documentation]"

Token cost: ~2000 tokens in every prompt
```

✅ **Best Practice**:
```markdown
System prompt references docs:
"For API endpoints, see docs/api-spec.md
For authentication patterns, see docs/auth-guide.md"

Token cost: ~50 tokens
Load full docs only when implementing specific endpoint
```

### Strategy 3: Progressive Context Loading

```
Phase Start (Minimal Context):
├─ Phase objectives: 500 tokens
├─ Subtasks list: 500 tokens
├─ Project conventions: 1K tokens
└─ Total: 2K tokens

As Needed (On-Demand):
├─ Subtask 1 implementation → Load relevant code (5K tokens)
├─ Subtask 2 implementation → Load related tests (3K tokens)
├─ Subtask 3 implementation → Load docs (2K tokens)
└─ Total per subtask: 5-8K tokens

Result: Never load more than needed for current subtask
```

### Strategy 4: Use context7 MCP

```bash
# Instead of loading React documentation manually
Read docs/react-19-hooks.md  # 8K tokens

# Use context7 MCP for up-to-date docs
"Implement React component with new hooks. use context7"
# Context7 injects only relevant docs: ~3K tokens
```

### Strategy 5: Checkpoint at 60%

```
Monitor context every 30min:
├─ <50%: Continue normal
├─ 50-60%: Monitor closely
├─ 60-70%: Run /compact
├─ 70-80%: Checkpoint → /compact
└─ >80%: STOP → Checkpoint → /clear → Resume

Result: Never exceed 80% context in a phase
```

## 🧪 TDD Enforcement Protocol

### Red-Green-Refactor Cycle

```
For each subtask:
1. RED: Verify test exists and fails
   ├─ If no test: STOP → Request test from claude-master
   └─ If test exists: Run → Must FAIL

2. GREEN: Implement minimal code to pass
   ├─ Write simplest implementation
   ├─ Run test → Must PASS
   └─ Commit immediately

3. REFACTOR: Improve code quality
   ├─ Clean up code
   ├─ Add comments
   ├─ Optimize if needed
   ├─ Run tests → Must still PASS
   └─ Commit refactor

4. VERIFY: Check coverage
   └─ npm run coverage → Must be >80%
```

### Example: Adding Login Endpoint

```bash
# 1. RED - Test exists and fails
$ npm test -- auth.login.test.ts
❌ FAIL  POST /auth/login
  ✕ should authenticate valid user (5 ms)
  ✕ should reject invalid credentials (3 ms)

# 2. GREEN - Implement to pass
# Write minimal implementation
$ npm test -- auth.login.test.ts
✅ PASS  POST /auth/login
  ✓ should authenticate valid user (12 ms)
  ✓ should reject invalid credentials (8 ms)

$ git commit -m "feat: add login authentication"

# 3. REFACTOR - Improve code
# Add error handling, logging, etc.
$ npm test -- auth.login.test.ts
✅ PASS  POST /auth/login
  ✓ should authenticate valid user (11 ms)
  ✓ should reject invalid credentials (9 ms)

$ git commit -m "refactor: improve login error handling"

# 4. VERIFY - Check coverage
$ npm run coverage
Coverage: 87% (target: >80%) ✓
```

### Handling Missing Tests

```
Scenario: Implementing feature without tests

executor detects no tests:
1. STOP implementation immediately
2. Mark subtask as blocked
3. Report to claude-master:
   "Tests missing for [subtask].
    Request test creation before implementation."
4. Wait for claude-master to delegate test creation
5. Once tests exist and fail, resume implementation
```

## ⏱️ Checkpoint Protocol

### Every 30 Minutes (Automated)

```bash
Internal Timer triggers checkpoint:

Step 1: Commit current work
$ git add .
$ git commit -m "checkpoint: [progress summary]"

Step 2: Update TodoWrite
- Mark current subtask status
- Update progress notes

Step 3: Check context
$ /context
Context usage: 58% (116K / 200K tokens)

Step 4: Take action based on context
IF context < 60%:
  ✅ Continue normal execution

IF context 60-80%:
  $ /compact
  ✅ Continue with reduced context

IF context > 80%:
  1. STOP current work
  2. Final checkpoint commit
  3. Update TodoWrite with exact position
  4. $ /clear (reset context)
  5. Resume with minimal context load
  6. Continue from checkpoint

Step 5: Log metrics
Time: 1h 30min
Progress: 3/6 subtasks completed
Context: 58%
Commits: 4
Next checkpoint: 2h 0min
```

### Checkpoint Content

Each checkpoint commit includes:

```bash
git commit -m "checkpoint: completed 3/6 subtasks

Completed:
- Users table migration ✓
- Sessions table migration ✓
- Performance indexes ✓

In Progress:
- Test data seeding (50%)

Pending:
- Integration tests
- Documentation update

Metrics:
- Time: 1h 30min / 2h estimated
- Tests: 18 passing
- Coverage: 82%
- Context: 58%"
```

## 🎯 Quality Gates

### Before Marking Subtask Complete

```markdown
Verification Checklist:
- [ ] Code compiles without errors
- [ ] All tests pass (green)
- [ ] Code coverage >80%
- [ ] No linting errors (eslint/prettier)
- [ ] No TypeScript errors
- [ ] Code follows project conventions
- [ ] Complex logic has comments
- [ ] No console.log or debug statements
- [ ] No hardcoded values (use env vars)
- [ ] Proper error handling implemented
```

### Automated Checks

```bash
# Run before marking complete
$ npm run lint        # Must pass
$ npm run type-check  # Must pass (TypeScript)
$ npm test           # All tests must pass
$ npm run coverage   # Must show >80%

# If any fail:
1. Fix issues
2. Re-run checks
3. Only mark complete when all pass
```

### Manual Code Review Checklist

```markdown
Self-review before completion:
- [ ] Is code readable and maintainable?
- [ ] Are variable names descriptive?
- [ ] Is logic broken into small functions?
- [ ] Are edge cases handled?
- [ ] Is error handling comprehensive?
- [ ] Are success/error paths clear?
- [ ] Would another developer understand this?
```

## 🔧 Troubleshooting Scenarios

### Scenario 1: Phase Taking Longer Than Estimated

**Symptoms**:
- 2h phase now at 2.5h with 2/6 subtasks remaining
- Subtasks more complex than anticipated

**Solution**:
```markdown
1. Stop current work
2. Checkpoint current progress
3. Report to claude-master:
   "Phase 1 running long. 4/6 subtasks done in 2.5h.
    Remaining 2 subtasks estimated 1.5h more.
    Suggest: Break into Phase 1a (current) and Phase 1b (remaining)."
4. Wait for claude-master to replan
5. Complete current phase with accomplished subtasks
6. Execute replanned phase separately
```

### Scenario 2: Context Approaching 80%

**Symptoms**:
- /context shows 78% usage
- Still 3 subtasks remaining
- Risk of hitting 80% limit

**Solution**:
```markdown
1. Immediate checkpoint
   $ git commit -m "checkpoint: before context reset"

2. Update TodoWrite with exact state
   3/6 subtasks completed
   Current: Implementing auth middleware (60% done)

3. Run /clear to reset context

4. Resume with minimal context:
   - Load only current subtask requirements
   - Load only necessary code files
   - Reference docs instead of loading

5. Continue execution with fresh context
```

### Scenario 3: Tests Failing Unexpectedly

**Symptoms**:
- Implemented feature as per spec
- Tests failing with unclear errors
- Can't identify root cause quickly

**Solution**:
```markdown
1. Don't spend >30min debugging alone

2. Report to claude-master:
   "Tests failing for [feature]. Error: [error message].
    Need specialist review."

3. Claude-master options:
   a) Delegate to test-engineer for diagnosis
   b) Delegate to code-reviewer for analysis
   c) Provide additional context/guidance

4. Once resolved, continue execution
```

### Scenario 4: Blocked on External Dependency

**Symptoms**:
- Need API key not available
- Dependent service not deployed
- External library not configured

**Solution**:
```markdown
1. Document blocker clearly
2. Mark subtask as "blocked" in TodoWrite
3. Report to claude-master with details:
   "Subtask blocked: Need [X].
    Cannot proceed without [X].
    Can work on other subtasks: [Y, Z]."
4. Move to independent subtask if available
5. Or wait for claude-master to resolve blocker
```

## 📈 Metrics and Reporting

### Phase Completion Report

```markdown
Template for reporting to claude-master:

Phase: [Phase Name]
Status: ✅ Complete / ⚠️ Partial / ❌ Blocked
Duration: [Actual] (Estimated: [Estimated])

Subtasks:
- ✅ [Subtask 1]: Completed in [time]
- ✅ [Subtask 2]: Completed in [time]
- ⚠️ [Subtask 3]: Blocked on [dependency]

Tests:
- Total: [N passing, M failing]
- Coverage: [X%] (target: >80%)

Commits: [N]
Context Peak: [X%]
Checkpoints: [N]

Blockers: [None / List]
Issues: [None / List]

Next Steps: [Ready for Phase N+1 / Need replan / Blocked]
```

### Example Report

```markdown
Phase: REST API for User Management
Status: ✅ Complete
Duration: 3h 15min (Estimated: 3h)

Subtasks:
- ✅ POST /users endpoint: Completed in 35min
- ✅ GET /users endpoint: Completed in 25min
- ✅ PUT /users/:id endpoint: Completed in 40min
- ✅ DELETE /users/:id endpoint: Completed in 30min
- ✅ Input validation: Completed in 35min
- ✅ Integration tests: Completed in 30min

Tests:
- Total: 32 passing, 0 failing
- Coverage: 89% ✓

Commits: 7
Context Peak: 57%
Checkpoints: 7 (every 30min)

Blockers: None
Issues: None

Next Steps: Ready for Phase 2 - Frontend Integration
```

## 🎓 Best Practices

### 1. Start with Smallest Subtask

**Why**: Build momentum, catch issues early

```markdown
❌ Don't start with:
- Most complex subtask
- Subtask with unknown dependencies
- Longest subtask

✅ Do start with:
- Simplest, clearest subtask
- Well-defined task with known patterns
- Quick win to build confidence
```

### 2. Commit After Each Subtask

**Why**: Atomic changes, easy rollback, clear history

```bash
✅ Good commit strategy:
feat: add user registration endpoint
feat: add login authentication
feat: add token verification
test: add auth integration tests

❌ Bad commit strategy:
feat: implement entire auth system (500 lines changed)
```

### 3. Load Docs Just-In-Time

**Why**: Saves tokens, reduces context bloat

```markdown
✅ Good approach:
- Start subtask
- Identify what docs needed
- Load only those docs
- Implement
- Move to next

❌ Bad approach:
- Load all docs at phase start
- Waste tokens on unused docs
- Context bloated before starting
```

### 4. Update TodoWrite Continuously

**Why**: Transparency, recoverability, progress tracking

```markdown
✅ Good practice:
- Mark in_progress when starting subtask
- Mark completed immediately when done
- Never batch updates

❌ Bad practice:
- Complete 3 subtasks
- Then update all at once
- No visibility during execution
```

### 5. Ask When Blocked

**Why**: Don't waste time spinning wheels

```markdown
✅ Good escalation:
- After 30min stuck: Report to claude-master
- Provide context and attempted solutions
- Ask for specific help

❌ Bad approach:
- Spend 2h debugging alone
- Try random solutions
- Waste tokens on unsuccessful attempts
```

## 📚 Related Documentation

- **Agent Configuration**: `.claude/agents/claude-executor.md`
- **Phase Methodology**: `docs/orchestration/phase-based-development.md`
- **Delegation Matrix**: `docs/orchestration/delegation-matrix.md`
- **Best Practices**: `docs/subagents/best-practices.md`
- **Project Rules**: `CLAUDE.md`

## 🔗 Integration with Claude-Master

### Communication Protocol

```
claude-master → claude-executor:
- Phase definition (clear objective, subtasks, criteria)
- Context and requirements
- Dependencies and constraints

claude-executor → claude-master:
- Progress updates (at checkpoints)
- Completion reports (with metrics)
- Blocker notifications (when stuck)
- Clarification requests (when ambiguous)
```

### Handoff Points

```
1. Phase Start:
   master → executor: "Execute Phase N with [details]"

2. During Phase:
   executor → master: "Checkpoint N: X/Y complete"

3. Phase End:
   executor → master: "Phase complete: [metrics]"
   master: Verifies completion, delegates next phase

4. Blocked:
   executor → master: "Blocked on [X], need [Y]"
   master: Resolves blocker or replans
```

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Maintained by**: Project Orchestration Team
