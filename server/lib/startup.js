import { Meteor } from 'meteor/meteor';

server_startup = function() {

  Meteor.startup(() => {
    if (debug >= 0) {
      console.log(`Start Werewolf server: showAllVillages=${showAllVillages}, debug=${debug}, resetOnStart=${resetOnStart}`);
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

  Meteor.publish('games', (villageName) => {
    return Games.find({name: villageName});
  });

  Meteor.publish('players', (gameID) => {
    return Players.find({gameID: gameID});
  });

  if (showAllVillages) {
    Meteor.publish('allGames', () => {
      return Games.find({}, { fields: {name: 1}, sort: {createdAt: 1} });
    });
  }

  Meteor.methods({
    villageExists: (villageName) => {
      if (resetCmd && villageName == resetCmd) {
        resetAllGames();
        return -1;
      }
      return Games.find( {name: villageName} ).count() > 0 ? 1 : 0;
    },
    resetAllGames: () => {
      if (showAllVillages) resetAllGames();
    },
    debugLevel: () => {
      return debug;
    },
  });

}
