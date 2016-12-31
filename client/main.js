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
    accessCode: generateAccessCode()
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
function trackGameState() {

}

function leaveGame() {

}

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  }
})

Template.startMenu.events({
  'click #btn-create-game-view': function() {
    Session.set('currentView', 'createGame');
  },
  'click #btn-join-game-view': function() {
    Session.set('currentView', 'joinGame');
  }
});

Session.set('currentView', 'startMenu');

Template.createGame.events({
  'submit #create-game': function(event) {
    console.log('new game created');

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
  'click .btn-back': function() {
    Session.set('currentView', 'startMenu');
    return false;
  }
})

Template.joinGame.events({
  'submit': function(event) {
    console.log('game was joined');
    return false;
  },
  'click .btn-back': function() {
    Session.set('currentView', 'startMenu');
    return false;
  }
})

Template.lobby.helpers({
  game: function() {
    return getCurrentGame();
  },
  accessLink: function() {
    return getAccessLink();
  },
  player: function() {
    return getCurrentPlayer();
  },
  players: function() {
    var game = getCurrentGame();
    var currentPlayer = getCurrentPlayer();

    if (!game) {
      return null;
    }

    var players = Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();

    // players.forEach(function(player) {
    //   if (player._id === currentPlayer._id) {
    //     player.isCurrent = true;
    //   }
    // });

    return players;
  }
})
