#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "========================================"
echo "  VDele - Build web assets for Android"
echo "========================================"
echo ""

cd escrow_proj || { echo "ERROR: escrow_proj not found!"; read -p "Press Enter..."; exit 1; }

echo "[1/5] Backup originals..."
cp src/app/routes.tsx src/app/routes.tsx.bak 2>/dev/null
cp vite.config.ts vite.config.ts.bak 2>/dev/null

echo "[2/5] Apply Android patches..."
cp "../web_patches/routes.android.tsx" src/app/routes.tsx
cp "../web_patches/vite.config.android.ts" vite.config.ts

echo "[3/5] Install dependencies..."
if command -v pnpm &>/dev/null; then
    pnpm install
elif command -v npm &>/dev/null; then
    echo "pnpm not found, using npm..."
    npm install
else
    echo "ERROR: npm/pnpm not found! Install Node.js"
    mv src/app/routes.tsx.bak src/app/routes.tsx 2>/dev/null
    mv vite.config.ts.bak vite.config.ts 2>/dev/null
    read -p "Press Enter..."; exit 1
fi

echo "[4/5] Build bundle..."
if command -v pnpm &>/dev/null; then
    pnpm build
else
    npm run build
fi

if [ ! -f "dist/index.html" ]; then
    echo ""
    echo "ERROR: Build failed!"
    mv src/app/routes.tsx.bak src/app/routes.tsx 2>/dev/null
    mv vite.config.ts.bak vite.config.ts 2>/dev/null
    read -p "Press Enter..."; exit 1
fi

echo "[5/5] Copy to Android assets..."
mv src/app/routes.tsx.bak src/app/routes.tsx 2>/dev/null
mv vite.config.ts.bak vite.config.ts 2>/dev/null
rm -rf "../app/src/main/assets/www"
mkdir -p "../app/src/main/assets/www"
cp -r dist/* "../app/src/main/assets/www/"

echo ""
echo "========================================"
echo "  DONE! Now in Android Studio:"
echo "  Build -> Rebuild Project"
echo "========================================"
echo ""
read -p "Press Enter to close..."
