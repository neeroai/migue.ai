# Getting Started

Welcome to migue.ai! This guide will help you set up your local development environment.

## Quick Start

1. **Prerequisites**
   - Node.js 18+ and npm
   - Supabase account
   - WhatsApp Business API access
   - OpenAI API key

2. **Clone & Install**
   ```bash
   git clone https://github.com/your-org/migue.ai.git
   cd migue.ai
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

## Documentation

- **[setup.md](./setup.md)** - Detailed setup instructions
- **[local-development.md](./local-development.md)** - Local development workflow
- **[troubleshooting.md](./troubleshooting.md)** - Common issues and solutions

## Essential Commands

```bash
npm run dev          # Start Vercel dev server
npm run build        # Compile TypeScript
npm run typecheck    # Type check without emit
npm run test         # Run all tests
```

## Next Steps

- Review [Architecture Overview](../02-architecture/README.md)
- Explore [Features Documentation](../04-features/README.md)
- Read [Deployment Guide](../05-deployment/README.md)

## Getting Help

- Check [Troubleshooting](./troubleshooting.md) for common issues
- Review [CLAUDE.md](../../CLAUDE.md) for development rules
- See [Main Documentation](../README.md) for full navigation

---

**Last Updated**: 2025-10-03
