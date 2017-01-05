import '../imports/roles.js';

function generateAccessCode() {
  var code = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz';

  for (var i = 0; i < 6; i++) {
    code += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return code;
}

function generateNewGame() {
  var game = {
    accessCode: generateAccessCode(),
    players: [],
    centerCards: [],
    playerRoles: [],
    state: 'waitingForPlayers',
    activeRoleIndex: 0
  };

  var gameID = Games.insert(game);
  return Games.findOne(gameID);
}

function generateNewPlayer(game, name) {
  var player = {
    gameID: game._id,
    name: name,
    role: null,
    // active = whether or not it is the player's turn at night
    active: false
  }

  var playerID = Players.insert(player);
  return Players.findOne(playerID);
}

function getCurrentGame() {
  var gameID = Session.get('gameID');
  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getAccessLink(){
  var game = getCurrentGame();

  if (!game){
    return;
  }
  return Meteor.settings.public.url + game.accessCode + '/';
}

function getCurrentPlayer() {
  var playerID = Session.get('playerID');
  if (playerID) {
    return Players.findOne(playerID);
  }
}

function resetUserState() {
  var player = getCurrentPlayer();
  var game = getCurrentGame();

  if (player) {
    Players.remove(player._id);
  }

  Session.set('gameID', null);
  Session.set('playerID', null);
}

/* sets the state of the game (which template to render) */
/* types of game state:
    waitingForPlayers (lobby)
    selectingRoles (roles)
    settingUp (loading)
    playing
 */
function trackGameState() {
  var gameID = Session.get('gameID');
  var playerID = Session.get('playerID');

  if (!gameID || !playerID) {
    return;
  }

  var game = Games.findOne(gameID);
  var player = Players.findOne(playerID);

  if (!game || !player) {
    Session.get('gameID', null);
    Session.set('playerID', null);
    Session.set('currentView', 'startMenu');
  }

  if (game.state === 'waitingForPlayers') {
    Session.set('currentView', 'lobby');
  } else if (game.state === 'selectingRoles') {
    Session.set('currentView', 'rolesMenu');
  } else if (game.state === 'playing') {
    Session.set('currentView', 'gameView');
  }
}

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

// function hasHistoryApi () {
//   return !!(window.history && window.history.pushState);
// }
//
// if (hasHistoryApi()){
//   function trackUrlState () {
//     var accessCode = null;
//     var game = getCurrentGame();
//     if (game) {
//       accessCode = game.accessCode;
//     } else {
//       accessCode = Session.get('urlAccessCode');
//     }
//
//     var currentURL = '/';
//     if (accessCode){
//       currentURL += accessCode+'/';
//     }
//     window.history.pushState(null, null, currentURL);
//   }
//   Tracker.autorun(trackUrlState);
// }
Tracker.autorun(trackGameState);

function leaveGame() {
  var player = getCurrentPlayer();
  Session.set('currentView', 'startMenu');
  Players.remove(player._id);
  Session.set('playerID', null);
};

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  }
});

Template.startMenu.events({
  'click #btn-create-game-view': function() {
    Session.set('currentView', 'createGame');
  },
  'click #btn-join-game-view': function() {
    Session.set('currentView', 'joinGame');
  }
});

Template.startMenu.rendered = function() {
  resetUserState();
};

Session.set('currentView', 'startMenu');

Template.createGame.events({
  'submit #create-game': function(event) {

    var playerName = event.target.playerName.value;
    if (!playerName) {
      return false;
    }

    var game = generateNewGame();
    var player = generateNewPlayer(game, playerName);

    Meteor.subscribe('games', game.accessCode);
    Meteor.subscribe('players', game._id, function onReady() {
      Session.set('gameID', game._id);
      Session.set('playerID', player._id);
      Session.set('currentView', 'lobby');
    });

    return false;
  },
  'click .btn-back-start-menu': function() {
    Session.set('currentView', 'startMenu');
    return false;
  }
})

Template.joinGame.events({
  'submit #join-game': function(event) {
    var playerName = event.target.playerName.value;
    var accessCode = event.target.accessCode.value;

    if (!playerName) {
      return false;
    }

    Meteor.subscribe('games', accessCode, function onReady() {
      var game = Games.findOne({
        accessCode: accessCode
      });

      if (game) {
        Meteor.subscribe('players', game._id);
        player = generateNewPlayer(game, playerName);

        // TODO if the game is in progress

        Session.set('urlAccessCode', null);
        Session.set('gameID', game._id);
        Session.set('playerID', player._id);
        Session.set('currentView', 'lobby');
      } else {
        console.log('invalid access code');
      }
    });

    return false;
  },
  'click .btn-back-start-menu': function() {
    Session.set('currentView', 'startMenu');
    return false;
  }
})

Template.lobby.helpers({
  game: function() {
    return getCurrentGame();
  },
  // player: function() {
  //   return getCurrentPlayer();
  // },
  players: function() {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    players.forEach(function(player) {
      if (player._id === currentPlayer._id) {
        player.isCurrent = true;
      }
    });

    return players;
  }
})

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': function() {
    Session.set('currentView', 'rolesMenu');

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'selectingRoles'}});
  }
})

Template.rolesMenu.helpers({
  roleKeys: function() {
    var roleKeys = [];
    for (key in allRoles) {
      roleKeys.push({ key : key, name : allRoles[key].name });
    }
    return roleKeys;
  },
  roles: allRoles
})

Template.rolesMenu.events({
  'submit #choose-roles': function(event) {
    var gameID = getCurrentGame()._id;
    var players = Players.find({'gameID': gameID});

    if ($('#choose-roles').find(':checkbox:checked').length >= players.count() + 3) {
      var selectedRoles = $('#choose-roles').find(':checkbox:checked').map(function() {
        // console.log(allRoles[this.value].instructions('hello'));
        console.log(allRoles[this.value]);
        return allRoles[this.value];
      }).get();

      Games.update(gameID, {$set: {state: 'settingUp', roles: selectedRoles}});
    }

    return false;
  }
})

Handlebars.registerHelper('equals', function(str1, str2) {
  return str1 === str2;
})


Handlebars.registerHelper('instructions', function(game, players, player) {
  var roleName = player.role.name;
  var playerArray = players.map(function(doc) {return doc});
  var werewolves = playerArray.filter(function(p) {
    return p.role.name === 'Werewolf'}
  ).map(function(p) {
    return p.name;
  });
  console.log(werewolves);
  if (roleName === 'Doppelganger') {
    return 'doppelganger instructions';
  } else if (roleName === 'Werewolf') {
    if (werewolves.length == 1) {
      return "Werewolf, wake up. Since you are a lone wolf, you may look at one of the center cards.";
    } else {
      return "Werewolves, wake up. There are " + werewolves.length + " of you: " + werewolves.join(', ');
    }
  } else {

  }
})

Template.gameView.helpers({
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();
    if (!game) {
      return null;
    }
    return Players.find({'gameID': game._id});
  },
  activeRole: function () {
    var game = getCurrentGame();
    return game.playerRoles[game.activeRoleIndex];
  }
})

Template.gameView.events({

});
