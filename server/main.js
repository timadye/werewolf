import { Meteor } from 'meteor/meteor';
import '../imports/roles.js';

Meteor.startup(() => {
  Games.remove({});
  Players.remove({});
});

function cleanUp(){
  var cutOff = moment().subtract(2, 'hours').toDate().getTime();

  Games.remove({ createdAt: {$lt: cutOff} });
  Players.remove({ createdAt: {$lt: cutOff} });
}

var cron = new Cron(60000);

cron.addJob(5, cleanUp);

Meteor.publish('games', function(accessCode) {
  return Games.find({"accessCode": accessCode});
});

Meteor.publish('players', function(gameID) {
  return Players.find({"gameID": gameID});
});

Meteor.methods({
  nameUsed: function(game, name) {
    return Players.find( {'gameID': game._id, 'name': name} ).count() > 0;
  }
})

Games.find({'state': 'settingUp'}).observeChanges({
  added: function(id, game) {
    var players = Players.find({gameID: id});
    assignRoles(id, players, game.roles);
    Games.update(id, {$set: {state: 'nightTime'}});
  }
})

// returns a NEW array
function shuffleArray(array) {
  var result = [];
  for (var i = 0; i < array.length; i++) {
    result.push(array[i]);
  }

  for (var i = array.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = result[i];
      result[i] = result[j];
      result[j] = temp;
  }

  return result;
}

function assignRoles(gameID, players, roles) {
  var shuffledRoles = shuffleArray(roles);
  var playerRoles = [];
  players.forEach(function(player) {
    role = shuffledRoles.pop();
    Players.update(player._id, {$set: {role: role}});
    playerRoles.push(role);
  });
  playerRoles.sort(function(role1, role2) {
    return role1.order - role2.order;
  });
  Games.update(gameID, {$set: {playerRoles: playerRoles}});
  Games.update(gameID, {$set: {centerCards: shuffledRoles}});
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
