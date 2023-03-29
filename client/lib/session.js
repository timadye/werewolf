main_templates = function() {

  //======================================================================
  // main template
  //======================================================================

  Template.main.helpers({
    whichView: () => {
      return Session.get('currentView');
    }
  });

  // global helpers
  registerHelper ({
    errorMessage: () => Session.get('errorMessage'),
    game: getCurrentGame,
    gameName: gameName,
    playerName: () => (playerName() || "a lurker"),
    lurker: () => (!playerName()),
    alive: alive,
    adminMode: () => { return Session.equals('adminMode', true); }
  });

}

//======================================================================
// Session
//======================================================================

// Handlebars.registerHelper() wrapper.
// Blaze/Spacebars/Handlebars doesn't seem to allow multiple helpers to be defined at once as implied here:
//   https://handlebarsjs.com/api-reference/runtime.html#handlebars-registerhelper-name-helper
// registerHelper({helper: ()=>{}}) can be used instead.
registerHelper = function(helpers, helper) {
  if (typeof helpers == "object" && helper === undefined) {
    for (const [k,v] of Object.entries(helpers)) {
      if (debug>=3) console.log(`Handlebars.registerHelper(${k},${v})`);
      Template.registerHelper(k,v);
    }
  } else {
    Template.registerHelper(helpers,helper);
  }
}

confirm = function (button="OK", title="Confirm?", text="", doConfirm=true, ok) {
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

//======================================================================
// General game
//======================================================================

setDebugLevel = function() {
  Meteor.call ('debugLevel', (error, result) => {
    if (!error && result > debug) {
      debug = result;
      if (debug >= 1) console.log (`debug = ${debug}`);
    }
  });
}

rendered = function() {
  initSession();
  hideRole();
  if (!Session.get('gameID')) {
    const villageName = Session.get('urlVillage');
    if (villageName) joinGame(villageName);
  }
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

reportError = function(msg) {
  if (msg) console.error(msg);
  Session.set('errorMessage', msg);
}

resetUserState = function() {
  // MeteorSubs.clear();
  MeteorSubsHistory.clear();
  setCurrentGame(null);
  setCurrentPlayer(null);
  initSession();
}

setPassword = function(pwd) {
  if (pwd != Session.get('adminPassword')) {
    Session.set('adminMode',undefined);
    Session.set('adminPassword',pwd);
  }
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
  MeteorSubsHistory.clear();
  const gameID = Session.get('gameID');
  if (gameID) {
    Games.update(gameID, { $set: initialGame() });
    for (const player of allPlayers (gameID, 2)) {
      Players.update(player._id, { $set: initialPlayer() });
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

endGame = function() {
  Session.set('errorMessage', null);
  Session.set('turnMessage', null);
  const gameID = Session.get('gameID');
  if (gameID) Games.update(gameID, {$set: {state: 'endGame'}});
}
