history_templates = function() {
  //======================================================================
  // historyIndex template
  //======================================================================

  Template.historyIndex.helpers({
    games: () => {
      games = GamesHistory.find({name: gameName()}, {fields: {createdAt: 1}}).fetch();
      // games = Games.find({}, {fields: {name: 1, date: 1}}).fetch();
      console.log(games);
      return games.map(game => ({_id: game._id, name: game.name, date: new Date(game.createdAt).toLocaleString()}));
    },
  });

  Template.historyIndex.events({
    'click .btn-leave-village': leaveVillage,
    'click .btn-new': () => {
      Session.set('lobbyView', '');
    },
    'click .btn-show': (event) => {
      Session.set('historyEntry', event.target.id);
      Session.set('lobbyView', 'historyEntry');
    },
  });

  //======================================================================
  // historyEntry template
  //======================================================================

  Template.historyEntry.helpers({
    history: () => {
      showHistory(Session.get('historyEntry'));
    },
  });

  Template.historyEntry.events({
    'click .btn-leave-village': leaveVillage,
    'click .btn-new': () => {
      Session.set('lobbyView', '');
    },
    'click .btn-old': () => {
      Session.set('lobbyView', 'historyIndex');
    },
  });

}
