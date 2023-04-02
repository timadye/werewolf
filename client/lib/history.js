history_templates = function() {
  //======================================================================
  // historyIndex template
  //======================================================================

  Template.historyIndex.helpers({
    games: () => {
      games = GamesHistory.find({name: getGameName()}, {fields: {createdAt: 1}, sort: {createdAt: -1}}).fetch();
      return games.map(game => ({_id: game._id, date: new Date(game.createdAt).toLocaleString()}));
    },
  });

  Template.historyIndex.events({
    'click .btn-leave-village': leaveVillage,
    'click .btn-new': () => {
      FlowRouter.go(`/${getGameName()}`);
    },
    'click .btn-download': downloadVillage,
    'click .btn-show': (event) => {
      FlowRouter.go(`/${getGameName()}/~history/${event.target.id}`);
    },
  });

  //======================================================================
  // historyEntry template
  //======================================================================

  Template.historyEntry.helpers({
    date: () => {
      game = GamesHistory.findOne(Session.get('historyEntry'), {fields: {createdAt: 1}});
      return game ? new Date(game.createdAt).toLocaleString() : null;
    },
  });

  Template.historyEntry.events({
    'click .btn-leave-village': leaveVillage,
    'click .btn-new': () => {
      FlowRouter.go(`/${getGameName()}`);
    },
    'click .btn-old': () => {
      FlowRouter.go(`/${getGameName()}/~history`);
    },
  });

}


//======================================================================
// history functions
//======================================================================

pastGamesSubscribe = function (onReady, gameName) {
  MeteorSubsHistory.subscribe('pastGames', gameName, {
    onReady: () => {
      if (debug >= 1) console.log (`Subscribed to 'pastGames' for '${gameName}'`);
      onReady();
    }
  });
}

historySubscribe = function (onReady, historyID=null) {
  if (!historyID) {
    const game = getCurrentGame({historyID:1});
    if (!game) return;
    historyID = game.historyID;
    if (!historyID) return;
  }
  // MeteorSubs doesn't seem to work when called from inside a Tracker.autorun (trackGameState):
  // instead, it calls the server's publish in an infinite loop.
  // Fortunately Meteor's native subscribe should do what we went - at least inside the Tracker:
  // it doesn't republish the same subscription, and
  // unsubscribes when the state changes again (ie. we leave the endGame view).
  const inTracker = !!Tracker.currentComputation
  const MeteorHistory = inTracker ? Meteor : MeteorSubsHistory;
  if (debug >= 2) console.log (`subscribe to 'gamesHistory' for historyID=${historyID} (in tracker=${inTracker})`);
  MeteorHistory.subscribe('gamesHistory', historyID, {
    onReady: () => {
      if (debug >= 1) console.log (`Subscribed to 'gamesHistory' for historyID ${historyID} (in tracker=${inTracker})`);
      Session.set('historyEntry', historyID);
      onReady();
    }
  });
}

showHistory = function () {
  const historyID = Session.get('historyEntry');
  if (!historyID) return null;
  const game = GamesHistory.findOne(historyID);
  if (!game) return null;
  const history = TurnsHistory.find({historyID: historyID}, {sort: {createdAt: 1}}).fetch();
  if (debug >= 2) {
    console.log (`showHistory game ${historyID} = `, game);
    console.log ('history = ', history);
  }
  return historyTable (game, history);
}

historyTable = function (game, history) {
  const col0 = {Class:"", name:""};
  const players = game.players.map (p => ({...p, role: roleInfo(game.playerRoles[p._id]), alive:true})) . filter (p=>!p.role.zombie);
  if (debug >= 2) console.log ('players = ', players);
  const playerMap = objectMap (players, p => ({[p._id]: p}));
  if (debug >= 3) console.log ('fellows = ', game.fellows);
  var day = 0;
  const table = {
    players: players,
    fellows: ['Lover', 'Rival'].flatMap (ff => ((game.fellows||{})[ff.toLowerCase()]||[]).map (f => ({type: `${ff}s`, names: (() => {
      players.forEach (p => {p.col = {...col0}});
      for (const p of f) {
        if (p._id in playerMap)
          playerMap[p._id].col.name = p.name;
      }
      return players.map(p=>p.col);
    })()}))),
    turns: history.map (t => ({
      turn: (t.phase == "night") ? {Class: 'night-row', name: `Night${nbsp}${++day}`}
                                  : {Class:   'day-row', name: {"guillotine": "Guillotine", "vigilante": "Vigilante"}[t.phase] || t.phase},
      players: (() => {
        const defClass = (t.phase == "night" ? 'night-row' : 'day-row');
        players.forEach (p => {p.col = {name:"", Class: (t.phase == "vigilante" && p.alive ? defClass : "zombie")}});
        for (const p of t.players) {
          const m = playerMap[p._id];
          if (!m) continue;
          if (t.phase == "guillotine") {
            if (p.cause == 'lover') {
              m.col.Class = p.casualty ? "dead-suicide" : defClass;
            } else {
              m.col.Class = p.casualty ? "dead" : "alive";
              for (const pid of p.guillotine) {
                const c = playerMap[pid].col;
                if (!c) continue;
                c.name = m.name;
                if (c.Class == "zombie") c.Class = defClass;
              }
              for (const pid of p.spare) {
                const c = playerMap[pid].col;
                if (!c) continue;
                c.name = dash;
                if (c.Class == "zombie") c.Class = defClass;
              }
            }
          } else  if (t.phase == "vigilante") {
            if (p.cause == 'lover') {
              if (p.casualty) m.col.Class =  "dead-suicide";
            } else {
              m.col.Class = p.casualty ? "dead" : "alive";
              for (const pid of p.attackers) {
                const c = playerMap[pid].col;
                if (!c) continue;
                c.name = "TWANG!";
                if (c.Class == "zombie") c.Class = defClass;
              }
            }
          } else  if (t.phase == "night") {
            if (p.casualty >= 2) {
              m.col.Class = (p.cause == "lover" ? "dead-suicide" : "dead");
            } else if (p.casualty == 1) {
              m.col.Class = (p.cause == "trapper" ? "injured-trapper" : "injured");
            } else {
              m.col.Class = defClass;
            }
            if (m.role.active == "night" && p.vote) {
              m.col.name = (playerMap[p.vote]||{}).name;
            }
          }
        }
        players.forEach (p => {if (p.col.Class == "zombie") p.alive = false});
        return players.map(p=>p.col);
      })()
    })),
  };
  if (debug >= 2) console.log ('table = ', table);
  return table;
}
