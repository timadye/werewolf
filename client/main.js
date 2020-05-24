import '../imports/roles.js';
import '../imports/utils.js';

function initialGame() {
  return {
    centerCards: [],
    playerRoles: [],
    lovers: [],
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
  };
}

function createGame(name) {
  const gameID = Games.insert({
    name: name,
    // default roles
    roles: ["werewolf_1", "werewolf_2", "wolfsbane", "trapper"],
    ... initialGame()
  });
  console.log(`New village '${name}' (${gameID})`)
  return Games.findOne(gameID);
}

function createPlayer(game, name) {
  const playerID = Players.insert({
    gameID: game._id,
    name: name,
    session: null,
    role: null,
    vote: null // id that this player votes to kill
  });
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
  const gameID = Session.get('gameID');
  return gameID ? Games.findOne(gameID) : null;
}

function getCurrentPlayer() {
  return Players.findOne({session: Meteor.default_connection._lastSessionId});
}

function setCurrentPlayer (newID, toggle=false) {
  const player = getCurrentPlayer();
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
  if (msg) console.error(msg);
  Session.set('errorMessage', msg);
}

function resetUserState() {
  setCurrentGame(null);
  setCurrentPlayer(null);
}

function allGamesFetch() {
  return Session.get('allGamesSubscribed') ? Games.find ({}, {fields: {name: 1}}).fetch() : [];
}

function allGames() {
  return allGamesFetch() . map ((game) => game.name);
}

function allPlayersFind (game=null, includeInactive=false) {
  if (!game) {
    game = getCurrentGame();
    if (!game) return null;
  }
  return Players.find( { gameID: game._id, ...includeInactive || {session: {$ne: null}} }, {fields: {name: 1}});
}

function allPlayers (game, includeInactive=false) {
  var ret = allPlayersFind (game, includeInactive)
  return ret ? ret.fetch() : null;
}

function readyToStart() {
  const game = getCurrentGame();
  if (!game) return false;
  var types = { werewolf:0, cultist:0 };
  var decks = { roles:0,    lovers:0  };
  var ndark=  { [false]:0, [true]:0   };
  for (name of game.roles) {
    role = allRoles[name];
    const n = role.number || 1;
    types[role.type] += n;
    decks[role.deck] += n;  // deck=roles or lovers
    ndark[role.dark] += n;
  }
  if (!(types.werewolf >= 1 && types.cultist != 1)) {
    console.log(`readyToStart=false: ${decks.roles} roles, ${ndark[true]} dark, ${types.werewolf} werewolves, ${types.cultist} cultists, ${decks.lovers} lovers/rivals`);
    return false;
  }
  const nplayers = allPlayersFind (game) . count();
  ok = (nplayers >= decks.roles && nplayers >= decks.lovers && nplayers > ndark[true]);
  console.log(`readyToStart=${ok}: ${nplayers} players, ${decks.roles} roles, ${ndark[true]} dark, ${types.werewolf} werewolves, ${types.cultist} cultists, ${decks.lovers} lovers/rivals`);
  return ok;
}

/* sets the state of the game (which template to render) */
/* types of game state:
    waitingForPlayers (lobby)
    settingUp (loading)
    nightTime
    dayTime
 */
function trackGameState() {
  const game = getCurrentGame();
  if (!game) return;
  if (game.state === 'waitingForPlayers') {
    Session.set('currentView', 'lobby');
  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
}

Meteor.setInterval(() => {
  Session.set('time', new Date());
}, 1000);

Tracker.autorun(trackGameState);

function leaveGame() {
  Session.set('currentView', 'startMenu');
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);
};

function resetGame() {
  const gameID = Session.get('gameID');
  if (gameID) Games.update(gameID, { $set: initialGame() });
}

function endGame() {
  resetGame();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
}

