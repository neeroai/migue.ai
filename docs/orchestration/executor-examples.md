# Claude-Executor: Execution Examples

Token-optimized execution examples following TDD and checkpoint methodology.

## Example 1: Authentication API Phase

**Phase Received from claude-master**:
```markdown
Phase: REST API for User Authentication
Duration: 3 hours
Token Budget: 20K tokens

Subtasks:
1. [ ] Create POST /auth/register endpoint (<200 lines)
2. [ ] Create POST /auth/login endpoint (<200 lines)
3. [ ] Add JWT token generation (<200 lines)
4. [ ] Write integration tests (<200 lines)

Acceptance Criteria:
- All endpoints work correctly
- JWT tokens generated securely
- Tests pass with >80% coverage
```

**Execution Timeline**:
```
0:00 - Receive phase, ask user confirmation
     User: "yes, proceed"

0:01 - Create TodoWrite with 4 subtasks
     Context: 15% (30K tokens)

0:05 - Subtask 1: Check test exists
     $ grep "POST /auth/register" tests/
     → Test found: tests/auth/register.test.ts

0:06 - Run test (must FAIL)
     $ npm test -- register
     ✗ POST /auth/register should create user (FAILING)

0:10 - Implement minimal code
     → Read only: src/routes/auth.ts, src/models/user.ts
     → Write: 145 lines in auth controller

0:20 - Run test (must PASS)
     $ npm test -- register
     ✓ POST /auth/register should create user (PASSING)

0:22 - Commit
     $ git add . && git commit -m "feat: add user registration"

0:23 - Mark todo completed
     Context: 22% (44K tokens)

---

0:30 - CHECKPOINT #1
     $ git commit -m "Checkpoint: 1/4 complete"
     $ /context → 24% (48K tokens)
     Status: On track, continue

0:31 - Subtask 2: Check test for /auth/login
     $ grep "POST /auth/login" tests/
     → Test found: tests/auth/login.test.ts

0:32 - Run test (must FAIL)
     $ npm test -- login
     ✗ POST /auth/login should return JWT (FAILING)

0:35 - Implement minimal code
     → Read: src/utils/password.ts, src/utils/jwt.ts
     → Write: 165 lines in login controller

0:48 - Run test (must PASS)
     $ npm test -- login
     ✓ POST /auth/login should return JWT (PASSING)

0:50 - Commit & mark complete
     $ git commit -m "feat: add user login endpoint"
     Context: 31% (62K tokens)

---

1:00 - CHECKPOINT #2
     $ /context → 33% (66K tokens)
     Status: Good progress, continue

1:05 - Subtask 3: JWT generation
     Load docs on-demand:
     → Read ONLY relevant section: docs/jwt-guide.md#generation

1:10 - Implement JWT service
     → Write: 178 lines in jwt.service.ts
     → Tests pass

1:25 - Commit & mark complete
     Context: 42% (84K tokens)

---

1:30 - CHECKPOINT #3
     $ /context → 43% (86K tokens)
     Status: Within budget, continue

1:35 - Subtask 4: Integration tests
     → Write: 195 lines in auth.integration.test.ts

1:55 - Run full test suite
     $ npm test
     ✓ 18 tests passing

2:00 - Check coverage
     $ npm run coverage
     Coverage: 87.3% (exceeds 80% requirement)

2:05 - Final commit
     $ git commit -m "test: add auth integration tests"

2:10 - Phase complete, report to master
     Context: 51% (102K tokens)

Phase: ✅ Complete
Subtasks: 4/4
Tests: 18 passing
Coverage: 87.3%
Time: 2h 10min (under 3h budget)
Context Peak: 51% (under 60% target)
Checkpoints: 3
Commits: 5
Next: Ready for Phase 2
```

---

## Example 2: Bug Fix with TDD

**Phase**: Fix webhook signature validation bug

**Execution**:
```
0:00 - User confirms: "yes, fix it"

0:05 - Create reproduction test FIRST
     → Write: tests/webhook/signature.test.ts
     $ npm test -- signature
     ✗ Test fails (bug confirmed)

0:15 - Minimal fix
     → Edit: 23 lines in webhook-validator.ts
     $ npm test -- signature
     ✓ Test passes

0:18 - Commit
     $ git commit -m "fix: webhook signature validation"

0:20 - Complete
     Context: 18% (36K tokens)
```

---

## Example 3: Context Approaching Limit

**Scenario**: Complex refactoring phase

**Execution with checkpoint**:
```
0:00 - Phase start, user approves
1:30 - CHECKPOINT: context 45% (90K tokens)
2:00 - Working on subtask 3
2:30 - CHECKPOINT: context 58% (116K tokens)
       ⚠️  Approaching 60% threshold

2:31 - Run /compact
       Context reduced: 58% → 48% (96K tokens)

3:00 - CHECKPOINT: context 56% (112K tokens)
3:30 - CHECKPOINT: context 63% (126K tokens)
       ⚠️  Exceeded 60%, running /compact

3:31 - Run /compact again
       Context reduced: 63% → 51% (102K tokens)

4:00 - Phase complete
       Final context: 57% (114K tokens)
```

---

## Example 4: Context Critical (Need /clear)

**Scenario**: Large legacy code refactor

