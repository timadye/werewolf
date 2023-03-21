const dash = "\u2013";
const nbsp = "\u00A0";

initialGame = function() {
  return {
    active: true,
    playerRoles: [],
    state: 'waitingForPlayers',
    voiceOfFate: [],
    date: Date.now(),
    history: []
  };
}

initialPlayer = function() {
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

createGame = function(name, roles=["werewolf_1", "werewolf_2", "wolfsbane_1", "trapper_1"]) {
  const gameID = Games.insert({
    name: name,
    // default roles
    roles: roles,
    ... initialGame()
  });
  if (debug>=1) console.log(`New game in village '${name}' (${gameID})`)
  return Games.findOne(gameID);
}

createPlayer = function(game, name) {
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

removePlayer = function(game, name) {
  if (!game) return;
  if (name) {
    var player = Players.findOne({gameID: game._id, name: name});
  } else {
    var player = getCurrentPlayer();
  }
  if (player) {
    console.log (`Remove player '${player.name}' (${player._id}) from game '${game.name}'`);
    Players.remove(player._id);
    // Remove roles that are no longer available
    unavailable = {};
    for (const [k,r] of availableRoles(game, true)) {
      unavailable[k] = r;
    };
    const available = game.roles.filter (r => !(r in unavailable));
    if (available.length < game.roles.length) {
      remove = game.roles.filter (r => r in unavailable);
      console.log (`Roles no longer available: ${remove}`);
      Games.update(game._id, {$set: {roles: available}});
    }
  }
}

joinGame = function(name) {
  Meteor.subscribe('games', name, function onReady() {
    var game = Games.findOne({name: name, active: true});
    if (!game) {
      leaveVillage();
      reportError(`no village '${name}'`);
      return false;
    }
    if (debug>=1) console.log(`Join village '${name}', id=${game._id}`);
    Meteor.subscribe('players', game._id);
    Session.set('gameID', game._id);
    setTitle (name);
  });
  return false;
}

setTitle = function(name) {
  if (name == undefined) {
    name = playerName();
    if (!name) {
      name = gameName();
      if (!name) {
        document.title = "Werewolf";
        return;
      }
    }
  }
  document.title = name + " - Werewolf";
}

setCurrentGame = function(game) {
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

getCurrentGame = function() {
  const gameID = Session.get('gameID');
  return gameID ? Games.findOne(gameID) : null;
}

gameName = function(gameID) {
  if (gameID === undefined) gameID = Session.get('gameID');
  if (!gameID) return null;
  const game = Games.findOne(gameID, { fields: { name: 1 } });
  return game ? game.name : null;
}

playerName = function(playerID) {
  const player = Players.findOne(
    (playerID !== undefined) ? playerID
                              : {session: Meteor.connection._lastSessionId},
    { fields: { name: 1 } }
  );
  return player ? player.name : null;
}

getCurrentPlayer = function() {
  return Players.findOne({session: Meteor.connection._lastSessionId});
}

setCurrentPlayer = function (newID, toggle=false) {
  const player = getCurrentPlayer();
  if (player) {
    if (newID == player._id) {
      if (toggle) {
        Players.update(player._id, {$set: {session: null}});
        setTitle();
        return null;
      } else {
        return player._id;
      }
    } else {
      Players.update(player._id, {$set: {session: null}});
    }
  }
  if (newID) {
    Players.update(newID, {$set: {session: Meteor.connection._lastSessionId}});
    setTitle();
    return newID;
  }
  return null;
}

reportError = function(msg) {
  if (msg) console.error(msg);
  Session.set('errorMessage', msg);
}

resetUserState = function() {
  setCurrentGame(null);
  setCurrentPlayer(null);
  hideRole();
  setTitle();
}

allGamesFetch = function() {
  return Session.get('allGamesSubscribed') ? Games.find ({active: true}, {fields: {name: 1}}).fetch() : [];
}

allGames = function() {
  const ret = allGamesFetch();
  return ret ? ret.map((game) => game.name) : ret;
}

allPlayersFind = function (gameID=null, includeInactive=0, fields={name:1}) {
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

allPlayers = function (gameID=null, includeInactive=0, fields={name:1}) {
  const ret = allPlayersFind (gameID, includeInactive, fields);
  return ret ? ret.fetch() : [];
}

readyToStart = function() {
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
startClock = function (start=true) {
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

leaveVillage = function () {
  Session.set('currentView', 'startMenu');
  Session.set('turnMessage', null);
  Session.set('errorMessage', null);
  Session.set('joinPlayer', null);
  resetUserState();
};

leaveGame = function() {
  const player = getCurrentPlayer();
  if (player && player.alive) {
    Session.set('turnMessage', null);
    Session.set('errorMessage', null);
    Players.update(player._id, {$set: {alive: false}});
  } else {
    leaveVillage();
  }
};

resetGame = function() {
  const oldGameID = Session.get('gameID');
  if (oldGameID) {
    oldGame = Games.findOne(oldGameID);
    players = allPlayers (oldGameID, 2);
    newGame = createGame (oldGame.name, oldGame.roles);
    for (const player of players) {
      Players.update(player._id, { $set: {gameID: newGame._id, ... initialPlayer()}});
    }
    Games.update(oldGameID, { $set: { active: false } });
    Session.set('gameID', newGame._id);
  }
}

endGame = function() {
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  const gameID = Session.get('gameID');
  if (gameID) Games.update(gameID, {$set: {state: 'endGame'}});
}

guillotineVote = function(vote) {
  const player = getCurrentPlayer();
  if (player) Players.update (player._id, {$set: {guillotine: vote}});
}

hideRole = function (hide=true) {
  Session.set ("hiddenRole", hide);
}

alive = function() {
  const player = getCurrentPlayer();
  return player ? player.alive : false;
}

voting = function() {
  let calls = {}, guillotine = 0, called = null;
  for (const {call} of Players.find ({call: {$ne: null}, alive: {$eq: true}}, {fields: {call:1} }) . fetch()) {
    if (call in calls) {
      if (++calls[call] == 2) {
        guillotine++;
        called = call;
      }
    } else {
      calls[call] = 1;
    }
  }
  return guillotine==1 ? playerName(called) : "";
}

availableRoles = function(game, unavailable=false) {
  const nplayersFind = allPlayersFind (game._id, 2);
  if (!nplayersFind) return [];
  const nplayers = nplayersFind.count();
  return Object.entries(allRoles)
    . filter (([k,r]) => (unavailable != (!r.display || nplayers >= r.display)));
}

showHistory = function() {
  if (Session.get('lobbyView') == 'historyEntry') {
    game = Games.findOne(Session.get('historyEntry'));
  } else {
    game = getCurrentGame();
  }
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
}
