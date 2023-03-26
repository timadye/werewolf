debug = 0;   // overridden by server setting if higher
MeteorSubs = new SubsCache();
MeteorSubsHistory = new SubsCache();

function werewolf_client() {
  collections();
  routes();
  start_templates();
  lobby_templates();
  history_templates();
  ingame_templates();
  night_templates();
  day_templates();
  Tracker.autorun(trackGameState);
  Session.set('currentView', 'startMenu');
}

werewolf_client();
