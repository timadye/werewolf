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


//======================================================================
// start functions
//======================================================================

initialGame = function() {
  return {
    playerRoles: [],
    state: 'waitingForPlayers',
    voiceOfFate: [],
    date: Date.now(),
    historyID: null,
  };
}

createGame = function(name, roles=["werewolf_1", "werewolf_2", "wolfsbane_1", "trapper_1"]) {
  const gameID = Games.insert({
    name: name,
    // default roles
    roles: roles,
    ... initialGame()
  });
  if (debug>=1) console.log(`New game in village '${name}' (${gameID})`)
  return Games.findOne(gameID);
}
