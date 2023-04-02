main_templates = function() {

  //======================================================================
  // main template and global helpers
  //======================================================================

  Template.main.helpers({
    whichView: () => Session.get('currentView'),
  });

  // global helpers
  registerHelper ({
    errorMessage: () => Session.get('errorMessage'),
    gameName: () => getGameName(),
    playerName: () => (getPlayerName() || "a lurker"),
    lurker: () => (!getPlayerName()),
    alive: alive,
    adminMode: () => Session.get('adminMode'),
  });

}

//======================================================================
// general-purpose client functions
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

setDebugLevel = function() {
  Meteor.call ('debugLevel', (error, result) => {
    if (!error && result > debug) {
      debug = result;
      if (debug >= 1) console.log (`debug = ${debug}`);
    }
  });
}

setTitle = function(title) {
  if (title == undefined) {
    title = getPlayerName();
    if (!title) {
      title = getGameName();
      if (!title) {
        document.title = "Werewolf";
        return;
      }
    }
  }
  document.title = title + " - Werewolf";
}

reportError = function(msg) {
  if (msg) console.error(msg);
  Session.set('errorMessage', msg);
}

setPassword = function(pwd) {
  if (pwd && pwd != Session.get('adminPassword')) {
    Session.set('adminMode', undefined);
    Session.set('adminPassword', pwd);
  }
}