**Execution with /clear**:
```
0:00 - Phase start, 6 subtasks approved
2:00 - CHECKPOINT: context 52%
3:00 - CHECKPOINT: context 67%
       → Run /compact: 67% → 56%

3:30 - CHECKPOINT: context 72%
       ⚠️  High usage, ineffective /compact

3:31 - STOP & ask user
       "Context at 72% and rising. Options:
        1. Checkpoint & /clear (lose context, start fresh)
        2. Continue to 80% max (risky)
        3. Split remaining work into new phase

        Recommend: option 3"

       User: "option 3"

3:35 - Complete current subtask
3:40 - Report to master: "3/6 complete, context 75%, recommend split"
       Master creates Phase 1b with remaining 3 subtasks
```

---

## Token-Saving Techniques

### 1. On-Demand Documentation Loading
```
❌ Don't:
0:00 - Read entire API reference (5K tokens)
0:05 - Read all examples (3K tokens)
0:10 - Start implementing

✅ Do:
0:05 - Start implementing
0:15 - Need JWT info? Read ONLY: docs/jwt#generation (400 tokens)
0:35 - Need refresh tokens? Read ONLY: docs/jwt#refresh (350 tokens)
```
**Savings**: ~7K tokens per phase

### 2. Minimal File Reads
```
❌ Don't:
- Read entire src/services/auth.service.ts (2K tokens)
- Read entire src/models/user.model.ts (1.5K tokens)

✅ Do:
- Use Grep to find relevant function
- Read only that function section
```
**Savings**: ~2K tokens per read

### 3. Concise Communication
```
❌ Don't:
"I have successfully completed the implementation of the user
registration endpoint. The endpoint accepts POST requests with
email and password fields, validates the input data, hashes the
password using bcrypt, stores the user in the database, and
returns a success message. All tests are passing with 92% coverage."

✅ Do:
"✅ Subtask 1 complete: /auth/register
Tests: ✓ passing
Coverage: 92%
Commit: abc123f"
```
**Savings**: ~150 tokens per update

### 4. Reference vs Embed
```
❌ Don't:
Include 50 lines of example code in prompt

✅ Do:
"See example: docs/auth-patterns.md#jwt-generation"
```
**Savings**: ~1K tokens per reference

---

## Troubleshooting Scenarios

### Issue: Tests Don't Exist

**Execution**:
```
0:05 - Check for tests
     $ grep "auth/register" tests/
     → No test found

0:06 - STOP immediately
     Report to master: "Tests missing for subtask 1.
                        Need test-engineer to create tests first."

     Wait for master to delegate test creation

0:30 - Master confirms: "Tests created, proceed"

0:31 - Resume: Run test (should FAIL)
     $ npm test -- register
     ✗ POST /auth/register (FAILING)

0:32 - Continue with implementation
```

### Issue: Subtask Taking >1.5h

**Execution**:
```
1:30 - Subtask 2 started
3:00 - Still working on subtask 2 (1.5h elapsed)

3:01 - STOP & assess
       Complexity higher than estimated

3:02 - Report to master:
       "Subtask 2 more complex than estimated.
        Implemented 60% so far.
        Recommend: Split into 2 subtasks:
        - 2a: Core login logic (done)
        - 2b: OAuth integration (remaining)"

       Master: "Agree, complete 2a, create new phase for 2b"

3:10 - Complete subtask 2a
3:15 - Report completion of scaled-down subtask
```

### Issue: Blocker Found

**Execution**:
```
0:45 - Implementing subtask 3
0:50 - Blocker: Required API key not in env vars

0:51 - STOP implementation
     Mark subtask 3 as BLOCKED in TodoWrite

0:52 - Report to master:
       "Blocker: STRIPE_API_KEY not configured
        Cannot proceed with payment integration

        Options:
        1. Configure key (blocks progress)
        2. Mock for now (proceed with placeholder)
        3. Skip subtask 3, move to subtask 4"

       Master: "option 2, document technical debt"

0:55 - Resume with mock
1:10 - Complete with TODO comment
```

---

## Checkpoint Protocol

### Every 30 Minutes
```bash
# 1. Commit current work
git add .
git commit -m "Checkpoint: [progress summary]"

# 2. Update TodoWrite
# Mark current progress

# 3. Check context
/context

# 4. Decision tree
if context < 60%:
    continue normally
elif 60% <= context < 80%:
    run /compact
    continue if successful
elif context >= 80%:
    STOP
    ask user for guidance
```

### Before Major Operations
```bash
# Before reading large files
/context  # Check current usage

# If >50%, ask user
"About to read large file (~2K tokens).
Context at 52%. Proceed? (yes/no)"
```

---

## Quality Gates Checklist

Before marking subtask complete:
```markdown
- [ ] Tests exist and were failing (RED)
- [ ] Implementation makes tests pass (GREEN)
- [ ] Code refactored for quality (REFACTOR)
- [ ] All tests passing
- [ ] Coverage >80%
- [ ] No linting errors
- [ ] Committed with clear message
- [ ] TodoWrite updated
- [ ] Context checked
```

---

## Metrics Reporting Template

At phase completion:
```markdown
## Phase Completion Report

**Phase**: [Phase Name]
**Status**: ✅ Complete / ⚠️ Partial / ❌ Failed
**Duration**: Xh Ymin (estimated: Zh)

**Subtasks**: X/Y completed
**Tests**: N passing, M failing
**Coverage**: X.X% (target: >80%)

**Context Usage**:
- Start: X% (XK tokens)
- Peak: Y% (YK tokens)
- End: Z% (ZK tokens)
- /compact runs: N
- /clear runs: N

**Commits**: N
**Checkpoints**: N

**Blockers**: [None / List]

**Token Efficiency**:
- Budget: XK tokens
- Actual: YK tokens
- Variance: ±Z%

**Next**: Ready for Phase N+1 / Need replan / Blocked
```

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Related**: claude-executor-guide.md, token-budget.md
