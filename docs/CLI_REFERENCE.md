# 📦 Inopay CLI Reference

## Installation

```bash
# Global installation
npm install -g @inopay/cli

# Or with npx
npx @inopay/cli <command>
```

## Commands

### `inopay audit <path>`

Analyzes a project without modifying any files. Generates a sovereignty audit report.

```bash
inopay audit ./my-project
inopay audit ./my-project --format json
inopay audit ./my-project --format json > audit.json
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-f, --format <format>` | Output format: `text` or `json` | `text` |

#### Example Output

```
📊 RAPPORT D'AUDIT
──────────────────────────────────────────────────

Score de souveraineté: 85/100 B
Fichiers analysés: 156
Lignes de code: 12,450

🚨 Fichiers propriétaires (2)
   - lovable.config.json
   - .lovable/cache.json

⚠️  Imports propriétaires (5)
   - src/App.tsx:3
     import { someHook } from '@lovable/hooks'

📡 Télémétrie détectée (3)
   - src/analytics.ts: amplitude.com

──────────────────────────────────────────────────

⚠️  Projet nécessite un nettoyage modéré

Utilisez `inopay liberate <path>` pour nettoyer automatiquement
```

---

### `inopay liberate <path>`

Liberates a project by scanning, cleaning, and generating a sovereign package.

```bash
# Basic liberation
inopay liberate ./my-project

# Custom output directory
inopay liberate ./my-project --output ./my-project-sovereign

# Dry run (no files modified)
inopay liberate ./my-project --dry-run
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output directory | `<path>-liberated` |
| `-d, --dry-run` | Simulate without modifying files | `false` |

#### What Gets Generated

```
my-project-liberated/
├── src/                      # Cleaned source code
├── Dockerfile               # Docker configuration
├── docker-compose.yml       # Orchestration
├── DEPLOY.md               # Deployment guide
├── liberation-report.json  # Audit report
└── .env.example            # Environment template
```

#### Example Output

```
╦╔╗╔╔═╗╔═╗╔═╗╦ ╦
║║║║║ ║╠═╝╠═╣╚╦╝
╩╝╚╝╚═╝╩  ╩ ╩ ╩  LIBERATOR v1.0.0

Libérez votre code. Reprenez le contrôle.

✔ Libération terminée!

📦 RÉSUMÉ DE LIBÉRATION
──────────────────────────────────────────────────
✓ Fichiers traités: 156
✓ Fichiers nettoyés: 12
✓ Fichiers propriétaires supprimés: 2
✓ Score final: 98/100 A

✅ Projet libéré dans: ./my-project-liberated

Pour déployer:
   cd ./my-project-liberated
   docker compose up -d
```

---

### `inopay serve`

Launches a local dashboard for managing liberations (coming soon).

```bash
inopay serve
inopay serve --port 8080
```

#### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <port>` | Server port | `3000` |

---

## Global Options

```bash
inopay --version    # Show version
inopay --help       # Show help
```

---

## Detection Patterns

The CLI detects the following proprietary patterns:

### Import Patterns
- `@lovable/*`
- `lovable-tagger`
- `@agent/*`
- `getAIAssistant`
- `lovableApi`
- `@anthropic-ai/sdk`
- `cloudflare-ai`

### Proprietary Files
- `lovable.config.*`
- `.lovable/`
- `lovable-lock.*`
- `.agent/`
- `agent.config.*`
- `__lovable__/`

### Telemetry Domains
- `lovable.dev/api`
- `api.lovable.dev`
- `telemetry.lovable`
- `sentry.io`
- `amplitude.com`
- `mixpanel.com`

---

## Scoring System

The sovereignty score is calculated as:

```
Score = 100 - (Critical × 15) - (Major × 5) - (Minor × 2)
```

| Grade | Score Range | Meaning |
|-------|-------------|---------|
| A | 90-100 | Fully sovereign |
| B | 80-89 | Mostly sovereign, minor cleanup needed |
| C | 70-79 | Moderate dependencies |
| D | 60-69 | Significant dependencies |
| F | 0-59 | Heavily dependent, full liberation required |

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `INOPAY_API_URL` | Override API endpoint |
| `INOPAY_TOKEN` | API authentication token |
| `NO_COLOR` | Disable colored output |

---

## Examples

### Quick Audit

```bash
# Audit and save report
inopay audit . --format json > audit.json

# Check score
cat audit.json | jq '.score'
```

### Full Liberation Pipeline

```bash
#!/bin/bash

# 1. Audit
inopay audit ./my-project

# 2. Liberate
inopay liberate ./my-project --output ./liberated

# 3. Deploy
cd ./liberated
docker compose up -d
```

### CI/CD Integration

```yaml
# .github/workflows/liberate.yml
name: Sovereignty Check

on: [push]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Inopay CLI
        run: npm install -g @inopay/cli
      
      - name: Run Audit
        run: inopay audit . --format json > audit.json
      
      - name: Check Score
        run: |
          SCORE=$(cat audit.json | jq '.score')
          if [ "$SCORE" -lt 80 ]; then
            echo "Sovereignty score too low: $SCORE"
            exit 1
          fi
```

---

## Troubleshooting

### "Command not found"

```bash
# Ensure npm bin is in PATH
export PATH="$PATH:$(npm bin -g)"
```

### "Permission denied"

```bash
# Run with proper permissions
sudo npm install -g @inopay/cli
```

### "Cannot read file"

```bash
# Ensure you're in the project directory
cd /path/to/project
inopay audit .
```

---

## Support

- Documentation: https://inopay.app/docs/cli
- Issues: https://github.com/inopay/cli/issues
- Email: support@inopay.app

---

*© 2024 Inovaq Canada Inc. - Libérez votre code.*
