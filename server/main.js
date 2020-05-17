import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';

const showAllVillages = true;

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
      console.log("reset all games");
      Games.remove({});
      Players.remove({});
    }
  }
});

Games.find({'state': 'settingUp'}).observeChanges({
  added: function(id, game) {
    console.log (`Start game "${game.name}"`);
    const players = Players.find({ gameID: id, session: {$ne: null} }, { fields: {_id:1, name:1} }).fetch();
    assignRoles(id, players, game.roles);
    Games.update(id, {$set: {state: 'nightTime'}});
  }
});

// returns a NEW array
function shuffleArray (array, npick=array.length, remove=false) {
  var copy = remove ? array : array.slice();
  var result = [];
  for (let i = 0; i < npick; i++) {
    result.push (copy.splice (Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return result;
}

function assignRoles(gameID, players, roleNames) {
  // console.log('roles =', roleNames);
  var decks = {roles:[], lovers:[]};
  for (const name of roleNames) {
    const deck = (allRoles[name]||{}) . deck;
    (decks[deck] || (decks[deck]=[])) . push(name);
  }

  var nvillagers = 0;
  while (decks.roles.length < players.length) {
    decks.roles.push("villager_"+(++nvillagers));
  }
  var shuffledRoles = shuffleArray (decks.roles, players.length);
  // console.log('shuffled roles =', shuffledRoles);

  var unloved = players.slice();
  var lovers = {lovers: [], rivals: []};
  for (const name of decks.lovers) {
    const role= allRoles[name]||{};
    (lovers[role.type] || (lovers[role.type]=[])) . push (shuffleArray (unloved, role.number, true));
  }

  var playerRoles = [];
  for (let i = 0; i < players.length; i++) {
    const playerID = players[i]._id;
    const role = shuffledRoles[i];
    playerLovers = {};
    for (const loverType in lovers) {
      playerLovers[loverType] = lovers[loverType].flatMap (c => c.some (p => p._id==playerID) ? c.filter (p => (p._id != playerID)) : []);
    }
    console.log (`Player ${players[i].name} is ${role} (lovers=${playerLovers.lovers.map(p=>p.name)}, rivals=${playerLovers.rivals.map(p=>p.name)})`);
    Players.update (playerID, {$set: {role: role, lovers: playerLovers}});
    playerRoles[role] = playerID;
  }
  // console.log('player roles =', playerRoles, 'lovers =', lovers);
  Games.update(gameID, {$set: {playerRoles: playerRoles, lovers: lovers}});
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
