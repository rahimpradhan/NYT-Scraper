var express = require("express");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

// Our scraping tools
// Axios is a promised-based http library, similar to jQuery's Ajax method
// It works on the client and on the server
var axios = require("axios");
var cheerio = require("cheerio");
var request = require("request");

// Require all models
var db = require("./models");
var Note = require("./models/Note.js")
var Article = require("./models/Article.js")

var PORT = 3000;

// Initialize Express
var app = express();

// Configure middleware

// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect("mongodb://localhost/nytscraper", {
  useMongoClient: true
});

//Routes 
app.get("/", function (req, res) {

  db.Article.find({}, function (err, doc) {

    console.log(doc);
    res.render('index', {
      doc: doc
    });

  })
});

// A GET route for scraping the NY Times website
app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  axios.get("http://www.nytimes.com/").then(function(response) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(response.data);
   console.log(response.data);
    // Now, we grab every h2 within an article tag, and do the following:
    $("article").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("h2")
        .text();
      result.summary = $(this)
        .children(".summary")
        .text();
      result.link = $(this)
        .children("h2")
        .children("a")
        .attr("href");
      
      var entry = new Article(result);

        entry.save(function(err,doc){
          });
     });
  });
 
  Article.find({}, function (err, doc) {
    // log any errors
    if (err) {
      console.log(err);
    }
    // once scrape button is pressed, redirect to main page
    else {
      res.redirect("/");
    }
  });
 });

app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article
    .find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article
    .findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note
    .create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

app.get('/delete', function (req, res) {
  // grab every doc in the Articles array
  Article.remove({}, function (err, doc) {
    // log any errors
    if (err) {
      console.log(err);
    }
    // once delete button is pressed, redirect to main page
    else {
      res.redirect("/");
    }
  });
});

// replace the existing note of an article with a new one
// or if no note exists for an article, make the posted note it's note.
app.post('/articles/:id', function(req, res){
  // create a new note and pass the req.body to the entry.
  var newNote = new Note(req.body);

  // and save the new note the db
  newNote.save(function(err, doc){
    // log any errors
    if(err){
      console.log(err);
    } 
    // otherwise
    else {
      // using the Article id passed in the id parameter of our url, 
      // prepare a query that finds the matching Article in our db
      // and update it to make it's lone note the one we just saved
      Article.findOneAndUpdate({'_id': req.params.id}, {'note':doc._id})
      // execute the above query
      .exec(function(err, doc){
        // log any errors
        if (err){
          console.log(err);
        } else {
          // or send the document to the browser
          res.send(doc);
        }
      });
    }
  });
});


// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
