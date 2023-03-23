collections = function() {

  Games = new Mongo.Collection("games");
  Players = new Mongo.Collection("players");
  GamesHistory = new Mongo.Collection("gamesHistory");
  TurnsHistory = new Mongo.Collection("turnsHistory");

  var allowFunctions = {
    insert: function (userId, doc) {
      return true;
    },
    update: function (userId, doc, fields, modifier) {
      return true;
    },
    remove: function (userId, doc) {
      return true;
    },
  };

  var denyFunctions = {
    insert: function(userId, doc) {
      doc.createdAt = new Date().valueOf();
      return false;
    },
  };

  Games.allow(allowFunctions);
  Players.allow(allowFunctions);
  GamesHistory.allow(allowFunctions);
  TurnsHistory.allow(allowFunctions);

  Games.deny(denyFunctions);
  Players.deny(denyFunctions);
}