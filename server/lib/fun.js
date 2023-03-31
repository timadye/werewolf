resetAllGames = function() {
  if (debug>=1) console.log("reset all games");
  Games.remove({});
  Players.remove({});
}

assignRoles = function(gameID, players, roleNames) {
  if (debug>=3) console.log('roles =', roleNames);

  const allFellows = keyArrayFromEntries (Object.entries(allRoles) . map (([k,v]) => [v.fellows, k]));
  if (debug>=3) console.log('allFellows =', allFellows);

  var decks = keyArrayMap (roleNames,
                           roleName => [(allRoles[roleName]||{}).deck, roleName],
                           initObject (Object.values(allRoles) . map (v => v.deck)));
  for (let i=1; decks.roles.length < players.length; i++) {
    decks.roles.push ("villager_"+i);
  }
  if (debug>=3) console.log('decks =', decks);

  const shuffledRoles = shuffleArray (decks.roles, players.length);
  if (debug>=3) console.log('shuffledRoles =', shuffledRoles);
  if (debug>=3) console.log('players =', players);
  const rolePlayers = objectMap (players, (player,i) => ({[shuffledRoles[i]]: player}));
  if (debug>=3) console.log('rolePlayers =', rolePlayers);

  const roleFellows = objectMap (allFellows, (([f,roles]) => {
    const fplayers = roles.flatMap (r => {
      const p = rolePlayers[r];
      return p ? [p] : [];
    });
    return {[f]: fplayers.length ? [fplayers] : []};
  }));

  var unloved = players.slice();
  const fellows = keyArrayMap (decks.lovers, role => {
    const r = allRoles[role];
    return r ? [r.fellows, shuffleArray (unloved, r.number, true)] : []
  }, roleFellows);
  if (debug>=3) Object.entries(fellows).forEach(([k,v])=>console.log(`fellows[${k}] =`,v));

  Object.entries (rolePlayers) . forEach (([role, player]) => {
    const playerID = player._id;
    const playerFellows = objectMap (fellows,
                                     ([fellowType, fellowPlayers]) => {
                                       const others = fellowPlayers.flatMap (f =>
                                                                               f.some   (p => (p._id == playerID))
                                                                             ? f.filter (p => (p._id != playerID))
                                                                             : []);
                                       return others.length ? {[fellowType]: others.map(p=>p.name)} : null;
                                     });
    if (debug>=1) {
      let fellowsStr = Object.entries (playerFellows) . map (([f,pa]) => [f+"="+(pa.join(","))]) . join(" ");
      if (fellowsStr) fellowsStr = " (fellow "+fellowsStr+")";
      console.log (`Player ${player.name} (${player._id}) is ${role}${fellowsStr}`);
    }
    Players.update (playerID, {$set: {role: role, fellows: playerFellows}});
  });

  const playerRoles = objectMap (rolePlayers, ([r,p]) => ({[p._id]: r}));
  const gameSettings = {playerRoles: playerRoles, fellows: fellows};
  Games.update(gameID, {$set: gameSettings});
  return gameSettings;
}

