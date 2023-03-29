routes = function() {

  FlowRouter.route('/', {
    action: (params, queryParams) => {
      console.log("route /");
      Session.set('gameID', null);
      if (queryParams.p) {
        setPassword(queryParams.p);
      }
      newView ("startMenu");
      BlazeLayout.render('main');
    }
  });

  FlowRouter.route('/:villageName/~history', {
    action: (params, queryParams) => {
      newView ('historyIndex');
      Session.set("urlVillage", params.villageName);
      BlazeLayout.render('main');
    }
  });

  FlowRouter.route('/:villageName/~history/:historyID', {
    action: (params, queryParams) => {
      newView ('historyEntry');
      Session.set("urlVillage", params.villageName);
      Session.set('historyEntry', params.historyID);
      BlazeLayout.render('main');
    }
  });

  FlowRouter.route('/:villageName', {
    action: (params, queryParams) => {
      const villageName = params.villageName;
      if (queryParams.p) {
        setPassword(queryParams.p);
      }
      // if (Object.keys(queryParams) != 0) {
      //   q = Object.entries(queryParams).map(([k,v]) => k+(v==""?"":"="+v)).join("&");
      //   if (debug >= 1) console.log(`route /${villageName}?${q} -> village '${villageName}'`);
      // } else
      if (debug >= 1) console.log(`route /${villageName} -> village '${villageName}'`);
      Session.set("urlVillage", villageName);
      const currentView = Session.get("currentView");
      if (!currentView) {
        newView ("lobby");
      } else if (currentView != "lobby") {
        newView ("lateLobby");
      }
      BlazeLayout.render('main');
    }
  });

}
