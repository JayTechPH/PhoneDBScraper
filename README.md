<p align="center"> <img width="250" height="250" src="https://media.tenor.com/nJCX4ZuO4OkAAAAi/dancing-dance-moves.gif"> </p> <h1 align="center">PhoneDB Scraper</h1><p align="center"> <b>PhoneDB Scraper</b> is a tool to scrape data from <b>phonedb.net</b> </p> <p align=center> <a href="https://github.com/JayTechPH"><img src="https://img.shields.io/badge/Author-JayTechPH-red.svg?style=for-the-badge&label=Author" /></a> <img src="https://img.shields.io/badge/Version-0.1-brightgreen?style=for-the-badge" > <img src="https://img.shields.io/github/stars/JayTechPH/PhoneDBScraper?style=for-the-badge"> <img src="https://img.shields.io/github/followers/JayTechPH?label=Followers&style=for-the-badge"> </p> 

* **If you like the tool and for my personal motivation so as to develop other tools please leave a +1 star**

PhoneDB Scraper is a **Node.js tool** that scrapes mobile phone specifications from **phonedb.net** and stores the data in **MongoDB**.
It supports concurrent scraping, data filtering using aggregation pipelines, and optional image downloading.

---

## Features

* Scrape phone specs by device ID
* Store raw data in MongoDB
* Prevent duplicate entries (upsert)
* Resume scraping from last retrieved ID
* Run MongoDB aggregation pipeline to filter data
* Optional image downloading
* Configurable concurrency limit

---

## Requirements

* Node.js v18+
* MongoDB
* npm or yarn

---

## Installation

Clone the repository:

```bash
git clone https://github.com/JayTechPH/PhoneDBScraper.git
cd PhoneDBScraper
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the root folder:

```env
MONGO_DB=mongodb://localhost:27017/phonedb(setup mongo db before using)
REQUEST_LIMIT=10
LAST_RETRIEVED=1
DOWNLOAD_IMAGES=false
FILTER_DATA=false
```

### Environment Options

| Variable        | Description                           |
| --------------- | ------------------------------------- |
| MONGO_DB        | MongoDB connection string             |
| REQUEST_LIMIT   | Number of concurrent requests         |
| LAST_RETRIEVED  | Resume scraping from this ID          |
| DOWNLOAD_IMAGES | Download phone images (true/false)    |
| FILTER_DATA     | Run aggregation pipeline (true/false) |

---

## Usage

Start the scraper:

```bash
node index.js
```

The script will:

1. Connect to MongoDB
2. Scrape phone data from PhoneDB
3. Save new devices only
4. Update `LAST_RETRIEVED` automatically
5. Optionally filter data and download images

---

## Database Collections

* **phones** – raw scraped data
* **phonesfiltered** – processed data after pipeline (optional)

---

## Image Downloading

If enabled, images will be saved to:

```
/images
```

Already downloaded images are skipped.

---

## Aggregation Pipeline

Filtered data uses a MongoDB aggregation pipeline defined in:

```
pipeline.js
```

You can customize it to shape your final dataset.

---

## Notes

* SSL verification is disabled for scraping
* Scraping speed depends on `REQUEST_LIMIT`
* Designed for educational and research purposes

---

## Disclaimer

This project is for **educational use only**.
Use responsibly and respect website terms of service.

---

## License 
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
