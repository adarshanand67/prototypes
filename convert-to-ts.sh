#!/bin/bash

# Batch convert all JavaScript prototype folders to TypeScript

set -e

FOLDERS=(
  "circuit-breaker"
  "design-e-commerce-platform"
  "design-rate-limiter"
  "redis-pubsub"
  "mysql-disaster-recovery"
)

for folder in "${FOLDERS[@]}"; do
  echo "=================================================="
  echo "Converting $folder to TypeScript..."
  echo "=================================================="

  cd "$folder"

  # Create src directory if it doesn't exist
  mkdir -p src

  # Move all .js files to src/ and rename to .ts
  for file in *.js; do
    if [ -f "$file" ]; then
      # Skip vitest.config.js
      if [[ "$file" != "vitest.config.js" ]]; then
        echo "  Moving $file -> src/${file%.js}.ts"
        mv "$file" "src/${file%.js}.ts"
      fi
    fi
  done

  # Create tsconfig.json
  cat > tsconfig.json <<'EOF'
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

  # Update package.json to add TypeScript support
  if [ -f package.json ]; then
    # Backup original
    cp package.json package.json.bak

    # Add type: module if not present
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pkg.type = 'module';
    pkg.scripts = pkg.scripts || {};
    pkg.scripts.build = 'tsc';
    pkg.scripts.dev = 'tsx watch src/*.ts';
    pkg.devDependencies = pkg.devDependencies || {};
    pkg.devDependencies.typescript = '^5.7.3';
    pkg.devDependencies.tsx = '^4.19.2';
    pkg.devDependencies['@types/node'] = '^22.10.5';
    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
    "

    echo "  ✓ Updated package.json"
  fi

  # Install TypeScript dependencies
  echo "  Installing TypeScript dependencies..."
  npm install --save-dev typescript tsx @types/node >/dev/null 2>&1 || true

  # Try to compile
  echo "  Compiling TypeScript..."
  npx tsc --noEmit || echo "  ⚠ Compilation had errors (will fix types later)"

  cd ..
  echo ""
done

echo "=================================================="
echo "✓ Conversion complete!"
echo "=================================================="
