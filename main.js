const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const {
Client,
GatewayIntentBits,
Events,
ActionRowBuilder,
StringSelectMenuBuilder,
EmbedBuilder,
PermissionFlagsBits
} = require("discord.js");

// ================= WEB SERVER =================

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
res.send("World Cup 2026 Bot Online");
});

app.listen(PORT, () => {
console.log("Web server running on port ${PORT}");
});

// ================= DATABASE =================

const db = new sqlite3.Database("./worldcup.db");

db.run("CREATE TABLE IF NOT EXISTS users ( userId TEXT PRIMARY KEY, team TEXT NOT NULL )");

db.run("CREATE TABLE IF NOT EXISTS guilds ( guildId TEXT PRIMARY KEY, language TEXT NOT NULL )");

db.run("CREATE TABLE IF NOT EXISTS leaderboard ( userId TEXT PRIMARY KEY, points INTEGER DEFAULT 0 )");

// ================= COUNTRY ANSWERS =================

const countryAnswers = {

"USA": ["usa","united states","america","أمريكا","امريكا"],
"Mexico": ["mexico","المكسيك"],
"Canada": ["canada","كندا"],
"Algeria": ["algeria","الجزائر","الجيريا"],
"Argentina": ["argentina","الأرجنتين","الارجنتين"],
"Australia": ["australia","أستراليا","استراليا"],
"Austria": ["austria","النمسا","اوستريا"],
"Belgium": ["belgium","بلجيكا"],
"Bosnia": ["bosnia","bosnia and herzegovina","البوسنة","البوسنة والهرسك"],
"Brazil": ["brazil","البرازيل"],
"Cape Verde": ["cape verde","كاب فيردي","الرأس الأخضر"],
"Colombia": ["colombia","كولومبيا"],
"DR Congo": ["dr congo","congo","جمهورية الكونغو الديمقراطية","الكونغو"],
"Cote d'Ivoire": ["cote divoire","ivory coast","ساحل العاج","كوت ديفوار"],
"Croatia": ["croatia","كرواتيا"],
"Curacao": ["curacao","كوراساو"],
"Czech Republic": ["czech republic","czechia","التشيك"],
"Ecuador": ["ecuador","الإكوادور","الاكوادور"],
"Egypt": ["egypt","مصر"],
"England": ["england","إنجلترا","انجلترا"],
"France": ["france","فرنسا"],
"Germany": ["germany","ألمانيا","المانيا"],
"Ghana": ["ghana","غانا"],
"Haiti": ["haiti","هايتي"]

};

// ================= TEAM FLAGS (1 - 24) =================

const teamFlags = {

"USA":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513905213201846392/USA.png",

"Mexico":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513905218029617182/MEX.png",

"Canada":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513904410798063696/CAN.png",

"Algeria":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906087617626242/ALG.png",

"Argentina":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906313787215932/ARG.png",

"Australia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906551180492971/AUS.png",

"Austria":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906667237019679/AUT.png",

"Belgium":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906790348226712/BEL.png",

"Bosnia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513906992207630427/BIH.png",

"Brazil":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908176137748613/BRA.png",

"Cape Verde":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908274368348200/CPV.png",

"Colombia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908455994429512/COL.png",

"DR Congo":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908591680294962/COD.png",

"Cote d'Ivoire":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513908707686224002/CIV.png",

"Croatia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513909283111178390/CRO.png",

"Curacao":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513909401457659934/CUW.png",

"Czech Republic":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513910724903043335/CZE.png",

"Ecuador":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911000250843337/ECU.png",

"Egypt":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911250739007549/EGY.png",

"England":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911313422880788/ENG.png",

"France":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911401448603809/FRA.png",

"Germany":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911493530484807/GER.png",

"Ghana":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911571179638876/GHA.png",

"Haiti":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911750888784072/HAI.png",
"Iran":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911879876087970/IRN.png",

"Iraq":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513911948817989732/IRQ.png",

"Japan":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912006934265957/JPN.png",

"Jordan":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912072805683260/JOR.png",

"South Korea":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912134147510402/KOR.png",

"Morocco":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912192930549862/MAR.png",

"Netherlands":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912270001012936/NED.png",

"New Zealand":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912511341133864/NZL.png",

"Norway":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912653221724322/NOR.png",

"Panama":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513912795496841459/PAN.png",

"Paraguay":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513913543370608641/PAR.png",

"Portugal":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513913691937181766/POR.png",

"Qatar":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513913827991752806/QAT.png",

"Saudi Arabia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513913892386902037/KSA.png",

"Scotland":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513913998431617206/SCO.png",

"Senegal":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914164454887674/SEN.png",

"South Africa":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914254363725919/RSA.png",

"Spain":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914328041132285/ESP.png",

"Sweden":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914374933184762/SWE.png",

"Switzerland":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914468151857409/SUI.png",

"Tunisia":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914618865651812/TUN.png",

"Turkey":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914724981542942/TUR.png",

"Uruguay":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914777447960838/URU.png",

"Uzbekistan":
"https://cdn.discordapp.com/attachments/1468904544321671220/1513914875091484804/UZB.png"

};

