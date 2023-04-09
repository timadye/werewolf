lobby_templates = function() {

//======================================================================
// lobby template
//======================================================================

  Template.lobby.rendered = function(event) {
    this.find("input").focus();
  };

  Template.lobby.helpers({
    players: () => allPlayers (null, 2),
    playerClass: playerClass,
    roleKeys: () => {
      const game= getCurrentGame({roles:1});
      if (!game) return null;
      let last = "";
      return availableRoles(game)
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
  });

  Template.lobby.events({
    'click .btn-leave': leaveVillage,
    'click .btn-start': () => {
      const gameID = Session.get('gameID');
      if (gameID) Games.update(gameID, {$set: {state: 'settingUp'}});
    },
    'click .btn-download': downloadAll,
    'click .btn-old': () => {
      FlowRouter.go('ingame', {gameName:getGameName(), playerName:'~history'}, {});
    },
    'click .toggle-player': toggleCurrentPlayer,
    'submit #lobby-add': (event) => {
      const target = event.explicitOriginalTarget || event.relatedTarget || document.activeElement || {};
      const action = target.name || 'player-add';
      const playerName = event.target.playerName.value.trim().replace(/\s+/g,' ');
      if (debug >= 1) console.log(`action = ${action}, playerName = '${playerName}'`);
      const game = getCurrentGame({name:1, roles:1});
      if (action != 'player-remove') {
        FlowRouter.go('ingame', {gameName:game.name, playerName:playerName}, {});
      } else {
        removePlayer(game, playerName);
        FlowRouter.go('lobby', {gameName:game.name}, {});
      }
      event.target.playerName.value = '';
      return false;
    },
    'click .toggle-role': (event) => {
      const role = event.target.id;
      var game = getCurrentGame({roles:1});
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

  Template.lateLobby.helpers({
    players: () => allPlayers (null, 1),
    playerClass: playerClass,
  });

  Template.lateLobby.events({
    'click .btn-leave': leaveVillage,
    'click .btn-join': () => Session.set ("lateLobby", false),
    'click .toggle-player': toggleCurrentPlayer,
    'click .btn-end': () => {
      confirm ("End Game", "End game?", "This will end the game for all players", true, () => {
        resetGame();
      });
    },
    'click .btn-download': downloadAll,
  });

}


//======================================================================
// lobby functions
//======================================================================

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

createPlayer = function(gameID, gameName, playerName) {
  if (!gameID || !playerName) return null;
  const player = Players.findOne({gameID: gameID, name: playerName});
  if (player) {
    if (debug>=1) console.log(`Player '${playerName}' (${player._id}) is already in game '${gameName}'`)
    return player;
  }
  const playerID = Players.insert({
    gameID: gameID,
    name: playerName,
    session: null,
    ... initialPlayer()
  });
  if (debug>=1) console.log(`New player '${playerName}' (${playerID}) in game '${gameName}'`)
  return playerID;
}

removePlayer = function(game, playerName) {
  if (!game) return;
  if (playerName) {
    var player = Players.findOne({gameID: game._id, name: playerName}, {fields: {name:1}});
  } else {
    var player = getCurrentPlayer({name:1});
  }
  if (player) {
    if (debug >= 1) console.log (`Remove player '${player.name}' (${player._id}) from game '${game.name}'`);
    Players.remove(player._id);
    // Remove roles that are no longer available
    unavailable = {};
    for (const [k,r] of availableRoles(game, true)) {
      unavailable[k] = r;
    };
    const available = game.roles.filter (r => !(r in unavailable));
    if (available.length < game.roles.length) {
      remove = game.roles.filter (r => r in unavailable);
      if (debug >= 1) console.log (`Roles no longer available: ${remove}`);
      Games.update(game._id, {$set: {roles: available}});
    }
  }
}

setCurrentPlayer = function (newID=null) {
  const playerID = Session.get('playerID');
  if (newID == playerID) return playerID;
  if (playerID && !newID) {
    const keep = Session.get ('lateLobby') ? true : null;
    Players.update(playerID, {$set: {session: keep}});
  }
  Session.set('playerID', newID);
  if (newID) {
    Players.update(newID, {$set: {session: Meteor.connection._lastSessionId}});
  }
  setTitle();
  return newID;
}

toggleCurrentPlayer = function (event) {
  const newID = event.target.id;
  if (!newID) return;
  if (Session.equals('playerID', newID)) {
    FlowRouter.go('lobby', {gameName:getGameName()}, {});
  } else {
    FlowRouter.go('ingame', {gameName:getGameName(), playerName:getPlayerName(newID)}, {});
  }
}

playerClass = function (id) {
  const player= Players.findOne(id, {fields: {session:1}});
  if (!player) {
    return null;
  } else if (player.session && Session.equals('playerID', id)) {
    return "current-player";
  } else if (player.session) {
    return "active-player";
  } else {
    return null;
  }
}

readyToStart = function() {
  const game = getCurrentGame({roles:1});
  if (!game) return false;
  var types = { werewolf:0, cultist:0 };
  var decks = { roles:0,    lovers:0  };
  var ndark=  { [false]:0, [true]:0   };
  for (const roleName of game.roles) {
    role = allRoles[roleName];
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

availableRoles = function(game, unavailable=false) {
  const nplayersFind = allPlayersFind (game._id, 2);
  if (!nplayersFind) return [];
  const nplayers = nplayersFind.count();
  return Object.entries(allRoles)
    . filter (([k,r]) => (unavailable != (!r.display || nplayers >= r.display)));
}
