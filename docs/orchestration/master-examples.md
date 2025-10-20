# Claude-Master: Planning Examples

Examples of phase-based planning workflows for complex projects.

## Example 1: New Feature Implementation

**User Request**: "Add user authentication with JWT to the API"

**Phase Plan by claude-master**:
```markdown
## Project: User Authentication System
**Duration**: 8-10 hours (3 phases)
**Token Budget**: ~60K tokens (30% of capacity)

### Phase 1: Authentication Backend (3h)
**Subtasks**:
1. [ ] Create user model and migrations (<200 lines)
2. [ ] Implement password hashing (<150 lines)
3. [ ] Add JWT token generation (<200 lines)
4. [ ] Create /auth/register endpoint (<150 lines)
5. [ ] Create /auth/login endpoint (<150 lines)
6. [ ] Write unit tests (>80% coverage)

**Acceptance Criteria**:
- All tests pass
- Coverage >80%
- JWT tokens generated securely
- Passwords hashed with bcrypt

**Token Estimate**: ~20K tokens

**User Approval Required**: "approve phase 1" to proceed

---

### Phase 2: Authentication Middleware (2.5h)
**Dependencies**: Phase 1 complete

**Subtasks**:
1. [ ] Create auth middleware (<150 lines)
2. [ ] Add token validation (<150 lines)
3. [ ] Implement refresh tokens (<200 lines)
4. [ ] Add rate limiting (<100 lines)
5. [ ] Write middleware tests

**Acceptance Criteria**:
- Middleware validates JWT correctly
- Refresh tokens work properly
- Rate limiting prevents abuse
- Tests >80% coverage

**Token Estimate**: ~18K tokens

**User Approval Required**: "approve phase 2" to proceed

---

### Phase 3: Integration & Documentation (2.5h)
**Dependencies**: Phases 1-2 complete

**Subtasks**:
1. [ ] Integrate auth with existing endpoints (<200 lines)
2. [ ] Add authorization middleware (<150 lines)
3. [ ] Create API documentation
4. [ ] Write integration tests
5. [ ] Update deployment config

**Acceptance Criteria**:
- All endpoints protected
- Documentation complete
- Integration tests pass
- Ready for deployment

**Token Estimate**: ~17K tokens
```

**Master Action**: Present to user, wait for "approve all phases" or "approve phase 1"

---

## Example 2: Bug Fix & Optimization

**User Request**: "Fix memory leak in webhook processing"

**Phase Plan by claude-master**:
```markdown
## Project: Webhook Memory Leak Fix
**Duration**: 4-5 hours (2 phases)
**Token Budget**: ~35K tokens

### Phase 1: Investigation & Root Cause (2h)
**Subtasks**:
1. [ ] Profile memory usage
2. [ ] Analyze webhook handler code
3. [ ] Identify leak sources
4. [ ] Create reproduction test
5. [ ] Document findings

**Acceptance Criteria**:
- Leak source identified
- Reproduction test available
- Analysis documented

**Token Estimate**: ~15K tokens

---

### Phase 2: Fix Implementation (2.5h)
**Dependencies**: Phase 1 complete

**Subtasks**:
1. [ ] Implement memory fix (<200 lines)
2. [ ] Add resource cleanup (<150 lines)
3. [ ] Update error handling
4. [ ] Add memory monitoring
5. [ ] Write regression tests

**Acceptance Criteria**:
- Memory leak resolved
- Monitoring in place
- Tests prevent regression

**Token Estimate**: ~18K tokens
```

---

## Example 3: Multi-Agent Coordination

**User Request**: "Build complete checkout flow with payment processing"

