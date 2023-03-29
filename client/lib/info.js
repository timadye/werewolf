getCurrentGame = function() {
  const gameID = Session.get('gameID');
  return gameID ? Games.findOne(gameID) : null;
}

gameName = function(gameID=null) {
  if (!gameID) return Session.get('playerName') || null;
  const game = Games.findOne(gameID, { fields: { name: 1 } });
  return game ? game.name : null;
}

playerName = function(playerID=null) {
  if (!playerID) return Session.get('playerName') || null;
  const player = Players.findOne(playerID, { fields: { name: 1 } });
  return player ? player.name : null;
}

getCurrentPlayer = function() {
  const playerID = Session.get('playerID');
  if (playerID) return Players.findOne(playerID);
  // if playerID not yet set, then try playerName and set playerID for next time
  const playerName = Session.get('playerName');
  if (!playerName) return null;
  const player = Players.findOne({name: playerName});
  if (!player) return null;
  Session.set('playerID', player._id);
  return player;
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
