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

Games.find({'swapping': true}).observeChanges({
  added: function(id, game) {
    for (index in game.swaps) {
      var swap = game.swaps[index];
      Players.update(swap.id, {$set: {role : swap.role}});
    }

    var gameEndTime = moment().add(game.discussionTime, 'minutes').valueOf();
    Games.update(id, {$set: {
      swaps: [],
      swapping: false,
      endTime: gameEndTime,
      paused: false,
      pausedTime: null
    }});
  }
})

Games.find({'state': 'voting'}).observeChanges({
  added: function(id, game) {
    var votingEndTime = moment().add(10, 'seconds').valueOf();
    Games.update(id, {$set: {
      endTime: votingEndTime,
      paused: false,
      pausedTime: null
    }});
  }
})

Games.find({'state': 'finishedVoting'}).observeChanges({
  added: function(id, game) {
    var players = Players.find({gameID: id});
    var votes = [];
    players.forEach(function(player) {
      if (player.vote) {
        votes.push(player.vote);
      }
    });

    if (votes.length > 0) {

      var voteFrequency = {};
      for (index in votes) {
        var vote = votes[index].toString();
        if (voteFrequency[vote]) {
          voteFrequency[vote] += 1;
        } else {
          voteFrequency[vote] = 1;
        }
      }
      var sortedVotes = [];
      for (key in voteFrequency) {
        sortedVotes.push({playerID : key, numVotes: voteFrequency[key]});
      }
      sortedVotes.sort(function(vote1, vote2) {
        return vote1.numVotes - vote2.numVotes;
      }).reverse();

      var killed = [];
      killed.push(Players.findOne(sortedVotes[0].playerID));
      for (var i = 1; i < sortedVotes.length; i++) {
        if (sortedVotes[i].numVotes == sortedVotes[0].numVotes) {
          killed.push(Players.findOne(sortedVotes[i].playerID));
        } else {
          break;
        }
      }
      if (killed.length == game.playerRoles.length) {
        killed = [];
      }

      Games.update(id, {$set: {'killed': killed}});
    }
  }
})
