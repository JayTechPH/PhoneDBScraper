// Load required packages
const mongoose = require('mongoose');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const https = require('https');
const agent = new https.Agent({ keepAlive: true });
require('dotenv').config();
const pLimit = require('p-limit').default;
const fs = require('fs');
const path = require('path');

const requestLimit = Number(process.env.REQUEST_LIMIT) || 20;; // Number of concurrent requests
const mongoDbUrl = process.env.MONGO_DB;
const pipeline = require('./pipeline');
const downloadImage = Boolean(process.env.DOWNLOAD_IMAGES);
const filterData = Boolean(process.env.FILTER_DATA);

// Ignore SSL certificate errors
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Connect to MongoDB using .env variable
mongoose.connect(mongoDbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;

// Flexible schema (accept any fields)
let phoneSchema;
let Phone;

// Device ID range to scrape
let max = 0;
let limit = pLimit(requestLimit);

async function initialize() {
    const res = await fetch('https://phonedbscraper-default-rtdb.firebaseio.com/pdbs-config.json');
    const json = await res.json();
    max = 30;
    // max = json.max || 10000;
    if (!json.max) {
        console.warn('Warning: Could not fetch max device ID from config, defaulting to 10000');
    } else {
        console.log(`Configured to scrape up to device ID: ${max}`);
        console.log(`Last update: ${json["last-update"]}`);
    }
}

// Add phone to DB if not exists
async function addPhone(data) {
    const result = await Phone.updateOne(
        { deviceId: data.deviceId },
        { $setOnInsert: data },
        { upsert: true }
    );

    if (result.upsertedCount > 0) {
        console.log(`Added device ${data.deviceId}`);
    } else {
        console.log(`Skipped device ${data.deviceId}`);
    }
}

// Scrape phone data by ID
async function scrapePhoneData(id) {
    try {
        // Fetch page HTML
        const response = await fetch(`https://phonedb.net/index.php?m=device&id=${id}`, { agent });
        const html = await response.text();
        const $ = cheerio.load(html);

        const data = {};

        // Get device image
        let imgSrc = $('body > div:nth-child(7) > div.sidebar > div:nth-child(2) > a > img').attr('src');
        if (imgSrc && !imgSrc.startsWith('http')) {
            imgSrc = 'https://phonedb.net/' + imgSrc.replace(/^\//, '');
        }

        if ($('tr').length === 0) return;
        // Read table rows (key/value)
        $('tr').each((i, row) => {
            const keyTd = $(row).find('td').first();
            const valueTd = $(row).find('td').eq(1);

            if (keyTd.length && valueTd.length) {
                let key = keyTd.text().trim().replace(/\s+/g, ' ');
                let value = valueTd.text().trim().replace(/\s+/g, ' ');

                if (key && value) {
                    data[key] = value;
                }
            }
        });

        // Normalize important fields
        data.deviceId = data['Device ID'] || `device_${id}`;
        data.codename = data['Codename'] || null;
        data.image = imgSrc || null;

        // Save to database
        await addPhone(data);
    } catch (error) {
        console.error(`Error scraping ${id}:`, error.message);
    }
}

// Filter raw data and save to new collection
async function runPipelineAndSave() {
    try {
        console.log('Running aggregation pipeline...');

        // Run your pipeline on Phone collection
        const results = await Phone.aggregate(pipeline);
        console.log(`Pipeline produced ${results.length} documents.`);

        // Save results to new collection "PhonesFiltered"
        const PhonesFiltered = mongoose.model('PhonesFiltered', new mongoose.Schema({}, { strict: false }));

        // Upsert each result (optional: or insertMany for bulk)
        await PhonesFiltered.deleteMany({}); // clear existing filtered collection
        await PhonesFiltered.insertMany(results);

        console.log('Saved filtered phones to collection "PhonesFiltered"');
    } catch (err) {
        console.error('Error running pipeline:', err.message);
    }
}

async function downloadAllImages() {
    console.log("Downloading images...");

    const folder = path.join(__dirname, 'images');
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

    const phonesWithImages = await Phone.find({ image: { $ne: null } });

    const downloadLimit = pLimit(requestLimit);

    const tasks = phonesWithImages.map(phone =>
        downloadLimit(async () => {
            try {
                const url = phone.image;
                const filename = path.basename(url.split('?')[0]); // gets 'bbk_vivo_x100_ultra_2.jpg'
                const filepath = path.join(folder, filename);

                if (fs.existsSync(filepath)) return;

                const response = await fetch(url, { agent });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const buffer = await response.buffer();
                fs.writeFileSync(filepath, buffer);

                console.log(`Downloaded ${filename}`);
            } catch (err) {
                console.error(`Failed to download ${phone.deviceId}:`, err.message);
            }

        })
    );

    await Promise.all(tasks);

    console.log("Image download completed.");
}


// Run scraper sequentially
async function scraperInstance() {
    await initialize();
    const tasks = [];
    for (let i = 1; i <= max; i++) {
        tasks.push(
            limit(() => scrapePhoneData(i))
        );
    }
    await Promise.all(tasks);
    if (filterData) await runPipelineAndSave();
    if (downloadImage) await downloadAllImages();

    mongoose.disconnect();
    console.log('Scraping finished!');
}

db.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

db.once('open', () => {
    phoneSchema = new mongoose.Schema({}, { strict: false });
    Phone = mongoose.model('Phone', phoneSchema);

    console.log('MongoDB connected successfully!');
    // Start the scraper only after MongoDB is connected
    scraperInstance();
});
