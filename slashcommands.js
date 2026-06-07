const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder().setName("worldcup").setDescription("معلومات كأس العالم 2026"),
  new SlashCommandBuilder().setName("teams").setDescription("عرض المنتخبات"),
  new SlashCommandBuilder().setName("schedule").setDescription("الجدول"),
  new SlashCommandBuilder().setName("stadiums").setDescription("الملاعب"),
  new SlashCommandBuilder().setName("pick_team").setDescription("اختيار منتخب"),
  new SlashCommandBuilder().setName("my_team").setDescription("منتخبك"),
  new SlashCommandBuilder().setName("guess_team").setDescription("لعبة التخمين"),
  new SlashCommandBuilder().setName("leaderboard").setDescription("الترتيب")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Deleting old commands...");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("ALL commands refreshed ✔");
  } catch (err) {
    console.error(err);
  }
})();