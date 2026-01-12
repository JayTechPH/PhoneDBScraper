const mongoose = require('mongoose');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
require('dotenv').config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // ignore SSL cert errors

// MongoDB connection
mongoose.connect(process.env.MONGO_DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const phoneSchema = new mongoose.Schema({}, { strict: false }); // flexible schema
const Phone = mongoose.model('Phone', phoneSchema);

const start = 23912;
const end   = 25167;
const url = 'https://phonedb.net/index.php?m=device&id=';

async function addPhone(data) {
    const { deviceId } = data;

    // Check if it already exists
    const exists = await Phone.findOne({ deviceId });
    if (exists) {
        console.log(`Skipping device ${deviceId}, already in database.`);
        return exists;
    }

    // Create new
    const phone = new Phone({
        deviceId,
        ...data
    });

    console.log(`Adding new device ${deviceId}`);
    await phone.save();
    return phone;
}



async function scrapePhoneData(id) {
    try {
        const response = await fetch(`${url}${id}`);
        const html = await response.text();
        const $ = cheerio.load(html);

        const data = {};
        let imgSrc = $('body > div:nth-child(7) > div.sidebar > div:nth-child(2) > a > img').attr('src');
        if (imgSrc && !imgSrc.startsWith('http')) {
            console.log
            imgSrc = 'https://phonedb.net/' + imgSrc.replace(/^\//, '');
        }

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

        // Map keys for deviceId, codename, and variant
        data.deviceId = data['Device ID'] || `device_${id}`; // fallback
        data.codename = data['Codename'] || null;
        data.image = imgSrc || null;

        await addPhone(data); // make sure to await
    } catch (error) {
        console.error(`Error scraping ${id}:`, error.message);
    }
}

// Sequential scraping to avoid overloading the server
(async () => {
    for (let i = start; i <= end; i++) {
        await scrapePhoneData(i);
    }
    mongoose.disconnect();
})();
