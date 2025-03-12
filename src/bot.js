const {Client, GatewayIntentBits} = require("discord.js");
const {checkStock} = require("./scraper");
const {connectDB} = require("./database");
const {CHECK_INTERVAL, CHANNEL_ID} = require("./config");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  connectDB();
  monitorStock();
});

async function monitorStock() {
  console.log("monitoring stock...")
}

async function sendRestockAlert(itemName, itemDetails) {
  // connect to channel
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return console.error("Channel not found!");

  // send restock alert
  await channel.send({
    content: `🔥 **${itemName}** is back in stock!`,
    embeds: [
      {
        title: itemName,
        url: itemDetails.url,
        image: { url: itemDetails.image },
      },
    ],
  });
}

client.login(process.env.BOT_TOKEN);
