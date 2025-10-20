# Agent Delegation Matrix

Decision matrix for routing tasks to appropriate specialized agents.

## Quick Reference

| Task Domain | Agent | Model | Use When |
|------------|-------|-------|----------|
| **Frontend** | `frontend-developer` | sonnet | React, UI, client-side |
| **Frontend Design** | `ui-ux-designer` | sonnet | Design systems, UX flows |
| **Backend API** | `typescript-pro` | sonnet | TypeScript API development |
| **Backend Python** | `python-pro` | sonnet | Python services, FastAPI |
| **Database** | `database-migrator` | sonnet | Schema changes, migrations |
| **Database Performance** | `supabase-expert` | sonnet | Query optimization, RLS |
| **Testing** | `test-engineer` | sonnet | Test strategy, automation |
| **E2E Testing** | `e2e-test-engineer` | sonnet | Playwright, Cypress tests |
| **Code Review** | `code-reviewer` | opus | Final quality validation |
| **Security** | `security-auditor` | opus | Security audits, vulnerabilities |
| **DevOps** | `ci-cd-engineer` | sonnet | CI/CD pipelines, deployments |
| **Infrastructure** | `infrastructure-architect` | opus | IaC, cloud architecture |
| **API Integration** | `api-integration-specialist` | sonnet | Third-party APIs, webhooks |
| **Documentation** | `api-documenter` | sonnet | API docs, technical writing |
| **AI/ML** | `ai-engineer` | opus | LLM integration, AI features |
| **Prompts** | `prompt-engineer` | opus | Prompt optimization, AI tuning |
| **Analysis** | `business-analyst` | opus | Business logic, requirements |
| **Research** | `research-analyst` | sonnet | Information gathering, synthesis |
| **Phase Execution** | `claude-executor` | sonnet | Implement phases from claude-master |

## Decision Framework

### 1. By Complexity

```
Simple Task (<1h)
├─ Handle directly
└─ No delegation needed

Medium Task (1-2h)
├─ Consider domain
├─ If specialized → Delegate
└─ If general → Handle directly

Complex Task (>2h)
├─ ALWAYS delegate
├─ Break into subtasks
└─ Use specialists
```

### 2. By Domain

#### Frontend Development

**Primary Agent**: `frontend-developer` (sonnet)

**Use For**:
- React component development
- State management
- Client-side routing
- CSS/Tailwind styling
- Performance optimization

**Fallback**: `ui-ux-designer` for design-heavy tasks

**Example Delegation**:
```typescript
Task({
  subagent_type: "frontend-developer",
  description: "Build responsive dashboard",
  prompt: "Create a responsive dashboard component using React 18 and Tailwind CSS"
})
```

#### Backend Development

**Primary Agents**:
- `typescript-pro` (sonnet) - TypeScript/Node.js
- `python-pro` (sonnet) - Python/FastAPI
- `backend-developer` (sonnet) - General backend

**Use For**:
- API endpoint development
- Business logic implementation
- Database queries
- Authentication/authorization
- Server-side validation

**Example Delegation**:
```typescript
Task({
  subagent_type: "typescript-pro",
  description: "Implement REST API",
  prompt: "Create REST API endpoints for user management with TypeScript and Express"
})
```

#### Database Work

**Primary Agents**:
- `database-migrator` (sonnet) - Schema changes
- `supabase-expert` (sonnet) - Supabase-specific
- `data-engineer` (opus) - Complex data pipelines

**Use For**:
- Schema design and migrations
- Query optimization
- Index management
- RLS policies (Supabase)
- Data transformations

**Example Delegation**:
```typescript
Task({
  subagent_type: "database-migrator",
  description: "Add user preferences table",
  prompt: "Create migration to add user_preferences table with proper relationships"
})
```

#### Testing

**Primary Agents**:
- `test-engineer` (sonnet) - Test strategy, unit tests
- `e2e-test-engineer` (sonnet) - End-to-end tests

**Use For**:
- Test suite creation
- Test automation
- Coverage improvement
- E2E test scenarios
- Performance testing

**Example Delegation**:
```typescript
Task({
  subagent_type: "test-engineer",
  description: "Create comprehensive test suite",
  prompt: "Write unit and integration tests for the authentication module"
})
```

#### Code Review & Quality

**Primary Agent**: `code-reviewer` (opus)

**Use For**:
- Final code review before merge
- Security vulnerability scan
- Best practices validation
- Performance review
- Architecture validation

**Example Delegation**:
```typescript
Task({
  subagent_type: "code-reviewer",
  description: "Review payment module",
  prompt: "Review payment processing code for security, performance, and best practices"
})
```

#### Security

