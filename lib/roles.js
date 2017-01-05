function Doppelganger() {
  this.name = 'Doppelganger';
  this.order = 0;
  this.instructions = function(game) {
    return "Doppelganger, wake up and look at another player's card. You are now that role."
  }
};

function Werewolf() {
  this.name = 'Werewolf';
  this.order = 3;
  this.instructions =  function(game) {
    return "Werewolves, wake up and look for other werewolves. If there is only one of you, view a center card."
  }
};

function Minion() {
  this.name = 'Minion';
  this.order = 4;
  this.instructions = function(game) {
    return "Minion, wake up and look for the werewolves."
  };
};

function Mason() {
  this.name = 'Mason';
  this.order = 5;
  this.instructions = function(game) {
    return "Masons, wake up and look for other masons."
  };
};

function Seer() {
  this.name = 'Seer',
  this.order = 6,
  this.instructions = function(game) {
    return "Seer, wake up. You may look at another player's card or two of the center cards."
  }
};

function Robber() {
  this.name = 'Robber';
  this.order = 7;
  this.instructions = function(game) {
    return "Robber, wake up. You may exchange your card with another player's card, and then view your new card."
  };
};

function Troublemaker() {
  this.name = 'Troublemaker';
  this.order = 8;
  this.instructions = function(game) {
    return "Troublemaker, wake up. You may exchange cards between two players."
  };
};

function Drunk() {
  this.name = 'Drunk';
  this.order = 9;
  this.instructions = function(game) {
    return "Drunk, wake up and exchange your card with a card from the center."
  };
};

function Insomniac() {
  this.name = 'Insomniac';
  this.order = 10;
  this.instructions = function(game) {
    return "Insomniac, wake up and look at your card."
  };
};

function Villager() {
  this.name = 'Villager';
  this.order = 15;
  this.instructions = function(game) {};
};

function Hunter() {
  this.name = 'Hunter';
  this.order = 15;
  this.instructions = function(game) {};
};

function Tanner() {
  this.name = 'Tanner';
  this.order = 15;
  this.instructions = function(game) {};
};

allRoles = {
  doppelganger : new Doppelganger(),
  werewolf1 : new Werewolf(),
  werewolf2 : new Werewolf(),
  minion : new Minion(),
  mason1 : new Mason(),
  mason2 : new Mason(),
  seer : new Seer(),
  robber : new Robber(),
  troublemaker : new Troublemaker(),
  drunk : new Drunk(),
  insomniac : new Insomniac(),
  villager1 : new Villager(),
  villager2 : new Villager(),
  villager3 : new Villager(),
  hunter : new Hunter(),
  tanner : new Tanner()
}
