import '../imports/roles.js';
import '../imports/utils.js';

var debug = 0;   // overridden by server setting if higher
const dash = "\u2013";
const nbsp = "\u00A0"

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
    lastvote: null,
    guillotine: null, // 'guillotine' or 'spare'
    alive: true,
    crossbow: false, // crossbow loaded
    twang: null // id of crossbow victim
  };
}

function createGame(name) {
  const gameID = Games.insert({
    name: name,
    // default roles
    roles: ["werewolf_1", "werewolf_2", "wolfsbane_1", "trapper_1"],
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
      leaveVillage();
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
  hideRole();
}

function allGamesFetch() {
  return Session.get('allGamesSubscribed') ? Games.find ({}, {fields: {name: 1}}).fetch() : [];
}

function allGames() {
  const ret = allGamesFetch();
  return ret ? ret.map((game) => game.name) : ret;
}

function allPlayersFind (gameID=null, includeInactive=0, fields={name:1}) {
  // includeInactive: 0=active and alive, 1=active, 2=all
  if (!gameID) {
    gameID = Session.get('gameID');
    if (!gameID) return null;
  }
  return Players.find( { gameID: gameID,
                         ...includeInactive<2 && {session: {$ne: null},
                         ...includeInactive<1 && {alive: true}} },
                       {fields: fields});
}

function allPlayers (gameID=null, includeInactive=0, fields={name:1}) {
  const ret = allPlayersFind (gameID, includeInactive, fields);
  return ret ? ret.fetch() : [];
}

function readyToStart() {
  const game = getCurrentGame();
  if (!game) return false;
  var types = { werewolf:0, cultist:0 };
  var decks = { roles:0,    lovers:0  };
  var ndark=  { [false]:0, [true]:0   };
  for (const name of game.roles) {
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

function leaveVillage() {
  Session.set('currentView', 'startMenu');
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);
  Session.set('joinPlayer', null);
  resetUserState();
};

function leaveGame() {
  const player = getCurrentPlayer();
  if (player && player.alive) {
    Session.set('turnMessage', null);
    Session.set('errorMessage', null);
    Players.update(player._id, {$set: {alive: false}});
  } else {
    leaveVillage();
  }
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
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  const gameID = Session.get('gameID');
  if (gameID) Games.update(gameID, {$set: {state: 'endGame', deaths: [], injuries: []}});
}

function guillotineVote(vote) {
  const player = getCurrentPlayer();
  if (player) Players.update (player._id, {$set: {guillotine: vote}});
}

function hideRole (hide=true) {
  Session.set ("hiddenRole", hide);
}

function alive() {
  const player = getCurrentPlayer();
  return player ? player.alive : false;
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

function confirm (button="OK", title="Confirm?", text="", doConfirm=true, ok) {
  if (doConfirm) {
    sweetAlert({
      title: title,
      text: text,
      type: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: button,
      closeOnConfirm: true,
      html: false
    }, ok);
  } else {
    ok();
  }
}

// sets the state of the game (which template to render)
function trackGameState() {
  const game = getCurrentGame();
  if (!game) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.default_connection._lastSessionId}: currentView = ${Session.get('currentView')}`);
    return;
  }
  const currentView = Session.get('currentView');
  if (game.state === 'waitingForPlayers') {
    Session.set('currentView', 'lobby');
  } else if (game.state === 'endGame') {
    Session.set('currentView', 'endGame');

  } else if (currentView == 'lateLobby') {
    if (debug >= 2) console.log (`trackGameState ${Meteor.default_connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView}`);
    return;

  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
  if (debug >= 2) console.log (`trackGameState ${Meteor.default_connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView} -> ${Session.get('currentView')}`);
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
  Meteor.call ('debugLevel', (error, result) => {
    if (!error && result > debug) {
      debug = result;
      if (debug >= 1) console.log (`debug = ${debug}`);
    }
  });
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
    if (!villageName) return false;
    Meteor.call ('villageExists', villageName, (error, result) => {
      if (error || result<0) {
        event.target.villageName.value = "";
        if (!error) console.log ("reset all games");
        return false;
      }
      if (!result) createGame (villageName);
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
  hideRole();
  this.find("input").focus();
};

Template.lobby.helpers({
  players: () => allPlayers (null, 2),
  playerClass: (id) => {
    const player= Players.findOne(id);
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
    const game= getCurrentGame();
    if (!game) return null;
    const nplayersFind = allPlayersFind (game._id, 2);
    if (!nplayersFind) return null;
    const nplayers = nplayersFind.count();
    let last = "";
    return Object.entries(allRoles)
      . filter (([k,r]) => !r.display || nplayers >= r.display)
      . map    (([k,r]) => {
        const head = (last == ""         && r.type == "werewolf") ? "Werewolves"    :
                     (last == "werewolf" && r.type != "werewolf") ? "Villagers"     :
                     (last != "lovers"   && r.type == "lovers")   ? "Relationships" : "";
        last = r.type;
        const cls = game.roles.includes(k) ? "selected-role" : null;
        return { key:k, role:r, header:head, roleClass:cls };
      });
  },
  startButtonDisabled: () => readyToStart() ? null : "disabled",
  errorMessage: () => Session.get('errorMessage'),
});

Template.lobby.events({
  'click .btn-leave': leaveVillage,
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
// lateLobby template
//======================================================================

Template.lateLobby.rendered = function(event) {
  if (Session.get('gameID')) return;
  const villageName = Session.get('urlVillage');
  if (villageName) joinGame(villageName);
  hideRole();
};

Template.lateLobby.helpers({
  players: () => allPlayers (null, 1),
  playerClass: (id) => {
    const joinPlayer = Session.get ("joinPlayer");
    if (joinPlayer && joinPlayer == id) {
      return "current-player";
    } else {
      const player= Players.findOne(id);
      if (player && player.alive) {
        return (player.session === true) ? "missing-player" : "active-player";
      } else {
        return null;
      }
    }
  },
  errorMessage: () => Session.get('errorMessage'),
});

Template.lateLobby.events({
  'click .btn-leave': leaveVillage,
  'click .btn-join': () => {
    const joinPlayer = Session.get ("joinPlayer");
    if (joinPlayer) {
      const player= Players.findOne(joinPlayer);
      if (player) {
        confirm ("Join Game", `Replace ${player.name}?`, `Are you sure you want to replace ${player.name} in the ${gameName()} game`, player.alive && player.session !== true, () => {
          if (debug >= 1) console.log (`Late join game ${gameName()} as ${player.name}`);
          Players.update(joinPlayer, {$set: {session: Meteor.default_connection._lastSessionId}});
          Session.set ('currentView', 'lobby');
          Session.set ("joinPlayer", null);
        });
        return;
      }
    }
    if (debug >= 1) console.log (`Late join game ${gameName()}`);
    Session.set ('currentView', 'lobby');
    Session.set ("joinPlayer", null);
  },
  'click .toggle-player': (event) => {
    const joinPlayer = Session.get ("joinPlayer");
    Session.set ("joinPlayer", (joinPlayer && joinPlayer == event.target.id) ? null : event.target.id);
  },
  'click .btn-end': () => {
    confirm ("End Game", "End game?", "This will end the game for all players", true, () => {
      resetGame();
      Session.set ("joinPlayer", null);
    });
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

Template.roleMenu.helpers({
  hiddenRole: () => Session.get("hiddenRole"),

  roleName: () => {
    const player = getCurrentPlayer();
    const role = roleInfo (player ? player.role : null);
    return role.properName ? role.properName : `the ${role.name}`;
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

  allRoles: () => {  // not used any more
    const game = getCurrentGame();
    if (!game) return null;
    var msg = Object.entries (game.playerRoles) . map (([playerID, role]) => `${playerName(playerID)} is the ${roleInfo(role).name}`);
    for (const fellow of ['lover', 'rival']) {
      for (const fellows of game.fellows[fellow]) {
        msg.push (fellows.map(p => p.name).join(" and ") + ` are ${fellow}s`);
      }
    }
    return msg;
  },
});


Template.roleInfo.helpers({
  history: () => {
    const game = getCurrentGame();
    if (!game) return null;
    if (debug >= 2) console.log ('history = ', game.history);
    if (debug >= 3) console.log ('fellows = ', game.fellows);
    const col0 = {Class:"", name:""};
    const players = allPlayers (game._id, 2, {name:1, role:1}) . map (p => ({...p, role: roleInfo(p.role), alive:true})) . filter (p=>!p.role.zombie);
    if (debug >= 2) console.log ('players = ', players);
    const playerMap = objectMap (players, p => ({[p._id]: p}));
    var day = 0;
    const table = {
      players: players,
      fellows: ['Lover', 'Rival'].flatMap (ff => ((game.fellows||{})[ff.toLowerCase()]||[]).map (f => ({type: `${ff}s`, names: (() => {
        players.forEach (p => {p.col = {...col0}});
        for (const p of f) {
          if (p._id in playerMap)
            playerMap[p._id].col.name = p.name;
        }
        return players.map(p=>p.col);
      })()}))),
      turns: game.history.map (t => ({
        turn: (t.phase == "night") ? {Class: 'night-row', name: `Night${nbsp}${++day}`}
                                   : {Class:   'day-row', name: {"guillotine": "Guillotine", "vigilante": "Vigilante"}[t.phase] || t.phase},
        players: (() => {
          const defClass = (t.phase == "night" ? 'night-row' : 'day-row');
          players.forEach (p => {p.col = {name:"", Class: (t.phase == "vigilante" && p.alive ? defClass : "zombie")}});
          for (const p of t.players) {
            const m = playerMap[p._id];
            if (!m) continue;
            if (t.phase == "guillotine") {
              if (p.cause == 'lover') {
                m.col.Class = p.casualty ? "dead-suicide" : defClass;
              } else {
                m.col.Class = p.casualty ? "dead" : "alive";
                for (const pid of p.guillotine) {
                  const c = playerMap[pid].col;
                  if (!c) continue;
                  c.name = m.name;
                  if (c.Class == "zombie") c.Class = defClass;
                }
                for (const pid of p.spare) {
                  const c = playerMap[pid].col;
                  if (!c) continue;
                  c.name = dash;
                  if (c.Class == "zombie") c.Class = defClass;
                }
              }
            } else  if (t.phase == "vigilante") {
              if (p.cause == 'lover') {
                if (p.casualty) m.col.Class =  "dead-suicide";
              } else {
                m.col.Class = p.casualty ? "dead" : "alive";
                for (const pid of p.attackers) {
                  const c = playerMap[pid].col;
                  if (!c) continue;
                  c.name = "TWANG!";
                  if (c.Class == "zombie") c.Class = defClass;
                }
              }
            } else  if (t.phase == "night") {
              if (p.casualty >= 2) {
                m.col.Class = (p.cause == "lover" ? "dead-suicide" : "dead");
              } else if (p.casualty == 1) {
                m.col.Class = (p.cause == "trapper" ? "injured-trapper" : "injured");
              } else {
                m.col.Class = defClass;
              }
              if (m.role.active == "night" && p.vote) {
                m.col.name = (playerMap[p.vote]||{}).name;
              }
            }
          }
          players.forEach (p => {if (p.col.Class == "zombie") p.alive = false});
          return players.map(p=>p.col);
        })()
      })),
    };
    if (debug >= 2) console.log ('table = ', table);
    return table;
  },

  today: (view=null) => {
    if (!view) view = Session.get('currentView');
    const night = {nightView: true, dayView: false}[view];
    if (night === undefined) return null;
    const field = night ? "vote" : "guillotine";
    const players = allPlayers (null, 2, {name:1, alive:1, role:1, [field]: 1}) . filter(p=>p.role);
    if (debug >= 2) console.log ('players = ', players);
    let playerMap = objectMap (players, p => ({[p._id]: p.name}));
    if (night) {
      playerMap["0"] = "none";
    } else {
      playerMap["guillotine"] = "Guillotine";
      playerMap["spare"] = "Spare";
    }
    const row = {
      name:  (night ? "Tonight" : "Today"),
      Class: (night ? "night-row" : "day-row"),
      players: players . map(p => ({
        Class: (p.alive ? "" : "zombie"),
        name:  playerMap[p[field]],
      })),
    };
    if (debug >= 2) console.log ('row = ', row);
    return row;
  },
});

Template.nightView.helpers({
  players: () => [ ... allPlayers(), { _id: '0', name: 'none' } ],
  playerClass: (id) => {
    const player= Players.findOne(id);
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
    let calls = {}, guillotine = 0;
    for (const {call} of Players.find ({call: {$ne: null}, alive: {$eq: true}}, {fields: {call:1} }) . fetch()) {
      if (call in calls) {
        if (++calls[call] == 2) guillotine++;
      } else {
        calls[call] = 1;
      }
    }
    return guillotine==1;
  },
  players: allPlayers,
  playerClass: (id) => {
    const ncalls= Players.find({call: id, alive: {$eq: true}}) . count();
    const loaded= Players.find({_id: id, crossbow: true}) . count();
    let cl = [];
    if (loaded) cl.push ("crossbow-loaded");
    if        (ncalls >= 2) {
      cl.push ("guillotine-player");
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
    if (player) {
      let vote = event.target.id;
      if (debug >= 3) console.log ('player =', player);
      if (roleInfo(player.role).type == "wolfsbane" && player.lastvote == player._id && vote == player._id) {
        if (debug >= 1) console.log (`${player.name} (${player.role}, ${player._id}) protected themself last night, so ignore self-protection tonight.`);
        vote = '0';    // ignore 2nd wolfbane protection for themself
      } else {
        if (debug >= 1) console.log (`${player.name} (${player.role}, ${player._id}) voted for ${vote} (last vote ${player.lastvote}).`);
      }
      Players.update (player._id, {$set: {vote: vote}});
    }
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
  'click .btn-guillotine': () => guillotineVote("guillotine"),
  'click .btn-spare':      () => guillotineVote("spare"),
  'click .btn-show': () => hideRole(false),
  'click .btn-hide': () => hideRole(true),
});

Template.gameFooter.events({
  'click .btn-suicide': () => {
    confirm ("Kill Myself", "Leave game?", "If you kill yourself, you could tip the balance of power in the village!", true, () => {
      leaveGame();
    });
  },
  'click .btn-rejoin': () => {
    const player = Players.findOne({session: Meteor.default_connection._lastSessionId});
    if (player) {
      Session.set ("joinPlayer", player._id);
      Players.update(player._id, {$set: {session: true}});
    }
    Session.set('currentView', 'lateLobby');
  },
  'click .btn-end': () => {
    confirm ("End Game", "End game?", "This will end the game for all players", true, () => {
      endGame();
    });
  },
});

Template.endGame.events({
  'click .btn-leave-village': leaveVillage,
  'click .btn-new': () => {
    confirm ("New Game", "New game?", "This will delete the game summary for everyone", true, () => {
    resetGame();
    });
  },
});