**Phase Plan by claude-master**:
```markdown
## Project: Checkout Flow
**Duration**: 12 hours (4 phases)
**Token Budget**: ~75K tokens
**Agents Required**: frontend-developer, typescript-pro, api-integration-specialist

### Phase 1: Backend API (3h) → typescript-pro
**Subtasks**:
1. [ ] Cart model & endpoints
2. [ ] Order processing logic
3. [ ] Inventory management
4. [ ] Unit tests

**Token Estimate**: ~20K tokens

---

### Phase 2: Payment Integration (3h) → api-integration-specialist
**Subtasks**:
1. [ ] Stripe integration
2. [ ] Payment webhooks
3. [ ] Transaction logging
4. [ ] Error handling

**Token Estimate**: ~18K tokens

---

### Phase 3: Frontend UI (3h) → frontend-developer
**Subtasks**:
1. [ ] Cart component
2. [ ] Checkout form
3. [ ] Payment UI
4. [ ] Success/error states

**Token Estimate**: ~20K tokens

---

### Phase 4: Integration Testing (2.5h) → test-engineer
**Subtasks**:
1. [ ] E2E checkout tests
2. [ ] Payment flow tests
3. [ ] Error scenario tests
4. [ ] Performance tests

**Token Estimate**: ~15K tokens
```

**Master Action**:
1. Present full plan
2. Get user approval
3. Delegate Phase 1 to typescript-pro
4. Monitor completion
5. Move to next phase

---

## Example 4: Database Migration

**User Request**: "Migrate from MongoDB to PostgreSQL"

**Phase Plan by claude-master**:
```markdown
## Project: Database Migration
**Duration**: 10 hours (3 phases)
**Token Budget**: ~65K tokens

### Phase 1: Schema Design (2.5h)
**Subtasks**:
1. [ ] Analyze MongoDB collections
2. [ ] Design PostgreSQL schema
3. [ ] Create migrations
4. [ ] Document mappings

**Token Estimate**: ~18K tokens

---

### Phase 2: Data Migration (3.5h)
**Subtasks**:
1. [ ] Build migration scripts
2. [ ] Test with sample data
3. [ ] Validate data integrity
4. [ ] Create rollback plan

**Token Estimate**: ~25K tokens

---

### Phase 3: Application Update (3.5h)
**Subtasks**:
1. [ ] Update database layer
2. [ ] Replace queries
3. [ ] Update tests
4. [ ] Performance tuning

**Token Estimate**: ~22K tokens
```

---

## Planning Best Practices

### Token Estimation Formula
```
Phase Token Budget =
  System Prompts (800-1000)
  + Phase Context (3-5K)
  + Code Files (10-15K per file)
  + Conversation (2K per interaction)
  + Tool Results (1K per read/write)
  + Buffer (20%)
```

### Phase Size Guidelines
- **Simple**: 1-2h, 2-4 subtasks, ~12K tokens
- **Medium**: 2-3h, 4-6 subtasks, ~20K tokens
- **Complex**: 3-4h, 6-8 subtasks, ~30K tokens
- **Never**: >4h or >8 subtasks (split into multiple phases)

### User Approval Protocol
1. Present complete plan with token estimates
2. Show phase dependencies
3. Wait for explicit "approve" or "approve phase N"
4. Never auto-execute without approval
5. Provide token budget at each checkpoint

### Delegation Decision Matrix
| Complexity | Duration | Decision |
|------------|----------|----------|
| Simple | <1h | Master handles directly |
| Medium | 1-2h | Delegate if specialized |
| Complex | 2-4h | Always delegate to executor |
| Very Complex | >4h | Break into multiple phases |

---

## Anti-Patterns to Avoid

### ❌ Don't: Create Phases >4 Hours
```markdown
Phase 1: Complete Authentication System (8h)
- 15 subtasks
- Token estimate: 60K
```
**Problem**: Exceeds context window, no checkpoints

### ✅ Do: Break Into 2-3 Hour Phases
```markdown
Phase 1: Auth Backend (3h) - 6 subtasks, 20K tokens
Phase 2: Auth Middleware (2.5h) - 5 subtasks, 18K tokens
Phase 3: Integration (2h) - 4 subtasks, 15K tokens
```

### ❌ Don't: Include Large Examples in Plan
**Problem**: Wastes tokens, clutters context

### ✅ Do: Reference External Docs
```markdown
For implementation patterns, see:
- docs/auth-patterns.md
- docs/jwt-best-practices.md
```

### ❌ Don't: Auto-Execute Phases
**Problem**: User loses control, wastes tokens if wrong

### ✅ Do: Wait for Approval
```markdown
Phase plan ready. Token budget: 55K (27% of capacity)
Reply "approve" to proceed with Phase 1
```

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Related**: claude-executor-guide.md, phase-based-development.md
