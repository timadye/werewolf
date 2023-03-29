downloadObject = function(obj, name=null) {
  const a = document.createElement('a');
  const data = JSON.stringify(obj, undefined, 2);
  a.href = URL.createObjectURL( new Blob([data], { type:'text/json' }) );
  a.download = (name||"werewolf")+".json";
  a.click();
}

downloadAll = function() { downloadGame(true); }
downloadVillage = function() { downloadGame(false); }

downloadGame = function(all) {
  var villageName = null;
  if (!all) {
    const game = getCurrentGame();
    if (game) villageName = game.name;
  }
  const callback = (error, obj) => {
    if (error) {
      reportError("download failed");
    } else {
      if (debug >= 1) {
        info = Object.entries(obj).flatMap(([k,v])=>(k!="villageName" && Array.isArray(v) ? [`${v.length} ${k}`] : [])).join(", ");
        if (obj.villageName === null) {
          console.log (`download everything as a JSON file: ${info}`);
        } else {
          console.log (`download '${obj.villageName}' as a JSON file: ${info}`);
        }
      }
      downloadObject (obj, villageName);
    }
  };
  if (all) {
    Meteor.call ('downloadAll', Session.get('adminPassword'), callback); 
  } else {
    Meteor.call ('downloadHistory', villageName, callback);
  }
}
