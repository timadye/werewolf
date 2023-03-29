getCurrentGame = function() {
  const gameID = Session.get('gameID');
  return gameID ? Games.findOne(gameID) : null;
}

gameName = function(gameID) {
  if (gameID === undefined) gameID = Session.get('gameID');
  if (!gameID) return null;
  const game = Games.findOne(gameID, { fields: { name: 1 } });
  return game ? game.name : null;
}

playerName = function(playerID) {
  const player = Players.findOne(
    (playerID !== undefined) ? playerID
                              : {session: Meteor.connection._lastSessionId},
    { fields: { name: 1 } }
  );
  return player ? player.name : null;
}

getCurrentPlayer = function() {
  return Players.findOne({session: Meteor.connection._lastSessionId});
}

allGames = function() {
  const ret = Games.find ({}, {fields: {name: 1}, sort: {createdAt: 1}}).fetch();
  return ret ? ret.map((game) => game.name) : ret;
}

allPlayersFind = function (gameID=null, includeInactive=0, fields={name:1}) {
  // includeInactive: 0=active and alive, 1=active, 2=all
  if (!gameID) {
    gameID = Session.get('gameID');
    if (!gameID) return null;
  }
  return Players.find( { gameID: gameID,
                          ...includeInactive<2 && {session: {$ne: null},
                          ...includeInactive<1 && {alive: true}} },
                        {fields: fields});
}

allPlayers = function (gameID=null, includeInactive=0, fields={name:1}) {
  const ret = allPlayersFind (gameID, includeInactive, fields);
  return ret ? ret.fetch() : [];
}
