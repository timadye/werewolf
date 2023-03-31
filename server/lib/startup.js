import { Meteor } from 'meteor/meteor';

server_startup = function() {

  Meteor.startup(() => {
    if (debug >= 0) {
      console.log(`Start Werewolf server: adminMode=${adminMode}, debug=${debug}, resetOnStart=${resetOnStart}`);
    }
    if (resetOnStart) {
      Games.remove({});
      Players.remove({});
    } else if (debug >= 1) {
      let games = Games.find({}, { fields: {name: 1, state: 1, createdAt: 1}, sort: {createdAt: 1} });
      games = games ? games.fetch() : [];
      let players = Players.find({}, { fields: {name: 1, gameID: 1}, sort: {createdAt: 1} });
      players = players ? players.fetch() : [];
      for (const game of games) {
        let ps = players.filter (p => p.gameID = game._id) . map (p => p.name) . join(', ');
        ps = ps ? `players ${ps}` : 'no players';
        ds = new Date(game.createdAt).toISOString();
        console.log (`Resume game '${game.name}' (${game.state}, created ${ds}) with ${ps}`);
      }
      let ps = players.filter (p => !games.some (g => g._id == p.gameID)) . map (p => p.name) . join (', ');
      if (ps) {
        console.log (`Resume with unattached players ${ps}`);
      }
    }
  });

  Meteor.publish('games', (gameName) => {
    if (debug >= 2) console.log("publish games", gameName);
    return Games.find({name: gameName});
  });

  Meteor.publish('players', (gameID) => {
    if (debug >= 2) console.log("publish players", gameID);
    return Players.find({gameID: gameID});
  });

  Meteor.publish('gamesHistory', (historyID) => {
    if (debug >= 2) console.log("publish gamesHistory", historyID);
    return [
      GamesHistory.find({_id: historyID}),
      TurnsHistory.find({historyID: historyID})
    ];
  });

  Meteor.publish('pastGames', (gameName) => {
    if (debug >= 2) console.log("publish pastGames", gameName);
    return GamesHistory.find({name: gameName}, {fields: {name: 1, createdAt: 1}});
  });

  Meteor.publish('allGames', (pwd) => {
    if (adminMode || pwd == adminPassword) {
      if (debug >= 1) console.log("admin mode: publish allGames");
      return Games.find({}, { fields: {name: 1} });
    } else {
      if (pwd) {
        if (debug >= 1) console.log("don't publish allGames - authentication failure");
      } else {
        if (debug >= 2) console.log("don't publish allGames");
      }
      return null;
    }
  });

  Meteor.methods({
    villageExists: (gameName) => {
      return Games.find( {name: gameName} ).count() > 0 ? 1 : 0;
    },
    resetAllGames: (pwd) => {
      if (adminMode || pwd == adminPassword) {
        resetAllGames();
        return true;
      } else {
        return false;
      }
    },
    debugLevel: () => {
      return debug;
    },
    downloadHistory: downloadHistory,
    downloadAll: (pwd) => {
      if (adminMode || pwd == adminPassword) {
        return downloadAll();
      } else {
        return null;
      }
    },
  });

}
