require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");
const cron = require("node-cron");
const twilio = require("twilio");
const db = require("./db");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const numbers = process.env.NUMBERS.split(",");

// Scrape prices
async function fetchPrices() {
  const apiKey = process.env.GOLD_API_KEY;

  const goldRes = await axios.get("https://www.goldapi.io/api/XAU/INR", {
    headers: { "x-access-token": apiKey },
  });

  const silverRes = await axios.get("https://www.goldapi.io/api/XAG/INR", {
    headers: { "x-access-token": apiKey },
  });

  const goldPricePerGram = goldRes.data.price_gram_24k;
  const silverPricePerGram = silverRes.data.price_gram_999;

  return {
    gold24: Math.round(goldPricePerGram * 10), // per 10g
    gold22: Math.round(goldPricePerGram * 0.916 * 10),
    silver: Math.round(silverPricePerGram * 1000), // per kg
  };
}


// Get yesterday data
function getYesterday() {
  return new Promise((resolve) => {
    db.get(
      "SELECT * FROM prices ORDER BY id DESC LIMIT 1",
      (err, row) => {
        resolve(row);
      }
    );
  });
}

// Save today price
function saveToday(date, gold22, gold24, silver) {
  db.run(
    `INSERT INTO prices(date,gold22,gold24,silver)
     VALUES(?,?,?,?)`,
    [date, gold22, gold24, silver]
  );
}

// Arrow indicator
function arrow(today, yesterday) {
  if (!yesterday) return "";
  if (today > yesterday) return "↑";
  if (today < yesterday) return "↓";
  return "→";
}

// Send WhatsApp
async function sendMessage(message) {
  for (const number of numbers) {
    await client.messages.create({
      from: process.env.FROM_NUMBER,
      to: number,
      body: message,
    });
  }
}

// Main job
async function runBot() {
  try {
    const todayPrices = await fetchPrices();
    const yesterday = await getYesterday();

    const message = `
📊 Daily Metal Price Update

🥇 Gold 22K: ₹${todayPrices.gold22} ${arrow(
      todayPrices.gold22,
      yesterday?.gold22
    )}

🥇 Gold 24K: ₹${todayPrices.gold24} ${arrow(
      todayPrices.gold24,
      yesterday?.gold24
    )}

🥈 Silver: ₹${todayPrices.silver} ${arrow(
      todayPrices.silver,
      yesterday?.silver
    )}

📅 ${new Date().toLocaleDateString()}
`;

    await sendMessage(message);

    saveToday(
      new Date().toISOString(),
      todayPrices.gold22,
      todayPrices.gold24,
      todayPrices.silver
    );

    console.log("Update sent successfully");
  } catch (err) {
    console.error(err);
  }
}

// Test run
runBot();

// Daily schedule
cron.schedule("0 9 * * *", () => {
  runBot();
});