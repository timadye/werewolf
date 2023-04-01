collections = function() {

  Games = new Mongo.Collection("games");
  Players = new Mongo.Collection("players");
  GamesHistory = new Mongo.Collection("gamesHistory");
  TurnsHistory = new Mongo.Collection("turnsHistory");

  Games.allow({
    update: (userId, doc, fields, modifier) => {
      return true;
    },
  });

  Players.allow({
    insert: (userId, doc) => {
      return true;
    },
    update: (userId, doc, fields, modifier) => {
      return true;
    },
    remove: (userId, doc) => {
      return true;
    },
  });

  Players.deny({
    insert: (userId, doc) => {
      doc.createdAt = new Date().valueOf();
      return false;
    },
  });
}

initialGame = function() {
  return {
    playerRoles: [],
    state: 'waitingForPlayers',
    voiceOfFate: [],
    historyID: null,
  };
}
