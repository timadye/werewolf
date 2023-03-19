start_templates = function() {

  //======================================================================
  // main template
  //======================================================================

  Template.main.helpers({
    whichView: () => {
      currentView = Session.get('currentView');
      if (currentView != 'lobby') {
        Session.set('lobbyView', '');
        return currentView;
      }
      lobbyView = Session.get('lobbyView');
      return lobbyView ? lobbyView : currentView;
    }
  });

  //======================================================================
  // startMenu template
  //======================================================================

  Template.startMenu.rendered = function() {
    Meteor.call ('debugLevel', (error, result) => {
      if (!error && result > debug) {
        debug = result;
        if (debug >= 1) console.log (`debug = ${debug}`);
      }
    });
    resetUserState();
    Session.set('allGamesSubscribed',false);
    // subscription allGames might not be published by server, but show all games if so.
    Meteor.subscribe('allGames', function onReady() {
      Session.set('allGamesSubscribed',true);
      if (debug>=3) console.log(`all games = ${allGames()}`);
      $(".allGames-removed").removeClass("allGames-removed");
    });
    this.find("input").focus();
  };

  Template.startMenu.helpers({
    allGamesButtons: allGamesFetch,
  });

  Template.startMenu.events({
    'click .btn-reset': () => {
      if (debug>=1) console.log(`reset all games`);
      resetUserState();
      Meteor.call('resetAllGames');
    },
    'click .join-village': (event) => {
      const villageName = event.target.id;
      FlowRouter.go(`/${villageName}`);
    },
    'submit #start-menu': (event) => {
      const villageName = event.target.villageName.value;
      if (!villageName) return false;
      Meteor.call ('villageExists', villageName, (error, result) => {
        if (error || result<0) {
          event.target.villageName.value = "";
          if (!error) console.log ("reset all games");
          return false;
        }
        if (!result) createGame (villageName);
        FlowRouter.go(`/${villageName}`);
      });
      return false;
    },
  });

}
