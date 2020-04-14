const keys = require('./keys');

// EXPRESS APP SETUP
const express = require('express');

const bodyParser = require('body-parser');

const cors = require('cors');

const app = express();

app.use(cors());

app.use(bodyParser.json());

// POSTGRES CLIENT SETUP
const { Pool } = require('pg');

const pgClient = Pool({
    user : keys.pgUser,
    host : keys.pghost,
    database : keys.pgDatabase,
    password : keys.pgPassword,
    port : keys.pgPort
});

pgClient.on('error', ()=> console.log('Lost PG Connection'));

pgClient.query('CREATE TABLE IF NOT EXISTS values(number INT)')
        .catch((error) => {
            console.log(error);
        });


// REDIS CLIENT SETUP
const redis = require('redis');

const redisClient = redis.createClient({
    host : keys.redisHost,
    port: keys.redisPort,
    retry_strategy : () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route Handler

app.get('/', (request, response) =>{
    response.send('HI');
})

app.get('/values/all', async(request, response)=>{

    const values = await pgClient.query('SELECT * from values');

    response.send(values.rows);

});


app.get('/values/current', async(request, response) =>{

    redisClient.hgetall('values', (error, values) => {
        response.send(values);
    });

});


app.post('/values', async (request, response) => {
    const index = request.body.index;

    if(parseInt(index) > 40){
        return response.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing Yet');
    redisPublisher.publish('insert', index);
    pgClient.query(`INSERT INTO values(number) VALUES($1)`, [index]);

    response.send({ working : true});

});


app.listen(5000, error => {
    console.log('Listening');
})