// ================= COUNTRY ANSWERS PART 2 =================

Object.assign(countryAnswers, {

"Iran": ["iran","إيران","ايران"],
"Iraq": ["iraq","العراق"],
"Japan": ["japan","اليابان"],
"Jordan": ["jordan","الأردن","الاردن"],
"South Korea": ["south korea","korea","كوريا الجنوبية"],
"Morocco": ["morocco","المغرب"],
"Netherlands": ["netherlands","holland","هولندا"],
"New Zealand": ["new zealand","نيوزيلندا"],
"Norway": ["norway","النرويج"],
"Panama": ["panama","بنما"],
"Paraguay": ["paraguay","باراغواي"],
"Portugal": ["portugal","البرتغال"],
"Qatar": ["qatar","قطر"],
"Saudi Arabia": ["saudi arabia","ksa","السعودية"],
"Scotland": ["scotland","إسكتلندا","اسكتلندا"],
"Senegal": ["senegal","السنغال"],
"South Africa": ["south africa","جنوب أفريقيا","جنوب افريقيا"],
"Spain": ["spain","إسبانيا","اسبانيا"],
"Sweden": ["sweden","السويد"],
"Switzerland": ["switzerland","سويسرا"],
"Tunisia": ["tunisia","تونس"],
"Turkey": ["turkey","تركيا"],
"Uruguay": ["uruguay","الأوروغواي","اوروغواي"],
"Uzbekistan": ["uzbekistan","أوزبكستان","اوزبكستان"]

});

const activeGuesses = new Map();
// ================= GUESS TEAM COMMAND =================

if (interaction.commandName === "guess_team") {

const countries = Object.keys(teamFlags);

const randomCountry =
countries[
Math.floor(
Math.random() * countries.length
)
];

activeGuesses.set(
interaction.channelId,
randomCountry
);

const embed = new EmbedBuilder()
.setTitle("🎮 Guess The Country")
.setDescription(
"اكتب اسم الدولة بالعربي أو الإنجليزي"
)
.setImage(
teamFlags[randomCountry]
);

return interaction.reply({
embeds: [embed]
});

}

// ================= MESSAGE ANSWERS =================

client.on(
Events.MessageCreate,
async (message) => {

if (message.author.bot) return;

const currentCountry =
activeGuesses.get(
message.channel.id
);

if (!currentCountry) return;

const answers =
countryAnswers[currentCountry];

if (!answers) return;

const userAnswer =
message.content
.toLowerCase()
.trim();

const correct =
answers.some(
a =>
a.toLowerCase() ===
userAnswer
);

if (!correct) return;

activeGuesses.delete(
message.channel.id
);

db.run(
"INSERT INTO leaderboard (userId, points) VALUES (?, 1) ON CONFLICT(userId) DO UPDATE SET points = points + 1",
[message.author.id]
);

const winEmbed =
new EmbedBuilder()
.setTitle("✅ Correct Answer!")
.setDescription(
"${message.author} guessed **${currentCountry}**"
)
.setImage(
teamFlags[currentCountry]
);

message.reply({
embeds: [winEmbed]
});

});

// ================= LEADERBOARD =================

if (
interaction.commandName ===
"leaderboard"
) {

db.all(
"SELECT * FROM leaderboard ORDER BY points DESC LIMIT 10",
[],
(err, rows) => {

if (!rows?.length) {

return interaction.reply(
"لا يوجد لاعبين بعد."
);

}

const text = rows
.map(
(r, i) =>
"${i + 1}. <@${r.userId}> - ${r.points}"
)
.join("\n");

interaction.reply({
content: text
});

}
);

}
// ================= LANGUAGE COMMAND =================

if (interaction.commandName === "language") {

const selected = interaction.options.getString("lang");

db.run(
"INSERT OR REPLACE INTO guilds(guildId, language) VALUES(?,?)",
[
interaction.guild.id,
selected
]
);

return interaction.reply(
selected === "ar"
? texts.ar.languageSaved
: texts.en.languageSaved
);

}

// ================= BROADCAST =================

if (interaction.commandName === "broadcast") {

if (
!interaction.member.permissions.has(
PermissionFlagsBits.Administrator
)
) {

return interaction.reply({
content: "❌ Admin only",
ephemeral: true
});
}

const message = interaction.options.getString("message");

await interaction.reply({
content: "📨 Sending...",
ephemeral: true
});

const members = await interaction.guild.members.fetch();

let sent = 0;

for (const member of members.values()) {

if (member.user.bot) continue;

try {
await member.send(message);
sent++;
} catch {}
}

return interaction.followUp({
content: "✅ Sent to ${sent} members",
ephemeral: true
});
}

// ================= LOGIN =================

client.login(process.env.DISCORD_TOKEN);

// ================= SAFETY NOTES =================
// - Accepts Arabic + English country names
// - Flags show automatically in guess game
// - Leaderboard updates on correct answers
// - Database stores users, teams, points, language