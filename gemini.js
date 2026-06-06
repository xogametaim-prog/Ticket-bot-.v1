const express = require("express");
const {
Client,
GatewayIntentBits,
Partials
} = require("discord.js");

const { generateAIResponse } = require("./gemini");

if (!process.env.DISCORD_TOKEN) {
throw new Error("DISCORD_TOKEN is missing");
}

if (!process.env.AI_KEY) {
throw new Error("AI_KEY is missing");
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
res.send("Bot is online!");
});

app.listen(PORT, () => {
console.log("Web server running on port ${PORT}");
});

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent
],
partials: [Partials.Channel]
});

client.once("clientReady", () => {
console.log("Logged in as ${client.user.tag}");
});

client.on("messageCreate", async (message) => {
try {
if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user);
    const isAiRoom = message.channel.name === "ai-chat";

    if (!isMentioned && !isAiRoom) return;

    await message.channel.sendTyping();

    let prompt = message.content;

    if (isMentioned) {
        prompt = prompt.replace(
            new RegExp(`<@!?${client.user.id}>`, "g"),
            ""
        ).trim();
    }

    if (!prompt) {
        return message.reply(
            "اكتب سؤالك بعد منشن البوت 🤖"
        );
    }

    const response = await generateAIResponse(
        message.author.id,
        prompt
    );

    const finalResponse =
        response.length > 1900
            ? response.slice(0, 1900) + "..."
            : response;

    await message.reply(finalResponse);

} catch (error) {
    console.error(error);

    await message.reply(
        "⚠️ حدث خطأ أثناء معالجة الطلب."
    );
}

});

client.login(process.env.DISCORD_TOKEN);