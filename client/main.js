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
  if (!game || !name) return null;
  const player = Players.findOne({gameID: game._id, name: name});
  if (player) {
    if (debug>=1) console.log(`Player '${name}' (${player._id}) is already in game '${game.name}'`)
    return player;
  }
  const playerID = Players.insert({
    gameID: game._id,
    name: name,
    session: null,
    ... initialPlayer()
  });
  if (debug>=1) console.log(`New player '${name}' (${playerID}) in game '${game.name}'`)
  return Players.findOne(playerID);
}

function removePlayer(game, name) {
  if (!game) return;
  if (name) {
    var player = Players.findOne({gameID: game._id, name: name});
  } else {
    var player = getCurrentPlayer();
  }
  if (player) {
    console.log (`Remove player '${player.name}' (${player._id}) from game '${game.name}'`);
    Players.remove(player._id);
  }
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

function allPlayersFind (gameID=null, includeInactive=0) {
  // includeInactive: 0=active and alive, 1=active, 2=all
  if (!gameID) {
    gameID = Session.get('gameID');
    if (!gameID) return null;
  }
  return Players.find( { gameID: gameID, ...includeInactive<2 && {session: {$ne: null}, ...includeInactive<1 && {alive: true}} }, {fields: {name: 1}});
}

function allPlayers (gameID=null, includeInactive=0) {
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

var interval = null;
function startClock (start=true) {
  if (interval) Meteor.clearInterval(interval);
  Session.set('time', 0);
  if (start) {
    interval = Meteor.setInterval(() => {
    const secs = Session.get('time') || 0;
    Session.set('time', secs+1);
    }, 1000);
  } else {
    interval = null;
  }
}

function leaveGame() {
  Session.set('currentView', 'startMenu');
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);
};

function resetGame() {
  const gameID = Session.get('gameID');
  if (gameID) {
    Games.update(gameID, { $set: initialGame() });
    for (const player of allPlayers (gameID, 2)) {
      Players.update(player._id, { $set: initialPlayer() });
    }
  }
}

function endGame() {
  resetGame();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
}

function lynchVote(vote) {
  const player = getCurrentPlayer();
  if (player) Players.update (player._id, {$set: {lynch: vote}});
}

function hideRole (hide=true) {
  Session.set ("hiddenRole", hide);
}

function alive() {
  const player = getCurrentPlayer();
  return (player && player.alive);
}

//======================================================================
// Session
//======================================================================

// Handlebars.registerHelper() wrapper.
// Blaze/Spacebars/Handlebars doesn't seem to allow multiple helpers to be defined at once as implied here:
//   https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper
// registerHelper({helper: ()=>{}}) can be used instead.
function registerHelper(helpers, helper) {
  if (typeof helpers == "object" && helper === undefined) {
    for (const [k,v] of Object.entries(helpers)) {
      if (debug>=3) console.log(`Handlebars.registerHelper(${k},${v})`);
      Template.registerHelper(k,v);
    }
  } else {
    Template.registerHelper(helpers,helper);
  }
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

Tracker.autorun(trackGameState);
Session.set('currentView', 'startMenu');

//======================================================================
// main template
//======================================================================

Template.main.helpers({
  whichView: () => {
    return Session.get('currentView');
  }
});

//======================================================================
// startMenu template
//======================================================================

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

//======================================================================
// lobby template
//======================================================================

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
  players: () => allPlayers (null, 2),
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
    const target = event.explicitOriginalTarget || event.relatedTarget || document.activeElement || {};
    const action = target.name || 'player-add';
    const playerName = event.target.playerName.value;
    if (debug >= 2) console.log(`action = ${action}, name = '${playerName}'`);
    const game = getCurrentGame();
    if (action != 'player-remove') {
      const player = createPlayer(game, playerName);
      if (player) setCurrentPlayer (player._id);
    } else {
      removePlayer(game, playerName);
      setCurrentPlayer (null);
    }
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

//======================================================================
// Game playing templates
//======================================================================

Template.nightView.rendered = () => {
  $('html').addClass("night");
  if (alive()) hideRole();
  startClock();
};

Template.nightView.destroyed = () => {
  $('html').removeClass("night");
  startClock(false);
};

Template.dayView.rendered = () => {
  $('html').addClass("day");
  if (alive()) hideRole();
  startClock();
};

Template.dayView.destroyed = () => {
  $('html').removeClass("day");
  startClock(false);
};

registerHelper ({
  errorMessage: () => Session.get('errorMessage'),
  game: getCurrentGame,
  gameName: gameName,
  playerName: () => (playerName() || "a lurker"),
  alive: alive,
});


Template.gameHeader.helpers({
  listAllRoles: () => {
    return getCurrentGame().roles.map (r => roleInfo(r).name) . join(", ");
  },

  time: () => {
    const secs = Session.get("time");
    return Math.floor(secs/60).toString() + ":" +
           Math.floor(secs%60).toString().padStart(2,'0');
  },
});

Template.roleInfo.helpers({
  hiddenRole: () => Session.get("hiddenRole"),

  roleName: () => {
    const player = getCurrentPlayer();
    return roleInfo (player ? player.role : null) . name;
  },

  allFellows: () => {
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
      return (fmsg ? fmsg[players.length==1?0:1] : f+": ")+pmsg;
    });
  },

  allRoles: () => {
    const game = getCurrentGame();
    if (!game) return null;
    var msg = Object.entries (game.playerRoles) . map (([playerID, role]) => `${playerName(playerID)} is the ${roleInfo(role).name}`);
    for (fellow of ['lover', 'rival']) {
      for (fellows of game.fellows[fellow]) {
        msg.push (fellows.map(p => p.name).join(" and ") + ` are ${fellow}s`);
      }
    }
    return msg;
  },

  history: () => {
    const game = getCurrentGame();
    if (!game) return null;
    if (!game.history.length) return null;
    const players = game.history[0].players;
    let i=0;
    const playerMap = objectMap (players, p => ({[p._id]: {...p, role: game.playerRoles[p._id], index:i++}}));
    if (debug >= 2) console.log ('history = ', game.history, 'playerMap =', playerMap);
    var day = 0;
    let table = {
      header: players,
      turns: game.history.map(t => ({
        turn: (t.phase == "night") ? {class: 'night-row', name: `Night ${++day}`}
                                   : {class:   'day-row', name: {"lynch": "Lynch", "vigilante": "Vigilante"}[t.phase] || t.phase},
        players: (() => {
          const rowClass = (t.phase == "night" ? 'night-row' : 'day-row');
          let cols = Array(players.length) . fill(null) . map(c => ({class:rowClass, name:""}));
          if (t.phase == "lynch") {
            for (p of t.players) {
              if (p.cause == 'lover') {
                if (p.casualty)
                  cols[playerMap[p._id].index].class =  "dead-suicide";
              } else {
                cols[playerMap[p._id].index].class = p.casualty ? "dead" : "alive";
                for (pid of p.lynch) {
                  cols[playerMap[pid].index].name = "Lynch";
                }
                for (pid of p.spare) {
                  cols[playerMap[pid].index].name = "--";
                }
              }
            }
          } else  if (t.phase == "vigilante") {
            for (p of t.players) {
              if (p.cause == 'lover') {
                if (p.casualty)
                  cols[playerMap[p._id].index].class =  "dead-suicide";
              } else {
                cols[playerMap[p._id].index].class = p.casualty ? "dead" : "alive";
                for (pid of p.attackers) {
                  cols[playerMap[pid].index].name = "TWANG!";
                }
              }
            }
          } else  if (t.phase == "night") {
            for (p of t.players) {
              let i = playerMap[p._id].index;
              if (p.casualty >= 2) {
                cols[i].class = (p.cause == "lover" ? "dead-suicide" : "dead");
              } else if (p.casualty == 1) {
                cols[i].class = (p.cause == "trapper" ? "injured-trapper" : "injured");
              }
              if (roleInfo(playerMap[p._id].role).active == "night")
                cols[i].name = (playerMap[p.vote]||{}).name;
            }
          }
          return cols;
        })()
      }))
    };
    return table;
  },
});

Template.nightView.helpers({
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
  allCasualties: () => {
    const game= getCurrentGame();
    if (!game) return null;
    let msg = [];
    if (game.deaths.length)
      msg.push (game.deaths.join(" and ") + (game.deaths.length >= 2 ? " are" : " is") + " dead");
    if (game.injuries.length)
      msg.push (game.injuries.join(" and ") + (game.injuries.length >= 2 ? " are" : " is") + " injured");
    return msg;
  },
});


Template.nightView.events({
  'click .toggle-player': (event) => {
    const player = getCurrentPlayer();
    if (player) Players.update (player._id, {$set: {vote: event.target.id}});
  },
  'click .btn-show': () => hideRole(false),
  'click .btn-hide': () => hideRole(true),
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
  'click .btn-show': () => hideRole(false),
  'click .btn-hide': () => hideRole(true),
});

Template.gameFooter.events({
  'click .btn-leave': leaveGame,
  'click .btn-end': endGame,
});
