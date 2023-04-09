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
    'click .btn-reset': () => resetAllGames(),
    'click .btn-remove': () => {
      const removingGames = !Session.get('removingGames');
      const setRemoving = () => {
        if (debug >= 1) console.log ((removingGames ? "Enable" : "Disable"), "removing games");
        Session.set('removingGames', removingGames);
      }
      if (removingGames) {
        confirm ("Remove games", "Remove games?", "Start removing villages", true, setRemoving);
      } else {
        setRemoving();
      }
    },
    'click .btn-verbose': () => increaseDebugLevel(1),
    'click .btn-quiet': () => increaseDebugLevel(-1),
    'click .btn-exit-admin': () => {
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
      const gameName = event.target.id;
      if (Session.get('removingGames')) {
        if (gameName) removeGame (gameName);
      } else {
        FlowRouter.go('lobby', {gameName:gameName}, {});
      }
    },
    'submit #start-menu': (event) => {
      const gameName = event.target.gameName.value.trim().replace(/\s+/g,' ');
      if (!gameName) return false;
      Session.set('removingGames', false);
      FlowRouter.go('lobby', {gameName:gameName}, {});
      return false;
    },
  });

}


//======================================================================
// start functions
//======================================================================

resetAllGames = function () {
  confirm ("Reset all games", "Remove all games?", "This will delete all villages", true, () => {
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
