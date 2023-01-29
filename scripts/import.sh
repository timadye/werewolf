#!/bin/bash
if [ -z "$MONGO_URL" ]; then
  echo "need to set \$MONGO_URL" >&2
  exit 2
fi
suffix=$1
[ -n "$suffix" ] && suffix=_$suffix
mongoimport -c games$suffix --file=games.json --jsonArray "$MONGO_URL"
mongoimport -c players$suffix --file=players.json --jsonArray "$MONGO_URL"
