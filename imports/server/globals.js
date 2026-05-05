export var adminMode     = !!Number(process.env.WEREWOLF_ADMIN);
export var debug         = Number(process.env.WEREWOLF_DEBUG || 1);
export const adminPassword = process.env.WEREWOLF_PASSWORD || "admin";
export const resetOnStart  = !!Number(process.env.WEREWOLF_RESET_ON_START);
