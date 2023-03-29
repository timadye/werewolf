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
    if (!Session.equals('currentView', 'startMenu')) {
      setCurrentGame();
    }
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

routed = function(view, villageName=null, playerName=null) {
  Session.set("gameName", villageName);
  if (playerName) Session.set('playerName', playerName);  // playerID set on first call to getCurrentPlayer
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  hideRole();
  if (view) Session.set('currentView', view);
  BlazeLayout.render('main');
}

setAdminMode = function() {
  Session.setDefault('adminMode',false);
  Session.setDefault('adminPassword','');
  MeteorSubs.subscribe('allGames', Session.get('adminPassword'), function onReady() {
    if (debug>=1) console.log('Enable admin mode');
    Session.set('adminMode',true);
    if (debug>=3) console.log(`all games = ${allGames()}`);
  });
}

setCurrentGame = function() {
  setTitle();
  hideRole();
  if (!Session.get('gameID')) {
    const villageName = Session.get('gameName');
    if (villageName) joinGame(villageName);
  }
}

joinGame = function(name) {
  MeteorSubs.subscribe('games', name, function onReady() {
    var game = Games.findOne({name: name});
    if (!game) {
      leaveVillage();
      reportError(`no village '${name}'`);
    }
    if (debug>=1) console.log(`Join village '${name}', id=${game._id}`);
    MeteorSubs.subscribe('players', game._id);
    Session.set('gameID', game._id);
    setTitle (name);
  });
}

leaveVillage = function () {
  MeteorSubsHistory.clear();
  setCurrentPlayer(null);
  Session.set('joinPlayer', null);
  Session.set('gameID', null);
  Session.set('gameName', null);
  Session.set('playerID', null);
  Session.set('playerName', null);
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
