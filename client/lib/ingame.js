ingame_templates = function() {

//======================================================================
// Game playing templates
//======================================================================

  Template.gameHeader.helpers({
    listAllRoles: () => {
      return getCurrentGame().roles.map (r => roleInfo(r).name) . join(", ");
    },

    time: () => {
      const secs = Session.get("time");
      return Math.floor(secs/60).toString() + ":" +
             Math.floor(secs%60).toString().padStart(2,'0');
    },
  });

  Template.roleMenu.helpers({
    hiddenRole: () => Session.get("hiddenRole"),

    roleName: () => {
      const player = getCurrentPlayer();
      const role = roleInfo (player ? player.role : null);
      return role.properName ? role.properName : `the ${role.name}`;
    },

    allFellows: () => {
      const player = getCurrentPlayer();
      if (!player) return null;
      return Object.entries (player.fellows) . map (([f,players]) => {
        const pmsg = players.join(" and ");
        const fmsg = {
          werewolf: ["The other werewolf is ",  "The other werewolves are " ],
          cultist:  ["Your fellow cultist is ", "Your fellow cultists are " ],
          lover:    ["You are in love with ",   "You are in love with "     ],
          rival:    ["Your rival is ",          "Your rivals are "          ],
        }[f];
        return (fmsg ? fmsg[players.length==1?0:1] : f+": ")+pmsg;
      });
    },

    allRoles: () => {  // not used any more
      const game = getCurrentGame();
      if (!game) return null;
      var msg = Object.entries (game.playerRoles) . map (([playerID, role]) => `${playerName(playerID)} is the ${roleInfo(role).name}`);
      for (const fellow of ['lover', 'rival']) {
        for (const fellows of game.fellows[fellow]) {
          msg.push (fellows.map(p => p.name).join(" and ") + ` are ${fellow}s`);
        }
      }
      return msg;
    },
  });


  Template.roleInfo.helpers({
    history: showHistory,

    today: (view=null) => {
      if (!view) view = Session.get('currentView');
      const night = {nightView: true, dayView: false}[view];
      if (night === undefined) return null;
      const field = night ? "vote" : "guillotine";
      const players = allPlayers (null, 2, {name:1, alive:1, role:1, [field]: 1}) . filter(p=>p.role);
      if (debug >= 2) console.log ('players = ', players);
      let playerMap = objectMap (players, p => ({[p._id]: p.name}));
      if (night) {
        playerMap["0"] = "none";
      } else {
        playerMap["guillotine"] = "Guillotine";
        playerMap["spare"] = "Spare";
      }
      const row = {
        name:  (night ? "Tonight" : "Today"),
        Class: (night ? "night-row" : "day-row"),
        players: players . map(p => ({
          Class: (p.alive ? "" : "zombie"),
          name:  playerMap[p[field]],
        })),
      };
      if (debug >= 2) console.log ('row = ', row);
      return row;
    },
  });

  Template.gameFooter.events({
    'click .btn-suicide': () => {
      confirm ("Kill Myself", "Leave game?", "If you kill yourself, you could tip the balance of power in the village!", true, () => {
        leaveGame();
      });
    },
    'click .btn-rejoin': () => {
      const player = Players.findOne({session: Meteor.connection._lastSessionId});
      if (player) {
        Session.set ("joinPlayer", player._id);
        Players.update(player._id, {$set: {session: true}});
      }
      Session.set('currentView', 'lateLobby');
    },
    'click .btn-end': () => {
      confirm ("End Game", "End game?", "This will end the game for all players", true, () => {
        endGame();
      });
    },
    'click .btn-download': downloadAll,
  });

  Template.endGame.events({
    'click .btn-leave-village': leaveVillage,
    'click .btn-new': () => {
      confirm ("New Game", "New game?", "This will remove the game summary for everyone", true, () => {
        resetGame();
      });
    },
    'click .btn-download': downloadAll,
  });

}


//======================================================================
// ingame functions
//======================================================================

var interval = null;
startClock = function (start=true) {
  if (interval) Meteor.clearInterval(interval);
  Session.set('time', 0);
  if (start) {
    interval = Meteor.setInterval(() => {
    const secs = Session.get('time') || 0;
    Session.set('time', secs+1);
    }, 1000);
  } else {
    interval = null;
  }
}

hideRole = function (hide=true) {
  Session.set ("hiddenRole", hide);
}

alive = function() {
  const player = getCurrentPlayer();
  return player ? player.alive : false;
}
