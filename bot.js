require('dotenv').config();
const { Telegraf } = require('telegraf');
const { TELEGRAM_TOKEN } = process.env;
const bot = new Telegraf(TELEGRAM_TOKEN);
const axios = require('axios');
const puppeteer = require('puppeteer');

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
process.on('uncaughtException', function (error) {
  console.log('\x1b[31m', 'Exception: ', error, '\x1b[0m');
});

process.on('unhandledRejection', function (error, p) {
  console.log('\x1b[31m', 'Error: ', error.message, '\x1b[0m');
});

bot.start((ctx) => {
  ctx.reply(introMessage).then(() => ctx.reply(helpMessage));
});

//@
bot.mention(async (ctx) => {
  const instaUsername = ctx.update.message.text.slice(1);

  ctx.reply(randomPhrases[(Math.random() * randomPhrases.length) | 0]);

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

  try {
    const page = await browser.newPage();
    await page.goto(`https://dumpor.com/v/${instaUsername}`, { waitUntil: 'networkidle0' });
    const isPrivate = false;

    const userId = await page.evaluate(
      (instaUsername) => {
        const profile = document.querySelector(`[data-name=${instaUsername}]`);
        if (!profile) {
          return 0;
        }
        return profile.getAttribute('data-id');
      },
      instaUsername,
      isPrivate
    );
    if (userId === 0) {
      return ctx.reply('Або акаунт приватний aбо такого юзера не існує..');
    }

    const userStories = await axios
      .get(`https://storiesig.info/api/ig/stories/${userId}`)
      .then((res) => res.data.result || undefined);

    if (userStories.length !== 0) {
      const mediaGroups = [[], [], [], []];
      userStories.forEach((story, index) => {
        const isVideo = story.video_versions;
        const storyUrl = isVideo ? story.video_versions[0].url : story.image_versions2.candidates[1].url;

        const mediaValue = {
          type: isVideo ? 'video' : 'photo',
          media: storyUrl
        };
        if (index < 9) {
          mediaGroups[0].push(mediaValue);
        } else if (index < 19) {
          mediaGroups[1].push(mediaValue);
        } else if (index < 29) {
          mediaGroups[2].push(mediaValue);
        } else {
          mediaGroups[3].push(mediaValue);
        }
        return;
      });

      mediaGroups.forEach(async (mediaGroup) => {
        if (mediaGroup.length > 0) {
          if (mediaGroup.length === 1) {
            switch (mediaGroup[0].type) {
              case 'photo':
                await bot.telegram.sendPhoto(ctx.chat.id, mediaGroup[0].media);
                break;
              case 'video':
                await bot.telegram.sendVideo(ctx.chat.id, mediaGroup[0].media);
            }
          } else {
            await bot.telegram.sendMediaGroup(ctx.chat.id, mediaGroup);
          }
        }
      });
    } else {
      ctx.reply('Пусто');
    }
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
