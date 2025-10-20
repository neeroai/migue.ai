# Project Orchestration Methodology

Comprehensive guide to orchestrating complex software projects using claude-master and subagent delegation.

## Overview

The orchestration methodology is built on four core principles:

1. **Plan** - Break complexity into manageable, checkpoint-sized phases
2. **Delegate** - Route work to specialized agents based on domain expertise
3. **Monitor** - Track progress, resource usage, and quality metrics
4. **Enforce** - Maintain quality standards through gates and reviews

## Documentation Structure

- [README.md](./README.md) - This file, orchestration overview
- [phase-based-development.md](./phase-based-development.md) - Detailed phase-based methodology
- [delegation-matrix.md](./delegation-matrix.md) - Agent routing decision matrix
- [claude-executor-guide.md](./claude-executor-guide.md) - Token-optimized executor agent guide

## Key Concepts

### Phase-Based Development

Projects are broken into phases that align with Claude's 5-hour context cycle:

- **Phase Size**: 2-4 hours of work
- **Subtask Size**: <200 line diffs per subtask
- **Checkpoint Cadence**: Every 30 minutes
- **Context Monitoring**: Compact at 60%, clear at 80%

**Benefits**:
- Prevents work loss from context resets
- Enables clean checkpointing
- Reduces cognitive load
- Facilitates parallel work

### Multi-Agent Delegation

Work is delegated to specialized agents based on:

- **Complexity**: Simple (<1h) vs Complex (>2h)
- **Domain**: Frontend, backend, database, testing, etc.
- **Task Type**: Implementation, review, documentation, research

**Delegation Patterns**:
- **Sequential**: Task A → Task B → Task C (dependencies)
- **Parallel**: Tasks A, B, C simultaneously (independent)
- **Hierarchical**: Main task delegates to subtasks with their own agents
- **Fallback**: Primary agent fails → Retry with general-purpose agent

### Context Optimization

Efficient use of Claude's context window:

**Load Documentation On-Demand**:
```
❌ Load all docs at start → Wastes tokens
✅ Load docs when needed → Just-in-time learning
```

**External References vs Embedding**:
```
❌ Embed entire API docs in prompt → Thousands of tokens
✅ "See docs/api-guide.md for details" → Few tokens
```

**Monitoring & Checkpointing**:
- Check `/context` every 30 minutes
- Use `/compact` at 60% context usage
- Use `/clear` at 80% context usage
- Save state before context operations

### Quality Enforcement

**Test-Driven Development**:
1. Write test that fails
2. Implement minimal code to pass
3. Refactor
4. Repeat

**Quality Gates**:
- Technical validation (tests, security, performance)
- Code review (automated + human)
- Documentation completeness
- Performance benchmarks
- Security audits

**Review Protocol**:
- All code reviewed before merge
- Security audit for sensitive code
- Performance testing for critical paths
- Accessibility validation for UI

## Orchestration Workflow

### 1. Session Start

```markdown
**Objective**: Prepare for productive work session

1. Read project context (CLAUDE.md, README.md)
2. Assess context availability (need >3h for complex work)
3. Detect project:
   - Tech stack (package.json, requirements.txt, etc.)
   - Available agents (/agents)
   - Documentation structure
4. Create TodoWrite plan with phases
5. Set 30-minute checkpoint cadence
```

### 2. During Execution

```markdown
**Objective**: Execute work efficiently and maintain quality

1. Work smallest tasks first (build momentum)
2. Update TodoWrite continuously (transparency)
3. Monitor context every 30min (optimize proactively)
4. Delegate intelligently:
   - Tasks >2h → Specialists
   - Independent tasks → Parallel execution
5. Enforce quality gates:
   - TDD (tests first)
   - Code review before merge
   - Performance validation
6. Track metrics (tokens, costs, progress)
```

### 3. Session End

