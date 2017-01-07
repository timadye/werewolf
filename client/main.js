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
    centerCards: [],
    playerRoles: [],
    state: 'waitingForPlayers',
    turnIndex: 0,
    numMoves: 0,
    moveLimit: 0,
    selectedPlayerIds: [],
    selectedCenterCards: [],
    // whether or not werewolf can click center or player cards
    werewolfCenter: false
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
    Session.set('gameID', null);
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

// also updates moveLimit
Handlebars.registerHelper('instructions', function(game, players, player) {
  var roleName = player.role.name;

  if (roleName === 'Doppelganger') {
    Games.update(game._id, {$set: {moveLimit: 1}});
    return 'doppelganger instructions';
  }
  else if (roleName === 'Werewolf') {
    var playerArray = players.map(function(doc) {return doc});
    var werewolves = playerArray.filter(function(p) {
      return p.role.name === 'Werewolf'}
    ).map(function(p) {
      return p.name;
    });
    if (werewolves.length == 1) {
      Games.update(game._id, {$set: {moveLimit: 1}});
      Games.update(game._id, {$set: {werewolfCenter: true}});
      return "Werewolf, wake up. Since you are a lone wolf, you may look at one of the center cards.";
    } else {
      Games.update(game._id, {$set: {moveLimit: 0}});
      return "Werewolves, wake up. There are " + werewolves.length + " of you: " + werewolves.join(', ') + ".";
    }
  }
  else if (roleName === 'Minion') {
    Games.update(game._id, {$set: {moveLimit: 0}});
    if (werewolves.length == 0) {
      return "Minion, wake up. There are no werewolves.";
    } else {
      return "Minion, wake up. There are " + werewolves.length + " werewolves that you must protect: " + werewolves.join(', ') + ".";
    }
  }
  else if (roleName === 'Mason') {
    var playerArray = players.map(function(doc) {return doc});
    var masons = playerArray.filter(function(p) {
      return p.role.name === 'Mason'}
    ).map(function(p) {
      return p.name;
    });
    Games.update(game._id, {$set: {moveLimit: 0}});
    if (masons.length == 1) {
      return "Mason, wake up. You are the only mason.";
    } else {
      return "Masons, wake up. There are " + masons.length + " of you: " + masons.join(', ') + ".";
    }
  }
  else if (roleName === 'Seer') {
    Games.update(game._id, {$set: {moveLimit: 2}});
    return "Seer, wake up. You may look at another player's card or two of the center cards."
  }
  else if (roleName === 'Robber') {
    Games.update(game._id, {$set: {moveLimit: 1}});
    return "Robber, wake up. You may exchange your card with another player's card, and then view your new card."
  }
  else if (roleName === 'Troublemaker') {
    Games.update(game._id, {$set: {moveLimit: 2}});
    return "Troublemaker, wake up. You may exchange cards between two players."
  }
  else if (roleName === 'Drunk') {
    Games.update(game._id, {$set: {moveLimit: 1}});
    return "Drunk, wake up and exchange your card with a card from the center."
  }
  else if (roleName === 'Insomniac') {
    Games.update(game._id, {$set: {moveLimit: 1}});
    return "Insomniac, wake up and look at your card. Your role is " + player.role.name + ".";
  }
})

Handlebars.registerHelper('stillNight', function(game) {
  var role = game.playerRoles[game.turnIndex];
  return role && role.order < 15;
});

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
  turnIndex: function () {
    return getCurrentGame().turnIndex;
  },
  activeRole: function () {
    var game = getCurrentGame();
    return game.playerRoles[game.turnIndex];
  },
  turnMessage: function () {
    return Session.get('turnMessage');
  }
})

function isTurn(game, player) {
  if (!game.playerRoles[game.turnIndex]) {
    return false;
  }
  var activeRole = game.playerRoles[game.turnIndex].name;
  var playerRole = player.role.name;
  return activeRole === playerRole;
}

function canClickCenter(game, player, clickedCardID) {
  var roleName = player.role.name;
  if (roleName === 'Werewolf' && !game.werewolfCenter) {
    return false;
  }
  else if (roleName !== 'Werewolf' && roleName !== 'Seer' && roleName !== 'Drunk') {
    return false;
  }

  return game.selectedCenterCards.indexOf(clickedCardID) < 0;
}

function canClickPlayer(game, activePlayer, clickedPlayer) {
  if (activePlayer.name === clickedPlayer.name) {
    return false;
  }

  var roleName = activePlayer.role.name;
  if (roleName === 'Seer' && game.numMoves != 0) {
    return false;
  }
  if (roleName !== 'Doppelganger' && roleName !== 'Seer' && roleName !== 'Troublemaker' && roleName !== 'Robber') {
    return false;
  }

  return game.selectedPlayerIds.indexOf(clickedPlayer._id) < 0;
}

Template.gameView.events({
  'click #btn-end-turn': function() {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    if (isTurn(game, player) && game.moveLimit == game.numMoves) {
      Games.update(game._id, {$set: {turnIndex: game.turnIndex + 1}});
      Games.update(game._id, {$set: {numMoves: 0}});
      Games.update(game._id, {$set: {selectedPlayerIds: []}});
      Games.update(game._id, {$set: {selectedCenterCards: []}});
      Session.set('turnMessage', null);
    }
    return false;
  },
  'click .center-cards': function(event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    if (game.numMoves < game.moveLimit && isTurn(game, player)) {
      var clickedCardID = event.currentTarget.id.replace('card-', '');
      if (canClickCenter(game, player, clickedCardID)) {
        var roleName = player.role.name;
        if (roleName === 'Werewolf') {
          Session.set('turnMessage', "Card " + clickedCardID + " is a " + game.centerCards[clickedCardID].name + ".");
        }
        else if (roleName === 'Seer') {
          var message = "";
          for (index in cc) {
            var id = game.selectedCenterCards[index];
            message += "Card " + id + " is a " + game.centerCards[id].name + ".";
          }
          Session.set('turnMessage', message);
        }
        Games.update(game._id, {$set: {numMoves: game.numMoves + 1}});
        Games.update(game._id, {$push: {selectedCenterCards: clickedCardID}});
      }
    }
    return false;
  },
  'click .player-cards': function(event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    if (game.numMoves < game.moveLimit && isTurn(game, player)) {
      var clickedPlayer = Players.findOne(event.currentTarget.id);
      if (canClickPlayer(game, player, clickedPlayer)) {
        var roleName = player.role.name;
        if (roleName === 'Doppelganger') {
          Session.set('turnMessage', "Your new role is " + clickedPlayer.role.name + ".");
        }
        else if (roleName === 'Seer') {
          Session.set('turnMessage', clickedPlayer.name + "'s role is " + clickedPlayer.role.name + ".");
        }
        else if (roleName === 'Robber') {
          Session.set('turnMessage', "You stole " + clickedPlayer.name + "'s card. Your new role is " + clickedPlayer.role.name + ".");
        }

        Games.update(game._id, {$set: {numMoves: game.numMoves + 1}});
        Games.update(game._id, {$push: {selectedPlayerIds: clickedPlayer._id}});
      }
    }
    return false;
  }
});
