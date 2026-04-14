import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';

const {
  BOT_TOKEN,
  CHANNEL_USERNAME,
  PRIVATE_GROUP_LINK,
  BOT_USERNAME
} = process.env;

if (!BOT_TOKEN || !CHANNEL_USERNAME || !PRIVATE_GROUP_LINK) {
  console.error('❌ .env dagi BOT_TOKEN, CHANNEL_USERNAME, PRIVATE_GROUP_LINK shart!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// ======== Fayl-based "DB" (oddiy JSON) =========
const DB_PATH = './db.json';
function loadDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { users: {} }; 
  }
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

const db = loadDB();

// ======== Foydali funksiyalar =========
function getUser(userId) {
  const key = String(userId);
  if (!db.users[key]) {
    db.users[key] = {
      referredBy: null,
      referrals: [],
      isMemberVerified: false
    };
  }
  return db.users[key];
}

function addReferral(referrerId, referredId) {
  const referrer = getUser(referrerId);
  const rId = String(referredId);
  if (!referrer.referrals.includes(rId)) {
    referrer.referrals.push(rId);
    saveDB(db);
    return true;
  }
  return false;
}

function buildReferralLink(botUsername, userId) {
  const uname = (botUsername || BOT_USERNAME || '').replace('@', '');
  return `https://t.me/${uname}?start=${userId}`;
}

function progressText(userId) {
  const u = getUser(userId);
  const count = u.referrals.length;
  return `📊 Sizning progress: ${count}/5\n` +
         (count >= 5
            ? "✅ Talab bajarildi! Yopiq guruh havolasi pastda beriladi.\n" 
            : `Yana ${Math.max(0, 5-count)} ta do‘st taklif qiling.`);
}

async function checkChannelMembership(ctx, userId) {
  try {
    const mem = await ctx.telegram.getChatMember(CHANNEL_USERNAME, userId);
    return !['left','kicked'].includes(mem.status);
  } catch (e) {
    return false;
  }
}

// ======== /start handler =========
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const payload = ctx.startPayload;
  const me = await ctx.telegram.getMe();
  const botUname = me.username ? '@' + me.username : (BOT_USERNAME || '');
  const u = getUser(userId);

  if (payload) {
    const refId = Number(payload);
    if (!Number.isNaN(refId) && refId !== userId) {
      if (!u.referredBy) {
        u.referredBy = String(refId);
        saveDB(db);
      }
    }
  }

  const txt = `
📚 Siz 6 yillik tajribaga ega, IELTS 7.5 ni 5 marta olgan o‘qituvchidan 
60 KUN 0 DAN – BEPUL INGLIZ TILI DARSLARini o‘rganasiz!

✅ Qadam 1: Pastdagi tugma orqali kanallarga qo‘shiling.  
✅ Qadam 2: "✅ Qo‘shildim" tugmasini bosing.  
✅ Qadam 3: "📝 Mening referral havolam" tugmasini bosing va havolangizni 5 do‘stingizga yuboring.  

⭐️ 5 ta do‘stingiz sizning havolangiz orqali kirib, tasdiqlagach, yopiq guruh havolasi beriladi!
`;

  await ctx.reply(txt, Markup.inlineKeyboard([
    [Markup.button.url("📢 Kanalga qo‘shilish", `https://t.me/${CHANNEL_USERNAME.replace('@','')}`)],
    [Markup.button.callback("✅ Qo‘shildim", "joined")],
    [Markup.button.callback("📝 Mening referral havolam", "my_ref")],
    [Markup.button.callback("📊 Mening holatim", "progress")]
  ]));
});

// ======== "Qo‘shildim" callback =========
// bot.action('joined', async (ctx) => {
//   const userId = ctx.from.id;
//   await ctx.answerCbQuery('Tekshirilmoqda...');

//   const isMember = await checkChannelMembership(ctx, userId);
//   const u = getUser(userId);
//   if (!isMember) {
//     return ctx.reply(
//       `❗️ Siz hali ${CHANNEL_USERNAME} kanaliga a’zo emassiz.\nAvval kanalga o‘ting va a’zo bo‘ling, keyin "✅ Qo‘shildim" ni bosing.`
//     );
//   }

