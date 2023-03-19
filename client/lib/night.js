night_templates = function() {

  Template.nightView.rendered = () => {
    $('html').addClass("night");
    if (alive()) hideRole();
    startClock();
  };

  Template.nightView.destroyed = () => {
    $('html').removeClass("night");
    startClock(false);
  };

  Template.nightView.helpers({
    players: () => [ ... allPlayers(), { _id: '0', name: 'none' } ],
    playerClass: (id) => {
      const player= Players.findOne(id);
      if (!player) {
        return null;
      } else if (player.vote) {
        return "voted-player";
      } else {
        return null;
      }
    },
  });

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

  Template.nightView.events({
    'click .toggle-player': (event) => {
      const player = getCurrentPlayer();
      if (player) {
        let vote = event.target.id;
        if (debug >= 3) console.log ('player =', player);
        if (roleInfo(player.role).type == "wolfsbane" && player.lastvote == player._id && vote == player._id) {
          if (debug >= 1) console.log (`${player.name} (${player.role}, ${player._id}) protected themself last night, so ignore self-protection tonight.`);
          vote = '0';    // ignore 2nd wolfbane protection for themself
        } else {
          if (debug >= 1) console.log (`${player.name} (${player.role}, ${player._id}) voted for ${vote} (last vote ${player.lastvote}).`);
        }
        Players.update (player._id, {$set: {vote: vote}});
      }
    },
    'click .btn-show': () => hideRole(false),
    'click .btn-hide': () => hideRole(true),
  });

}
