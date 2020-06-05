#!/usr/local/bin/node

const fetch = require('node-fetch');

const MongoClient = require('mongodb').MongoClient;

const sleep = require('util').promisify(setTimeout);

require('dotenv').config();

(async () => {
    var db = {};
    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_URL,
            {
                useUnifiedTopology: true
            });

        console.log(`connected to ${client.s.url}`);

        db = client.db();
    } catch (err) {
        console.log(`failed connecting to ${process.env.DB_PATH}`);
        return;
    }

    const col = await db.collection(process.env.MONGO_COLLECTION);

    var start = {};

    const urls = process.env.URLS.split(',');

    while (true) {
        var haveError = false;
        var timeout = 30000;
        start = new Date();
        console.log(`start ${start}`);
        var errorMessages = [];
        var attempts = 0;
        while (true) {
            const index = Math.floor(Math.random() * urls.length);
            const url = urls[index];
            attempts++;
            try {
                const response = await fetch(url, { timeout: 30 * 1000 });
                if (response.ok && !haveError) {
                    break;
                } else if (response.ok && haveError) {
                    await db.collection(process.env.MONGO_COLLECTION).insertOne({
                        start: start,
                        end: new Date(),
                        attempts: attempts,
                        messages: errorMessages
                    });
                    haveError = false;
                }
                else {
                    throw { message: `${response.status} ${response.statusText}` };
                }
            } catch (err) {
                const errm = `${new Date()} ${err.message}`;
                console.error(errm);
                errorMessages.push({ time: new Date(), message: err.message });
                haveError = true;
            }
        }

        console.log(`end ${new Date()}`);

        await sleep(process.env.SLEEP_SECONDS * 1000);
    }
})()