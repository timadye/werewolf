let _debug = 0;   // overridden by server setting if higher
export function setDebug(v) { _debug = v; }
export { _debug as debug };

export const dash = "\u2013";
export const nbsp = "\u00A0";

import { SubsCache } from 'meteor/ccorcos:subs-cache';
export const MeteorSubs = new SubsCache();
export const MeteorSubsHistory = new SubsCache();
