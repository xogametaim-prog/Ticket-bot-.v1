const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
    new SlashCommandBuilder()
        .setName("giveaway")
        .setDescription("إنشاء قيف أواي جديد")
        .addStringOption(option =>
            option
                .setName("prize")
                .setDescription("الجائزة")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("duration")
                .setDescription("المدة بالثواني")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("language")
                .setDescription("لغة القيف أواي")
                .setRequired(true)
                .addChoices(
                    { name: "العربية", value: "ar" },
                    { name: "English", value: "en" }
                )
        ),

    new SlashCommandBuilder()
        .setName("guess_game")
        .setDescription("ابدأ لعبة تخمين الرقم")
];

const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN
);

(async () => {
    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            {
                body: commands.map(cmd => cmd.toJSON())
            }
        );

        console.log("Slash commands registered successfully.");
    } catch (error) {
        console.error(error);
    }
})();