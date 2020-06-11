
const MongoClient = require('mongodb').MongoClient;

const fs = require('fs');

const CSV_FILE = './outages.csv';

require('dotenv').config();

if (fs.existsSync(CSV_FILE)) {
    fs.truncateSync(CSV_FILE);
}

fs.appendFileSync(CSV_FILE, 'id,start,end,attempts,duration\n');

MongoClient.connect(process.env.MONGO_DB_URL,
    { useUnifiedTopology: true },
    (err, client) => {
        if (err) {
            throw err;
        }
        console.log(`connected to ${client.s.url}`);

        var db = client.db();

        db.collection(process.env.MONGO_COLLECTION, (err, col) => {
            if (err) {
                throw err;
            }

            col.aggregate([
                {
                    $project: {
                        "_id": 1,
                        start: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', timezone: "-06:00", date: "$start" } },
                        end: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', timezone: "-06:00", date: "$end" } },
                        "attempts": 1,
                        duration: { $divide: [{ $subtract: ["$end", "$start"] }, 1000] }
                    }
                }
            ], (err, cursor) => {
                if (err) {
                    throw err;
                }

                cursor.on('close', () => {
                    client.close();
                    console.log('done');
                    process.exit(0);
                });

                cursor.forEach(data => {
                    if (data) {
                        fs.appendFile(CSV_FILE, `${data._id},${data.start},${data.end},${data.attempts},${data.duration}\n`, (err) => {
                            if (err) {
                                console.log(err);
                            }
                        });
                    }
                });
            });
        });
    });
    