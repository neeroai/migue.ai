# Orchestration Troubleshooting Guide

Common issues and solutions for claude-master and claude-executor workflows.

## Context Management Issues

### Issue: Context Approaching 80%

**Symptoms**:
- `/context` shows >75%
- Slow responses
- Unable to load more files

**Solutions**:

**Option 1: Run /compact** (if <80%)
```bash
1. Save current work
   $ git add . && git commit -m "Checkpoint before compact"

2. Update TodoWrite status

3. Run /compact
   $ /compact

4. Check result
   $ /context
   # Should drop 10-20%

5. Continue if <70%, otherwise try Option 2
```

**Option 2: Checkpoint & /clear** (if >80%)
```bash
1. STOP all work immediately

2. Commit everything
   $ git add . && git commit -m "Checkpoint: context limit"

3. Update TodoWrite with detailed status

4. Document current state:
   - What subtask you're on
   - What's pending
   - Any blockers

5. Run /clear
   $ /clear

6. Resume with minimal context:
   - Read ONLY phase definition
   - Read ONLY current subtask requirements
   - Don't reload history
```

**Prevention**:
- Monitor every 30min
- Run /compact proactively at 60%
- Load docs on-demand only
- Use Grep instead of reading entire files

---

### Issue: /compact Not Reducing Context

**Symptoms**:
- Run /compact but context stays >70%
- Already ran /compact 2-3 times

**Root Cause**:
- Too much active conversation history
- Large files loaded in context
- Multiple tool results accumulated

**Solution**:
```bash
1. Stop & checkpoint current work

2. Identify what's consuming tokens:
   - Long conversation history
   - Multiple large file reads
   - Extensive tool outputs

3. Use /clear (only option at this point)

4. Resume with MINIMAL context:
   - Phase objective only
   - Current subtask only
   - Load files just-in-time
```

**Prevention**:
- Reference external docs instead of reading
- Use targeted Grep queries
- Limit file reads to necessary sections
- Keep communication concise

---

### Issue: Running Out of Context Mid-Phase

**Symptoms**:
- Context at 85%+ mid-phase
- Can't complete current subtask
- Can't load necessary files

**Immediate Action**:
```bash
1. STOP work immediately

2. Ask user for guidance:
   "Context critical at 85%. Options:
    1. Checkpoint & /clear (lose context, restart)
    2. Complete current subtask only (skip rest)
    3. Split phase into 2 phases

    Recommend: option 3"

3. If user chooses option 3:
   - Complete current subtask
   - Report to master
   - Let master create smaller phase for remaining work
```

**Long-term Fix**:
- Phases too large (reduce to 2-3h max)
- Too many subtasks (max 6 per phase)
- Loading unnecessary files
- Not using /compact proactively

---

## TDD Issues

### Issue: Tests Don't Exist

**Symptoms**:
```bash
$ grep "feature X" tests/
# No results found
```

**Solution for Executor**:
```bash
1. STOP implementation immediately

2. Report to master:
   "Tests missing for [subtask name].
    Cannot proceed with TDD.
    Need test-engineer to create tests first."

3. Wait for master response

4. Once tests created:
   $ npm test -- feature-x
   # Verify test FAILS (RED)

5. Proceed with implementation
```

**Solution for Master**:
```markdown
When planning phases:

1. Check if tests exist:
   $ grep "feature name" tests/**/*.test.*

2. If tests missing, create test-first subtask:
   Phase 1: Write Tests (1h) → test-engineer
   Phase 2: Implement Feature (2h) → executor

3. Ensure executor receives phase AFTER tests exist
```

**Prevention**:
- Always plan test creation first
- Verify tests exist before delegating
- Use test-engineer for test creation
- Never assume tests exist

---

### Issue: Tests Exist But Not Failing

**Symptoms**:
```bash
$ npm test -- new-feature
✓ All tests passing (should be RED)
```

**Root Cause**:
- Tests not properly written
- Feature already partially implemented
- Wrong tests being run

**Solution**:
```bash
1. Verify correct test:
   $ cat tests/new-feature.test.ts
   # Check if test is for correct feature

2. If test is wrong:
   - Report to master
   - Request test update from test-engineer

3. If feature partially exists:
   - Remove partial implementation
   - Re-run test (should FAIL now)
   - Proceed with TDD

4. If still passing:
   - Report to master
   - Something is wrong with test setup
```

---

### Issue: Can't Achieve >80% Coverage

**Symptoms**:
```bash
$ npm run coverage
Coverage: 72.3% (below 80% requirement)
```

