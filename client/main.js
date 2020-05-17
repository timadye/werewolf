import '../imports/roles.js';

function initialGame() {
  var game = {
    centerCards: [],
    playerRoles: [],
    state: 'waitingForPlayers',
    turnIndex: 0,
    numMoves: 0,
    moveLimit: 0,
    selectedPlayerIds: [],
    selectedCenterCards: [],
    // whether or not werewolf can click center or player cards
    werewolfCenter: false,
    // list of swaps in the form of { player_id : ___, new_role : ___ }
    swaps: [],
    swapping: false,
    insomniacRole: allRoles.insomniac,
    // time
    discussionTime: 5,
    endTime: null,
    paused: false,
    pausedTime: null,
    // playerIDs, sorted afterwards
    killed: [],
    // default roles
    roles: ["werewolf_1", "werewolf_2", "wolfsbane", "trapper"]
  };
  return game;
}

function createGame(name) {
  var game = { name: name, ... initialGame() };
  var gameID = Games.insert(game);
  console.log(`New village '${name}' (${gameID})`)
  return Games.findOne(gameID);
}

function createPlayer(game, name) {
  var player = {
    gameID: game._id,
    name: name,
    session: null,
    role: null,
    vote: null // id that this player votes to kill
  }

  var playerID = Players.insert(player);
  console.log(`New player '${name}' (${playerID}) in game '${game.name}'`)
  return Players.findOne(playerID);
}

function joinGame(name) {
  Meteor.subscribe('games', name, function onReady() {
    var game = Games.findOne({name: name});
    if (!game) {
      leaveGame();
      reportError(`no village '${name}'`);
      return false;
    }
    console.log(`join village '${name}', id=${game._id}`);
    if (game.state !== 'waitingForPlayers') {
      leaveGame();
      reportError('Please wait. Cannot join village ${name} with game in progress.');
      return false;
    }
    Meteor.subscribe('players', game._id);
    Session.set('gameID', game._id);
  });
  return false;
}

function setCurrentGame(game) {
  if (game) {
    if (game._id !== Session.get('gameID')) {
      Session.set('gameID', game._id);
    }
    urlVillage = Session.get("urlVillage");
    if (!urlVillage || urlVillage != game.name) {
      FlowRouter.go(`/${game.name}`);
    }
  } else {
    if (Session.get('gameID')) {
      Session.set('gameID', null);
    }
    if (Session.get("urlVillage")) {
      FlowRouter.go('/');
    }
  }
}

function getCurrentGame() {
  var gameID = Session.get('gameID');
  if (gameID) {
    return Games.findOne(gameID);
  }
}

function getCurrentPlayer() {
  return Players.findOne({session: Meteor.default_connection._lastSessionId});
}

function setCurrentPlayer (newID, toggle=false) {
  player = getCurrentPlayer();
  if (player) {
    if (newID == player._id) {
      if (toggle) {
        Players.update(player._id, {$set: {session: null}});
        return null;
      } else {
        return player._id;
      }
    } else {
      Players.update(player._id, {$set: {session: null}});
    }
  }
  if (newID) {
    Players.update(newID, {$set: {session: Meteor.default_connection._lastSessionId}});
    return newID;
  }
  return null;
}

function reportError(msg) {
  if (msg) {
    console.error(msg);
  }
  Session.set('errorMessage', msg);
}

function resetUserState() {
  var player = getCurrentPlayer();
  var game = getCurrentGame();

  if (player) {
    Players.remove(player._id);
  }

  setCurrentGame(null);
  setCurrentPlayer(null);
}

function allGamesFetch() {
  if (Session.get('allGamesSubscribed')) {
    return Games.find({}, {fields: {name: 1}}).fetch();
  } else {
    return [];
  }
}

function allGames() {
  var games = allGamesFetch();
  var all= [];
  games.forEach(function(game) {
    all.push(game.name);
  });
  return all;
}

function readyToStart() {
  var game = getCurrentGame();
  if (!game) {
    return false;
  }
  var count = { role:0, lover:0, dark:0, light:1, werewolf:0, cultist:0 };
  for (name of game.roles) {
    role = allRoles[name];
    var n = role.number || 1;
    count[role.type]                               += n;
    count[{0:    "role", 1:   "lover"}[role.deck]] += n;  // deck0=roles, deck1=lovers/rivals
    count[{false:"light",true:"dark" }[role.dark]] += n;
  }
  if (!(count.werewolf >= 1 && count.cultist != 1)) {
    console.log(`readyToStart=false: ${count.role} roles, ${count.dark} dark, ${count.werewolf} werewolves, ${count.cultist} cultists, ${count.lover} lovers/rivals`);
    return false;
  }
  var nplayers = Players.find({ gameID: game._id, session: {$ne: null} }).count();
  ok = (nplayers >= count.role && nplayers >= count.lover && nplayers > count.dark);
  console.log(`readyToStart=${ok}: ${nplayers} players, ${count.role} roles, ${count.dark} dark, ${count.werewolf} werewolves, ${count.cultist} cultists, ${count.lover} lovers/rivals`);
  return ok;
}

