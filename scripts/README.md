# Scripts Inopay

## Audit de Souveraineté (Pre-Build)

Le script `sovereignty-audit.js` vérifie que le code ne contient aucune trace de plateforme propriétaire avant le build.

### Usage

```bash
# Audit standard (score minimum: 95)
node scripts/sovereignty-audit.js

# Audit avec détails complets
node scripts/sovereignty-audit.js --verbose

# Audit avec score minimum personnalisé
node scripts/sovereignty-audit.js --min-score=90

# Combiné
node scripts/sovereignty-audit.js --verbose --min-score=95
```

### Intégration dans le Build

Pour exécuter l'audit avant chaque build, ajoutez dans votre `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/sovereignty-audit.js",
    "build": "vite build",
    "build:sovereign": "node scripts/sovereignty-audit.js && vite build"
  }
}
```

### Ce qui est vérifié

1. **Patterns propriétaires** dans le code source:
   - `data-lovable-id`, `data-bolt-id`, `data-v0-id`, etc.
   - Imports `@lovable/*`, `@gptengineer/*`, `@bolt/*`, `@v0/*`
   - Commentaires de balisage IDE

2. **Dépendances package.json**:
   - `lovable-tagger`
   - `@lovable/core`, `@lovable/cli`, `@lovable/ui`
   - Autres packages propriétaires

3. **Configuration Vite**:
   - Minification Terser activée
   - Noms de chunks aléatoires
   - Sourcemaps désactivées en production
   - Tagger conditionnel (dev only)

### Scores

- **95-100**: ✅ Souverain - Build autorisé
- **80-94**: 🔶 Presque souverain - Build autorisé avec avertissements
- **< 80**: ❌ Non souverain - Build bloqué

### Pénalités

| Issue | Points |
|-------|--------|
| Pattern critique | -10 |
| Warning | -2 |
| Pas de minification Terser | -5 |
| Pas de chunks aléatoires | -5 |
| Sourcemaps en prod | -5 |
| Tagger non conditionnel | -3 |

---

© 2024 Inovaq Canada Inc. - Code 100% Souverain
