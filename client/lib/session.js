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