**Solution**:
```bash
1. Identify uncovered lines:
   $ npm run coverage -- --verbose
   # Shows which lines need tests

2. Add missing test cases:
   - Error scenarios
   - Edge cases
   - Validation failures

3. Focus on critical paths first

4. If legitimately can't test (e.g., external API):
   - Document why
   - Add TODO comment
   - Report to master with justification
```

**Prevention**:
- Write tests for all paths
- Test error scenarios
- Test validation
- Test edge cases
- Use mocks for external dependencies

---

## Delegation Issues

### Issue: Executor Not Responding

**Symptoms**:
- Master delegates but no response
- Timeout after several minutes

**Solutions**:

**Check 1: Verify executor exists**
```bash
$ ls .claude/agents/claude-executor.md
# Should exist
```

**Check 2: Verify triggers match**
```bash
# Master should use these phrases:
"execute phase"
"run phase"
"implement phase"
```

**Check 3: Try manual invocation**
```bash
# Instead of Task delegation:
@claude-executor please execute this phase:
[phase definition]
```

**Fallback**:
```bash
# If executor unavailable, master handles directly
# But report issue to user
```

---

### Issue: Executor Executing Without Approval

**Symptoms**:
- Phases start automatically
- No user confirmation requested
- Unexpected token consumption

**Root Cause**:
- Approval gate missing
- User said "yes" too broadly
- Executor misunderstood scope

**Solution**:
```bash
1. STOP execution immediately
   "STOP - user approval required"

2. Review what was already done:
   $ git log --oneline -5
   # Check recent commits

3. If work is acceptable:
   - Continue with approval protocol

4. If work is unwanted:
   $ git reset --hard [last-good-commit]
   # Undo unauthorized work

5. Fix approval gate:
   - Require explicit "approve phase N"
   - Never proceed on vague "yes"
```

**Prevention**:
- Always show phase plan with token estimate
- Wait for explicit "approve" or "proceed"
- Confirm scope before starting
- Report token budget upfront

---

## Subtask Issues

### Issue: Subtask Taking >1.5 Hours

**Symptoms**:
- Subtask estimated 30min, actual 90min+
- Still not complete
- Context usage rising

**Solution for Executor**:
```bash
1. At 1.5h mark, STOP and assess

2. Calculate completion:
   - 60% done? Continue to finish
   - <50% done? Need to split

3. Report to master:
   "Subtask X more complex than estimated.
    Currently Y% complete.
    Recommend:
    - Split into X.1 (done) and X.2 (remaining)
    - Create new phase for X.2"

4. Wait for master decision

5. Complete what's done, checkpoint
```

**Solution for Master**:
```markdown
When receiving complexity report:

1. Assess remaining work

2. If significant (>1h remaining):
   - Accept completed portion
   - Create new phase for remainder
   - Re-estimate token budget

3. Update phase plan with realistic estimates
```

**Prevention**:
- Estimate conservatively (add 30% buffer)
- Break into smaller subtasks (<200 lines)
- Review estimates after each phase
- Learn from past variance

---

### Issue: Subtask Has Hidden Dependencies

**Symptoms**:
```bash
# Working on subtask 3
# Discover it requires subtask 5 to be done first
```

**Solution**:
```bash
1. STOP current subtask

2. Report to master:
   "Dependency issue: Subtask 3 requires Subtask 5 first.
    Recommend reorder:
    5 → 3 → 4 → 6"

3. Wait for master to replan

4. Execute in correct order
```

**Prevention (Master)**:
- Analyze dependencies during planning
- Order subtasks by dependency chain
- Mark dependencies explicitly
- Validate order before delegating

---

## Quality Gate Failures

### Issue: Linting Errors Blocking Completion

**Symptoms**:
```bash
$ npm run lint
✗ 12 errors, 3 warnings
```

**Solution**:
```bash
1. Run auto-fix first:
   $ npm run lint -- --fix

2. Check remaining errors:
   $ npm run lint

3. Fix manually if auto-fix insufficient

4. If errors are legitimate style issues:
   - Fix them (part of quality gate)

5. If errors are false positives:
   - Document why
   - Add eslint-disable comment with justification
   - Report to master
```

**Prevention**:
- Run lint during development
- Use editor with lint integration
- Fix as you go
- Follow project style guide

---

### Issue: Tests Passing Locally, Failing in CI

**Symptoms**:
```bash
# Local:
$ npm test
✓ All tests passing

# CI:
Build #123 failed - tests failing
```

**Common Causes**:
1. Environment differences
2. Timing issues
3. Missing dependencies
4. Database state

