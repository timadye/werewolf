FlowRouter.route('/', {
  action: (params, queryParams) => {
    console.log("route /");
    Session.set('gameID', null);
    Session.set("currentView", "startMenu");
    BlazeLayout.render('main');
  }
});

FlowRouter.route('/:villageName', {
  action: (params, queryParams) => {
    const villageName = params.villageName;
    console.log(`route /${villageName} -> village '${villageName}'`);
    Session.set("urlVillage", villageName);
    if (Session.get("currentView") != "lobby")
      Session.set("currentView", "lateLobby");
    BlazeLayout.render('main');
  }
});
