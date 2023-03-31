//======================================================================
// Session management functions
//======================================================================

initSession = function() {
  setDebugLevel();
  setAdminMode();
  Tracker.autorun(trackGameState);
  Session.set('currentView', 'startMenu');
}

// sets the state of the game (which template to render)
trackGameState = function() {
  const game = getCurrentGame();
  if (!game) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}`); // stops working with: Session.get('currentView')
    return;
  }

  const currentView = Session.get('currentView');
  if (game.state === 'waitingForPlayers') {
    if (currentView == "historyIndex" || currentView == "historyEntry") {
      if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView}`);
      return;
    }
    Session.set('currentView', 'lobby');
  } else if (game.state === 'endGame') {
    Session.set('currentView', 'endGame');

  } else if (currentView == 'lateLobby') {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView}`);
    return;

  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
  if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView} -> ${Session.get('currentView')}`);
}

routed = function(view, gameName=null, playerName=null) {
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  hideRole();
  setCurrentGame (gameName, (gameID) => {
    if (debug >= 2) console.log('setCurrentGame onReady', view, gameName, playerName, gameID);
    if (gameID && playerName) {
      const player = Players.findOne ({gameID: gameID, name: playerName}, {});
      if (player) {
        var playerID = player._id;
      } else {
        var playerID = createPlayer (gameID, gameName, playerName);
      }
    } else {
      var playerID = null;
    }
    Session.set('gameID', gameID);
    setCurrentPlayer (playerID);
    if (view) Session.set('currentView', view);
    BlazeLayout.render('main');
  });
}

setAdminMode = function() {
  Session.setDefault('adminMode',false);
  Session.setDefault('adminPassword','');
  MeteorSubs.subscribe('allGames', Session.get('adminPassword'), () => {
    if (debug>=1) console.log('Enable admin mode');
    Session.set('adminMode',true);
    if (debug>=3) console.log(`all games = ${allGames()}`);
  });
}

setCurrentGame = function(gameName, onReadyPlayers=null) {
  if (debug >= 2) console.log('setCurrentGame', gameName);
  const gameID = Session.get('gameID');
  if (gameID) {
    if (gameName == getGameName (gameID)) {
      if (onReadyPlayers) onReadyPlayers(gameID);
      return;
    }
    leaveVillage();
  }
  if (gameName) {
    joinGame(gameName, onReadyPlayers);
  } else {
    if (onReadyPlayers) onReadyPlayers(null);
  }
}

joinGame = function(gameName, onReadyPlayers=null) {
  const sub = MeteorSubs.subscribe('game', gameName, {
    onReady: () => {
      if (debug >= 2) console.log('joinGame games onReady', gameName);
      const game = Games.findOne({name: gameName}, {});
      if (!game) {
        console.log (`subscribed to game, but '${gameName}' not found`);
        return;
      } else {
        var gameID = game._id;
      }
      if (debug >= 1) console.log(`Join village '${gameName}', id=${gameID}`);
      if (onReadyPlayers) onReadyPlayers(gameID);
    },

    onError: (err) => {
      if (!err) return;
      if (debug >= 2) console.log(`joinGame games onError ${gameName}: error ${err.error}, ${err.reason}`);
      if (debug >= 1) console.log(err.reason);
      if (err.error != 'no-game') return;
      sub.stopNow();
      const gameID = createGame (gameName);
      if (gameID) {
        MeteorSubs.subscribe('game', gameName, {
          onReady: () => {
            if (debug >= 1) console.log(`Join new village '${gameName}', id=${gameID}`);
            if (onReadyPlayers) onReadyPlayers(gameID);
          }
        });
      }
    }
  });
}



leaveVillage = function () {
  MeteorSubsHistory.clear();
  setCurrentPlayer(null);
  Session.set('joinPlayer', null);
  Session.set('gameID', null);
  Session.set('playerID', null);
  FlowRouter.go('/');
};

resetGame = function() {
  MeteorSubsHistory.clear();
  const gameID = Session.get('gameID');
  if (gameID) {
    Games.update(gameID, { $set: initialGame() });
    for (const player of allPlayers (gameID, 2)) {
      Players.update(player._id, { $set: initialPlayer() });
    }
  }
}
