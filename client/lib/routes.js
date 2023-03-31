routes = function() {

  FlowRouter.route('/', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log("route /");
      setPassword(queryParams.p);
      routed ("startMenu");
    }
  });

  // FlowRouter.route('/:gameName/~history', {
  //   action: (params, queryParams) => {
  //     if (debug >= 1) console.log(`route /${params.gameName}/~history`);
  //     routed ('historyIndex', params.gameName);
  //   }
  // });

  FlowRouter.route('/:gameName', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}`);
      // if (Object.keys(queryParams) != 0) {
      //   q = Object.entries(queryParams).map(([k,v]) => k+(v==""?"":"="+v)).join("&");
      //   if (debug >= 1) console.log(`route /${gameName}?${q} -> village '${gameName}'`);
      // } else
      setPassword(queryParams.p);
      const currentView = Session.get("currentView");
      if (currentView == "lobby") {
        newView = null;
      } else if (!currentView || currentView == "startMenu" || currentView == "historyIndex" || currentView == "historyEntry") {
        newView = "lobby";
      } else {
        newView = "lateLobby";
      }
      routed (newView, params.gameName);
  }
  });

  FlowRouter.route('/:gameName/:playerName', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}/${params.playerName}`);
      if (params.playerName == "~history") {  // handle ambiguous route
        routed ('historyIndex', params.gameName);
        return;
      }
      const currentView = Session.get("currentView");
      if (!currentView || currentView == "startMenu" || currentView == "historyIndex" || currentView == "historyEntry") {
        newView = "lobby";
      } else {
        newView = null;
      }
      routed (newView, params.gameName, params.playerName);
    }
  });

  FlowRouter.route('/:gameName/~history/:historyID', {
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}/~history/${params.historyID}`);
      Session.set('historyEntry', params.historyID);
      routed ('historyEntry', params.gameName);
    }
  });

}