**Solution**:
```bash
1. Check CI logs:
   $ gh run view 123

2. Identify failed tests

3. Reproduce locally:
   - Use same Node version
   - Clear node_modules
   - Fresh database

4. Fix root cause:
   - Add missing env vars
   - Fix timing issues (use waitFor)
   - Add missing dependencies
   - Reset database state

5. Verify in CI:
   $ git push
   # Wait for CI to pass
```

---

## Communication Issues

### Issue: Master and Executor Out of Sync

**Symptoms**:
- Executor working on wrong phase
- Master thinks phase complete but executor still working
- Token estimates don't match actual

**Solution**:
```bash
1. STOP all work

2. Executor reports status:
   "Current phase: X
    Subtask: Y
    Progress: Z%
    Context: W%"

3. Master acknowledges:
   "Confirmed. Continue with current phase"
   OR
   "STOP. Wrong phase. Switch to [correct phase]"

4. Resync and continue
```

**Prevention**:
- Clear phase handoff
- Explicit acknowledgment
- Status checkpoints every 30min
- TodoWrite as shared state

---

### Issue: User Unclear About Progress

**Symptoms**:
- User asks "where are we?"
- Unclear what phase is active
- Don't know token usage

**Solution**:
```bash
Both master and executor should provide:

1. Regular status updates (every 30min)

2. Progress format:
   "Phase 2 of 3: Authentication
    Subtask 3/6: JWT Generation
    Time: 1.5h of 3h (50%)
    Context: 42% (84K tokens)
    Next: Token refresh implementation"

3. At checkpoints:
   "✓ Checkpoint: 3/6 complete
    Tests: 12 passing
    Coverage: 83%
    Context: 45%
    Estimated: 1h remaining"
```

**Prevention**:
- Proactive status updates
- TodoWrite visibility
- Clear phase boundaries
- Regular user check-ins

---

## Token Budget Issues

### Issue: Phase Exceeded Token Budget

**Symptoms**:
- Estimated 20K, actual 35K
- Budget exhausted mid-phase

**Root Causes**:
1. Under-estimated complexity
2. Loaded too many files
3. Long conversations
4. Multiple retries

**Solution**:
```bash
1. Complete current subtask

2. Report variance:
   "Token budget exceeded:
    Budgeted: 20K
    Actual: 28K (so far)
    Remaining: 2 subtasks
    Estimated need: 8K more
    Total: 36K (80% over budget)"

3. Get user approval:
   "Continue with additional 16K tokens? (yes/no)"

4. If no:
   - Checkpoint current progress
   - Create new phase for remaining work
```

**Prevention**:
- Add 30% buffer to estimates
- Monitor tokens during execution
- Use /context frequently
- Optimize file reads
- Keep conversation concise

---

## Recovery Procedures

### Scenario: Lost Context (Crash/Disconnect)

**Recovery Steps**:
```bash
1. Check last commit:
   $ git log -1

2. Check TodoWrite state:
   # Read .claude/todos.md or last status

3. Resume with minimal context:
   - Don't reload full history
   - Read only current phase definition
   - Read only current subtask

4. Ask user:
   "Last checkpoint: [timestamp]
    Last completed: [subtask]
    Ready to resume with [next subtask]? (yes/no)"

5. Continue from checkpoint
```

### Scenario: Realized Wrong Approach Mid-Phase

**Recovery Steps**:
```bash
1. STOP implementation

2. Assess work done:
   $ git diff

3. If work is salvageable:
   - Commit what's good
   - Undo what's wrong
   - Adjust approach

4. If completely wrong:
   $ git reset --hard [last-good-commit]
   - Report to user
   - Request replanning

5. Learn and adjust
```

---

## Escalation Matrix

| Issue Type | Severity | First Response | Escalate To |
|------------|----------|----------------|-------------|
| Context >80% | High | Executor: checkpoint & report | Master: replan |
| Tests missing | Medium | Executor: stop & report | Master: delegate test-engineer |
| Subtask >1.5h | Medium | Executor: report complexity | Master: split subtask |
| Dependency blocker | High | Executor: mark blocked | Master: resolve or reorder |
| Quality gate fail | Low | Executor: fix and retry | Master: if can't fix in 30min |
| Token budget exceeded | Medium | Report to user | User: approve additional tokens |
| Lost context | High | Checkpoint immediately | Master: assess and replan |

---

## Debug Mode

Enable verbose logging:
```bash
export CLAUDE_DEBUG=true
export CLAUDE_AGENT_DEBUG=true
```

Check agent health:
```bash
claude mcp list
# Verify both agents connected
```

Test triggers:
```bash
# Test master triggers
echo "plan project" | grep -i "plan"

# Test executor triggers
echo "execute phase" | grep -i "execute"
```

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Related**: master-examples.md, executor-examples.md, token-budget.md
