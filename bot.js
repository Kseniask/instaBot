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

async function clearUpdates (token) {
  const { result } = (await axios.get(`https://api.telegram.org/bot${token}/getUpdates`)).data;
  console.log('result', result);

  if (result.lenght > 0) {
    await axios.get(
      `https://api.telegram.org/bot${token}/getUpdates?offset=${result[result.length - 1].message_id + 1}`
    );
  }
}

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
    await page.setRequestInterception(true);
    let userData;
    page.on('requestfinished', async (request) => {
      if (request.url().includes(`https://www.instagram.com/api/v1/users`)) {
        userData = (await request.response().json()).data.user;
      }
    });
    let stopRequests = false;
    page.on('request', (request) => {
      if (request.url().includes(`https://www.instagram.com/api/v1/users`)) {
        stopRequests = true;
        return request.continue();
      }
      if (stopRequests) {
        return request.abort();
      }
      request.continue();
    });

    await page.goto(`https://www.instagram.com/${instaUsername}/`, { waitUntil: 'networkidle0' });

    if (userData.is_private) {
      return ctx.reply('Упсі.. Акаунт то привaтний. Я не настільки кльовий, сорі ');
    }

    const userStories = await axios
      .get(`https://storiesig.info/api/ig/stories/${userData.id}`)
      .then((res) => res.data.result || undefined);

    if (userStories.length !== 0) {
      const mediaGroups = [[], [], [], []];
      userStories.forEach((story, index) => {
        const isVideo = story.video_versions;
        const storyUrl = isVideo ? story.video_versions[0].url : story.image_versions2.candidates[0].url;

        const mediaValue = {
          type: isVideo ? 'video' : 'photo',
          media: storyUrl
        };
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

(async () => {
  await clearUpdates(TELEGRAM_TOKEN);
  bot.launch();
})();
