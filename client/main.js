debug = 0;   // overridden by server setting if higher
dash = "\u2013";
nbsp = "\u00A0";

MeteorSubs = new SubsCache();
MeteorSubsHistory = new SubsCache();

(function() {
  collections();
  routes();
  main_templates();
  start_templates();
  lobby_templates();
  history_templates();
  ingame_templates();
  night_templates();
  day_templates();
  initSession();
})();
