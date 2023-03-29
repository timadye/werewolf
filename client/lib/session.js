//======================================================================
// Session management functions
//======================================================================

// sets the state of the game (which template to render)
trackGameState = function() {
  const game = getCurrentGame();
  if (!game) {
    if (debug >= 2) console.log (`trackGameState ${Meteor.connection._lastSessionId}`); // stops working with: Session.get('currentView')
    Session.set('currentView', 'startMenu');
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

joinGame = function(name) {
  setDebugLevel();
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

newView = function(view) {
  hideRole();
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  if (view)
    Session.set('currentView', view);
}

rendered = function() {
  initSession();
  hideRole();
  if (!Session.get('gameID')) {
    const villageName = Session.get('urlVillage');
    if (villageName) joinGame(villageName);
  }
}

resetUserState = function() {
  // MeteorSubs.clear();
  MeteorSubsHistory.clear();
  setCurrentGame(null);
  setCurrentPlayer(null);
  initSession();
}

checkAdminMode = function() {
  if (Session.get('adminMode') === undefined) {
    Session.set('adminMode',false);
    Session.setDefault('adminPassword','');
    MeteorSubs.subscribe('allGames', Session.get('adminPassword'), function onReady() {
      if (debug>=1) console.log('Enable admin mode');
      Session.set('adminMode',true);
      if (debug>=3) console.log(`all games = ${allGames()}`);
    });
  }
}

initSession = function() {
  setDebugLevel();
  checkAdminMode();
  setTitle();
}

leaveVillage = function () {
  newView ('startMenu');
  Session.set('joinPlayer', null);
  resetUserState();
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
