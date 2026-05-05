import { collections } from '/lib/collections.js'
import { server_startup } from '/server/lib/startup.js'
import { observe } from '/server/lib/observe.js'

collections();
server_startup();
observe();
