const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  StringSelectMenuBuilder
} = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 Web server (Render يحتاجه)
app.get("/", (req, res) => {
  res.send("🏆 World Cup 2026 Bot Online");
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// 🗄️ SQLite DB
const db = new sqlite3.Database("./worldcup.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
  userId TEXT PRIMARY KEY,
  team TEXT NOT NULL
)
`);

// ⚽ المنتخبات (ممكن تطورها لاحقًا من API)
const teams = [
  "Argentina", "Brazil", "France", "Spain", "Germany",
  "England", "Portugal", "Netherlands", "Belgium", "Croatia",
  "Morocco", "Japan", "South Korea", "Mexico", "USA",
  "Canada", "Uruguay", "Italy", "Turkey", "Saudi Arabia"
];

// 🤖 Discord Client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ✅ جاهزية البوت
client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

// 🎮 التفاعلات
client.on(Events.InteractionCreate, async (interaction) => {

  // slash commands
  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "worldcup") {
      return interaction.reply("🏆 كأس العالم 2026 في أمريكا + كندا + المكسيك");
    }

    if (interaction.commandName === "pick_team") {

      db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], async (err, row) => {

        if (row) {
          return interaction.reply({
            content: `❌ اخترت منتخبك بالفعل: ${row.team}`,
            ephemeral: true
          });
        }

        const menu = new StringSelectMenuBuilder()
          .setCustomId("team_select")
          .setPlaceholder("اختر منتخبك")
          .addOptions(
            teams.map(t => ({
              label: t,
              value: t
            }))
          );

        const rowMenu = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
          content: "⚽ اختر منتخبك (مرة واحدة فقط)",
          components: [rowMenu],
          ephemeral: true
        });

      });
    }

    if (interaction.commandName === "my_team") {

      db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], (err, row) => {

        if (!row) {
          return interaction.reply({
            content: "❌ ما اخترت أي منتخب",
            ephemeral: true
          });
        }

        return interaction.reply(`🏆 منتخبك: ${row.team}`);
      });
    }
  }

  // 🟢 اختيار المنتخب من القائمة
  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "team_select") {

      const team = interaction.values[0];

      db.get("SELECT * FROM users WHERE userId = ?", [interaction.user.id], (err, row) => {

        if (row) {
          return interaction.reply({
            content: "❌ لا يمكنك تغيير منتخبك",
            ephemeral: true
          });
        }

        db.run("INSERT INTO users(userId, team) VALUES(?, ?)", [
          interaction.user.id,
          team
        ]);

        return interaction.reply({
          content: `✅ تم اختيار ${team} بنجاح!`,
          ephemeral: true
        });

      });
    }
  }
});

// 🔐 تشغيل البوت
client.login(process.env.DISCORD_TOKEN);