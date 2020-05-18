allRoles = {
  werewolf_1 : {
    name: 'Werewolf',
    type: 'werewolf',
    index: 0,
    dark: true,
    deck: 'roles',
    fellows: 'werewolf',
    order: 3
  },
  werewolf_2 : {
    name: 'Werewolf',
    type: 'werewolf',
    index: 1,
    dark: true,
    deck: 'roles',
    fellows: 'werewolf',
    order: 3
  },
  werewolf_3 : {
    name: 'Werewolf',
    type: 'werewolf',
    index: 2,
    dark: true,
    deck: 'roles',
    fellows: 'werewolf',
    order: 3
  },
  werewolf_vigilante : {
    name: 'Werewolf Vigilante',
    type: 'werewolf',
    index: 3,
    dark: true,
    deck: 'roles',
    vigilante: true,
    fellows: 'werewolf',
    order: 3
  },
  darkVillager : {
    name: 'Dark Villager',
    type: 'darkVillager',
    dark: true,
    deck: 'roles',
    fellows: 'werewolf',
    order: 4
  },
  wolfsbane : {
    name: 'Wolfsbane',
    type: 'wolfsbane',
    dark: false,
    deck: 'roles',
    order: 6
  },
  trapper : {
    name: 'Trapper',
    type: 'trapper',
    dark: false,
    deck: 'roles',
    order: 7
  },
  seer : {
    name: 'Seer',
    type: 'seer',
    index: 0,
    dark: false,
    deck: 'roles',
    unreliable: false,
    order: 8
  },
  seer_unreliable: {
    name: 'Unreliable Seer',
    type: 'seer',
    index: 1,
    dark: false,
    deck: 'roles',
    unreliable: true,
    order: 8
  },
  vigilante : {
    name: 'Vigilante',
    type: 'vigilante',
    index: 0,
    dark: false,
    deck: 'roles',
    vigilante: true,
    order: 9
  },
  mayor : {
    name: 'Mayor',
    type: 'mayor',
    dark: false,
    deck: 'roles',
    order: 10
  },
  cultist_1 : {
    name: 'Cultist',
    type: 'cultist',
    index: 0,
    dark: false,
    deck: 'roles',
    fellows: 'cultist',
    order: 15
  },
  cultist_2 : {
    name: 'Cultist',
    type: 'cultist',
    index: 1,
    dark: false,
    deck: 'roles',
    fellows: 'cultist',
    order: 15
  },
  cultist_3 : {
    name: 'Cultist',
    type: 'cultist',
    index: 2,
    dark: false,
    deck: 'roles',
    fellows: 'cultist',
    order: 15
  },
  cultist_4 : {
    name: 'Cultist',
    type: 'cultist',
    index: 3,
    dark: false,
    deck: 'roles',
    fellows: 'cultist',
    order: 15
  },
  lovers_1 : {
    name: 'Lover Pair',
    type: 'lovers',
    index: 0,
    deck: 'lovers',
    number: 2,
    fellows: 'lover',
    order: 17
  },
  lovers_2 : {
    name: 'Lover Pair',
    type: 'lovers',
    index: 1,
    deck: 'lovers',
    number: 2,
    fellows: 'lover',
    order: 17
  },
  lovers_triad : {
    name: 'Lover Triad',
    type: 'lovers',
    index: 2,
    deck: 'lovers',
    number: 3,
    fellows: 'lover',
    order: 18
  },
  rivals : {
    name: 'Rival Pair',
    type: 'rivals',
    deck: 'lovers',
    number: 2,
    fellows: 'rival',
    order: 17
  },
};

roleInfo = function (name) {
  return name ? (allRoles[name] || {
    name: 'Ordinary Villager',
    type: 'villager',
    dark: false,
    deck: 'roles',
    order: 20
  }) : {
    name: 'Zombie',
    type: 'zombie',
    dark: false,
    deck: 'roles',
    order: 999
  };
}