/* sets the state of the game (which template to render) */
/* types of game state:
    waitingForPlayers (lobby)
    settingUp (loading)
    playing
 */
function trackGameState() {
  var gameID = Session.get('gameID');

  if (!gameID) {
    return;
  }

  var game = Games.findOne(gameID);
  if (!game) {
    console.log(`gameID ${gameID} not found.`);
    setCurrentGame(null);
    setCurrentPlayer(null)
    Session.set('currentView', 'startMenu');
    return;
  }

  if (game.state === 'waitingForPlayers') {
    Session.set('currentView', 'lobby');
  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
  // game.state can also be finishedVoting and voting
}

Meteor.setInterval(function () {
  Session.set('time', new Date());
}, 1000);

Tracker.autorun(trackGameState);

function leaveGame() {
  var player = getCurrentPlayer();
  if (player) {
    Players.remove(player._id);
  }
  Session.set('currentView', 'startMenu');
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);
  setCurrentGame (null);
};

function resetGame() {
  var game = getCurrentGame();
  if (game) {
    Games.update(game._id, { $set: initialGame() });
  }
}

function endGame() {
  resetGame();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
}

Template.main.helpers({
  whichView: function() {
    return Session.get('currentView');
  }
});

Template.startMenu.rendered = function() {
  resetUserState();
  Session.set('allGamesSubscribed',false);
  // subscription allGames might not be published by server, but show all games if so.
  Meteor.subscribe('allGames', function onReady() {
    Session.set('allGamesSubscribed',true);
    console.log(`all games = ${allGames()}`);
    $(".allGames-removed").removeClass("allGames-removed");
  });
  this.find("input").focus();
};

Template.startMenu.helpers({
  allGamesButtons: allGamesFetch
});

Template.startMenu.events({
  'click .btn-reset': function() {
    console.log(`reset all games`);
    resetUserState();
    Meteor.call('resetAllGames');
  },
  'click .join-village': function(event) {
    var villageName = event.target.id;
    FlowRouter.go(`/${villageName}`);
  },
  'submit #start-menu': function(event) {

    var villageName = event.target.villageName.value;
    if (!villageName) {
      return false;
    }

    Meteor.call('villageExists', villageName, function(error,result) {
      if (error) return false;
      if (!result) {
        createGame(villageName);
      }
      FlowRouter.go(`/${villageName}`);
    });

    return false;
  }
});

Session.set('currentView', 'startMenu');

Template.lobby.rendered = function (event) {
  if (!Session.get('gameID')) {
    var villageName = Session.get('urlVillage');
    if (villageName) {
      joinGame(villageName);
    }
  }
  this.find("input").focus();
};

Template.lobby.helpers({
  errorMessage: function() {
    return Session.get('errorMessage');
  },
  game: function() {
    return getCurrentGame();
  },
  players: function() {
    var game = getCurrentGame();
    if (!game) {
      return null;
    }
    return Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
  },
  playerClass: function() {
    var player= Players.findOne(this._id);
    if (!player) {
      return null;
    } else if (player.session == Meteor.default_connection._lastSessionId) {
      return "current-player";
    } else if (player.session) {
      return "active-player";
    } else {
      return null;
    }
  },
  roleKeys: function() {
    var roleKeys = [];
    for (key in allRoles) {
      roleKeys.push({ key : key, name : allRoles[key].name });
    }
    return roleKeys;
  },
  roleClass: function() {
    var game= getCurrentGame();
    return (game && game.roles.includes(this.key)) ? "selected-role" : null;
  },
  roles: allRoles,
  startButtonDisabled: function() {
    return readyToStart() ? null : "disabled";
  },
  errorMessage: function() {
    return Session.get('errorMessage');
  }
})

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': function() {
    Session.set('currentView', 'rolesMenu');

    var game = getCurrentGame();
    Games.update(game._id, {$set: {state: 'nightTime'}});
  },
  'click .toggle-player': function(event) {
    setCurrentPlayer (event.target.id, true);
  },
  'submit #lobby-add': function(event) {
    var playerName = event.target.playerName.value;
    var game = getCurrentGame();
    var player = createPlayer(game, playerName);
    setCurrentPlayer (player._id);
    event.target.playerName.value = '';
    return false;
  },
  'click .toggle-role': function(event) {
    var role = event.target.id;
    var game = getCurrentGame();
    var ind = game.roles.indexOf(role);
    if (ind >= 0) {
      game.roles.splice(ind,1);
    } else {
      game.roles.push(role);
    }
    Games.update(game._id, {$set: {roles: game.roles}});
  },
  'submit #choose-roles-form': function(event) {
    var gameID = getCurrentGame()._id;
    var players = Players.find({'gameID': gameID});

    if ($('#choose-roles-form').find(':checkbox:checked').length >= players.count() + 3) {
      var selectedRoles = $('#choose-roles-form').find(':checkbox:checked').map(function() {
        return allRoles[this.value];
      }).get();
      Games.update(gameID, {$set: {state: 'settingUp', roles: selectedRoles}});
      reportError(null);
    } else {
      reportError('Please select at least ' + (players.count() + 3) + ' roles.');
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
    var playerArray = players.map(function(doc) {return doc});
    var werewolves = playerArray.filter(function(p) {
      return p.role.name === 'Werewolf'}
    ).map(function(p) {
      return p.name;
    });
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
    Games.update(game._id, {$set: {moveLimit: 0}});
    return "Insomniac, wake up and look at your card. Your role is " + game.insomniacRole.name + ".";
  }
})

