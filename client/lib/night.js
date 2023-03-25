night_templates = function() {

  Template.nightView.rendered = () => {
    $('html').addClass("night");
    if (alive()) hideRole();
    historySubscribe();  // will change on first night
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
