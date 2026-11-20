#!/usr/bin/env bash
# Short-lived public hosting for Metricool via the branch `videos` of this repo.
#   bash autopilot/host.sh upload build/<id>/<id>.mp4   -> prints the public URL
#   bash autopilot/host.sh clear                         -> empties the branch again
# Builds a one-commit branch with git plumbing (no checkout, the working tree is untouched).
set -e
FILE=$2; [ "$1" = upload ] && FILE=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
cd "$(git rev-parse --show-toplevel)"
REPO=$(git remote get-url origin | sed -E 's#\.git$##' | awk -F/ '{print $(NF-1)"/"$NF}')
export GIT_INDEX_FILE=$(mktemp -u); trap 'rm -f "$GIT_INDEX_FILE"' EXIT
git read-tree --empty
if [ "$1" = upload ]; then
  NAME=$(basename "$FILE")
  git update-index --add --cacheinfo 100644,"$(git hash-object -w "$FILE")","$NAME"
fi
C=$(git -c user.name="Kampf Autopilot" -c user.email=autopilot@users.noreply.github.com commit-tree "$(git write-tree)" -m "${NAME:-empty}")
for i in 1 2 3 4; do git push -qf origin "$C:refs/heads/videos" 2>&1 | grep -v "negotiation" || true; git ls-remote origin videos | grep -q "$C" && break; sleep $((i * 2)); done
[ "$1" = upload ] && echo "https://raw.githubusercontent.com/$REPO/videos/$NAME"
exit 0
