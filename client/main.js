import '../imports/roles.js';
import '../imports/utils.js';

const debug = 1;

function initialGame() {
  return {
    playerRoles: [],
    lovers: [],
    state: 'waitingForPlayers',
    deaths: [],
    injuries: [],
    history: []
  };
}

function initialPlayer() {
  return {
    role: null,
    vote: null, // id that this player selects at night
    call: null, // id that this player selects in the day
    lynch: null, // 'lynch' or 'spare'
    alive: true,
    crossbow: false, // crossbow loaded
    twang: null // id of crossbow victim
  };
}

function createGame(name) {
  const gameID = Games.insert({
    name: name,
    // default roles
    roles: ["werewolf_1", "werewolf_2", "wolfsbane", "trapper"],
    ... initialGame()
  });
  if (debug>=1) console.log(`New village '${name}' (${gameID})`)
  return Games.findOne(gameID);
}

function createPlayer(game, name) {
  const playerID = Players.insert({
    gameID: game._id,
    name: name,
    session: null,
    ... initialPlayer()
  });
  if (debug>=1) console.log(`New player '${name}' (${playerID}) in game '${game.name}'`)
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
    if (debug>=1) console.log(`Join village '${name}', id=${game._id}`);
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

function gameName(gameID) {
  if (gameID === undefined) gameID = Session.get('gameID');
  if (!gameID) return null;
  const game = Games.findOne(gameID, { fields: { name: 1 } });
  return game ? game.name : null;
}

function playerName(playerID) {
  const player = Players.findOne(
    (playerID !== undefined) ? playerID
                             : {session: Meteor.default_connection._lastSessionId},
    { fields: { name: 1 } }
  );
  return player ? player.name : null;
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
  const ret = allGamesFetch();
  return ret ? ret.map((game) => game.name) : ret;
}

function allPlayersFind (gameID=null, includeInactive=false) {
  if (!gameID) {
    gameID = Session.get('gameID');
    if (!gameID) return null;
  }
  return Players.find( { gameID: gameID, ...includeInactive || {session: {$ne: null}, alive: true} }, {fields: {name: 1}});
}

function allPlayers (gameID=null, includeInactive=false) {
  const ret = allPlayersFind (gameID, includeInactive)
  return ret ? ret.fetch() : [];
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
    if (debug>=2) console.log(`readyToStart=false: ${decks.roles} roles, ${ndark[true]} dark, ${types.werewolf} werewolves, ${types.cultist} cultists, ${decks.lovers} lovers/rivals`);
    return false;
  }
  const nplayers = allPlayersFind (game._id) . count();
  ok = (nplayers >= decks.roles && nplayers >= decks.lovers && nplayers > ndark[true]);
  if (debug>=2) console.log(`readyToStart=${ok}: ${nplayers} players, ${decks.roles} roles, ${ndark[true]} dark, ${types.werewolf} werewolves, ${types.cultist} cultists, ${decks.lovers} lovers/rivals`);
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
  if (gameID) {
    Games.update(gameID, { $set: initialGame() });
    for (const player of allPlayers (gameID, true)) {
      Players.update(player._id, { $set: initialPlayer() });
    }
  }
}

function endGame() {
  resetGame();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
}

// Handlebars.registerHelper() wrapper.
// Blaze/Spacebars/Handlebars doesn't seem to allow multiple helpers to be defined at once as implied here:
//   https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper
// registerHelper({helper: ()=>{}}) can be used instead.
function registerHelper(helpers, helper) {
  if (typeof helpers == "object" && helper === undefined) {
    for (const [k,v] of Object.entries(helpers)) {
      if (debug>=3) console.log(`Handlebars.registerHelper(${k},${v})`);
      Handlebars.registerHelper(k,v);
    }
  } else {
    Handlebars.registerHelper(helpers,helper);
  }
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
    if (debug>=3) console.log(`all games = ${allGames()}`);
    $(".allGames-removed").removeClass("allGames-removed");
  });
  this.find("input").focus();
};

Template.startMenu.helpers({
  allGamesButtons: allGamesFetch,
});

