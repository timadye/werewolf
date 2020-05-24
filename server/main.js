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
  const playerRoles = objectMap (players, (player,i) => ({[shuffledRoles[i]]: player}));
  if (debug>=3) console.log('playerRoles =', playerRoles);

  const roleFellows = objectMap (allFellows, (([f,roles]) => ({[f]: [roles.flatMap (r => {const p = playerRoles[r]; return p ? [p] : []})]})));

  var unloved = players.slice();
  const fellows = keyArrayMap (decks.lovers,
                                     role => { const r = allRoles[role]; return r ? [r.fellows, shuffleArray (unloved, r.number, true)] : []},
                                     roleFellows);
  if (debug>=3) Object.entries(fellows).forEach(([k,v])=>console.log(`fellows[${k}] =`,v));

  Object.entries (playerRoles) . forEach (([role, player]) => {
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

  Games.update(gameID, {$set: {playerRoles: playerRoles, fellows: fellows}});
}

Players.find({'vote': {$ne: null}}).observeChanges({
  added: function(id, player) {
    const gameID = player.gameID;
    if (debug>=3) console.log(`Player ${player.name} (${id}) initially voted for ${player.vote}`);
    const players = Players.find({ gameID: gameID, session: {$ne: null} }, { fields: {_id:1, name:1, vote:1} }).fetch();
    if (players.some (p => !p.vote)) return null;
    const game = Games.findOne(gameID);
    if (debug>=1) {
      console.log(`Game ${game.name} ${game.state}: all ${players.length} players voted`);
      for (const player of players) {
        const vote = players.find (p => p._id === player.vote);
        if (vote)
          console.log(`Player ${player.name} (${id}) voted for ${vote.name} (${player.vote})`);
        else
          console.log(`Player ${player.name} (${id}) invalid vote for ${player.vote}`);
      }
    }
    if (game.state == "nightTime") dawn (game, players);
    else if (game.state == "dayTime") lynch (game, players);
    Players.update({gameID: gameID, session: {$ne: null}}, {$set: {vote: null}}, {multi: true});
    Games.update(gameID, {$set: {state: 'dayTime'}});
  }
});

function dawn (game, players) {
  console.log ("Dawn");
}

function lynch (game, players) {
  console.log ("Lynching");
}
