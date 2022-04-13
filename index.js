const express = require("express");
const app = express();
require('dotenv').config()

app.use(express.json())
app.use(express.urlencoded({extended: true}));

const moment = require("moment")

const fetch = require("node-fetch")

const { Deta } = require("deta");

const deta = Deta(process.env.projectkey);
const db = deta.Base("songs");

const { auth, requiresAuth } = require('express-openid-connect');
const config = {
  authRequired: false,
  auth0Logout: true,
  secret: 'thisisthesecret54321',
  baseURL: 'https://onesong.eddiecoldrick.com',
  clientID: '2Nbm68ETSXYbvdHUNSAUBKRwPWk60cep',
  issuerBaseURL: 'https://pi4li.eu.auth0.com',
  routes: {
    login: "/admin/login",
    callback: "/admin/callback",
    logout: "/admin/logout",
    postLogoutRedirect: '/',
  },
};

app.use(auth(config));
app.get('/admin/profile', requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user));
  });

var SpotifyWebApi = require('spotify-web-api-node');

var spotifyApi = new SpotifyWebApi({
  clientId: process.env.spotifyclientid,
  clientSecret: process.env.spotifyclientsec
});

let expiresin;
function auththing(){
spotifyApi.clientCredentialsGrant().then(
    function(data) {
      expiresin = data.body['expires_in']
      console.log('The access token expires in ' + data.body['expires_in']);
      console.log('The access token is ' + data.body['access_token']);
  
      // Save the access token so that it's used in future calls
      spotifyApi.setAccessToken(data.body['access_token']);
    },
    function(err) {
      console.log('Something went wrong when retrieving an access token', err);
    }
  ).then(function(){
    setInterval(function() {
      auththing()
    }, expiresin*1000)
  }
  );
}

auththing();

app.set('view engine', 'ejs');

app.get("/", async (request, response) => {
    var json = (await db.fetch({}).next()).value
    json.sort(function(a, b) {
        return parseFloat(b.timestamp) - parseFloat(a.timestamp);
    });
    if(json[0]){
    if (moment(json[0].timestamp).isSame(moment(new Date()), 'd')) {
        spotifyApi.getTrack(json[0].songid)
  .then(async function(data) {
      var spotifyid = data.body.id;
      var imageurl = data.body.album.images[0].url;
      var songname = data.body.name;
      var artistname = data.body.artists[0].name;
      const response2 = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getInfo&api_key=${process.env.lastfmapi}&artist=${artistname}&track=${songname}&format=json`);
      const data2 = await response2.json();
      var datething = moment(json[0].timestamp).format("DD/MM/YYYY HH:mm")
      response.render(__dirname+"/views/index.ejs", {date:datething, id:spotifyid, image:imageurl,song:songname,artist:artistname, genres:data2.track.toptags.tag})
  }, function(err) {
    console.error(err);
  });
    } else {
        response.render(__dirname + "/views/index.ejs", {id:null});
    }
}else{
    response.render(__dirname + "/views/index.ejs", {id:null});
}
});

app.get("/admin/add", requiresAuth(), async (request, response) => {
        var json = (await db.fetch({}).next()).value
    json.sort(function(a, b) {
        return parseFloat(b.timestamp) - parseFloat(a.timestamp);
    });
    var number = 0;
    var songs = []
    json.forEach((element)=>{
        number = number+1
        if(number == json.length){
            spotifyApi.getTrack(element.songid)
            .then(async function(data) {
                var songname = data.body.name;
                var artistname = data.body.artists[0].name;
                songs.push({"songname": songname, "artistname": artistname, "date":moment(element.timestamp).format("DD/MM/YYYY HH:mm")})
                response.render(__dirname + "/views/add.ejs", {songs:songs});
              })
        }else{
            spotifyApi.getTrack(element.songid)
            .then(async function(data) {
                var songname = data.body.name;
                var artistname = data.body.artists[0].name;
                songs.push({"songname": songname, "artistname": artistname, "date":moment(element.timestamp).format("DD/MM/YYYY HH:mm")})
              })
        }
    })
  });

app.post("/admin/add", requiresAuth(), (req,res)=>{
    spotifyApi.searchTracks(req.body.term)
  .then(function(data) {
      var spotifyid = data.body.tracks.items[0].id;
      var imageurl = data.body.tracks.items[0].album.images[2].url;
      var songname = data.body.tracks.items[0].name;
      var artistname = data.body.tracks.items[0].artists[0].name;
      res.render(__dirname+"/views/searchres.ejs", {id:spotifyid, image:imageurl,song:songname,artist:artistname})
  }, function(err) {
    console.error(err);
  });
})

app.get("/admin/yesadd", requiresAuth(), async (req,res)=>{
    const song = await db.put({
        songid: req.query.id,
        timestamp: Date.now()
    })
    res.redirect("/")
})

const listener = app.listen(3033, () => {
  console.log("Your app is listening on port " + listener.address().port);
});