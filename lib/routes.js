Router.route('/', function () {
  this.render('main');
  Session.set("currentView", "startMenu");
});

Router.route('/:villageName', function () {
  var villageName = this.params.villageName;
  this.render('main');
  Session.set("urlVillage", villageName);
  Session.set("currentView", "lobby");
});
