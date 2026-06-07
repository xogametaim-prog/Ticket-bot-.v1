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

app.get("/", (req, res) => {
    res.send("World Cup 2026 Bot Online");
});

app.listen(PORT, () => {
    console.log(`Web server running on port ${PORT}`);
});

const db = new sqlite3.Database("./worldcup.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
    userId TEXT PRIMARY KEY,
    team TEXT NOT NULL
)
`);

const teams = [
    "Argentina",
    "Brazil",
    "France",
    "Spain",
    "Germany",
    "England",
    "Portugal",
    "Netherlands",
    "Belgium",
    "Croatia",
    "Morocco",
    "Japan",
    "South Korea",
    "Mexico",
    "USA",
    "Canada",
    "Uruguay",
    "Italy",
    "Turkey",
    "Saudi Arabia"
];

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {

    if (interaction.isChatInputCommand()) {

        switch (interaction.commandName) {

            case "pick_team":

                db.get(
                    "SELECT * FROM users WHERE userId = ?",
                    [interaction.user.id],
                    async (err, row) => {

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
                                teams.map(team => ({
                                    label: team,
                                    value: team
                                }))
                            );

                        const rowMenu = new ActionRowBuilder()
                            .addComponents(menu);

                        await interaction.reply({
                            content: "⚽ اختر منتخبك المفضل (مرة واحدة فقط)",
                            components: [rowMenu],
                            ephemeral: true
                        });
                    }
                );

                break;

            case "my_team":

                db.get(
                    "SELECT * FROM users WHERE userId = ?",
                    [interaction.user.id],
                    async (err, row) => {

                        if (!row) {
                            return interaction.reply({
                                content: "❌ لم تختر منتخباً بعد",
                                ephemeral: true
                            });
                        }

                        await interaction.reply({
                            content: `🏆 منتخبك المختار هو: ${row.team}`
                        });
                    }
                );

                break;

            default:

                await interaction.reply({
                    content: "🚧 هذا الأمر قيد التطوير."
                });

        }

    }

    if (interaction.isStringSelectMenu()) {

        if (interaction.customId === "team_select") {

            const team = interaction.values[0];

            db.get(
                "SELECT * FROM users WHERE userId = ?",
                [interaction.user.id],
                (err, row) => {

                    if (row) {
                        return interaction.reply({
                            content: "❌ لا يمكنك تغيير منتخبك.",
                            ephemeral: true
                        });
                    }

                    db.run(
                        "INSERT INTO users(userId, team) VALUES(?, ?)",
                        [interaction.user.id, team]
                    );

                    interaction.reply({
                        content: `✅ تم اختيار ${team} بنجاح!`,
                        ephemeral: true
                    });

                }
            );

        }

    }

});

client.login(process.env.DISCORD_TOKEN);