Handlebars.registerHelper('stillNight', function(game) {
  var role = game.playerRoles[game.turnIndex];
  return role && role.order < 15;
});

Template.nightView.helpers({
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();
    if (!game) {
      return null;
    }

    return Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
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

function canEndNight () {
  var game = getCurrentGame();
  var role = game.playerRoles[game.turnIndex];
  return !(role && role.order < 15);
}

Template.nightView.events({
  'click #btn-end-turn': function() {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    if (isTurn(game, player) && game.moveLimit == game.numMoves) {
      var roleName = player.role.name;
      var swaps = game.swaps;

      // perform necessary role swaps
      if (roleName === 'Robber') {
        var clickedPlayer = Players.findOne(game.selectedPlayerIds[0]);
        swaps.push({ id : player._id, role : clickedPlayer.role });
        swaps.push({ id : clickedPlayer._id, role : allRoles.robber });
        if (clickedPlayer.role.name === 'Insomniac') {
          Games.update(game._id, {$set: {insomniacRole: allRoles.robber}});
        }
        Games.update(game._id, {$set: {swaps: swaps}});
      }
      else if (roleName === 'Troublemaker') {
        var player0 = Players.findOne(game.selectedPlayerIds[0]);
        var player1 = Players.findOne(game.selectedPlayerIds[1]);
        swaps.push({ id : player0._id, role : player1.role });
        swaps.push({ id : player1._id, role : player0.role });
        if (player0.role.name === 'Insomniac') {
          Games.update(game._id, {$set: {insomniacRole: player1.role}});
        }
        if (player1.role.name === 'Insomniac') {
          Games.update(game._id, {$set: {insomniacRole: player0.role}});
        }
        Games.update(game._id, {$set: {swaps: swaps}});
      }
      else if (roleName === 'Drunk') {
        var clickedCardID = game.selectedCenterCards[0];
        var clickedRole = game.centerCards[clickedCardID];
        swaps.push({ id : player._id, role : clickedRole });
        var newCenterCards = game.centerCards;
        newCenterCards[clickedCardID] = allRoles.drunk;
        Games.update(game._id, {$set: {centerCards: newCenterCards}});
        Games.update(game._id, {$set: {swaps: swaps}});
      }

      var game = getCurrentGame();
      // css
      for (index in game.selectedCenterCards) {
        var cssId = '#card-' + game.selectedCenterCards[index];
        $(cssId).removeClass('selected-card');
      }
      for (index in game.selectedPlayerIds) {
        var cssId = '#' + game.selectedPlayerIds[index];
        $(cssId).removeClass('selected-card');
      }


      Games.update(game._id, {$set: {turnIndex: game.turnIndex + 1}});
      Games.update(game._id, {$set: {numMoves: 0}});
      Games.update(game._id, {$set: {selectedPlayerIds: []}});
      Games.update(game._id, {$set: {selectedCenterCards: []}});

      Session.set('turnMessage', null);

      if (canEndNight()) {
        var game = getCurrentGame();
        Games.update(game._id, {$set: {swapping: true}});
        Games.update(game._id, {$set: {state: 'dayTime'}});
      }
    }

    return false;
  },
  'click .center-cards': function(event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();
    if (game.numMoves < game.moveLimit && isTurn(game, player)) {
      var clickedCardID = event.currentTarget.id.replace('card-', '');
      if (canClickCenter(game, player, clickedCardID)) {
        var cssId = '#' + event.currentTarget.id;
        $(cssId).addClass('selected-card');
        var roleName = player.role.name;
        if (roleName === 'Werewolf') {
          Session.set('turnMessage', "Card " + clickedCardID + " is the " + game.centerCards[clickedCardID].name + ".");
        }
        else if (roleName === 'Seer') {
          var message = Session.get('turnMessage');
          if (message) {
            message += " Card " + clickedCardID + " is the " + game.centerCards[clickedCardID].name + ".";
          } else {
            message = "Card " + clickedCardID + " is the " + game.centerCards[clickedCardID].name + ".";
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
        var cssId = '#' + event.currentTarget.id;
        $(cssId).addClass('selected-card');
        var roleName = player.role.name;
        if (roleName === 'Doppelganger') {
          Session.set('turnMessage', "Your new role is " + clickedPlayer.role.name + ".");
        }
        else if (roleName === 'Seer') {
          Session.set('turnMessage', clickedPlayer.name + "'s role is " + clickedPlayer.role.name + ".");
          Games.update(game._id, {$set: {numMoves: game.numMoves + 1}});
        }
        else if (roleName === 'Robber') {
          Session.set('turnMessage', "You stole " + clickedPlayer.name + "'s card. Your new role is " + clickedPlayer.role.name + ".");
        }
        var game = getCurrentGame();
        Games.update(game._id, {$set: {numMoves: game.numMoves + 1}});
        Games.update(game._id, {$push: {selectedPlayerIds: clickedPlayer._id}});
      }
    }
    return false;
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame
});

function getTimeRemaining() {
  var game = getCurrentGame();
  var localEndTime = game.endTime - TimeSync.serverOffset();

  if (game.paused) {
    var localPausedTime = game.pausedTime - TimeSync.serverOffset();
    var timeRemaining = localEndTime - localPausedTime;
  } else {
    var timeRemaining = localEndTime - Session.get('time');
  }

  if (timeRemaining < 0 && timeRemaining > -5000) {
    if (game.state !== 'voting') {
      Games.update(game._id, {$set: {'state': 'voting'}});
    }
  }

  if (timeRemaining < 0) {
    timeRemaining = 0;
  }

  return timeRemaining;
}

function getVotingTimeRemaining() {
  var game = getCurrentGame();

  var localEndTime = game.endTime - TimeSync.serverOffset();
  var timeRemaining = localEndTime - Session.get('time');

  if (timeRemaining < 1000 && timeRemaining > 0) {
    var player = getCurrentPlayer();
    Games.update(game._id, {$set: {'state': 'finishedVoting'}});
  }

  if (timeRemaining < 0) {
    timeRemaining = 0;
  }

  return timeRemaining;
}

Template.dayView.helpers({
  game: getCurrentGame,
  player: getCurrentPlayer,
  players: function () {
    var game = getCurrentGame();
    if (!game) {
      return null;
    }

    return Players.find({'gameID': game._id}, {'sort': {'createdAt': 1}}).fetch();
  },
  timeRemaining: function () {
    var game = getCurrentGame();
    if (game.state === 'voting' || game.state === 'finishedVoting') {
      var timeRemaining = getVotingTimeRemaining();
    } else {
      var timeRemaining = getTimeRemaining();
    }

    return moment(timeRemaining).format('m[<span>:</span>]ss');
  },
  winningTeam: function() {
    var game = getCurrentGame();
    for (index in game.killed) {
      var roleName = game.killed[index].role.name;
      if (roleName === 'Tanner') {
        return 'The Tanner wins!';
      }
      if (roleName === 'Werewolf') {
        return 'The Villagers win!'
      }
    }
    return 'The Werewolves win!';
  }
})

Handlebars.registerHelper('noDeaths', function(game) {
  return game.killed.length == 0;
})

Template.dayView.events({
  'click #countdown': function () {
    var game = getCurrentGame();
    var currentServerTime = TimeSync.serverTime(moment());

    if(game.paused) {
      var newEndTime = game.endTime - game.pausedTime + currentServerTime;
      Games.update(game._id, {$set: {paused: false, pausedTime: null, endTime: newEndTime}});
    } else {
      Games.update(game._id, {$set: {paused: true, pausedTime: currentServerTime}});
    }
  },
  'click .vote-player': function(event) {
    var game = getCurrentGame();
    var player = getCurrentPlayer();

    Players.update(player._id, {$set: {vote: event.currentTarget.id}});
    return false;
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame,
  'click .btn-vote-now': function () {
    var game = getCurrentGame();
    if (game.state !== 'voting') {
      Games.update(game._id, {$set: {'state': 'voting'}});
    }
  }
});
