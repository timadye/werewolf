day_templates = function() {

  Template.dayView.rendered = () => {
    $('html').addClass("day");
    if (alive()) hideRole();
    startClock();
  };

  Template.dayView.destroyed = () => {
    $('html').removeClass("day");
    startClock(false);
  };

  Template.dayView.helpers({
    haveVigilante: () => getCurrentGame().roles.some (r => roleInfo(r).vigilante),
    voting: voting,
    players: allPlayers,
    playerClass: (id) => {
      let cl = [];
      const loaded= Players.find({_id: id, crossbow: true}) . count();
      if (loaded) {
        cl.push ("crossbow-loaded");
      } else {
        const caller= Players.find({_id: id, call: {$ne: null}, alive: {$eq: true}}) . count();
        if (caller) {
          cl.push ("guillotine-caller");
        }
      }
      if (voting()) {
        const voted= Players.find({_id: id, guillotine: {$ne: null}, alive: {$eq: true}}) . count();
        if (voted) {
          cl.push ("voted-player");
        }
      } else {
        const ncalls= Players.find({call: id, alive: {$eq: true}}) . count();
        if        (ncalls >= 2) {
          cl.push ("guillotine-player");
        } else if (ncalls >= 1) {
          cl.push ("voted-player");
        }
      }
      return cl.join(" ");
    },
    voiceOfFate: () => {
      const game= getCurrentGame();
      if (!game) return null;
      return game.voiceOfFate;
    },
  });

  Template.dayView.events({
    'click .toggle-player': (event) => {
      const player = getCurrentPlayer();
      if (player) {
        if (player.crossbow) {
          const victimID = (roleInfo(player.role).vigilante && !player.twang) ? event.target.id : null;
          Players.update (player._id, {$set: {crossbow: false, ...victimID && {twang: victimID} }} );
        } else {
          let call = event.target.id;
          if (player.call == call || !voting()) {
            if (player.call == call) call = null;
            Players.update (player._id, {$set: {call: call}});
          }
        }
      }
    },
    'click .btn-twang': () => {
      // allow anyone to load a crossbow, but only vigilante can fire.
      const player = getCurrentPlayer();
      if (player)
        Players.update (player._id, {$set: {crossbow: !player.crossbow}});
    },
    'click .btn-sleep': (event) => {
      const gameID = Session.get('gameID');
      if (gameID) Games.update(gameID, {$set: {state: 'nightTime'}});
      // "Not permitted. Untrusted code may only update documents by ID.":
      // Players.update({gameID: gameID}, {$set: {call: null, guillotine: null, crossbow: null, twang: null}}, {multi: true});
      for (const {_id: playerID} of allPlayers (null, 2, {_id:1})) {
        Players.update (playerID, {$set: {call: null, guillotine: null, crossbow: null}});
      }
    },
    'click .btn-guillotine': () => guillotineVote("guillotine"),
    'click .btn-spare':      () => guillotineVote("spare"),
    'click .btn-show': () => showRole(),
    'click .btn-hide': () => hideRole(),
  });

}


//======================================================================
// day functions
//======================================================================

guillotineVote = function(vote) {
  const player = getCurrentPlayer();
  if (player) Players.update (player._id, {$set: {guillotine: vote}});
}

voting = function() {
  let calls = {}, guillotine = 0, called = null;
  for (const {call} of Players.find ({call: {$ne: null}, alive: {$eq: true}}, {fields: {call:1} }) . fetch()) {
    if (call in calls) {
      if (++calls[call] == 2) {
        guillotine++;
        called = call;
      }
    } else {
      calls[call] = 1;
    }
  }
  return guillotine==1 ? getPlayerName(called) : "";
}
