export const adminPassword = process.env.WEREWOLF_PASSWORD || "admin";
export const resetOnStart  = !!Number(process.env.WEREWOLF_RESET_ON_START);
export const adminMode     = !!Number(process.env.WEREWOLF_ADMIN);
let _debug                 = Number(process.env.WEREWOLF_DEBUG || 1);

export function setDebug(v) { _debug = v; }
export { _debug as debug };
