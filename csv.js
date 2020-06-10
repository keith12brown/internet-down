
const MongoClient = require('mongodb').MongoClient;

const fs = require('fs');

const CSV_FILE ='./outages.csv';

require('dotenv').config();

if (fs.existsSync(CSV_FILE)) {
    fs.truncateSync(CSV_FILE);
}

( async () => {

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

    fs.appendFileSync(CSV_FILE, 'id,start,end,attempts,duration\n');

    var dataArray = await col.aggregate([
        {
            $project: {
                "_id": 1,
                start: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', timezone: "-06:00", date: "$start" } },
                end: { $dateToString: { format: '%Y-%m-%d %H:%M:%S', timezone: "-06:00", date: "$end" } },
                "attempts": 1,
                duration: { $divide: [{ $subtract: ["$end", "$start"] }, 1000] }
            }
        }
    ]).toArray();

    for(data of dataArray) {
        fs.appendFileSync(CSV_FILE, `${data._id},${data.start},${data.end},${data.attempts},${data.duration}\n`);
    }
    console.log('done');
    process.exit(0);
})();