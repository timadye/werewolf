lobby_templates = function() {

//======================================================================
// lobby template
//======================================================================

  Template.lobby.rendered = function(event) {
    rendered();
    this.find("input").focus();
  };

  Template.lobby.helpers({
    players: () => allPlayers (null, 2),
    playerClass: (id) => {
      const player= Players.findOne(id);
      if (!player) {
        return null;
      } else if (player.session == Meteor.connection._lastSessionId) {
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
    errorMessage: () => Session.get('errorMessage'),
  });

  Template.lobby.events({
    'click .btn-leave': leaveVillage,
    'click .btn-start': () => {
      const gameID = Session.get('gameID');
      if (gameID) Games.update(gameID, {$set: {state: 'settingUp'}});
      setTitle();
    },
    'click .btn-download': downloadAll,
    'click .btn-old': () => {
      MeteorSubsHistory.subscribe('pastGames', gameName());
      FlowRouter.go(`/${gameName()}/~history`);
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
    initSession();
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
            Players.update(joinPlayer, {$set: {session: Meteor.connection._lastSessionId}});
            Session.set ('currentView', 'lobby');
            Session.set ("joinPlayer", null);
            setTitle (player.name);
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
      newPlayer = (joinPlayer && joinPlayer == event.target.id) ? null : event.target.id;
      Session.set ("joinPlayer", newPlayer);
      setTitle (newPlayer ? playerName(newPlayer) : null);
    },
    'click .btn-end': () => {
      confirm ("End Game", "End game?", "This will end the game for all players", true, () => {
        resetGame();
        Session.set ("joinPlayer", null);
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

availableRoles = function(game, unavailable=false) {
  const nplayersFind = allPlayersFind (game._id, 2);
  if (!nplayersFind) return [];
  const nplayers = nplayersFind.count();
  return Object.entries(allRoles)
    . filter (([k,r]) => (unavailable != (!r.display || nplayers >= r.display)));
}