```markdown
**Objective**: Preserve state and prepare handoff

1. Checkpoint state (save progress with timestamp)
2. Update metrics (tokens, costs, tasks completed)
3. Document learnings (insights, decisions, blockers)
4. Prepare next session:
   - Update CLAUDE.md with context
   - List pending todos
   - Document next steps
5. Clean up (remove temp files, organize docs)
```

## Agent Orchestration

### Decision Framework

```
1. Analyze Task
   ├─ Complexity? (< 1h, 1-2h, > 2h)
   ├─ Domain? (frontend, backend, testing, etc.)
   └─ Dependencies? (sequential, parallel, hierarchical)

2. Select Agent
   ├─ Check /agents for available specialists
   ├─ Match task to agent description
   └─ Choose model (haiku/sonnet/opus)

3. Delegate Work
   ├─ Provide complete context
   ├─ Use Task tool with subagent_type
   └─ Monitor execution

4. Validate Result
   ├─ Verify completion criteria
   ├─ Run tests
   └─ Code review if needed
```

### Claude-Master + Claude-Executor

The orchestration framework uses a two-agent pattern for complex projects:

**claude-master v8.0** (The Expert Orchestrator):
- **Expertise**: Master of phase-based methodologies, token economics, and TDD
- **Planning**: Breaks work into 2-4h phases with <200 line subtasks
- **Token Budget**: Calculates and manages budgets (15-60K per phase)
- **Delegation**: Routes to specialized agents based on complexity and domain
- **Quality Enforcement**: Enforces TDD strict and quality gates
- **Context Intelligence**: Progressive loading, references over embedding, checkpoints at 60%

**claude-executor v3.0** (The Expert Implementer):
- **Expertise**: Master of TDD, token efficiency, and quality enforcement
- **Execution**: Implements phases with intelligent decision-making
- **TDD Deep**: RED-GREEN-REFACTOR with deep understanding (why + how)
- **Token Intelligence**: Progressive loading, context thresholds, efficiency formulas
- **Problem-Solving**: Proactive troubleshooting, proposes solutions (not just reports)
- **Quality Enforcement**: >80% coverage mandatory, quality gates strict

**Workflow**:
```
1. claude-master creates phase plan
   ├─ Phase objective
   ├─ Subtasks list (<200 lines each)
   ├─ Dependencies
   └─ Acceptance criteria

2. claude-master delegates to claude-executor
   Task({
     subagent_type: "claude-executor",
     prompt: "Execute Phase: [phase definition]"
   })

3. claude-executor executes phase
   ├─ Creates TodoWrite for subtasks
   ├─ Implements with TDD (red-green-refactor)
   ├─ Checkpoints every 30min
   ├─ Monitors context usage
   └─ Enforces quality gates

4. claude-executor reports back
   ├─ Completion metrics
   ├─ Test results
   ├─ Coverage report
   └─ Context usage

5. claude-master validates and continues
```

**See**: [claude-executor-guide.md](./claude-executor-guide.md) for detailed usage.

### Parallel Execution

Execute multiple independent tasks simultaneously:

```bash
# Single message with multiple Task tool calls
Task(subagent_type="frontend-developer", task="Build UI component")
Task(subagent_type="backend-developer", task="Create API endpoint")
Task(subagent_type="test-engineer", task="Write test suite")
```

**Benefits**:
- Faster completion
- Better resource utilization
- Independent work streams

**Constraints**:
- Tasks must be truly independent
- Shared resources need coordination
- Context budget split across agents

### Fallback Strategies

Handle agent failures gracefully:

```typescript
async function robustDelegation(primaryAgent, fallbackAgent, task) {
  try {
    return await delegateToAgent(primaryAgent, task);
  } catch (error) {
    console.warn(`Primary failed: ${error.message}`);
    return await delegateToAgent(fallbackAgent, task);
  }
}
```

## Context Management

### Token Budget

Typical context distribution:

```
Total Context: ~200K tokens
├─ System Prompts: ~5K tokens (2.5%)
├─ Project Docs: ~20K tokens (10%)
├─ Conversation: ~30K tokens (15%)
├─ Code Context: ~50K tokens (25%)
└─ Available: ~95K tokens (47.5%)
```

