start_templates = function() {

  //======================================================================
  // main template
  //======================================================================

  Template.main.helpers({
    whichView: () => {
      return Session.get('currentView');
    }
  });

  //======================================================================
  // startMenu template
  //======================================================================

  Template.startMenu.rendered = function() {
    this.find("input").focus();
  };

  Template.startMenu.helpers({
    allGames: () => {
      return Games.find ({}, {fields: {name: 1}, sort: {createdAt: 1}});
    }
  });

  Template.startMenu.events({
    'click .btn-reset': () => {
      ok = Meteor.call('resetAllGames', Session.get('adminPassword'), (error, obj) => {
        if (error || !obj) {
          reportError('failed to reset all games')
        } else {
          if (debug>=1) console.log(`reset all games`);
        }
      });
    },
    'click .join-village': (event) => {
      const gameName = event.target.id;
      FlowRouter.go(`/${gameName}`);
    },
    'submit #start-menu': (event) => {
      const gameName = event.target.gameName.value.trim();
      if (!gameName) return false;
      FlowRouter.go(`/${gameName}`);
      return false;
    },
  });

}


//======================================================================
// start functions
//======================================================================
