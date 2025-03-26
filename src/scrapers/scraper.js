const axios = require("axios");
const cheerio = require("cheerio"); // for handling page html
const {BASE_URL} = require("../config/config");

let restockedProducts = {};
let currentPage = 1;
let outOfStockProductNames = [];

class Frontier {
  constructor() {
    this.queue = []; // hold links to visit
    this.seen = new Set(); // hold visited links
  }

  add(url) {
    if (!this.seen.has(url)) {
      this.queue.push(link);
      this.seen.add(url);
    }
  }

  next() {
      // will for now be the link attached to next page button
      return(this.queue.shift());
  }
}

// init frontier
const frontier = new Frontier();
frontier.add(`${BASE_URL}${currentPage}`); // seed URL

class Product {
  constructor(name, price, img, url) {
    // this is the info required for the restock alert
    this.name = name;
    this.price = price;
    this.img = img;
    this.url = url;
  }
}

async function scrapePage(url) {
  try {
    // fetch page data
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // TODO: Move this into the checkStock function
    // loop through all listed products to check stock
    $(".index_infoBlock__IG8h0 > div").each((index, element) => {
      const productElement = $(element);
      // extract product name
      const name = productElement.find(".index_itemUsTitle__7oLxa").text().trim();
      // extract product price
      const price = productElement.find(".index_itemPrice__AQoMy").text().trim();
      // extract product URL
      const relativeUrl = productElement.find("a").attr("href");
      const productUrl = relativeUrl ? new URL(relativeUrl, SEED_URL).href : "";
      // extract product image
      const imgElement = productElement.find(".index_itemImg__1J3x5 img");
      const imgUrl = imgElement.attr("src") || imgElement.attr("data-src");

      const product = new Product(name, price, imgUrl, productUrl);

      // NOTE: for now ignoring products that have gone out of stock
      const isOutOfStock = productElement.find(".index_tag__5TOhQ").text().includes("OUT OF STOCK");
      if (!isOutOfStock) {
        // if product in the list of products that were out of stock, it counts as a restock
        if(outOfStockProductNames.includes(name))
          restockedProducts[name] = product;
      }
    });

    // add next page to the frontier until reach end
    hasNextPage = $(".ant-pagination-next").attr("aria-disabled") !== "true";
    if (hasNextPage) {
      currentPage++;
      nextUrl = `${BASE_URL}${currentPage}`;
      frontier.add(nextUrl);
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
  }
}

async function checkStock(product) {
  try {
    // TODO: move logic to here
  } catch (error) {
    console.error("Error fetching product data:", error.message);
    return null;
  }
}

async function runScraper() {
  while (frontier.hasPending()) {
    const nextUrl = frontier.next();
    if(nextUrl) 
      await scrapePage(nextUrl);
  }

  return restockedProducts;
}

async function initScraper(outOfStockProductNames) {
  this.outOfStockProductNames = outOfStockProductNames;
  runScraper();
}

module.exports = { checkStock }; // make avail for other modules to use

