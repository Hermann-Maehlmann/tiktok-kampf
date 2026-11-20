#!/usr/bin/env bash
# Short-lived public hosting for Metricool via the branch `videos` of this repo.
#   bash autopilot/host.sh upload build/<id>/<id>.mp4   -> prints the public URL
#   bash autopilot/host.sh clear                         -> empties the branch again
set -e
cd "$(git rev-parse --show-toplevel)"
REPO=$(git remote get-url origin | sed -E 's#\.git$##' | awk -F/ '{print $(NF-1)"/"$NF}')
TMP=$(mktemp -d)
git worktree add -q --detach "$TMP" HEAD
cd "$TMP"
git checkout -q --orphan videos-tmp
git rm -rq --cached . >/dev/null 2>&1 || true
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
if [ "$1" = upload ]; then
  NAME=$(basename "$2"); cp "$OLDPWD/$2" "$NAME" 2>/dev/null || cp "$2" "$NAME"
  git add "$NAME"; git commit -qm "video $NAME"
else
  git commit -q --allow-empty -m "empty"
fi
for i in 1 2 3 4; do git push -qf origin HEAD:videos && break || sleep $((i * 2)); done
cd - >/dev/null; git worktree remove --force "$TMP"
[ "$1" = upload ] && echo "https://raw.githubusercontent.com/$REPO/videos/$NAME"
exit 0
