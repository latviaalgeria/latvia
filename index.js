// telegram-bot-data-scheduler.js
 import { Telegraf } from 'telegraf';
 import cron from 'node-cron';
 import { fillLatviaEmbassyForm } from './visapp.js';
 import fs from 'fs/promises';
 import dotenv from 'dotenv';
 import path from 'path';
 dotenv.config();
 const DB_FILE = path.join(process.cwd(), 'subscribers.json');
 const botToken = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Telegram bot with token from environment variables
console.log('Bot starting up...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  TELEGRAM_BOT_TOKEN: botToken ? 'Token exists (hidden)' : 'undefined'
});

// Initialize Telegram bot with token from environment variables
if (!botToken) {
  console.error('Error: TELEGRAM_BOT_TOKEN is undefined. Make sure your .env file is set up correctly.');
  process.exit(1);
}
const bot = new Telegraf(botToken);
let subscribedUsers = new Set();

async function loadSubscribers() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    const subscribers = JSON.parse(data);
    subscribedUsers = new Set(subscribers);
    console.log(`Loaded ${subscribedUsers.size} subscribers from database`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No existing subscribers database found, creating a new one');
      await saveSubscribers(); // Create empty DB file
    } else {
      console.error('Error loading subscribers database:', error.message);
    }
  }
}

// Function to save subscribers to JSON file
async function saveSubscribers() {
  try {
    const subscribers = Array.from(subscribedUsers);
    await fs.writeFile(DB_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
    console.log(`Saved ${subscribers.length} subscribers to database`);
  } catch (error) {
    console.error('Error saving subscribers database:', error.message);
  }
}
// Store chat IDs for users who have subscribed to updates

// Function to fetch data 
async function fetchData() {
  try {
    // This is a placeholder - replace with your actual API or data source
    const response = await fillLatviaEmbassyForm();
    return response;
  } catch (error) {
    console.error('Error fetching data:', error.message);
    return { error: 'Failed to fetch data' };
  }
}

// Format the data for display in Telegram
function formatData(data) {

    if (data === true) {
        return '🟢 Available'
    } else {
        return '🔴 Not Available'
    }

}

// Schedule to send data every minute to all subscribed users
cron.schedule('* * * * *', async () => {
  if (subscribedUsers.size === 0) {
    return; // No users subscribed
  }
  
  try {
    const data = await fetchData();
    const formattedMessage = formatData(data);
console.log("data ", data);
    if (typeof data === "boolean" && data === false) {
      return;
    }
    // Send to all subscribed users
    for (const chatId of subscribedUsers) {
      try {
        await bot.telegram.sendMessage(chatId, formattedMessage);
        await bot.telegram.sendPhoto(chatId,{source:'./embassy-booking-check.png'},{caption:'Embassy Booking Check'});
      } catch (err) {
        console.error(`Failed to send message to ${chatId}:`, err.message);
        // Remove user if we can't send messages to them
        if (err.message.includes('blocked') || err.message.includes('not found')) {
          subscribedUsers.delete(chatId);
        }
      }
    }
  } catch (error) {
    console.error('Error in scheduled task:', error);
  }
});

// Bot commands
bot.command('start', (ctx) => {
  ctx.reply(`👋 Welcome to Data Reporter Bot!
  
Commands:
/subscribe - Start receiving data updates every minute
/unsubscribe - Stop receiving updates
/getdata - Get data once immediately
/status - Check subscription status`);
});

bot.command('subscribe', async (ctx) => {
  const chatId = ctx.chat.id;
  subscribedUsers.add(chatId);
 await saveSubscribers();
  ctx.reply('✅ You are now subscribed to data updates every minute');
});

bot.command('unsubscribe', async (ctx) => {
  const chatId = ctx.chat.id;
  subscribedUsers.delete(chatId);
  await saveSubscribers();
  ctx.reply('❌ You are now unsubscribed from data updates');
});

bot.command('getdata', async (ctx) => {
  try {
    ctx.reply('Fetching latest data...');
    const data = await fetchData();
    console.log("data ", data);
   await ctx.reply(formatData(data));
    await ctx.replyWithPhoto( { source: './embassy-booking-check.png' }, { caption: 'Embassy Booking Check',},);
  } catch (error) {
    ctx.reply('❌ Error fetching data');
    console.error('Error handling getdata command:', error);
  }
});

bot.command('status', (ctx) => {
  const chatId = ctx.chat.id;
  const subscribed = subscribedUsers.has(chatId);
  ctx.reply(subscribed 
    ? '✅ You are currently subscribed to minute-by-minute updates'
    : '❌ You are not subscribed to updates');
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred while processing your request');
});

// Start the bot
loadSubscribers()
  .then(() => {
    // Start the bot
    return bot.launch();
  })
  .then(() => {
    console.log('Bot started successfully!');
  })
  .catch(err => {
    console.error('Failed to start bot:', err);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));



