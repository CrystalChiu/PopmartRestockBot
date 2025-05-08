const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require("cheerio");
const { BASE_URL } = require("../config/config");
const Product = require("../database/models/Products");
const Frontier = require('./Frontier');

// ENUM for changes that create an alert
const ChangeTypeAlert = Object.freeze({
  RESTOCK: 0,
  NEW_ITEM: 1,
});

let alertProducts = []; // Stores pairs of product, changeTypes that will become alerts
let browser, page; // Reuse browser and page for scraping
let currentPage = 1;
let privacyBannerAccepted = false;

puppeteer.use(StealthPlugin());

const buildBulkOps = (products) => {
  return products.map((product) => ({
    updateOne: {
      filter: { name: product.name },
      update: {
        $set: {
          price: product.price,
          url: product.url,
          // img_url: product.img_url,
          in_stock: product.in_stock,
        },
      },
      upsert: true,
    },
  }));
};

async function runScraper() {
  // logging animation
  console.log("Scraper running..."); // Print once, no newline

  // Reset scraper state
  alertProducts.length = 0;
  currentPage = 1;

  browser = await puppeteer.launch({
    headless: true,
  });
  page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  const frontier = new Frontier();
  frontier.add(`${BASE_URL}`);

  const changedProducts = [];
  const allProducts = await Product.find();
  const allProductsMap = allProducts.reduce((acc, product) => {
    acc[product.name] = product;
    return acc;
  }, {});

  while (!frontier.isEmpty()) {
    const url = frontier.next();
    if (url) await scrapePage(url, allProductsMap, frontier, changedProducts, page);
  }

  await browser.close();

  // Bulk write for any DB changes with products
  if (changedProducts.length > 0) {
    const bulkOps = buildBulkOps(changedProducts);
    const result = await Product.bulkWrite(bulkOps);
    console.log("Bulk write result:", result);
  }

  return alertProducts;
}

const getRenderedHTML = async (url) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  } catch (err) {
    console.error(`❌ Error loading ${url}: ${err.message}`);
    console.log("⏳ Waiting 30 seconds before continuing...");

    await new Promise((resolve) => setTimeout(resolve, 30000));
  }

  // NOTE: Let us only do this once when the bot first starts up OR only check on page 1
  // Attempt to accept privacy banner if it appears
  if(!privacyBannerAccepted) {
    try {
      await page.waitForSelector('.policy_acceptBtn__ZNU71', { timeout: 2000 });
      await page.evaluate(() => {
        const acceptDiv = document.querySelector('.policy_acceptBtn__ZNU71');
        if (acceptDiv) acceptDiv.click();
      });
      console.log("✅ Accepted privacy banner.");
      privacyBannerAccepted = true;
    } catch (e) {
      console.log("ℹ️ No privacy banner or already accepted.");
    }
  }

  await page.waitForSelector(".index_infoBlock__IG8h0 > div", { timeout: 10000 });

  return await page.content();
};

async function isLastPage(page) {
  const nextLi = await page.$('li[title="Next Page"]', { timeout: 2000 });
  if (!nextLi) return true; // If the button doesn't exist, assume last page

  const className = await page.evaluate(el => el.getAttribute('class'), nextLi);
  return className.includes('disabled');
}

async function scrapePage(url, allProductsMap, frontier, changedProducts, page) {
  console.log("Scraping url:", url);

  try {
    const html = await getRenderedHTML(url, page);
    const $ = cheerio.load(html);

    await checkStock($, allProductsMap, changedProducts);

    const isLast = await isLastPage(page);
    if (!isLast) {
      currentPage++;
      const nextUrl = `${BASE_URL}?page=${currentPage}`;
      frontier.add(nextUrl);
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
  }
}

const checkStock = async ($, allProductsMap, changedProducts) => {
  console.log("Checking stock...");

  const elements = $(".index_infoBlock__IG8h0 > div");

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
   
    const productElement = $(element);
    const name = productElement.find(".index_itemUsTitle__7oLxa").text().trim();
    const rawPrice = productElement.find(".index_itemPrice__AQoMy").text().trim();
    const price = parseFloat(rawPrice.replace(/[^0-9.]/g, ""));
    const relativeUrl = productElement.find("a").attr("href");
    const productUrl = relativeUrl ? new URL(relativeUrl, BASE_URL).href : "";
    // const imgElement = productElement.find(".index_itemImg__1J3x5 img");
    // const imgUrl = imgElement.attr("src") || imgElement.attr("data-src");

    const isOutOfStock = productElement.find(".index_tag__5TOhQ").text().includes("OUT OF STOCK");
    const inStock = !isOutOfStock;

    let product = allProductsMap[name];

    // Keep track of database changes that need to be made based on scraped data
    if (!product) {
      // Adding new product to table
      product = new Product({
        name,
        price,
        in_stock: inStock,
        url: productUrl,
        // img_url: imgUrl,
      });

      alertProducts.push([product, ChangeTypeAlert.NEW_ITEM])
      changedProducts.push(product);
      // console.log("<DEBUG> Added new product:", name);
    } else {
      // Restock detected, update stock status and keep track of restocked item
      if (!product.in_stock && inStock) {
        alertProducts.push([product, ChangeTypeAlert.RESTOCK]);
        product.in_stock = inStock;
      }

      const updateField = (field, newValue) => {
        if (product[field] !== newValue) {
          product[field] = newValue;
        }
      };

      // Handle other product detail changes
      updateField("price", price);
      updateField("url", productUrl);
      // updateField("img_url", imgUrl);

      changedProducts.push(product);
    }
  }
};

module.exports = { runScraper };