dawn = function (game, playersFound) {
  if (debug >= 3) console.log ('Dawn: playerRoles =', game.playerRoles);

  const players = playersFound.map (p => ({ ... p, act: {}, attackers: [], casualty: 0, cause: null }));
  const playerMap = objectMap (players, p => ({[p._id]: p}));
  if (debug >= 3) console.log ('initial players =', players);
  var nwerewolves = 0;
  for (const player of players) {
    const roleName = game.playerRoles[player._id];
    const role = roleInfo(roleName);
    if (role.type == "werewolf") nwerewolves ++;
    if (role.active == 'night') {
      const p = playerMap[player.vote];
      if (p) {
        if (role.type in p.act) {
          p.act[role.type]++;
        } else {
          p.act[role.type]= 1;
        }
        if (role.type == "werewolf")
          p.attackers.push(player._id);
      }
    }
  }

  for (const player of players) {
    const act = player.act;
    if (act.werewolf && !act.wolfsbane) {
      player.casualty += (nwerewolves <= 1 ? 2 : act.werewolf);
      player.cause = 'werewolf';
    }
  }

  for (const player of players) {
    if (player.act.trapper) {
      const a = player.attackers;
      const w = a[Math.floor(Math.random() * a.length)];
      if (w) {
        const t = playerMap[w];
        if (t.casualty <= 1) t.cause = 'trapper';
        t.casualty ++;
      }
    }
  }

  for (const player of players) {
    if (player.casualty > 2) player.casualty = 2;
  }

  for (const player of players) {
    if (player.casualty == 2) {
      loverSuicide (game.fellows.lover, playerMap, player);
    }
  }

  const deaths=[], suicides=[], injuries=[];
  for (const player of players) {
    if (player.casualty >= 2) {
      if (player.casualty == 3) {
        suicides.push(player.name);
      } else {
        deaths.push(player.name);
      }
      Players.update (player._id, {$set: {alive: false}});
    } else if (player.casualty >= 1) {
      injuries.push(player.name);
    }
  }
  if (debug >= 1) console.log (`Dawn: deaths = ${deaths}, suicides = ${suicides}, injuries = ${injuries}`);
  if (debug >= 2) console.log ('details =', players);
  TurnsHistory.insert({historyID: game.historyID, phase: 'night', players: players});

  let voiceOfFate = [];
  if (deaths.length)
    voiceOfFate.push (deaths  .join(" and ") + " died in the night.");
  if (suicides.length)
    voiceOfFate.push (suicides.join(" and ") + " also died of a broken heart.");
  if (injuries.length)
    voiceOfFate.push (injuries.join(" and ") + (injuries.length >= 2 ? " were" : " was") + " injured in the night.");
  if (!voiceOfFate.length)
    voiceOfFate.push ("There were no injuries in the night.");
  Games.update(game._id, {$set: {voiceOfFate: voiceOfFate, state: 'dayTime'}});
}

guillotine = function (game, players) {
  const victimPlayer = guillotineCall (players);
  if (!victimPlayer) return;

  let votes = {guillotine:[], spare:[]};
  for (const player of players) {
    const role = roleInfo (game.playerRoles[player._id]);
    const n = ('votes' in role) ? role.votes : 1;
    const vote = player.guillotine;
    (votes[vote] || (votes[vote]=[])) . push (... Array.from({length:n}, x=>player._id));
  }
  const calls = players.flatMap (p => (p.call == victimPlayer._id ? [p._id] : []));
  const dead = (votes.guillotine.length > votes.spare.length);
  const victim = { _id: victimPlayer._id, name: victimPlayer.name, ... votes, attackers: calls, casualty: dead?2:0, cause: 'guillotine' };
  if (debug >= 1) console.log (`Player ${victim.name} (${victim._id}) was ${dead?"guillotined":"spared"} by ${votes.guillotine.length} to ${votes.spare.length}`);

  const [history, voiceOfFate] = killPlayer ("Guillotine", game, players, victim);
  if (!dead) {
    voiceOfFate.push (victim.name + " was spared.");
  }

  Games.update(game._id, {$push: { voiceOfFate: { $each: voiceOfFate } }});
  TurnsHistory.insert({historyID: game.historyID, phase: 'guillotine', players: history});
}

guillotineCall = function (players) {
  if (debug >= 3) console.log('players =', players);
  let calls = {}, guillotine = [];
  for (const player of players) {
    if (player.call) {
      if (player.call in calls) {
        if (++calls[player.call] == 2)
          guillotine.push (players.find (p => p._id == player.call));
      } else {
        calls[player.call] = 1;
      }
    }
  }
  if (guillotine.length == 1) {
    return guillotine[0];
  } else {
    if (debug >= 0) {
      if (guillotine.length == 0) {
        console.log (`Ignore vote on call which was not seconded on ${Object.keys(calls).join(" and ")} - why was this requested by the client?`);
      }  else {
        console.log (`Ignore vote on multiple calls on ${guillotine.join(" and ")} - why was this requested by the client?`);
      }
    }
    return null;
  }
}

twang = function (game, players, vigilanteID, vigilante) {
  const victimPlayer = players.find (p => p._id == vigilante.twang);
  if (!victimPlayer) return;
  const victim = { _id: victimPlayer._id, name: victimPlayer.name, attackers: [vigilanteID], casualty: 2, cause: 'crossbow' };
  if (debug >= 1) console.log (`Player ${victim.name} (${victim._id}) was shot by ${vigilante.name} (${vigilanteID})`);

  const [history, voiceOfFate] = killPlayer ("Vigilante", game, players, victim);

  Games.update(game._id, {$push: { voiceOfFate: { $each: voiceOfFate }}});
  TurnsHistory.insert({historyID: game.historyID, phase: 'vigilante', players: history});
}

