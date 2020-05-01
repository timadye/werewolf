FlowRouter.route('/', {
  action: function(params, queryParams) {
    console.log("route /");
    BlazeLayout.render('main');
    Session.set("currentView", "startMenu");
  }
});

FlowRouter.route('/:villageName', {
  action: function(params, queryParams) {
    var villageName = params.villageName;
    console.log(`route /${villageName} -> villageName=${villageName}`);
    BlazeLayout.render('main');
    Session.set("urlVillage", villageName);
    Session.set("currentView", "lobby");
  }
});
