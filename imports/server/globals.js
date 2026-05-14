export const adminMode     = !!Number(process.env.WEREWOLF_ADMIN);
export const adminPassword =          process.env.WEREWOLF_PASSWORD || "admin";
export const resetOnStart  = !!Number(process.env.WEREWOLF_RESET_ON_START);
let _debug                 =   Number(process.env.WEREWOLF_DEBUG || 1);
export { _debug as debug };
export function setDebug(v) { _debug = v; }
