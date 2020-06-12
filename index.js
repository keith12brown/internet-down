#!/usr/local/bin/node

const fetch = require('node-fetch');

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;

const sleep = require('util').promisify(setTimeout);

require('dotenv').config();

const notifier = require('node-notifier');

const sendNotification = (title, message) => {
    console.log(`${title} ${message}`);
    notifier.notify({
        title: title,
        message: message,
        wait: true
    }, (err, response) => {
        if (err) {
            console.log(`notification error ${err}`)
        } 
        if (response) {
            console.log(`notification response ${response}`);
        }
    });
}

function insertUpdateError(db) {
    this.id = {};
    this.attempts = 0;
    this.db = db;

    this.save = function (errorMessage) {
        const date = new Date();
        if (this.attempts === 0) {
            this.id = new ObjectID();
            sendNotification('No internet access', date.toLocaleDateString());
        }

        this.db.collection(process.env.MONGO_COLLECTION).updateOne(
            { _id: this.id },
            {
                $set: {
                    _id: this.id,
                    end: date,
                    attempts: ++this.attempts
                },
                $push: { messages: { time: date, message: errorMessage } },
                $setOnInsert: { start: date },
            },
            { upsert: true },
            (err, result) => {
                if (err) {
                    console.log(`error ${err}`);
                }
            });
    }
}

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

    const urls = process.env.URLS.split(',');

    const timeoutSeconds = (process.env.TIMEOUT_SECONDS || 60) * 1000;

    while (true) {
        var start = new Date();
        console.log(`start ${start}`);
        var saveError = new insertUpdateError(db);
        var lastIndex = -1;
        var index = 0
        while (true) {
            do {
                index = Math.floor(Math.random() * urls.length);
            } while(lastIndex === index);
            
            lastIndex = index;
            const url = urls[index];
            try {
                const response = await fetch(url, { timeout: timeoutSeconds });
                if (response.ok) {
                    break;
                }
                else {
                    throw { message: `${response.status} ${response.statusText}` };
                }
            } catch (err) {
                const errm = `${new Date()} ${err.message}`;
                console.error(errm);
                saveError.save(err.message);
            }
        }

        console.log(`end ${new Date()}`);

        await sleep(process.env.SLEEP_SECONDS * 1000);
    }
})()