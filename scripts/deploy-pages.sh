#!/usr/bin/env bash
# Сборка и публикация сайта в ветку gh-pages (GitHub Pages).
# Переменные NEXT_PUBLIC_API_URL / NEXT_PUBLIC_TELEGRAM_BOT_URL / ... можно задать перед запуском.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_NAME="${REPO_NAME:-agrosfera}"
export MSYS_NO_PATHCONV=1
NEXT_PUBLIC_BASE_PATH="/$REPO_NAME" npm run build
touch out/.nojekyll
REMOTE="$(git remote get-url origin)"
cd out
rm -rf .git
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -q -f "$REMOTE" gh-pages
rm -rf .git
echo "Опубликовано: https://$(echo "$REMOTE" | sed -E 's#.*github.com[:/]([^/]+)/.*#\1#').github.io/$REPO_NAME/"
