import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';
import '../imports/utils.js';

const showAllVillages = true;
const debug = 1;

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
  added: function(newID, newPlayer) {
    const gameID = newPlayer.gameID;
    if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted for ${newPlayer.vote}`);
    const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, vote:1} }).fetch();
    if (players.some (p => !p.vote)) return null;
    const game = Games.findOne(gameID);
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
      Players.update({gameID: gameID, session: {$ne: null}}, {$set: {vote: null}}, {multi: true});
    }
  }
});

function dawn (game, playersFound) {
  if (debug >= 3) console.log ('Dawn: playerRoles =', game.playerRoles);

  const players = playersFound.map (p => ({ ... p, act: {}, attackers: [], casualty: 0, cause: null }));
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

  for (let player of players) {
    if (player.casualty >= 2) {
      loverSuicide (game.fellows.lover, playerMap, player);
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

Players.find({'lynch': {$ne: null}}).observeChanges({
  added: function(newID, newPlayer) {
    const gameID = newPlayer.gameID;
    if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) initially voted to ${newPlayer.lynch}`);
    const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1, call:1, lynch:1} }).fetch();
    if (players.some (p => !p.lynch)) return null;
    const game = Games.findOne(gameID);
    if (debug>=1) {
      console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
      for (const player of players) {
        console.log(`  Player ${player.name} (${player._id}) voted to ${player.lynch}`, player.call ? `(lynch call on ${player.call})` : "");
      }
    }
    if (game.state == "dayTime") {
      lynch (game, players);
      Players.update({gameID: gameID, session: {$ne: null}}, {$set: {call: null, lynch: null}}, {multi: true});
    }
  }
});

function lynch (game, players) {
  const victimPlayer = lynchCall (players);
  if (!victimPlayer) return;

  let votes = {lynch:[], spare:[]};
  for (player of players) {
    const role = roleInfo (game.playerRoles[player._id]);
    const n = ('votes' in role) ? role.votes : 1;
    const vote = player.lynch;
    (votes[vote] || (votes[vote]=[])) . push (... Array.from({length:n}, x=>player._id));
  }
  const calls = players.flatMap (p => (p.call == victimPlayer._id ? [p._id] : []));
  const dead = (votes.lynch.length > votes.spare.length);
  const victim = { _id: victimPlayer._id, name: victimPlayer.name, ... votes, attackers: calls, casualty: dead?2:0, cause: 'lynch' };
  if (debug >= 1) console.log (`Player ${victim.name} (${victim._id}) was ${dead?"lynched":"spared"} by ${votes.lynch.length} to ${votes.spare.length}`);

  const [history, deaths] = killPlayer ("Lynching", game, players, victim);

  Games.update(game._id, {$push: { history: history, ... dead && {deaths: { $each: deaths }} }});
}

function lynchCall (players) {
  if (debug >= 3) console.log('players =', players);
  let calls = {}, lynching = [];
  for (const player of players) {
    if (player.call && player.call in calls) {
      if (++calls[player.call] == 2)
        lynching.push (players.find (p => p._id == player.call));
    } else {
      calls[player.call] = 1;
    }
  }
  if (lynching.length == 1) {
    return lynching[0];
  } else {
    if (debug >= 0) {
      if (lynching.length == 0) {
        console.log (`Ignore vote on call which was not seconded on ${Object(calls).keys().join(" and ")}`);
      }  else {
        console.log (`Ignore vote on multiple calls on ${lynching.join(" and ")}`);
      }
    }
    return null;
  }
}

Players.find({'twang': {$ne: null}}).observeChanges({
  added: function(newID, newPlayer) {
    const gameID = newPlayer.gameID;
    if (debug>=3) console.log(`Player ${newPlayer.name} (${newID}) shot ${newPlayer.twang}`);
    if (!newPlayer.twang) return;
    const players = Players.find({ gameID: gameID, session: {$ne: null}, alive: true }, { fields: {name:1} }).fetch();
    const game = Games.findOne(gameID);
    if (game.state == "dayTime") {
      twang (game, players, newID, newPlayer);
    }
  }
});

function twang (game, players, vigilanteID, vigilante) {
  const victimPlayer = players.find (p => p._id == vigilante.twang);
  if (!victimPlayer) return;
  const victim = { _id: victimPlayer._id, name: victimPlayer.name, attackers: [vigilanteID], casualty: 2, cause: 'crossbow' };
  if (debug >= 1) console.log (`Player ${victim.name} (${victim._id}) was shot by ${vigilante.name} (${vigilanteID})`);

  const [history, deaths] = killPlayer ("Vigilante", game, players, victim);

  Games.update(game._id, {$push: { history: history, deaths: { $each: deaths }}});
}

function killPlayer (cause, game, players, victim) {
  if (victim.casualty < 2) return [[victim], []];
  let playerMap = objectMap (players, p => ({[p._id]: Object.assign({},p)}));
  const history = [victim].concat (loverSuicide (game.fellows.lover, playerMap, victim));

  let deaths=[];
  for (let player of history) {
    if (player.casualty >= 2) {
      deaths.push (player.name);
      Players.update (player._id, {$set: {alive: false}});
    }
  }
  if      (debug == 1) console.log (`${cause}: deaths = ${deaths}`);
  else if (debug >= 2) console.log (`${cause}: deaths = ${deaths}, details =`, history);
  return [history, deaths];
}

function loverSuicide (allLovers, playerMap, player) {
  playerMap[player._id] = player;
  if (debug >= 3) console.log ('loverSuicide: lovers =', allLovers, ', playerMap =', playerMap, ', player =', player);
  var deaths = [], suicides = [];
  for (let lovers of allLovers) {
    if (lovers.some (p => p._id == player._id)) {
      for (let lover of lovers) {
        if (lover._id != player._id) {
          const suicide = playerMap[lover._id];
          if (suicide && (!suicide.casualty || suicide.casualty <= 1)) {
            if (debug >= 1) console.log (`Player ${player.name}'s (${player._id}) death by ${player.cause} causes ${suicide.name} (${suicide._id}) to suicide`);
            suicide.casualty = 2;
            suicide.cause = 'lover';
            suicides.push (suicide);
          }
        }
      }
    }
  }
  var deaths = suicides.slice();

  // Suicide lovers of lovers (is this a thing?)
  for (let suicide of suicides) {
    deaths.push (... loverSuicide (allLovers, playerMap, suicide));
  }
  return deaths;
}