**Optimization Strategies**:
- Load docs on-demand, not upfront
- Reference external docs vs embedding
- Summarize large files
- Use caching for frequently accessed content

### Checkpoint Strategy

Save state regularly to prevent work loss:

**What to Checkpoint**:
- TodoWrite state (completed, in-progress, pending)
- Key decisions made
- Code changes (git commit)
- Documentation updates
- Metrics (tokens, costs, time)

**When to Checkpoint**:
- Every 30 minutes
- Before context operations (/compact, /clear)
- After completing major tasks
- Before ending session

**How to Checkpoint**:
```bash
# Create checkpoint file
cat > .claude/checkpoints/$(date +%Y-%m-%d-%H%M).md << EOF
# Checkpoint: $(date)

## Completed
- Task 1
- Task 2

## In Progress
- Task 3

## Pending
- Task 4
- Task 5

## Context
Current work on feature X, next step is Y

## Metrics
- Tokens: 85K / 200K (42%)
- Time: 2.5h / 5h (50%)
EOF
```

## Quality Gates

### Technical Gate

**Criteria**:
- [ ] All tests pass
- [ ] Code coverage >80%
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Linting clean

**Process**:
1. Run test suite
2. Check coverage report
3. Security scan
4. Performance tests
5. Lint + type check

### Code Review Gate

**Criteria**:
- [ ] Code reviewed by specialist
- [ ] Best practices followed
- [ ] Documentation complete
- [ ] No obvious bugs
- [ ] Maintainable code

**Process**:
1. Delegate to code-reviewer agent
2. Address feedback
3. Re-review if significant changes
4. Approval required to merge

### Documentation Gate

**Criteria**:
- [ ] README updated
- [ ] API docs current
- [ ] Code comments clear
- [ ] Architecture docs reflect reality
- [ ] Examples provided

**Process**:
1. Check documentation completeness
2. Validate examples work
3. Update diagrams if needed
4. Review for clarity

## Best Practices

### Planning

- ✅ Break projects into 2-4 hour phases
- ✅ Create subtasks with <200 line diffs
- ✅ Use TodoWrite for transparency
- ✅ Identify dependencies early
- ✅ Plan for testing and documentation

### Delegation

- ✅ Choose right agent for the job
- ✅ Provide complete context
- ✅ Use parallel execution when possible
- ✅ Monitor agent performance
- ✅ Implement fallback strategies

### Context

- ✅ Load docs on-demand
- ✅ Monitor every 30 minutes
- ✅ Checkpoint regularly
- ✅ Use external references
- ✅ Clear at 80% usage

### Quality

- ✅ Tests before implementation
- ✅ Code review before merge
- ✅ Performance validation
- ✅ Security audits
- ✅ Documentation completeness

## Troubleshooting

### High Context Usage

**Symptoms**: Approaching 80% context usage

**Solutions**:
1. Run `/compact` to reduce context
2. Checkpoint current state
3. Clear non-essential context
4. Continue with fresh context

### Delegation Failures

**Symptoms**: Agent returns errors or incomplete work

**Solutions**:
1. Check agent description matches task
2. Verify task requirements are clear
3. Try different agent or model
4. Use general-purpose as fallback
5. Break task into smaller subtasks

### Slow Progress

**Symptoms**: Tasks taking longer than expected

**Solutions**:
1. Break into smaller subtasks
2. Use parallel execution
3. Delegate more aggressively
4. Optimize context (reduce overhead)
5. Review task complexity estimates

## Related Documentation

- [Phase-Based Development](./phase-based-development.md) - Detailed methodology
- [Delegation Matrix](./delegation-matrix.md) - Agent routing guide
- [Subagents Guide](../subagents/README.md) - Agent configuration
- [Best Practices](../subagents/best-practices.md) - Optimization strategies

---

**Last Updated**: 2025-10-16
**Version**: 1.2.0 (Updated for claude-master v8.0 + claude-executor v3.0)
**Maintained by**: Project Orchestration Team
