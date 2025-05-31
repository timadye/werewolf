global.adminMode     = !!Number(process.env.WEREWOLF_ADMIN);
global.debug         = Number(process.env.WEREWOLF_DEBUG || 1);
global.adminPassword = process.env.WEREWOLF_PASSWORD || "admin";
global.resetOnStart  = !!Number(process.env.WEREWOLF_RESET_ON_START);

(function() {
  collections();
  server_startup();
  observe();
})();
