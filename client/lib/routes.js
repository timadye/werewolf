routes = function() {

  FlowRouter.route('/', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log("route /");
      Session.set('gameID', null);
      setPassword(queryParams.p);
      routed ("startMenu");
    }
  });

  FlowRouter.route('/:villageName/~history', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.villageName}/~history`);
      routed ('historyIndex', params.villageName);
    }
  });

  FlowRouter.route('/:villageName/~history/:historyID', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.villageName}/~history/${params.historyID}`);
      Session.set('historyEntry', params.historyID);
      routed ('historyEntry', params.villageName);
    }
  });

  FlowRouter.route('/:villageName', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.villageName}`);
      // if (Object.keys(queryParams) != 0) {
      //   q = Object.entries(queryParams).map(([k,v]) => k+(v==""?"":"="+v)).join("&");
      //   if (debug >= 1) console.log(`route /${villageName}?${q} -> village '${villageName}'`);
      // } else
      setPassword(queryParams.p);
      const currentView = Session.get("currentView");
      if (!currentView || currentView == "startMenu" || currentView == "historyIndex" || currentView == "historyEntry" || currentView == "lobby") {
        newView = "lobby";
      } else {
        newView = "lateLobby";
      }
      routed (newView, params.villageName);
  }
  });

}