**Primary Agent**: `security-auditor` (opus)

**Use For**:
- Security audits
- Vulnerability assessments
- Penetration testing
- Security best practices
- Compliance validation

**Example Delegation**:
```typescript
Task({
  subagent_type: "security-auditor",
  description: "Security audit",
  prompt: "Perform comprehensive security audit of the authentication system"
})
```

#### DevOps & Infrastructure

**Primary Agents**:
- `ci-cd-engineer` (sonnet) - CI/CD pipelines
- `infrastructure-architect` (opus) - Cloud infrastructure

**Use For**:
- GitHub Actions workflows
- Deployment pipelines
- Infrastructure as Code
- Cloud resource provisioning
- Container orchestration

**Example Delegation**:
```typescript
Task({
  subagent_type: "ci-cd-engineer",
  description: "Setup deployment pipeline",
  prompt: "Create GitHub Actions workflow for automated deployment to staging"
})
```

#### API Integration

**Primary Agent**: `api-integration-specialist` (sonnet)

**Use For**:
- Third-party API integration
- Webhook implementation
- OAuth flows
- REST/GraphQL clients
- API error handling

**Example Delegation**:
```typescript
Task({
  subagent_type: "api-integration-specialist",
  description: "Integrate Stripe",
  prompt: "Implement Stripe payment integration with webhook handling"
})
```

#### Documentation

**Primary Agents**:
- `api-documenter` (sonnet) - API documentation
- `docs-architect` (sonnet) - Technical documentation

**Use For**:
- API documentation
- Technical guides
- Architecture documentation
- User guides
- Code comments

**Example Delegation**:
```typescript
Task({
  subagent_type: "api-documenter",
  description: "Document REST API",
  prompt: "Create OpenAPI documentation for all API endpoints"
})
```

#### AI/ML

**Primary Agents**:
- `ai-engineer` (opus) - LLM applications, RAG
- `prompt-engineer` (opus) - Prompt optimization

**Use For**:
- LLM integration
- RAG system implementation
- AI agent orchestration
- Prompt engineering
- Model fine-tuning

**Example Delegation**:
```typescript
Task({
  subagent_type: "ai-engineer",
  description: "Implement RAG system",
  prompt: "Build RAG system for document question-answering using vector search"
})
```

#### Business Analysis

**Primary Agent**: `business-analyst` (opus)

**Use For**:
- Requirements analysis
- Business logic design
- Data analysis
- ROI calculations
- Strategic planning

**Example Delegation**:
```typescript
Task({
  subagent_type: "business-analyst",
  description: "Analyze feature ROI",
  prompt: "Analyze ROI for proposed premium subscription feature"
})
```

#### Phase Execution

**Primary Agent**: `claude-executor` (sonnet)

**Use For**:
- Executing phases planned by claude-master
- Token-optimized implementation
- TDD-driven development
- Checkpoint-based execution
- Quality gate enforcement

**Example Delegation**:
```typescript
Task({
  subagent_type: "claude-executor",
  description: "Execute authentication phase",
  prompt: `Execute Phase: User Authentication API

Phase Definition:
- Subtasks: [
    "Implement POST /auth/register endpoint",
    "Implement POST /auth/login endpoint",
    "Add JWT token generation",
    "Write integration tests"
  ]
- Acceptance Criteria: All tests pass, >80% coverage
- Duration: 3 hours

Follow TDD strictly and checkpoint every 30 minutes.`
})
```

## Delegation Patterns

### Sequential Pattern

Tasks depend on each other, execute in order:

```typescript
// Step 1: Design
await Task({
  subagent_type: "ui-ux-designer",
  prompt: "Design user onboarding flow"
});

// Step 2: Implement Frontend
await Task({
  subagent_type: "frontend-developer",
  prompt: "Implement onboarding UI based on design"
});

// Step 3: Implement Backend
await Task({
  subagent_type: "typescript-pro",
  prompt: "Create onboarding API endpoints"
});

// Step 4: Test
await Task({
  subagent_type: "e2e-test-engineer",
  prompt: "Create E2E tests for onboarding flow"
});

// Step 5: Review
await Task({
  subagent_type: "code-reviewer",
  prompt: "Review entire onboarding implementation"
});
```

### Parallel Pattern

Independent tasks execute simultaneously:

```bash
# Single message with multiple Task calls
Task(subagent_type="frontend-developer", prompt="Build dashboard UI")
Task(subagent_type="backend-developer", prompt="Create analytics API")
Task(subagent_type="database-migrator", prompt="Add analytics tables")
Task(subagent_type="api-documenter", prompt="Document analytics endpoints")
```

### Hierarchical Pattern

Complex task delegates to subtasks:

