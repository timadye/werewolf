lobby_templates = function() {

//======================================================================
// lobby template
//======================================================================

  Template.lobby.rendered = function(event) {
    initSession();
    if (!Session.get('gameID')) {
      const villageName = Session.get('urlVillage');
      if (villageName) joinGame(villageName);
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
      Session.set('lobbyView', 'historyIndex');
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