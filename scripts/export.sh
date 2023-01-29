#!/bin/bash
if [ -z "$MONGO_URL" ]; then
  echo "need to set \$MONGO_URL" >&2
  exit 2
fi
mongoexport -c games -o games.json --jsonArray "$MONGO_URL"
mongoexport -c players -o players.json --jsonArray "$MONGO_URL"
