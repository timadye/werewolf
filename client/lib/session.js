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
  const currentView = Session.peek('currentView');
  if (!game) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}, currentView: ${currentView}`);
    return;
  }

  if (game.state === 'waitingForPlayers') {
    if (Session.equals('currentView', "historyIndex") || Session.equals('currentView', "historyEntry")) {
      if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView}`);
      return;
    }
    Session.set('currentView', 'lobby');
  } else if (game.state === 'endGame') {
    historySubscribe (() => Session.set('currentView', 'endGame'), game.historyID);

  } else if (Session.equals('currentView', 'lateLobby')) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView}`);
    return;

  } else if (game.state === 'nightTime') {
    Session.set('currentView', 'nightView');
  } else if (game.state === 'dayTime') {
    Session.set('currentView', 'dayView');
  }
  if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}: game.state = ${game.state}, currentView: ${currentView} -> ${Session.peek('currentView')}`);
}

routed = function(view, gameName=null, playerName=null, onReady=null) {
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  hideRole();
  setCurrentGame (gameName, (gameID) => {
    if (debug >= 2) console.log(`setCurrentGame onReady view=${view}, gameName=${gameName}, playerName=${playerName}, gameID=${gameID}`);
    if (gameID && playerName) {
      const player = Players.findOne ({gameID: gameID, name: playerName}, {});
      var playerID = player ? player._id : createPlayer (gameID, gameName, playerName);
    } else {
      var playerID = null;
    }
    if (!Session.equals('gameID', gameID)) {  // only set gameID if not already set. Is this needed to prevent unneccessary refresh?
      Session.set('gameID', gameID);
    }
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

setAdminMode = function() {
  Session.setDefault('adminMode',false);
  Session.setDefault('adminPassword','');
  MeteorSubs.subscribe('allGames', Session.get('adminPassword'), () => {
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
    joinGame(gameName, onReadyPlayers);
  } else {
    if (onReadyPlayers) onReadyPlayers(null);
  }
}

joinGame = function (gameName, onReadyPlayers=null) {
  MeteorSubs.subscribe('game', gameName, {
    onReady: () => {
      if (debug >= 2) console.log('joinGame games onReady', gameName);
      const game = Games.findOne({name: gameName}, {});
      if (!game) {
        console.log (`Subscribed to game, but '${gameName}' not found`);
        return;
      }
      if (debug >= 1) console.log(`Join village '${gameName}', id=${game._id}`);
      if (onReadyPlayers) onReadyPlayers(game._id);
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
