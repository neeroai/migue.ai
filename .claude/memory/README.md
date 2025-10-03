# Memory / Knowledge Base

**Purpose**: Persistent knowledge storage for session continuity and context optimization

---

## Structure

```
.claude/memory/
├── README.md              # This file
├── decisions.md           # Architecture & design decisions
├── patterns.md            # Code patterns & best practices
├── lessons-learned.md     # Insights from development
├── troubleshooting.md     # Common issues & solutions
└── api-quirks.md          # API-specific behaviors & gotchas
```

---

## Usage

### When to Update

**decisions.md**: After making significant architectural choices
**patterns.md**: When establishing reusable code patterns
**lessons-learned.md**: After completing major features or debugging
**troubleshooting.md**: When solving non-obvious issues
**api-quirks.md**: When discovering unexpected API behaviors

### Before Each Session

1. Review relevant memory files for context
2. Check decisions.md for established patterns
3. Consult troubleshooting.md if hitting known issues

### During Sessions

- Add notes to appropriate files as you work
- Update when discovering new patterns
- Document decisions for future reference

---

## File Guidelines

### decisions.md
Format:
```markdown
## [Decision Title] (YYYY-MM-DD)
**Context**: Why we needed to decide
**Decision**: What we chose
**Alternatives**: What else we considered
**Rationale**: Why this choice
**Impact**: Files/features affected
```

### patterns.md
Format:
```markdown
## [Pattern Name]
**Use Case**: When to use this pattern
**Example**:
'''typescript
// code example
'''
**Gotchas**: Things to watch out for
```

### lessons-learned.md
Format:
```markdown
## [Feature/Task] (YYYY-MM-DD)
**Challenge**: What was difficult
**Solution**: How we solved it
**Takeaway**: Key lesson
**Applied to**: Future use cases
```

### troubleshooting.md
Format:
```markdown
## [Issue Description]
**Symptom**: What you see
**Cause**: Root cause
**Solution**: How to fix
**Prevention**: Avoid in future
```

### api-quirks.md
Format:
```markdown
## [API Name] - [Quirk]
**Behavior**: What happens
**Workaround**: How to handle it
**Tested**: Version/date confirmed
```

---

## Best Practices

1. **Be Specific**: Include file paths, versions, dates
2. **Be Concise**: Bullet points over paragraphs
3. **Be Actionable**: Focus on "what to do" not just "what happened"
4. **Cross-Reference**: Link to related decisions/patterns
5. **Update Regularly**: Don't wait until end of session

---

**Last Updated**: 2025-10-03
**Owner**: claude-master
