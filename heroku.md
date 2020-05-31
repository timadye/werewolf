To install on Heroku, followed some instructions here:
https://medium.com/@leonardykris/how-to-run-a-meteor-js-application-on-heroku-in-10-steps-7aceb12de234

Created nodejs app at http://heroku.com/ linked to GitHub repo https://github.com/timadye/werewolf

```
heroku login -i
heroku git:remote --app oxford-werewolf
heroku apps:info   # should show info for oxford-werewolf by default after git remote is set
heroku buildpacks:set https://github.com/AdmitHub/meteor-buildpack-horse.git
heroku addons:create mongolab:sandbox

heroku config   # shows MONGODB_URI to set MONGO_URL in next command
heroku config:add MONGO_URL=<MONGODB_URI>
heroku config:add ROOT_URL=https://oxford-werewolf.herokuapp.com
```
