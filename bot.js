require('dotenv').config();
const { Telegraf } = require('telegraf');
const { TELEGRAM_TOKEN } = process.env;
const axios = require('axios');
const puppeteer = require('puppeteer');
let askId = false;
async function clearUpdates (token) {
  const { result } = (await axios.get(`https://api.telegram.org/bot${token}/getUpdates`)).data;

  if (result.lenght > 0) {
    await axios.get(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${result[result.length - 1].message_id + 1}`
    );
  }
}
clearUpdates(TELEGRAM_TOKEN);
const bot = new Telegraf(TELEGRAM_TOKEN);

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

const getUserId = async (userName) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36'
  );
  await page.setRequestInterception(true);
  let stopRequests = false;
  page.on('request', async (request) => {
    // https://www.instagram.com/api/v1/lox/account_recommendations
    if (request.url().includes(`https://www.instagram.com/api/v1/lox/account_recommendations`)) {
      stopRequests = true;
      return await request.continue();
    }
    if (stopRequests) {
      return await request.abort();
    }
    await request.continue();
  });
  await page.goto(`https://instagram.com/${userName}`, { waitUntil: 'load' });
  // await page.screenshot({ path: 'userId.jpg' });
  userId = await page.evaluate(() => {
    let foundId = false;
    let currentIndex = 32;
    const getIdText = (scriptIndex) => document.scripts[scriptIndex].text.split('"id":"')[1];
    while (foundId === false && currentIndex < 45) {
      foundId = getIdText(currentIndex) !== undefined;
      currentIndex++;
    }
    if (foundId) {
      return getIdText(currentIndex - 1).split('","')[0];
    }
    return 0;
  });
  await browser.close();
  return userId;
};

bot.start((ctx) => {
  ctx.reply(introMessage).then(() => ctx.reply(helpMessage));
});

//@
bot.mention(async (ctx) => {
  const instaUsername = ctx.update.message.text.slice(1);
  let userId;
  ctx.reply(randomPhrases[(Math.random() * randomPhrases.length) | 0]);
  //document.scripts[35].text.split('"id":"')[1].split('","')[0]

  try {
    if (!Number(instaUsername)) {
      userId = await getUserId(instaUsername);
      if (userId === 0) {
        return ctx.reply('Або акаунт приватний aбо такого юзера не існує..');
      }
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
  }
});

bot.command('getId', (ctx) => {
  askId = true;
  return ctx.reply("Скажи мені ім'я користувача (без @)");
});

bot.on('text', async (ctx) => {
  if (askId) {
    const userId = await getUserId(ctx.message.text);
    askId = false;
    if (userId === 0) {
      return ctx.reply('Не знайшов.. Напевне такого юзера нема або сервер знов дурачиться');
    }
    return ctx.reply(`Вот тобі ID, користуйся: ${userId}`);
  }
  ctx.reply("Хм.. Нє, шось не то... Пам'ятай шо перед ніком треба собачку (@)");
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

process.on('uncaughtException', function (error) {
  console.log('\x1b[31m', 'Exception: ', error, '\x1b[0m');
});

process.on('unhandledRejection', function (error, p) {
  console.log('\x1b[31m', 'Error: ', error.message, '\x1b[0m');
});
