#!/bin/bash
set -e

SD="$(cd "$(dirname "$0")" && pwd)"
WD="$SD/escrow_proj"
PATCHES="$SD/web_patches"
AD="$SD/app/src/main/assets/www"

echo ""
echo "=== В Деле: Build web for Android ==="
echo ""

if [ ! -d "$WD" ]; then
    echo "ERROR: escrow_proj/ not found!"
    echo "Copy your web project: cp -r /path/to/escrow_proj $WD"
    exit 1
fi

if [ ! -f "$PATCHES/routes.android.tsx" ]; then
    echo "ERROR: web_patches/ directory missing!"
    exit 1
fi

cd "$WD"

echo "[1/5] Backing up original files..."
cp src/app/routes.tsx src/app/routes.tsx.bak
cp vite.config.ts vite.config.ts.bak

echo "[2/5] Applying Android patches (HashRouter + base path)..."
cp "$PATCHES/routes.android.tsx" src/app/routes.tsx
cp "$PATCHES/vite.config.android.ts" vite.config.ts

echo "[3/5] Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

echo "[4/5] Building production bundle..."
pnpm build

echo "[5/5] Restoring originals and copying assets..."
mv src/app/routes.tsx.bak src/app/routes.tsx
mv vite.config.ts.bak vite.config.ts

rm -rf "$AD"
mkdir -p "$AD"
cp -r dist/* "$AD/"

echo ""
echo "Done! Assets in: app/src/main/assets/www/"
echo ""
echo "Next: Open VDele/ in Android Studio"
echo "  Build Variant: customerRelease or specialistRelease"
echo "  Build > Build APK(s)"
