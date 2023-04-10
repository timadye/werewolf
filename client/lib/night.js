night_templates = function() {

  Template.nightView.rendered = () => {
    document.body.className = "night";
    if (alive()) hideRole();
    startClock();
  };

  Template.nightView.destroyed = () => {
    document.body.className = "";
    startClock(false);
  };

  Template.nightView.helpers({
    players: () => [ ... allPlayers(), { _id: '0', name: 'none' } ],
    playerClass: (id) => {
      const player= Players.findOne(id, {fields:{vote:1}});
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
      const player = getCurrentPlayer({name:1, role:1, lastvote:1});
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
  });

}
