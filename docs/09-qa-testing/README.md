# QA & Testing

Testing strategy, QA checklists, and test documentation for migue.ai.

## Overview

migue.ai maintains high quality through comprehensive testing across all layers.

## Documentation

- **[po-checklist.md](./po-checklist.md)** - Product Owner acceptance checklist
- **[test-scenarios.md](./test-scenarios.md)** - E2E test scenarios and cases

## Testing Strategy

### Test Pyramid

```
    /\
   /  \    E2E Tests (Playwright)
  /____\
 /      \  Integration Tests (Jest)
/________\ Unit Tests (Jest)
```

### Coverage

**Current Status**: 112 tests passing ✅

| Test Type | Count | Status |
|-----------|-------|--------|
| Unit Tests | 89 | ✅ Passing |
| E2E Tests | 23 | ✅ Passing |
| Total | 112 | ✅ All passing |

## Running Tests

```bash
# All tests
npm run test

# Unit tests only
npm run test:unit

# E2E tests only
npm run test:e2e

# Watch mode
npm run test:watch

# Type checking
npm run typecheck
```

## Test Requirements

### For New Features
1. **Unit Tests**: Core logic and utilities
2. **E2E Tests**: User flows (≥1 happy path + ≥1 failure path)
3. **Edge Compatibility**: Verify runtime compatibility

### For Bug Fixes
1. **Regression Test**: Test must fail before fix
2. **Verify Fix**: Test passes after fix
3. **Related Tests**: Ensure no regression in related features

## E2E Test Structure

```typescript
describe('Feature Name', () => {
  it('should handle happy path', async () => {
    // Test successful flow
  });

  it('should handle error case', async () => {
    // Test error handling
  });
});
```

## QA Checklist

Before deploying to production:

### Functional Testing
- [ ] All features work as expected
- [ ] Error handling works correctly
- [ ] Edge cases handled gracefully
- [ ] Interactive messages render properly
- [ ] Audio transcription works
- [ ] Streaming responses function correctly

### Performance Testing
- [ ] Response time <2s (p95)
- [ ] No memory leaks
- [ ] Cold start <100ms
- [ ] Database queries optimized

### Security Testing
- [ ] No exposed secrets
- [ ] RLS policies enforced
- [ ] Input validation works
- [ ] Rate limiting in place

See [po-checklist.md](./po-checklist.md) for complete checklist.

## Continuous Integration

Tests run automatically on:
- **Pull Requests**: All tests must pass
- **Main Branch**: Pre-deployment verification
- **Scheduled**: Daily smoke tests

## Test Data

Test data is managed in:
- `tests/fixtures/` - Test fixtures
- `tests/mocks/` - Mock responses
- Supabase test database (separate from production)

## Monitoring & Alerts

Production monitoring includes:
- Vercel Analytics for performance
- Supabase logs for errors
- OpenAI usage tracking
- Custom error tracking

See [Monitoring Guide](../05-deployment/monitoring.md) for setup.

## Related Documentation

- [Deployment](../05-deployment/README.md) - Deployment process
- [Pre-Deployment Checklist](../05-deployment/pre-deployment-checklist.md)
- [Features](../04-features/README.md) - Feature-specific testing notes

---

**Last Updated**: 2025-10-03
**Test Status**: 112/112 passing ✅