```typescript
// Main Task: Launch New Feature
Task({
  subagent_type: "claude-master",  // Coordinator
  prompt: "Orchestrate launch of payment feature",
  subtasks: [
    // Design Phase
    { agent: "ui-ux-designer", task: "Design payment UI" },
    { agent: "business-analyst", task: "Define payment flows" },

    // Implementation Phase
    { agent: "frontend-developer", task: "Implement payment UI" },
    { agent: "typescript-pro", task: "Implement payment API" },
    { agent: "api-integration-specialist", task: "Integrate Stripe" },

    // Quality Phase
    { agent: "test-engineer", task: "Create payment tests" },
    { agent: "security-auditor", task: "Security audit payment flow" },
    { agent: "code-reviewer", task: "Final code review" }
  ]
});
```

## Model Selection

### Haiku (Fast & Cheap)

**Use For**:
- Simple configuration updates
- Quick fixes
- Linting/formatting
- Basic validation

**Not Recommended For**:
- Complex logic
- Architecture decisions
- Critical security code

### Sonnet (Balanced - Default)

**Use For**:
- Most development tasks
- Feature implementation
- Bug fixes
- Testing
- Documentation

**Recommended For**:
- 80% of tasks
- Default choice when unsure

### Opus (Powerful)

**Use For**:
- Complex architecture
- Security audits
- AI/ML implementation
- Business analysis
- Critical code review

**Use Sparingly**:
- Higher cost
- Slower response
- Only when complexity justifies it

## Fallback Strategies

### Primary Agent Fails

```typescript
async function delegateWithFallback(primary, fallback, task) {
  try {
    return await Task({ subagent_type: primary, prompt: task });
  } catch (error) {
    console.warn(`${primary} failed, using ${fallback}`);
    return await Task({ subagent_type: fallback, prompt: task });
  }
}

// Example
const result = await delegateWithFallback(
  "typescript-pro",       // Primary
  "backend-developer",    // Fallback
  "Implement user service"
);
```

### Agent Not Available

```typescript
// Check available agents first
const agents = await listAgents();

if (agents.includes("whatsapp-api-expert")) {
  await Task({ subagent_type: "whatsapp-api-expert", ... });
} else {
  await Task({ subagent_type: "api-integration-specialist", ... });
}
```

### Task Too Complex

```typescript
// Break into smaller subtasks
const subtasks = [
  { agent: "frontend-developer", task: "Build UI form" },
  { agent: "typescript-pro", task: "Create validation logic" },
  { agent: "database-migrator", task: "Add database fields" },
  { agent: "test-engineer", task: "Write tests" }
];

for (const subtask of subtasks) {
  await Task({ subagent_type: subtask.agent, prompt: subtask.task });
}
```

## Performance Optimization

### Parallel Execution

```bash
# ✅ Good - Parallel independent tasks
Task(agent="frontend") & Task(agent="backend") & Task(agent="docs")

# ❌ Bad - Sequential when parallel possible
Task(agent="frontend"); Task(agent="backend"); Task(agent="docs")
```

### Right-Sized Agents

```bash
# ✅ Good - Sonnet for implementation
Task(agent="frontend-developer", model="sonnet")

# ❌ Bad - Opus for simple task (expensive)
Task(agent="frontend-developer", model="opus")
```

### Batch Similar Tasks

```bash
# ✅ Good - Single agent for related work
Task(agent="api-documenter", prompt="Document all 10 endpoints")

# ❌ Bad - Multiple small delegations
for endpoint in endpoints:
    Task(agent="api-documenter", prompt=f"Document {endpoint}")
```

## Common Routing Errors

### Over-Delegation

**Problem**: Delegating trivial tasks
```bash
# ❌ Bad
Task(agent="typescript-pro", prompt="Fix typo in variable name")

# ✅ Good
# Handle directly - it's a 30-second fix
```

### Under-Delegation

**Problem**: Handling complex tasks directly
```bash
# ❌ Bad
# Master trying to implement complex security feature

# ✅ Good
Task(agent="security-auditor", prompt="Implement OAuth 2.0 flow")
```

### Wrong Agent

**Problem**: Mismatched agent to task
```bash
# ❌ Bad
Task(agent="frontend-developer", prompt="Optimize database queries")

# ✅ Good
Task(agent="database-optimizer", prompt="Optimize database queries")
```

## Related Documentation

- [Orchestration README](./README.md) - Overall methodology
- [Phase-Based Development](./phase-based-development.md) - Planning approach
- [Subagents Guide](../subagents/README.md) - Agent configuration
- [Agent Types](../subagents/agent-types.md) - All available agents

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Maintained by**: Project Orchestration Team
