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
    'click .btn-show': () => hideRole(false),
    'click .btn-hide': () => hideRole(true),
  });

}
