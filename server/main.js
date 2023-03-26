showAllVillages = !Number(process.env.WEREWOLF_HIDE);
debug            = Number(process.env.WEREWOLF_DEBUG || 1);
resetCmd         = process.env.WEREWOLF_RESET || "reset";
resetOnStart     = !!Number(process.env.WEREWOLF_RESET_ON_START);

(function() {
  collections();
  server_startup();
  observe();
})();
