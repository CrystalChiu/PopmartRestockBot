const {Client, GatewayIntentBits} = require("discord.js");
const {runScraper} = require("./scrapers/scraper");
const {connectDB} = require("./database/database");
const {CHECK_INTERVAL, PROD_CHANNEL_ID, TEST_CHANNEL_ID} = require("./config/config");
const MAX_JITTER_MS = 10 * 1000;
require("dotenv").config();

let mode = "prod"

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});
client.login(process.env.BOT_TOKEN);

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  await connectDB();

  var args = process.argv.slice(2);
  if (args.length > 0 && args[0] === "test") {
    mode = "test";
  }
  console.log(`App running in ${mode}`);

  let CHANNEL_ID = mode == "test" ? TEST_CHANNEL_ID : PROD_CHANNEL_ID;

  // start the infinite loop
  runScraperLoop(CHANNEL_ID);
});

async function runScraperLoop(CHANNEL_ID) {
  const alertProducts = await runScraper(); // returns a list of [product, changeType]
  console.log(`received ${alertProducts.length} alert products`);

  for (const [product, changeType] of alertProducts) {
    await sendAlert(product, changeType, CHANNEL_ID);
  }

  const jitter = Math.floor(Math.random() * MAX_JITTER_MS);
  const nextInterval = CHECK_INTERVAL + jitter;

  setTimeout(() => runScraperLoop(CHANNEL_ID), nextInterval); // Schedule next run
}

async function sendAlert(product, changeType, CHANNEL_ID) {
  console.log(`sending alert for: ${product.name}`);

  try {
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (!channel) {
      console.error("❌ Channel not found!");
      return;
    }

    const messageContent = changeType === 0 
      ? `🔥 **${product.name}** is back in stock!`
      : `‼️ New product: **${product.name}**`;

    await channel.send({
      content: messageContent,
      embeds: [
        {
          title: product.name,
          url: product.url,
          image: {
            url: product.img_url, // 🔧 was `imgUrl`, which is incorrect
          },
        },
      ],
    });

    console.log("✅ Alert sent.");
  } catch (err) {
    console.error("❌ Error sending alert:", err.message);
  }
}