killPlayer = function (cause, game, players, victim) {
  if (victim.casualty < 2) return [[victim], [], []];
  let playerMap = objectMap (players, p => ({[p._id]: Object.assign({},p)}));
  const history = [victim].concat (loverSuicide (game.fellows.lover, playerMap, victim));

  let deaths=[], suicides=[];
  for (const player of history) {
    if (player.casualty >= 2) {
      if (player.casualty == 3) {
        suicides.push(player.name);
      } else {
        deaths.push(player.name);
      }
      Players.update (player._id, {$set: {alive: false}});
    }
  }
  if      (debug == 1) console.log (`${cause}: deaths = ${deaths}, suicides = ${suicides}`);
  else if (debug >= 2) console.log (`${cause}: deaths = ${deaths}, suicides = ${suicides}, details =`, history);

  let voiceOfFate = [];
  if (deaths.length) {
    if        (cause == "Guillotine") {
      voiceOfFate.push (deaths.join(" and ") + (deaths.length >= 2 ? " were" : " was") + " executed.");
    } else if (cause == "Vigilante") {
      voiceOfFate.push (deaths.join(" and ") + (deaths.length >= 2 ? " were" : " was") + " shot dead by " + victim.attackers.map(p=>playerMap[p].name).join(" and ") + ".");
    } else {
      voiceOfFate.push (deaths.join(" and ") + (deaths.length >= 2 ? " are" : " is") + " dead.");
    }
  }
  if (suicides.length)
    voiceOfFate.push (suicides.join(" and ") + " also died of a broken heart.");

  return [history, voiceOfFate];
}

loverSuicide = function (allLovers, playerMap, player) {
  playerMap[player._id] = player;
  if (debug >= 3) console.log ('loverSuicide: lovers =', allLovers, ', playerMap =', playerMap, ', player =', player);
  var deaths = [], suicides = [];
  for (const lovers of allLovers) {
    if (lovers.some (p => p._id == player._id)) {
      for (const lover of lovers) {
        if (lover._id != player._id) {
          const suicide = playerMap[lover._id];
          if (suicide && (!suicide.casualty || suicide.casualty <= 1)) {
            if (debug >= 1) console.log (`Player ${player.name}'s (${player._id}) death by ${player.cause} causes ${suicide.name} (${suicide._id}) to suicide`);
            suicide.casualty = 3;
            suicide.cause = 'lover';
            suicides.push (suicide);
          }
        }
      }
    }
  }
  var deaths = suicides.slice();

  // Suicide lovers of lovers (is this a thing?)
  for (const suicide of suicides) {
    deaths.push (... loverSuicide (allLovers, playerMap, suicide));
  }
  return deaths;
}

downloadHistory = function (gameName) {
  h = GamesHistory.find({ name: gameName });
  gamesHistory = h ? h.fetch() : `error finding gamesHistory.gameID=${game._id}`;
  ids = h ? gamesHistory.map (g => g._id) : [];
  t = TurnsHistory.find({ historyID: { $in: ids }});
  turnsHistory = t ? t.fetch() : `error finding turnsHistory->gameID=${game._id}`;
  obj = {
    gameName: gameName,
    gamesHistory: gamesHistory,
    turnsHistory: turnsHistory,
  };
  if (debug >= 1) {
    info = Object.entries(obj).flatMap(([k,v])=>(k!="gameName" && Array.isArray(v) ? [`${v.length} ${k}`] : [])).join(", ");
    console.log (`download history for '${gameName}': ${info}`);
  }
  return obj;
}

downloadAll = function() {
  g = Games.find({});
  games = g ? g.fetch() : "error reading 'games'";
  p = Players.find({});
  players = p ? p.fetch() : "error reading 'players'";
  h = GamesHistory.find({});
  gamesHistory = h ? h.fetch() : "error reading 'gamesHistory'";
  t = TurnsHistory.find({});
  turnsHistory = t ? t.fetch() : "error reading 'turnsHistory'";
  obj = {
    gameName: null,  // all villages
    games: games,
    players: players,
    gamesHistory: gamesHistory,
    turnsHistory: turnsHistory,
  };
  if (debug >= 1) {
    info = Object.entries(obj).flatMap(([k,v])=>(k!="gameName" && Array.isArray(v) ? [`${v.length} ${k}`] : [])).join(", ");
    console.log (`download all data: ${info}`);
  }
  return obj;
}
