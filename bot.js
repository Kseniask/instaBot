require('dotenv').config();
const { Telegraf } = require('telegraf');
const { TELEGRAM_TOKEN, BASE_API_URL } = process.env;
const bot = new Telegraf(TELEGRAM_TOKEN);
const axios = require('axios');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const request_client = require('request-promise-native');

const introMessage = 'Привіт крисятко. Велкам в світ, де можна дивитись сторі бившого анонімно!';
const helpMessage =
  "Щоб отримати сторі, введи ім'я користувача Instagram з @ на початку (@username). \nТа й усьо. \nЩасти, сталкер малий :)";

const randomPhrases = [
  'Завдання прийняу!',
  'Ща всьо буде..',
  'Пожди, шукаю..',
  'On it! Надіємось шо шось відкопаю',
  'Єс сер! Виконую завдання'
];
bot.start((ctx) => {
  ctx.reply(introMessage).then(() => ctx.reply(helpMessage));
});

//@
bot.mention(async (ctx) => {
  const instaUsername = ctx.update.message.text.slice(1);
  ctx.reply(randomPhrases[(Math.random() * randomPhrases.length) | 0]);

  const browser = await puppeteer.launch({ headless: false });

  try {
    const page = await browser.newPage();
    await page.goto(`https://instastories.watch/en/${instaUsername}/`, { waitUntil: 'networkidle0' });
    await page.goto(`https://instastories.watch/api/profile?username=${instaUsername}`, {
      waitUntil: 'networkidle0'
    });

    const userData = await page.evaluate(() => JSON.parse(document.body.innerText).stories);
    const stories = userData.filter((entry) => entry.type !== 'ads');
    const mediaGroups = [[], [], [], []];
    stories.forEach((story, index) => {
      const mediaValue = { type: story.type, media: story.url.replace('/api/proxy/', '') };
      if (index < 10) {
        mediaGroups[0].push(mediaValue);
      } else if (index < 20) {
        mediaGroups[1].push(mediaValue);
      } else if (index < 30) {
        mediaGroups[2].push(mediaValue);
      } else {
        mediaGroups[3].push(mediaValue);
      }
      return;
    });
    mediaGroups.forEach((mediaGroup) => {
      if (mediaGroup.length > 0) {
        if (mediaGroup.length === 1) {
          switch (mediaGroup[0].type) {
            case 'photo':
              bot.telegram.sendPhoto(ctx.chat.id, mediaGroup[0].media);
              break;
            case 'video':
              bot.telegram.sendVideo(ctx.chat.id, mediaGroup[0].media);
          }
        } else {
          bot.telegram.sendMediaGroup(ctx.chat.id, mediaGroup);
        }
      }
    });
  } catch (e) {
    console.log('Error occured: ', e.message);
    ctx.reply('Шось не то.. Виникла помилка');
  } finally {
    await browser.close();
  }
});

bot.on('text', (ctx) => {
  ctx.reply("Хм.. Нє, шось не то... Пам'ятай шо перед ніком треба собачку (@)");
});

bot.command('menu', (ctx) => {});

bot.launch();
