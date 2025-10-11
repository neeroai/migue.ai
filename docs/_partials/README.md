# Partials - Reusable Content

This folder contains reusable documentation snippets that can be included in multiple documents across the project, following the Supabase pattern.

## Purpose

Partials help maintain consistency and reduce duplication by storing commonly used content in a single location. When content needs to be updated, changing the partial automatically updates all documents that reference it.

## Usage

Reference partials in your MDX files using:

```md
<!-- Include a partial -->
See [Environment Setup](./_partials/env-setup.md) for configuration details.

<!-- Or with direct inclusion in MDX -->
import EnvSetup from '../_partials/env-setup.mdx';
<EnvSetup />
```

## Guidelines

1. **Keep partials focused** - Each partial should cover a single, well-defined topic
2. **Use descriptive names** - `env-vars.md` not `vars.md`
3. **Document dependencies** - Note if a partial requires specific context
4. **Version control** - Track changes to partials carefully as they affect multiple docs

## Structure

```
_partials/
├── README.md                  # This file
├── env-vars.md               # Environment variable setup
├── code-snippets/            # Reusable code examples
│   ├── whatsapp-client.md
│   ├── supabase-query.md
│   └── error-handling.md
└── common-setup.md           # Common development setup steps
```

## Examples of Good Partials

- **Environment variable tables** - Used in getting-started and deployment docs
- **Code snippets** - Commonly used API calls or patterns
- **Troubleshooting steps** - Common issues and solutions
- **Configuration templates** - Standard config files

## Not Suitable for Partials

- Content that's specific to only one document
- Content that changes frequently based on context
- Long tutorial sequences (better as standalone guides)

---

**Pattern Source**: Inspired by [Supabase documentation structure](https://github.com/supabase/supabase/tree/master/apps/docs/content/_partials)
