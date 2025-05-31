global.observe = function() {

  Games.find({state: 'settingUp'}).observeChanges({
    added: (id, game) => {
      if (global.adminMode>=1) console.log (`Start game '${game.name}' (${id})`);
      const players = Players.find({ gameID: id, session: {$ne: null} }, { fields: {_id:1, name:1} }).fetch();
      const gameSettings = assignRoles(id, players, game.roles);
      const historyID = GamesHistory.insert({
        gameID: id,
        name: game.name,
        createdAt: new Date().valueOf(),
        players: players,
        ... gameSettings
      });
      Games.update(id, {$set: {state: 'nightTime', historyID: historyID}});
    }
  });

  Players.find({'vote': {$ne: null}}).observeChanges({
    added: (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (global.adminMode>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted for ${newPlayer.vote}`);
      const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, vote:1} }).fetch();
      if (players.some (p => !p.vote)) return null;
      const game = Games.findOne(gameID);
      if (global.adminMode>=1) {
        console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
        for (const player of players) {
          if (player.vote == "0") {
            console.log(`  Player ${player.name} (${player._id}) did not vote (${player.vote})`);
          } else {
            const vote = players.find (p => p._id === player.vote);
            if (vote)
              console.log(`  Player ${player.name} (${player._id}) voted for ${vote.name} (${player.vote})`);
            else
              console.log(`  Player ${player.name} (${player._id}) invalid vote for ${player.vote}`);
          }
        }
      }
      if (game.state == "nightTime") {
        dawn (game, players);
        Players.update({gameID: gameID, session: {$ne: null}}, {$rename: {vote: "lastvote"}}, {multi: true});
      }
    }
  });

  Players.find({'guillotine': {$ne: null}}).observeChanges({
    added: (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (global.adminMode>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted to ${newPlayer.guillotine}`);
      const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, call:1, guillotine:1} }).fetch();
      if (players.some (p => !p.guillotine)) return null;
      const game = Games.findOne(gameID);
      if (global.adminMode>=1) {
        console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
        for (const player of players) {
          console.log(`  Player ${player.name} (${player._id}) voted to ${player.guillotine}`, player.call ? `(guillotine call on ${player.call})` : "");
        }
      }
      if (game.state == "dayTime") {
        guillotine (game, players);
        Players.update({gameID: gameID, session: {$ne: null}}, {$set: {call: null, guillotine: null}}, {multi: true});
      }
    }
  });

  Players.find({'twang': {$ne: null}}).observeChanges({
    added: (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (global.adminMode>=3) console.log(`Player ${newPlayer.name} (${newID}) shot ${newPlayer.twang}`);
      if (!newPlayer.twang) return;
      const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1} }).fetch();
      const game = Games.findOne(gameID);
      if (game.state == "dayTime") {
        twang (game, players, newID, newPlayer);
      }
    }
  });

}