//   if (!u.isMemberVerified) {
//     u.isMemberVerified = true;
//     saveDB(db);

//     if (u.referredBy && u.referredBy !== String(userId)) {
//       addReferral(u.referredBy, userId);

//       const referrerId = Number(u.referredBy);
//       const referrer = getUser(referrerId);
//       if (referrer.referrals.length >= 5) {
//         try {
//           await ctx.telegram.sendMessage(
//             referrerId,
//             `🎉 Tabriklaymiz! 5 ta do‘st taklif qildingiz.\nMana yopiq guruh havolasi:\n${PRIVATE_GROUP_LINK}`
//           );
//         } catch (_) {}
//       }
//     }
//   }

//   await ctx.reply("✅ A’zo bo‘lganingiz tasdiqlandi!");
// });
bot.action('joined', async (ctx) => {
  const userId = ctx.from.id;
  await ctx.answerCbQuery('Tekshirilmoqda...');

  const isMember = await checkChannelMembership(ctx, userId);
  const u = getUser(userId);

  if (!isMember) {
    return ctx.reply(
      `❗️ Siz hali ${CHANNEL_USERNAME} kanaliga a’zo emassiz.\nAvval kanalga o‘ting va a’zo bo‘ling, keyin "✅ Qo‘shildim" ni bosing.`
    );
  }

  if (!u.isMemberVerified) {
    u.isMemberVerified = true;
    saveDB(db);

    if (u.referredBy && u.referredBy !== String(userId)) {
  addReferral(u.referredBy, userId);

  const referrerId = Number(u.referredBy);
  const referrer = getUser(referrerId);

  try {
    const fullName = [ctx.from.first_name, ctx.from.last_name]
      .filter(Boolean)
      .join(' ');
    const username = ctx.from.username ? '@' + ctx.from.username : 'username yo‘q';

    let message =
      `👤 Sizning referral havolangiz orqali yangi odam kirdi!\n\n` +
      `🆔 ID: ${userId}\n` +
      `👤 Ismi: ${fullName || 'Noma’lum'}\n` +
      `🔗 Username: ${username}\n` +
      `📊 Jami referral: ${referrer.referrals.length}/5`;

    if (referrer.referrals.length >= 5) {
      message += `\n\n🎉 Tabriklaymiz! 5 ta do‘st taklif qildingiz.` +
                 `\n🔓 Yopiq guruh havolasi:\n${PRIVATE_GROUP_LINK}`;
    }

    await ctx.telegram.sendMessage(referrerId, message);

  } catch (e) {
    console.log('Referrerga xabar yuborilmadi:', e.message);
  }
}
  }

  await ctx.reply("✅ A’zo bo‘lganingiz tasdiqlandi!");
});

// ======== "Mening referral havolam" callback =========
bot.action('my_ref', async (ctx) => {
  const userId = ctx.from.id;
  const me = await ctx.telegram.getMe();
  const botUname = me.username ? '@' + me.username : (BOT_USERNAME || '');
  const refLink = buildReferralLink(botUname, userId);

  await ctx.answerCbQuery();
  await ctx.reply(`📝 Sizning referral havolangiz:\n${refLink}`);
});

// ======== Progress callback =========
bot.action('progress', async (ctx) => {
  const userId = ctx.from.id;
  const text = progressText(userId);
  const u = getUser(userId);

  if (u.referrals.length >= 5) {
    return ctx.reply(
      `${text}\n\n🔒 Yopiq guruh havolasi:\n${PRIVATE_GROUP_LINK}`,
      Markup.inlineKeyboard([
        [Markup.button.url('🔓 Yopiq guruh', PRIVATE_GROUP_LINK)]
      ])
    );
  } else {
    await ctx.answerCbQuery('Progress yangilandi');
    return ctx.reply(
      `${text}\n\nDo‘stlaringizga o‘z referral havolangizni yuboring.`
    );
  }
});

// ======== Launch =========
bot.launch().then(async () => {
  const me = await bot.telegram.getMe();
  console.log(`🚀 Bot ishga tushdi: @${me.username || 'unknown'}`);
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
