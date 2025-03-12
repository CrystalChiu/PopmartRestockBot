const axios = require("axios");
const cheerio = require("cheerio"); // for handling page html
const {SEED_URL, EXCLUDED_PRODUCTS} = require("./config");

async function checkStock() {
  try {
    // rescrape the pages

    // frontier obj: queue that holds urls to the page (might also have it store #? we'll see)
  } catch (error) {
    console.error("Error fetching product data:", error.message);
    return null;
  }
}

module.exports = { checkStock }; // make avail for other modules to use
