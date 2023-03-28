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
    resetUserState();
    this.find("input").focus();
  };

  Template.startMenu.helpers({
    allGames: () => {
      return Games.find ({}, {fields: {name: 1}, sort: {createdAt: 1}});
    }
  });

  Template.startMenu.events({
    'click .btn-reset': () => {
      resetUserState();
      ok = Meteor.call('resetAllGames', Session.get('adminPassword'), (error, obj) => {
        if (error || !obj) {
          reportError('failed to reset all games')
        } else {
          if (debug>=1) console.log(`reset all games`);
        }
      });
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
