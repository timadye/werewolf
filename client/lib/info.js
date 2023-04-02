getCurrentGame = function() {
  const gameID = Session.get('gameID');
  return gameID ? Games.findOne(gameID) : null;
}

getGameName = function(gameID=null) {
  if (!gameID) {
    gameID = Session.get('gameID');
    if (!gameID) return null;
  }
  const game = Games.findOne(gameID, { fields: { name: 1 } });
  return game ? game.name : null;
}

getPlayerName = function(playerID=null) {
  if (!playerID) {
    playerID = Session.get('playerID');
    if (!playerID) return null;
  }
  const player = Players.findOne(playerID, { fields: { name: 1 } });
  return player ? player.name : null;
}

getCurrentPlayer = function() {
  const playerID = Session.get('playerID');
  return playerID ? Players.findOne(playerID) : null;
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

// define Session.peek(key) to look at value without setting a dependency.
// According to https://github.com/meteor/meteor/issues/8430#issuecomment-284602567
// Session objects are really just ReactiveDict's, so we use their methods.
// https://github.com/meteor/meteor/blob/master/packages/session/session.js
// https://github.com/meteor/meteor/blob/master/packages/reactive-dict/reactive-dict.js
import { EJSON } from 'meteor/ejson';
Session.peek = (key) => {
  const val = Session.keys[key];
  return val === undefined ? undefined : EJSON.parse(val);
}