Template.main.helpers({
  whichView: () => {
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
  'click .btn-reset': () => {
    console.log(`reset all games`);
    resetUserState();
    Meteor.call('resetAllGames');
  },
  'click .join-village': (event) => {
    const villageName = event.target.id;
    FlowRouter.go(`/${villageName}`);
  },
  'submit #start-menu': (event) => {

    const villageName = event.target.villageName.value;
    if (!villageName) {
      return false;
    }

    Meteor.call('villageExists', villageName, (error,result) => {
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

Template.lobby.rendered = function(event) {
  if (!Session.get('gameID')) {
    const villageName = Session.get('urlVillage');
    if (villageName) {
      joinGame(villageName);
    }
  }
  this.find("input").focus();
};

Template.lobby.helpers({
  errorMessage: () => Session.get('errorMessage'),
  game: getCurrentGame,
  players: () => allPlayers (null, true),
  playerClass: function() {
    const player= Players.findOne(this._id);
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
  roleKeys: () => {
    var roleKeys = [];
    for (key in allRoles) {
      roleKeys.push({ key : key, name : allRoles[key].name });
    }
    return roleKeys;
  },
  roleClass: function() {
    const game= getCurrentGame();
    return (game && game.roles.includes(this.key)) ? "selected-role" : null;
  },
  roles: allRoles,
  startButtonDisabled: () => readyToStart() ? null : "disabled",
  errorMessage: () => Session.get('errorMessage'),
})

Template.lobby.events({
  'click .btn-leave': leaveGame,
  'click .btn-start': () => {
    const gameID = Session.get('gameID');
    if (gameID) Games.update(gameID, {$set: {state: 'settingUp'}});
  },
  'click .toggle-player': (event) => {
    setCurrentPlayer (event.target.id, true);
  },
  'submit #lobby-add': (event) => {
    const playerName = event.target.playerName.value;
    const game = getCurrentGame();
    const player = createPlayer(game, playerName);
    setCurrentPlayer (player._id);
    event.target.playerName.value = '';
    return false;
  },
  'click .toggle-role': (event) => {
    const role = event.target.id;
    var game = getCurrentGame();
    const ind = game.roles.indexOf(role);
    if (ind >= 0) {
      game.roles.splice(ind,1);
    } else {
      game.roles.push(role);
    }
    Games.update(game._id, {$set: {roles: game.roles}});
  },
});

function playerName() {
  const player = getCurrentPlayer();
  return player ? player.name : "the undead";
}

function roleName() {
  const player = getCurrentPlayer();
  return roleInfo (player ? player.role : null) . name;
}

function showFellows() {
  const player = getCurrentPlayer();
  if (!player) return null;
  return Object.entries (player.fellows) . map (([f,players]) => {
    const pmsg = players.join(" and ");
    const fmsg = {
      werewolf: ["The other werewolf is ",  "The other werewolves are " ],
      cultist:  ["Your fellow cultist is ", "Your fellow cultists are " ],
      lover:    ["You are in love with ",   "You are in love with "     ],
      rival:    ["Your rival is ",          "Your rivals are "          ],
    }[f];
    return (fmsg ? fmsg[players.length==1?0:1] : f+": ")+pmsg+".<br>";
  }) . join("");
}

function listAllRoles() {
  return getCurrentGame().roles.map (r => roleInfo(r).name) . join(", ");
}


Template.nightView.helpers({
  playerName: playerName,
  roleName: roleName,
  showFellows: showFellows,
  listAllRoles: listAllRoles,
  players: allPlayers,
  playerClass: function() {
    const player= Players.findOne(this._id);
    if (!player) {
      return null;
    } else if (player.vote) {
      return "voted-player";
    } else {
      return null;
    }
  },
});

Template.dayView.helpers({
  playerName: playerName,
  roleName: roleName,
  showFellows: showFellows,
  listAllRoles: listAllRoles,
  players: allPlayers,
  playerClass: function() {
    const player= Players.findOne(this._id);
    if (!player) {
      return null;
    } else if (player.vote) {
      return "voted-player";
    } else {
      return null;
    }
  },
});

Template.nightView.events({
  'click .toggle-player': (event) => {
    const player = getCurrentPlayer();
    if (player) Players.update (player._id, {$set: {vote: event.target.id}});
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame
});

Template.dayView.events({
  'click .btn-sleep': (event) => {
    const gameID = Session.get('gameID');
    if (gameID) Games.update(gameID, {$set: {state: 'nightTime'}});
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame
});
