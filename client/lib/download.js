import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';

import { debug } from '/imports/client/globals.js';
import { reportError } from '/client/lib/client.js';
import { getGameName } from '/client/lib/info.js';

export function downloadObject(obj, filename=null) {
  const a = document.createElement('a');
  const data = JSON.stringify(obj, undefined, 2);
  a.href = URL.createObjectURL( new Blob([data], { type:'text/json' }) );
  a.download = (filename||"werewolf")+".json";
  a.click();
}

export function downloadAll() { downloadGame(true); }
export function downloadVillage() { downloadGame(false); }

export function downloadGame(all) {
  const gameName = all ? null : getGameName();
  const callback = (error, obj) => {
    if (error) {
      reportError("download failed");
    } else {
      if (debug >= 1) {
        info = Object.entries(obj).flatMap(([k,v])=>(k!="gameName" && Array.isArray(v) ? [`${v.length} ${k}`] : [])).join(", ");
        if (obj.gameName === null) {
          console.log (`download everything as a JSON file: ${info}`);
        } else {
          console.log (`download '${obj.gameName}' as a JSON file: ${info}`);
        }
      }
      downloadObject (obj, gameName);
    }
  };
  if (all) {
    Meteor.call ('downloadAll', Session.get('adminPassword'), callback); 
  } else {
    Meteor.call ('downloadHistory', gameName, callback);
  }
}
