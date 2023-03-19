function resetAllGames() {
  if (debug>=1) console.log("reset all games");
  Games.remove({});
  Players.remove({});
}

function assignRoles(gameID, players, roleNames) {
  if (debug>=3) console.log('roles =', roleNames);

  const allFellows = keyArrayFromEntries (Object.entries(allRoles) . map (([k,v]) => [v.fellows, k]));
  if (debug>=3) console.log('allFellows =', allFellows);

  var decks = keyArrayMap (roleNames,
                           name => [(allRoles[name]||{}).deck, name],
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
  Games.update(gameID, {$set: {playerRoles: playerRoles, fellows: fellows}});
}

function dawn (game, playersFound) {
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

  let voiceOfFate = [];
  if (deaths.length)
    voiceOfFate.push (deaths  .join(" and ") + " died in the night.");
  if (suicides.length)
    voiceOfFate.push (suicides.join(" and ") + " also died of a broken heart.");
  if (injuries.length)
    voiceOfFate.push (injuries.join(" and ") + (injuries.length >= 2 ? " were" : " was") + " injured in the night.");
  if (!voiceOfFate.length)
    voiceOfFate.push ("There were no injuries in the night.");
  Games.update(game._id, {$set: {voiceOfFate: voiceOfFate, state: 'dayTime'},
                          $push: { history: {phase: 'night', players: players} }});
}

function guillotine (game, players) {
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

  Games.update(game._id, {$push: { history: {phase: 'guillotine', players: history}, voiceOfFate: { $each: voiceOfFate } }});
}

function guillotineCall (players) {
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
