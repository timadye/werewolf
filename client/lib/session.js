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
  const currentView = Session.peek('currentView');
  const game = getCurrentGame({state:1, historyID:1});
  if (!game) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}, currentView: ${currentView}`);
    return;
  }
  if (game.state === 'waitingForPlayers') {
    if (!Session.equals('currentView', "historyIndex") && !Session.equals('currentView', "historyEntry")) {
      Session.set('currentView', 'lobby');
    }
  } else if (game.state === 'endGame') {
    historySubscribe (() => Session.set('currentView', 'endGame'), game.historyID);
  } else if (Session.get('lateLobby')) {
    Session.set('currentView', 'lateLobby');
  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
  if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView} -> ${Session.peek('currentView')}`);
}

routed = function(view, gameName=null, playerName=null, onReady=null) {
  Session.set('turnMessage', null);
  hideRole();
  hideSecrets();
  setCurrentGame (gameName, (gameID) => {
    if (debug >= 2) console.log(`setCurrentGame onReady view=${view}, gameName=${gameName}, playerName=${playerName}, gameID=${gameID}`);
    if (gameID && playerName) {
      const player = Players.findOne ({gameID: gameID, name: playerName}, {});
      var playerID = player ? player._id : createPlayer (gameID, gameName, playerName);
    } else {
      var playerID = null;
    }
    Session.set('gameID', gameID);
    setCurrentPlayer (playerID);

    const routingDone = () => {
      if (view) Session.set('currentView', view);
      BlazeLayout.render('main');
    }
    if (onReady) {
      onReady(routingDone);
    } else {
      routingDone();
    }
  });
}

setAdminMode = function(pwd='') {
  Session.set('adminMode',false);
  Session.set('adminPassword',pwd);
  MeteorSubs.subscribe('allGames', pwd, () => {
    if (debug>=1) console.log('Enable admin mode');
    Session.set('adminMode',true);
    if (debug>=3) console.log(`all games = ${allGames()}`);
  });
}

setCurrentGame = function (gameName, onReadyPlayers=null) {
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
    Session.set('errorMessage', null);
    Session.set('creatingGame', false);
    joinGame(gameName, onReadyPlayers);
  } else {
    if (onReadyPlayers) onReadyPlayers(null);
  }
}

joinGame = function (gameName, onReadyPlayers=null) {
  var sub = MeteorSubs.subscribe('game', gameName, {
    onReady: () => {
      if (debug >= 2) console.log('joinGame games onReady', gameName);
      const game = Games.findOne({name: gameName}, {});
      if (!game) {
        if (debug >= 0) console.log (`Subscribed to game, but '${gameName}' not found`);
        return;
      }
      if (debug >= 1) console.log(`Join village '${gameName}', id=${game._id}`);
      if (onReadyPlayers) onReadyPlayers(game._id);
    },
    onStop: (error) => {
      if (error) {
        if (debug >= 0) console.log (`error '${error.error}' subscribing to game '${gameName}': ${error.reason}`);
        sub.stopNow();
        Session.set('creatingGame', true);
        Session.set('errorMessage', error.reason);
        if (error.error == 'no-game') {
          FlowRouter.go('start', {}, {});
        }
      }
    },
  });
}

leaveVillage = function () {
  MeteorSubsHistory.clear();
  setCurrentPlayer(null);
  Session.set('lateLobby', false);
  Session.set('gameID', null);
  Session.set('playerID', null);
  setTitle()
  FlowRouter.go('start', {}, {});
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
  Session.set('lateLobby', false);
}