Template.startMenu.events({
  'click .btn-reset': () => {
    if (debug>=1) console.log(`reset all games`);
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
  },
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

registerHelper ({
  errorMessage: () => Session.get('errorMessage'),
  game: getCurrentGame,
  gameName: gameName,
  playerName: () => (playerName() || "the undead"),
  roleName: () => {
    const player = getCurrentPlayer();
    return roleInfo (player ? player.role : null) . name;
  },
  showFellows: () => {
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
  },
  listAllRoles: () => {
    return getCurrentGame().roles.map (r => roleInfo(r).name) . join(", ");
  }
});

Template.nightView.helpers({
  alive: () => {
    const player = getCurrentPlayer();
    return (player && player.alive);
  },
  players: () => [ ... allPlayers(), { _id: 0, name: 'none' } ],
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

Template.nightView.rendered = () => {
  $('html').addClass("night");
};

Template.nightView.destroyed = () => {
  $('html').removeClass("night");
};

Template.dayView.rendered = () => {
  $('html').addClass("day");
};

Template.dayView.destroyed = () => {
  $('html').removeClass("day");
};

Template.dayView.helpers({
  haveVigilante: () => getCurrentGame().roles.some (r => roleInfo(r).vigilante),
  voting: () => {
    let calls = {}, lynching = 0;
    for (const {call} of Players.find({call: {$ne: null}}, {fields: {call:1} }) . fetch()) {
      if (call in calls) {
        if (++calls[call] == 2) lynching++;
      } else {
        calls[call] = 1;
      }
    }
    return lynching==1;
  },
  alive: () => {
    const player = getCurrentPlayer();
    return (player && player.alive);
  },
  players: allPlayers,
  playerClass: function() {
    const ncalls= Players.find({call: this._id}) . count();
    const loaded= Players.find({_id: this._id, crossbow: true}) . count();
    let cl = [];
    if (loaded) cl.push ("crossbow-loaded");
    if        (ncalls >= 2) {
      cl.push ("lynch-player");
    } else if (ncalls >= 1) {
      cl.push ("voted-player");
    }
    return cl.join(" ");
  },
  showCasualties: () => {
    const game= getCurrentGame();
    if (!game) return null;
    let msg = [];
    if (game.deaths.length)
      msg.push (game.deaths.join(" and ") + (game.deaths.length >= 2 ? " are" : " is") + " dead.");
    if (game.injuries.length)
      msg.push (game.injuries.join(" and ") + (game.injuries.length >= 2 ? " are" : " is") + " injured.");
    return msg.length ? msg.join("<br>") : "There are no injuries.";
  },
});

Template.nightView.events({
  'click .toggle-player': (event) => {
    const player = getCurrentPlayer();
    if (player) Players.update (player._id, {$set: {vote: event.target.id}});
  },
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame,
});

Template.dayView.events({
  'click .toggle-player': (event) => {
    const player = getCurrentPlayer();
    if (player) {
      if (player.crossbow) {
        const victimID = (roleInfo(player.role).vigilante && !player.twang) ? event.target.id : null;
        Players.update (player._id, {$set: {crossbow: false, ...victimID && {twang: victimID} }} );
      } else {
        let call = event.target.id;
        if (player.call == call) call = null;
        Players.update (player._id, {$set: {call: call}});
      }
    }
  },
  'click .btn-twang': () => {
    // allow anyone to load a crossbow, but only vigilante can fire.
    const player = getCurrentPlayer();
    if (player)
      Players.update (player._id, {$set: {call: null, crossbow: !player.crossbow}});
  },
  'click .btn-sleep': (event) => {
    const gameID = Session.get('gameID');
    if (gameID) Games.update(gameID, {$set: {state: 'nightTime', deaths: [], injuries: []}});
  },
  'click .btn-lynch': () => lynchVote("lynch"),
  'click .btn-spare': () => lynchVote("spare"),
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame,
});

function lynchVote(vote) {
  const player = getCurrentPlayer();
  if (player) Players.update (player._id, {$set: {lynch: vote}});
}
