import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';
import '../imports/utils.js';

const showAllVillages = true;
const debug = 2;

Meteor.startup(() => {
  Games.remove({});
  Players.remove({});
});

Meteor.publish('games', function(villageName) {
  return Games.find({"name": villageName});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

if (showAllVillages) {
  Meteor.publish('allGames', function() {
    return Games.find({}, { fields: {name: 1}, sort: {createdAt: 1} });
  });
}

Meteor.methods({
  villageExists: function(villageName) {
    return Games.find( {name: villageName} ).count() > 0;
  },
  resetAllGames: function() {
    if (showAllVillages) {
      if (debug>=1) console.log("reset all games");
      Games.remove({});
      Players.remove({});
    }
  }
});

Games.find({'state': 'settingUp'}).observeChanges({
  added: function(id, game) {
    if (debug>=1) console.log (`Start game '${game.name}' (${id})`);
    const players = Players.find({ gameID: id, session: {$ne: null} }, { fields: {_id:1, name:1} }).fetch();
    assignRoles(id, players, game.roles);
    Games.update(id, {$set: {state: 'nightTime'}});
  }
});

function assignRoles(gameID, players, roleNames) {
  if (debug>=3) console.log('roles =', roleNames);

  const allFellows = keyArrayFromEntries (Object.entries(allRoles) . map (([k,v]) => [v.fellows, k]));
  if (debug>=3) console.log('allFellows =', allFellows);

  var decks = keyArrayMap (roleNames,
                           name => [(allRoles[name]||{}).deck, name],
                           initObject (Object.values(allRoles) . map (v => v.deck)));
  for (let i=1; decks.roles.length < players.length; i++) {
    decks.roles.push ("villager_"+i);
  }
  if (debug>=3) console.log('decks =', decks);

  const shuffledRoles = shuffleArray (decks.roles, players.length);
  if (debug>=3) console.log('shuffledRoles =', shuffledRoles);
  if (debug>=3) console.log('players =', players);
  const rolePlayers = objectMap (players, (player,i) => ({[shuffledRoles[i]]: player}));
  if (debug>=3) console.log('rolePlayers =', rolePlayers);

  const roleFellows = objectMap (allFellows, (([f,roles]) => {
    const fplayers = roles.flatMap (r => {
      const p = rolePlayers[r];
      return p ? [p] : [];
    });
    return {[f]: fplayers.length ? [fplayers] : []};
  }));

  var unloved = players.slice();
  const fellows = keyArrayMap (decks.lovers, role => {
    const r = allRoles[role];
    return r ? [r.fellows, shuffleArray (unloved, r.number, true)] : []
  }, roleFellows);
  if (debug>=3) Object.entries(fellows).forEach(([k,v])=>console.log(`fellows[${k}] =`,v));

  Object.entries (rolePlayers) . forEach (([role, player]) => {
    const playerID = player._id;
    const playerFellows = objectMap (fellows,
                                     ([fellowType, fellowPlayers]) => {
                                       const others = fellowPlayers.flatMap (f =>
                                                                               f.some   (p => (p._id == playerID))
                                                                             ? f.filter (p => (p._id != playerID))
                                                                             : []);
                                       return others.length ? {[fellowType]: others.map(p=>p.name)} : null;
                                     });
    if (debug>=1) {
      let fellowsStr = Object.entries (playerFellows) . map (([f,pa]) => [f+"="+(pa.join(","))]) . join(" ");
      if (fellowsStr) fellowsStr = " (fellow "+fellowsStr+")";
      console.log (`Player ${player.name} (${player._id}) is ${role}${fellowsStr}`);
    }
    Players.update (playerID, {$set: {role: role, fellows: playerFellows}});
  });

  const playerRoles = objectMap (rolePlayers, ([r,p]) => ({[p._id]: r}));
  Games.update(gameID, {$set: {playerRoles: playerRoles, fellows: fellows}});
}

Players.find({'vote': {$ne: null}}).observeChanges({
  added: function(id, player) {
    const gameID = player.gameID;
    if (debug>=3) console.log(`Player ${player.name} (${id}) initially voted for ${player.vote}`);
    const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {_id:1, name:1, vote:1} }).fetch();
    if (players.some (p => !p.vote)) return null;
    const game = Games.findOne(gameID);
    if (debug>=1) {
      console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
      for (const player of players) {
        if (player.vote == "0") {
          console.log(`Player ${player.name} (${id}) did not vote (${player.vote})`);
        } else {
          const vote = players.find (p => p._id === player.vote);
          if (vote)
            console.log(`Player ${player.name} (${id}) voted for ${vote.name} (${player.vote})`);
          else
            console.log(`Player ${player.name} (${id}) invalid vote for ${player.vote}`);
        }
      }
    }
    if (game.state == "nightTime") {
      dawn (game, players);
      Players.update({gameID: gameID, session: {$ne: null}}, {$set: {vote: null}}, {multi: true});
    } else if (game.state == "dayTime") {
      lynch (game, players);
    }
  }
});

