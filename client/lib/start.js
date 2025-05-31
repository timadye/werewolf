start_templates = function() {

  //======================================================================
  // main template
  //======================================================================

  Template.main.helpers({
    whichView: () => Session.get('currentView'),
  });

  //======================================================================
  // startMenu template
  //======================================================================

  Template.startMenu.rendered = function() {
    Session.set('removingGames', false);
    this.find("input").focus();
  };

  Template.startMenu.helpers({
    allGames: () => Games.find ({}, {fields: {name: 1}, sort: {createdAt: 1}}),
    removingClass: () => (Session.get('removingGames') ? "removing-games" : ""),
  });

  Template.startMenu.events({
    'click .evt-reset': () => resetAllGames(),
    'click .evt-remove': () => {
      const removingGames = !Session.get('removingGames');
      const setRemoving = () => {
        if (debug >= 1) console.log ((removingGames ? "Enable" : "Disable"), "removing games");
        Session.set('removingGames', removingGames);
      }
      if (removingGames) {
        ask_confirm ("Remove games", "Remove games?", "Start removing villages", true, setRemoving);
      } else {
        setRemoving();
      }
    },
    'click .evt-verbose': () => increaseDebugLevel(1),
    'click .evt-quiet': () => increaseDebugLevel(-1),
    'click .evt-exit-admin': () => {
      Meteor.call('resetDebug', Session.get('adminPassword'), (error, newDebug) => {
        if (error) {
          reportError('exitAdmin failed');
        } else {
          if (newDebug != debug) {
            console.log(`reset debug level to ${newDebug}`);
          }
          debug = newDebug;
        }
      });
      Session.set('adminMode', false);
      Session.set('adminPassword', '');
      console.log(`exited admin mode`);
      FlowRouter.go('start', {}, {});
    },
    'click .join-village': (event) => {
      // admin mode click on a village button
      const gameName = event.target.id;
      if (Session.get('removingGames')) {
        if (gameName) removeGame (gameName);
      } else {
        FlowRouter.go('lobby', {gameName:gameName}, {});
      }
    },
    'submit #start-menu': (event) => {
      // enter name in box and press enter or click on "Enter Village" button
      const gameName = event.target.gameName.value.trim().replace(/\s+/g,' ');
      if (!gameName) return false;
      if (gameName.startsWith('admin ')) {
        event.target.gameName.value = '';
        setPassword (gameName.substring(6));
        return false;
      }
      event.target.gameName.value = ' ' + gameName;
      event.target.gameName.setSelectionRange(0, 0);  // put cursor at start of line
      Session.set('removingGames', false);
      if (Session.get('creatingGame')) {
        createGame (gameName);
      } else {
        FlowRouter.go('lobby', {gameName:gameName}, {});
      }
      return false;
    },
  });

}


//======================================================================
// start functions
//======================================================================

createGame = function (createGame) {
  console.log(`try creating game with '${createGame}'`);
  Meteor.call ('createGame', createGame, Session.get('adminPassword'), (error, gameName) => {
    if (error) {
      if (debug>=0) console.log (`error '${error.error}' creating game with '${createGame}': ${error.reason}`);
      Session.set('errorMessage', error.reason);
    } else if (gameName) {
      Session.set('errorMessage', null);
      FlowRouter.go('lobby', {gameName:gameName}, {});
    }
  });
}

resetAllGames = function () {
  ask_confirm ("Reset all games", "Remove all games?", "This will delete all villages", true, () => {
    Meteor.call('removeGames', Session.get('adminPassword'), null, (error, ndel) => {
      if (error) {
        reportError(`failed to remove all games`);
      } else {
        if (debug>=1) console.log(`removing all games deletes ${ndel} game/player entries`);
      }
    });
  });
}

removeGame = function (gameName=null) {
  Meteor.call('removeGames', Session.get('adminPassword'), gameName, (error, ndel) => {
    const msg = gameName===null ? 'all games' : `game '${gameName}'`;
    if (error) {
      reportError(`failed to remove game '${gameName}'`);
    } else {
      if (debug>=1) console.log(`removing '${gameName}' deletes ${ndel} game/player entries`);
    }
  });
}

increaseDebugLevel = function (delta=1) {
  Meteor.call('increaseDebugLevel', Session.get('adminPassword'), delta, (error, newDebug) => {
    if (error) {
      reportError('increaseDebugLevel failed');
    } else {
      debug = newDebug;
      console.log(`set new debug level ${debug}`);
    }
  });
}
