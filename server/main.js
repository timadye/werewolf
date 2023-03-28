adminMode     = !!Number(process.env.WEREWOLF_ADMIN);
debug         = Number(process.env.WEREWOLF_DEBUG || 1);
adminPassword = process.env.WEREWOLF_PASSWORD || "admin";
resetOnStart  = !!Number(process.env.WEREWOLF_RESET_ON_START);

(function() {
  collections();
  server_startup();
  observe();
})();
