import { Mongo } from 'meteor/mongo';

export const Games = new Mongo.Collection("games");
export const Players = new Mongo.Collection("players");
export const GamesHistory = new Mongo.Collection("gamesHistory");
export const TurnsHistory = new Mongo.Collection("turnsHistory");

export function collections() {

  Games.allow({
    update: (userId, doc, fields, modifier) => {
      return true;
    },
  });

  Players.allow({
    insert: (userId, doc) => {
      return true;
    },
    update: (userId, doc, fields, modifier) => {
      return true;
    },
    remove: (userId, doc) => {
      return true;
    },
  });

  Players.deny({
    insert: (userId, doc) => {
      doc.createdAt = new Date().valueOf();
      return false;
    },
  });
}

export function initialGame() {
  return {
    playerRoles: [],
    state: 'waitingForPlayers',
    voiceOfFate: [],
    historyID: null,
  };
}
