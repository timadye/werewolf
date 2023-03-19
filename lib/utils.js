// utils.js - JavaScript utility functions.
// Use import 'utils.js' to include the definitions in your global namespace.
// We use func=function(){} instead of function func(){} so they don't have to all be imported by name.

// shuffleArray returns a NEW array
shuffleArray = function (array, npick=array.length, remove=false) {
  var copy = remove ? array : array.slice();
  var result = [];
  for (let i = 0; i < npick; i++) {
    result.push (copy.splice (Math.floor(Math.random() * copy.length), 1)[0]);
  }
//  console.log ('shuffleArray ->', result);
  return result;
}

// Initialise object with keys
initObject = function (keys, init=[]) {
  var obj = {};
  for (const key of keys) {
    if (Array.isArray(init)) {
      obj[key] = init.slice();
    } else {
      obj[key] = Object.create (init);
    }
  }
  return obj;
}

// A keyArray has {key1:[val11,val12,...], key2:[val21,val22,...], ...} with an entry for each unique key
keyArrayFromEntries = function (entries, init={}) {
  var ret = init;
  for (const [key, value] of entries) {
    if (key === undefined || value === undefined) continue;
    (ret[key] || (ret[key]=[])) . push (value);
  }
  return ret;
}

// obj can be an Array or an object. Calls func(entry,index,object) and expects [key,value] return.
keyArrayMap = function (obj, func, init={}) {
  var ret = init;
  if (Array.isArray (obj)) {
    var iter = obj;
  } else {
    var iter = Object.entries (obj);
  }
  iter.forEach ((e,i,obj) => {
    const [k,v] = func(e,i,obj);
    if (k !== undefined && v !== undefined) {
      (ret[k] || (ret[k]=[])) . push (v);
    }
//    console.log ('keyArrayMap: add',e,'->',[k,v],'->',ret[k]);
  });
  return ret;
}

// adds one entry to a keyArray.
keyArrayAdd = function (obj, key, value) {
  if (key === undefined || value === undefined) return null;
  let a = (obj[key] || (obj[key]=[]));
  a.push (value);
  return a;
}

// Creates an object with entries mapped from an input array's or object's elements.
// Calls func(entry,index,object) and expects a returned object {k:v} which is added to the return.
objectMap = function (obj, func, init={}) {
  var ret= init;
  if (Array.isArray (obj)) {
    var iter = obj;
  } else {
    var iter = Object.entries (obj);
  }
  iter.forEach ((e,i,obj) => {
    const r = func(e,i,obj);
    if (r) Object.assign (ret, r);
//    console.log ('objectMap: add',e,'->',r,'->',ret);
  });
  return ret;
}
