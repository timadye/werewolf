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
    roles: [],
    state: 'waitingForPlayers'
  };

  var gameID = Games.insert(game);
  return Games.findOne(gameID);
}

function generateNewPlayer(game, name) {
  var player = {
    gameID: game._id,
    name: name,
    role: null
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

  if (player) {
    Players.remove(player._id);
  }

  Session.set('gameID', null);
  Session.set('playerID', null);
}

/* sets the state of the game (which template to render) */
/* types of game state:
    waitingForPlayers (lobby)
    settingUp (roles)
    inProgress (gameView)
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

  var views = {
    'waitingForPlayers' : 'lobby',
    'settingUp' : 'rolesMenu',
    'inProgress' : 'gameView'
  }

  if (game.state) {
    Session.set('currentView', views[game.state]);
  }
}

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

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
    Games.update(game._id, {$set: {state: 'settingUp'}});
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
      Session.set('currentView', 'gameView');
      var selectedRoles = $('#choose-roles').find(':checkbox:checked').map(function() {
        return allRoles[this.value];
      }).get();

      Games.update(gameID, {$set: {state: 'settingUp', roles: selectedRoles}});
    }

    return false;
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
  }
})

Template.gameView.events({

})
