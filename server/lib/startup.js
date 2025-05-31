global.server_startup = function() {

  Meteor.startup(() => {
    if (global.adminMode >= 0) {
      console.log(`Start Werewolf server: adminMode=${global.adminMode}, debug=${global.adminMode}, resetOnStart=${global.resetOnStart}`);
    }
    if (global.resetOnStart) {
      Games.remove({});
      Players.remove({});
    } else if (global.adminMode >= 1) {
      let games = Games.find({}, { fields: {name: 1, state: 1, createdAt: 1}, sort: {createdAt: 1} });
      games = games ? games.fetch() : [];
      let players = Players.find({}, { fields: {name: 1, gameID: 1}, sort: {createdAt: 1} });
      players = players ? players.fetch() : [];
      for (const game of games) {
        let ps = players.filter (p => p.gameID == game._id) . map (p => p.name) . join(', ');
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

  Meteor.publish('game', function (gameName) {
    if (global.adminMode >= 2) console.log("publish game", gameName);
    const game = Games.findOne({name: gameName}, {});
    if (!game) {
      this.error(new Meteor.Error('no-game', noGame(gameName)));
      return;
    }
    return [
      Games.find(game._id),
      Players.find({gameID: game._id})
    ];
  });

  Meteor.publish('gamesHistory', (historyID) => {
    if (global.adminMode >= 2) console.log("publish gamesHistory", historyID);
    return [
      GamesHistory.find(historyID),
      TurnsHistory.find({historyID: historyID})
    ];
  });

  Meteor.publish('pastGames', (gameName) => {
    if (global.adminMode >= 2) console.log("publish pastGames", gameName);
    return GamesHistory.find({name: gameName}, {fields: {name: 1, createdAt: 1}});
  });

  Meteor.publish('allGames', (pwd) => {
    if (global.adminMode || pwd == global.adminPassword) {
      if (global.adminMode >= 1) console.log("admin mode: publish allGames");
      return Games.find({}, { fields: {name: 1} });
    } else {
      if (pwd) {
        if (global.adminMode >= 1) console.log("don't publish allGames - authentication failure");
      } else {
        if (global.adminMode >= 2) console.log("don't publish allGames");
      }
      return null;
    }
  });

  Meteor.methods({

    villageExists: (gameName) => {
      return Games.find( {name: gameName} ).count() > 0 ? 1 : 0;
    },

    createGame: (incantation, pwd) => {
      const game = Games.findOne({name: incantation}, {name: 1});
      if (game) {
        if (global.adminMode >= 2) console.log("createGame: game", incantation, "already exists");
        return game.name;
      }
      const gameName = tryCreateGame (incantation, pwd);
      if (!gameName) {
        throw new Meteor.Error ('no-game', noGame(incantation));
      }
      return gameName;
    },

    removeGames: (pwd, gameName) => {
      if (global.adminMode || pwd == global.adminPassword) {
        if (gameName === null) {
          return resetAllGames();
        } else {
          return removeGame(gameName);
        }
      } else {
        return null;
      }
    },

    resetDebug: (pwd) => {
      if (global.adminMode || pwd == global.adminPassword) {
        global.adminMode = Number(process.env.WEREWOLF_DEBUG || 1);
        console.log(`debug level reset to ${global.adminMode}`);
      }
      return global.adminMode;
    },

    debugLevel: () => {
      return global.adminMode;
    },

    increaseDebugLevel: (pwd, delta=1) => {
      if (global.adminMode || pwd == global.adminPassword) {
        global.adminMode += delta;
        console.log(`set new debug level ${global.adminMode}`);
      }
      return global.adminMode;
    },

    downloadHistory: downloadHistory,

    downloadAll: (pwd) => {
      if (global.adminMode || pwd == global.adminPassword) {
        return downloadAll();
      } else {
        return null;
      }
    },

  });

}
