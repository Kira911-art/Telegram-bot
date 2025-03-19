const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
require("dotenv").config(); // To load environment variables from .env file

const BOT_TOKEN = process.env.TOKEN; // Get the bot token from environment variables
const CHANNEL_ID = -1002648515392;
const FILE_CHANNEL_ID = -1002518313917;
const BOT_OWNER_ID = 1992786012; // Change to your bot owner's ID

const bot = new Telegraf(BOT_TOKEN);

let userSessions = {};

// Start command to forward a file based on a custom format
bot.command("start", async (ctx) => {
  if (!ctx.message.text.includes("start single_")) {
    return;
  }
  const params = ctx.message.text.split("start single_")[1];
  const [fileChannelId, messageId] = params.split("_");

  try {
    await ctx.telegram.forwardMessage(ctx.chat.id, fileChannelId, messageId);
  } catch (error) {
    console.error("Error forwarding file:", error);
    ctx.reply("⚠️ Failed to forward the file. Check bot permissions.");
  }
});

// Auto join approval for users
bot.on("chat_join_request", async (ctx) => {
  const userId = ctx.chatJoinRequest.from.id;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/approveChatJoinRequest?chat_id=${CHANNEL_ID}&user_id=${userId}`;
    await axios.get(url);

    ctx.telegram.sendMessage(userId, "✅ Your request to join has been approved!");
    console.log(`Approved user: ${userId}`);
  } catch (error) {
    console.error("Error approving user:", error);
  }
});

// Sending message ID of new posts to the owner
bot.on("channel_post", (ctx) => {
  ctx.reply(`Message ID: \`${ctx.channelPost.message_id}\``, {
    parse_mode: "Markdown",
  });
});

// Command to create a post (only for bot owner)
bot.command("create", (ctx) => {
  if (ctx.from.id !== BOT_OWNER_ID) {
    return ctx.reply("🚫 You are not authorized to use this bot.");
  }

  userSessions[ctx.from.id] = { step: 1 };
  ctx.reply("✅ Welcome! Please send the *image* for your post.");
});

// Handle image uploads for the post
bot.on("photo", (ctx) => {
  const session = userSessions[ctx.from.id];
  if (!session || session.step !== 1) return;

  session.image = ctx.message.photo.pop().file_id;
  session.step = 2;
  ctx.reply("📜 Now send the *description* for your post.");
});

// Handle text inputs for description and file IDs
bot.on("text", async (ctx) => {
  const session = userSessions[ctx.from.id];
  if (!session) return;

  if (session.step === 2) {
    session.description = ctx.message.text;
    session.step = 3;
    ctx.reply("📩 Send the *Message ID* of the 480p file from the file channel.");
  } else if (session.step === 3) {
    // Validate if the 480p file ID is valid
    if (!isValidMessageId(ctx.message.text)) {
      return ctx.reply("⚠️ Invalid Message ID. Please send a valid Message ID.");
    }
    session.file480p = ctx.message.text;
    session.step = 4;
    ctx.reply("📩 Send the *Message ID* of the 720p file.");
  } else if (session.step === 4) {
    // Validate if the 720p file ID is valid
    if (!isValidMessageId(ctx.message.text)) {
      return ctx.reply("⚠️ Invalid Message ID. Please send a valid Message ID.");
    }
    session.file720p = ctx.message.text;
    session.step = 5;
    ctx.reply("📩 Send the *Message ID* of the 1080p file.");
  } else if (session.step === 5) {
    // Validate if the 1080p file ID is valid
    if (!isValidMessageId(ctx.message.text)) {
      return ctx.reply("⚠️ Invalid Message ID. Please send a valid Message ID.");
    }
    session.file1080p = ctx.message.text;
    session.step = 6;

    // Generate deep links for each resolution
    const link480p = `https://t.me/${process.env.BOT_USERNAME}?start=single_${FILE_CHANNEL_ID}_${session.file480p}`;
    const link720p = `https://t.me/${process.env.BOT_USERNAME}?start=single_${FILE_CHANNEL_ID}_${session.file720p}`;
    const link1080p = `https://t.me/${process.env.BOT_USERNAME}?start=single_${FILE_CHANNEL_ID}_${session.file1080p}`;

    try {
      // Send the post to the channel with the provided image and download links
      await bot.telegram.sendPhoto(CHANNEL_ID, session.image, {
        caption: `${session.description}\n\n🎬 *Download Links:*\n\n🔹 [480p](${link480p}) | 🔹 [720p](${link720p}) | 🔹 [1080p](${link1080p})`,
        parse_mode: "Markdown",
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.url("🔹 480p", link480p)],
          [Markup.button.url("🔹 720p", link720p)],
          [Markup.button.url("🔹 1080p", link1080p)],
        ]),
      });

      ctx.reply("✅ Post has been sent to the channel!");
    } catch (error) {
      console.error("Error sending post:", error);
      ctx.reply("⚠️ Failed to send the post. Please check bot permissions.");
    }

    // Cleanup session after sending the post
    delete userSessions[ctx.from.id];
  }
});

// Helper function to validate message ID
function isValidMessageId(messageId) {
  // Here we can add additional validation if needed (e.g., check if messageId exists in the file channel)
  return messageId && !isNaN(messageId); // Simple check to ensure the ID is a valid number
}

bot.launch()
  .then(() => console.log("Bot started"))
  .catch((error) => console.error("Error starting bot:", error));
