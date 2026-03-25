#!/bin/bash
[ -n "$1" ] && MONGO_URL=$1
[ -n "$2" ] && suffix=_$2
if [ -z "$MONGO_URL" ]; then
  echo "need to set \$MONGO_URL" >&2
  exit 2
fi
for c in games players gamesHistory turnsHistory; do
  (
    set -x
    docker run -i --rm "docker.io/alpine/mongosh:latest" mongoimport --uri="$MONGO_URL" --collection="$c$suffix" --jsonArray < "$c.json"
  )
done
