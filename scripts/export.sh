#!/bin/bash
[ $# -eq 1 ] && MONGO_URL=$1
if [ -z "$MONGO_URL" ]; then
  echo "need to set \$MONGO_URL" >&2
  exit 2
fi
for c in games players gamesHistory turnsHistory; do
  (
    set -x
    docker run --rm "docker.io/alpine/mongosh:latest" mongoexport --uri="$MONGO_URL" --collection="$c" --jsonArray > "$c.json"
  )
done