function dawn (game, playersIn) {
  if (debug >= 3) console.log ('Dawn: playerRoles =', game.playerRoles);

  const players = playersIn.map (p => ({ ... p, act: {}, attackers: [], casualty: 0, cause: null }));
  const playerMap = objectMap (players, p => ({[p._id]: p}));
  if (debug >= 3) console.log ('initial players =', players);
  var nwerewolves = 0;
  for (let player of players) {
    const roleName = game.playerRoles[player._id];
    const role = roleInfo(roleName);
    if (role.type == "werewolf") nwerewolves ++;
    if (role.active == 'night') {
      const p = playerMap[player.vote];
      if (p) {
        if (role.type in p.act) {
          p.act[role.type]++;
        } else {
          p.act[role.type]= 1;
        }
        if (role.type == "werewolf")
          p.attackers.push(player._id);
      }
    }
  }

  for (let player of players) {
    const act = player.act;
    if (act.werewolf && !act.wolfsbane) {
      player.casualty += (nwerewolves <= 1 ? 2 : act.werewolf);
      player.cause = 'werewolf';
    }
  }

  for (let player of players) {
    if (player.act.trapper) {
      for (w of player.attackers) {
        const t = playerMap[w];
        if (t.casualty <= 1) t.cause = 'trapper';
        t.casualty ++;
      }
    }
  }

  if (debug >= 3) console.log ('lovers =', game.fellows.lover);
  for (let player of players) {
    if (player.casualty >= 2) {
      loverSuicide (game, playerMap, player);
    }
  }

  const deaths=[], injuries=[];
  for (let player of players) {
    if (player.casualty > 2) player.casualty = 2;
    if (player.casualty >= 2) {
      deaths.push(player.name);
      Players.update (player._id, {$set: {alive: false}});
    } else if (player.casualty >= 1) {
      injuries.push(player.name);
    }
  }
  if (debug >= 1) console.log (`Dawn: deaths = ${deaths}, injuries = ${injuries}`);
  if (debug >= 2) console.log ('details =', players);

  Games.update(game._id, {$set: {deaths: deaths, injuries: injuries, state: 'dayTime'},
                          $push: { history: players }});
}

function loverSuicide (game, playerMap, player) {
  const suicides = [];
  for (let lovers of game.fellows.lover) {
    if (lovers.some (p => p._id == player._id)) {
      for (let lover of lovers) {
        if (lover._id != player._id) {
          const suicide = playerMap[lover._id];
          if (suicide && suicide.casualty <= 1) {
            suicide.casualty = 2;
            suicide.cause = 'lover';
            suicides.push (suicide);
          }
        }
      }
    }
  }

  // Suicide lovers of lovers (is this a thing?)
  for (let suicide of suicides) {
    loverSuicide (game, playerMap, suicide);
  }
}

function lynch (game, players) {
  console.log ("Lynching");
}
