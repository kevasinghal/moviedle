const portNumber = process.argv[2];
const http = require("http");
const path = require("path");

const express = require("express"); /* Accessing express module */
const app = express(); /* app is a request handler function */
const bodyParser = require("body-parser"); /* To handle post parameters */

require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = {db: "CMSC335_Final", collection:"userScores"};
const { MongoClient, ServerApiVersion } = require('mongodb');
let uScore = 0;

async function add(name, right, wrong){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        let user = {name: name, correct: right, incorrect: wrong};
        await insertUser(client, databaseAndCollection, user);

    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
async function insertUser(client, databaseAndCollection, newUser) {
  const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(newUser);
}

async function lookup(name) {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        return await lookUpOneEntry(client, databaseAndCollection, name);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
async function lookUpOneEntry(client, databaseAndCollection, movieName) {
  let filter = {name: movieName};
  const result = await client.db(databaseAndCollection.db)
                      .collection(databaseAndCollection.collection)
                      .findOne(filter);

 if (result) {
     return result;
 } else {
    return "NONE";
 }
}

async function update(name, right, wrong){
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
   
    try {
        await client.connect();
        let newValues = {correct: right, incorrect: wrong};
        let targetName = name;
        await updateOne(client, databaseAndCollection, targetName, newValues)
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
async function updateOne(client, databaseAndCollection, targetName, newValues) {
  let filter = {name : targetName};
  let update = { $set: newValues };

  const result = await client.db(databaseAndCollection.db)
  .collection(databaseAndCollection.collection)
  .updateOne(filter, update);

}

async function findUsers() {
  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    try {
        await client.connect();
        let filter = {};
        const cursor = client.db(databaseAndCollection.db)
        .collection(databaseAndCollection.collection)
        .find(filter);
        
        const result = await cursor.toArray();
        return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

const API_KEY = 'api_key=1cf50e6248dc270629e802686245c2c8';
const BASE_URL = 'https://api.themoviedb.org/3';
const API_URL = BASE_URL + '/movie/popular?language=en-US&' + API_KEY;

async function movie(){
  const result = await fetch('https://api.themoviedb.org/3/movie/popular?language=en-US&api_key=1cf50e6248dc270629e802686245c2c8');
  const json = await result.json();
  return getRandomMovieName(json.results);
}

function getRandomMovieName(data) {
    const movie = data[(Math.floor(Math.random() * data.length))];
    return movie;
}

console.log(`Web server started and running at http://localhost:${portNumber}`);

const prompt = "Type stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  const dataInput = process.stdin.read();
  if (dataInput !== null) {
    if (dataInput.toString().trim() == "stop") {
        console.log("Shutting down the server");
        process.exit(0);  /* exiting */
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended:false}));

app.get("/", (request, response) => { 
    response.render("index");
});
app.get("/guess", async (request, response) => { 
  let m = await movie();
  console.log(m);
  uScore = m.vote_average;
  let i = 'https://image.tmdb.org/t/p/w500' + m.poster_path;

  const variables = { 
    file: `https://moviedle.onrender.com/processGuess`,
    img: i
  };
  response.render("guess", variables);
});
app.get("/scores", async (request, response) => { 
  let result = await findUsers();
  let table = "<table border='1'><tr><th>NAME</th><th>CORRECT</th><th>INCORRECT</th></tr>";    
  result.forEach(app => { table += "<tr><td>" + app.name + "</td><td>" + app.correct + "</td><td>" + app.incorrect + "</td></tr>"; });
  table += "</table>";
  const variables = { 
    itemsTable: table
  };
  response.render("scores", variables);
});

app.post("/processGuess", async (request, response) => { 
  let result = "wrong";
  let {name, guess} = request.body;
  let guess_num = Number(guess);
  let diff = Math.abs(uScore - guess_num);
  let points = 100 - (diff / 0.1);
  if(points > 95) {
    result = "correct";
  }
  let find = await lookup(name);

  if (find == "NONE") {
    await add(name, result == "correct" ? 1 : 0, result == "wrong" ? 1 : 0);
  } else {
    await update(name, result == "correct" ? find.correct + 1 : find.correct, result == "wrong" ? find.incorrect + 1 : find.incorrect);
  }

  const variables = { 
    info: result,
    ogscore: uScore,
    uguess: guess_num
  };
  response.render("processGuess", variables);
});
app.listen(portNumber);