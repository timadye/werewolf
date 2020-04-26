FlowRouter.route('/', {
  action: function(params, queryParams) {
    console.log("route /");
    BlazeLayout.render('main');
    Session.set("currentView", "startMenu");
  }
});

FlowRouter.route('/:accessCode', {
  action: function(params, queryParams) {
    var accessCode = params.accessCode;
    console.log(`route /${accessCode} -> accessCode`);
    BlazeLayout.render('main');
    Session.set("urlAccessCode", accessCode);
    Session.set("currentView", "joinGame");
  }
});
