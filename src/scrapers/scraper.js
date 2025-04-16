const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { BASE_URL } = require("../config/config");
const Product = require("../database/models/Products");

let restockedProducts = [];
let currentPage = 7;

class Frontier {
  constructor() {
    this.queue = [];
    this.seen = new Set();
  }

  add(url) {
    if (!this.seen.has(url)) {
      this.queue.push(url);
      this.seen.add(url);
    }
  }

  next() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

const getRenderedHTML = async (url) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

  const html = await page.content();
  await browser.close();
  return html;
};

async function scrapePage(url, allProductsMap, frontier) {
  console.log("<DEBUG> Scraping url:", url);

  try {
    const html = await getRenderedHTML(url);
    const $ = cheerio.load(html);

    await checkStock($, allProductsMap);

    const hasNextPage = $(".ant-pagination-next").attr("aria-disabled") !== "true";
    console.log("<DEBUG> Next button data: ", hasNextPage);
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
  console.log("<DEBUG> checking stock...");

  $(".index_infoBlock__IG8h0 > div").each(async (index, element) => {
    const productElement = $(element);
    const name = productElement.find(".index_itemUsTitle__7oLxa").text().trim();
    const rawPrice = productElement.find(".index_itemPrice__AQoMy").text().trim();
    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    const relativeUrl = productElement.find("a").attr("href");
    const productUrl = relativeUrl ? new URL(relativeUrl, BASE_URL).href : "";
    const imgElement = productElement.find(".index_itemImg__1J3x5 img");
    const imgUrl = imgElement.attr("src") || imgElement.attr("data-src");

    const isOutOfStock = productElement.find(".index_tag__5TOhQ").text().includes("OUT OF STOCK");
    const inStock = !isOutOfStock;

    let product = allProductsMap[name];

    // Persist database changes based on scraped data
    if (!product) {
      // Adding new product to table
      product = new Product({
        name,
        price,
        in_stock: inStock,
        url: productUrl,
        img_url: imgUrl,
      });
      console.log("<DEBUG> Added new product:", name);
    } else {
      // Restock detected
      if (!product.in_stock && inStock) {
        restockedProducts.push(product);
      }
      product.in_stock = inStock;
    }
    // TODO: check for information updates in all other fields as well if needed (price changes, url, etc)
    // Might be costly, we should do this more sparingly unless we can optimize it

    await product.save();
    console.log("Saved:", name);
  });
};

async function runScraper() {
  console.log("Scraper running...");

  const frontier = new Frontier();
  frontier.add(`${BASE_URL}${currentPage}`);

  const allProducts = await Product.find();
  const allProductsMap = allProducts.reduce((acc, product) => {
    acc[product.name] = product;
    return acc;
  }, {});

  while (!frontier.isEmpty()) {
    const url = frontier.next();
    if (url) await scrapePage(url, allProductsMap, frontier);
  }

  return restockedProducts;
}

module.exports = { runScraper };
