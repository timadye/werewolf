routes = function() {

  FlowRouter.route('/', {
    name: 'start',
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
    name: 'lobby',
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}`);
      // if (Object.keys(queryParams) != 0) {
      //   q = Object.entries(queryParams).map(([k,v]) => k+(v==""?"":"="+v)).join("&");
      //   if (debug >= 1) console.log(`route /${gameName}?${q} -> village '${gameName}'`);
      // } else
      setPassword(queryParams.p);
      const currentView = Session.get("currentView");
      if (!currentView || currentView == "startMenu" || currentView == "historyIndex" || currentView == "historyEntry") {
        newView = "lobby";
      } else {
        newView = null;
      }
      routed (newView, params.gameName);
  }
  });

  FlowRouter.route('/:gameName/:playerName', {
    name: 'ingame',
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}/${params.playerName}`);
      setPassword(queryParams.p);
      const gameName = params.gameName;
      if (params.playerName == "~history") {  // handle ambiguous route
        routed ('historyIndex', gameName, null, (onReady) => pastGamesSubscribe(onReady, gameName));
        return;
      }
      const currentView = Session.get("currentView");
      if (!currentView || currentView == "startMenu" || currentView == "historyIndex" || currentView == "historyEntry") {
        newView = "lobby";
      } else {
        newView = null;
      }
      routed (newView, gameName, params.playerName);
    }
  });

  FlowRouter.route('/:gameName/~history/:historyID', {
    name: 'history',
    action: (params, queryParams) => {
      if (debug >= 1) console.log(`route /${params.gameName}/~history/${params.historyID}`);
      setPassword(queryParams.p);
      const historyID = params.historyID;
      routed ('historyEntry', params.gameName, null, (onReady) => historySubscribe(onReady, historyID));
    }
  });

}
