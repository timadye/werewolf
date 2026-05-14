import { debug } from '/imports/server/globals.js';
import { assignRoles, dawn, guillotine, twang } from '/server/lib/fun.js';
import { Games, Players, GamesHistory } from '/lib/collections.js';

export function observe() {

  Games.find({state: 'settingUp'}).observeChanges({
    added: async (id, game) => {
      if (debug>=1) console.log (`Start game '${game.name}' (${id})`);
      const players = await Players.find({ gameID: id, session: {$ne: null} }, { fields: {_id:1, name:1} }).fetchAsync();
      const gameSettings = await assignRoles(id, players, game.roles);
      const historyID = await GamesHistory.insertAsync({
        gameID: id,
        name: game.name,
        createdAt: new Date().valueOf(),
        players: players,
        ... gameSettings
      });
      await Games.updateAsync(id, {$set: {state: 'nightTime', historyID: historyID}});
    }
  });

  Players.find({'vote': {$ne: null}}).observeChanges({
    added: async (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted for ${newPlayer.vote}`);
      const players = await Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, vote:1} }).fetchAsync();
      if (players.some (p => !p.vote)) return null;
      const game = await Games.findOneAsync(gameID);
      if (debug>=1) {
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
        await Players.updateAsync({gameID: gameID, session: {$ne: null}}, {$rename: {vote: "lastvote"}}, {multi: true});
      }
    }
  });

  Players.find({'guillotine': {$ne: null}}).observeChanges({
    added: async (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted to ${newPlayer.guillotine}`);
      const players = await Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, call:1, guillotine:1} }).fetchAsync();
      if (players.some (p => !p.guillotine)) return null;
      const game = await Games.findOneAsync(gameID);
      if (debug>=1) {
        console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
        for (const player of players) {
          console.log(`  Player ${player.name} (${player._id}) voted to ${player.guillotine}`, player.call ? `(guillotine call on ${player.call})` : "");
        }
      }
      if (game.state == "dayTime") {
        guillotine (game, players);
        await Players.updateAsync({gameID: gameID, session: {$ne: null}}, {$set: {call: null, guillotine: null}}, {multi: true});
      }
    }
  });

  Players.find({'twang': {$ne: null}}).observeChanges({
    added: async (newID, newPlayer) => {
      const gameID = newPlayer.gameID;
      if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) shot ${newPlayer.twang}`);
      if (!newPlayer.twang) return;
      const players = await Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1} }).fetchAsync();
      const game = await Games.findOneAsync(gameID);
      if (game.state == "dayTime") {
        twang (game, players, newID, newPlayer);
      }
    }
  });

}
