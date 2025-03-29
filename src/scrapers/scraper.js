const axios = require("axios");
const cheerio = require("cheerio"); // for handling page html
const {BASE_URL} = require("../config/config");
const Product = require("../database/models/Products"); 

let restockedProducts = [];
let currentPage = 1;

class Frontier {
  constructor() {
    this.queue = []; // hold links to visit
    this.seen = new Set(); // hold visited links
  }

  add(url) {
    if (!this.seen.has(url)) {
      this.queue.push(url);
      this.seen.add(url);
    }
  }

  next() {
      // will for now be the link attached to next page button
      return(this.queue.shift());
  }

  hasPending() {
    return this.queue.size > 0;
  }
}

async function scrapePage(url, allProductsMap) {
  console.log("Scraping url: ", url);

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    await checkStock($, allProductsMap);

    const hasNextPage = $(".ant-pagination-next").attr("aria-disabled") !== "true";
    if (hasNextPage) {
      currentPage++;
      const nextUrl = `${BASE_URL}${currentPage}`;
      frontier.add(nextUrl);
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
  }
}

const checkStock = async ($, allProductsMap) => {
  $(".index_infoBlock__IG8h0 > div").each(async (index, element) => {
    const productElement = $(element);
    const name = productElement.find(".index_itemUsTitle__7oLxa").text().trim();
    const price = productElement.find(".index_itemPrice__AQoMy").text().trim();
    const relativeUrl = productElement.find("a").attr("href");
    const productUrl = relativeUrl ? new URL(relativeUrl, BASE_URL).href : "";
    const imgElement = productElement.find(".index_itemImg__1J3x5 img");
    const imgUrl = imgElement.attr("src") || imgElement.attr("data-src");

    console.log(name);
    console.log(productUrl);
    console.log(imgUrl);

    const isOutOfStock = productElement.find(".index_tag__5TOhQ").text().includes("OUT OF STOCK");
    const inStock = !isOutOfStock;

    let product = allProductsMap[name];

    if (!product) {
      console.log("DEBUG: added new product", product);
      // product doesnt exit, update db with new record
      product = new Product({
        name,
        price,
        img: imgUrl,
        url: productUrl,
        inStock,
      });
    } else {
      if (!product.inStock && inStock) {
        restockedProducts.add(product);
      }
      product.inStock = inStock;
    }

    await product.save();
  });
};

async function runScraper() {
  console.log("Scraper running...");
  
  // init frontier
  const frontier = new Frontier();
  console.log(`${BASE_URL}${currentPage}`);
  frontier.add(`${BASE_URL}${currentPage}`); // seed URL

  const allProducts = await Product.find();
  const allProductsMap = allProducts.reduce((acc, product) => {
    acc[product.name] = product;  // map product name to product object
    return acc;
  }, {});

  while (frontier.hasPending()) {
    const nextUrl = frontier.next();
    console.log(nextUrl);
    if(nextUrl) 
      await scrapePage(nextUrl, allProductsMap);
  }

  return restockedProducts;
}

module.exports = { runScraper };

