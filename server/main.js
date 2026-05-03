console.log('Server running');

import { collections } from '/lib/collections.js';
collections();

import { server_startup } from '/server/lib/startup.js';
server_startup();

import { observe } from '/server/lib/observe.js';
observe();
