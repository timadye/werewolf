import { debug } from '/imports/client/globals.js'
import { getGameName, getPlayerName } from '/client/lib/info.js'
import { alive } from '/client/lib/ingame.js'
import { setAdminMode } from '/client/lib/session.js'

export function main_templates() {

  //======================================================================
  // main template and global helpers
  //======================================================================

  Template.main.helpers({
    whichView: () => Session.get('currentView'),
  });

  // global helpers
  registerHelper ({
    errorMessage: () => {
      const errorMessage = Session.get('errorMessage');
      return errorMessage ? errorMessage.split('\n') : [];
    },
    gameName: () => getGameName(),
    playerName: () => (getPlayerName() || "a lurker"),
    lurker: () => (!getPlayerName()),
    alive: () => alive(),
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
export function registerHelper(helpers, helper) {
  if (typeof helpers == "object" && helper === undefined) {
    for (const [k,v] of Object.entries(helpers)) {
      if (debug>=3) console.log(`Handlebars.registerHelper(${k},${v})`);
      Template.registerHelper(k,v);
    }
  } else {
    Template.registerHelper(helpers,helper);
  }
}

export function ask_confirm (button="OK", title="Confirm?", text="", doConfirm=true, ok) {
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

export function setDebugLevel() {
  Meteor.call ('debugLevel', (error, result) => {
    if (!error && result > debug) {
      debug = result;
      if (debug >= 1) console.log (`debug = ${debug}`);
    }
  });
}

export function setTitle(title) {
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

export function reportError(msg) {
  if (msg) console.error(msg);
  Session.set('errorMessage', msg);
}

export function setPassword(pwd) {
  if (pwd && pwd != Session.get('adminPassword')) {
    setAdminMode(pwd);
  }
}
