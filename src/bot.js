const {Client, GatewayIntentBits} = require("discord.js");
const {runScraper} = require("./scrapers/scraper");
const {connectDB} = require("./database/database");
const {CHECK_INTERVAL, CHANNEL_ID} = require("./config/config");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  connectDB();

  const restockedProducts = await runScraper();
  for (const product of restockedProducts) {
    await sendRestockAlert(product);
  }

  // setInterval(async () => {
  //   const restockedProducts = await runScraper();
  //   console.log(restockedProducts);
  //   for (const product of restockedProducts) {
  //     await sendRestockAlert(product);
  //   }
  // }, CHECK_INTERVAL);
});

async function sendRestockAlert(product) {
  // connect to channel
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return console.error("Channel not found!");

  // send restock alert
  await channel.send({
    content: `🔥 **${product.name}** is back in stock!`,
    embeds: [
      {
        title: product.name,
        url: product.url,
        image: { imgUrl: product.img_url },
      },
    ],
  });
}

client.login(process.env.BOT_TOKEN);
