# Oxford Werewolf

What exactly is _Werewolf?_ It's a game. It's another one of those [University of Oxford](http://www.ox.ac.uk/) experiences. As far as I can tell, Werewolf is the most purposefully complicated psychological thriller role-playing game ever invented. You may have played variations of it, or similar games like _Mafia_ elsewhere, but I assure you the Oxford version is different. The [roles and rules](doc/werewolf_online_rules.md) have been developing over at least the past fifty years. There are rumours that this version hatched from a cosmic egg laid by [_Helliconia_](https://en.wikipedia.org/wiki/Helliconia) author [Brian Aldiss](https://en.wikipedia.org/wiki/Brian_Aldiss). I can neither confirm nor deny that. Anyway, it is complicated, but worth it for the feeling of smug self-satisfaction you get when you do well at a difficult game developed by generations of Oxonian geniuses.

The code here is an attempt to capture that experience online. It is implemented in [Meteor](https://github.com/meteor/meteor)-[Blaze](https://github.com/meteor/blaze), inspired by [code for _One Night Ultimate Werewolf_](https://github.com/timadye/werewolf/tree/1n-werewolf) by [Katie Jiang](https://github.com/katiejiang/).

_Oxford Werewolf_ is a little rough around the edges, but we have found from many games that it works well in both face-to-face play and over Zoom.

* Compared to a human _Fate_ (which anyway is a contradiction in terms), it allows everyone to play and speeds up the night phase.
* It does require everyone to have access to a web browser (eg. on a smartphone), though it is possible for players to share devices using different browser tabs. Private information is only revealed when `Show Role` is selected.
* To start a game, type in a name for your group of players and press `Enter Village`. That will take you to a new page where you can set up the game. You can bookmark or share the URL to allow others to join your game straight away.
* You need to agree on the game setup before someone presses `Start Game`. You also need to agree when you go to sleep - again anyone can press the `Sleep` button, but it may simplify things to designate one player to do these common actions. They should only act when everyone agrees - or when any limit on the length of the day phase has expired.
* This app relies on the players to detect the end-game conditions - this can be a good role for dead players, who can follow the progress of the game by selecting `Show Fate's Secrets`.
* Occasionally, if there is a connection problem, a player may be thrown out of the game and taken back to the setup screen. From there, they can select their name and `Join Game`. If they are shown as a dead "lurker", then they can select `Rejoin` to return to the setup screen (being careful not to look at fate's secrets on the way).

This code is currently running here: https://oxford-werewolf.eu.meteorapp.com/ . Please note it it takes a minute to start up the first time.
