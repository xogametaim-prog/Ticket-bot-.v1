const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const Database = require('better-sqlite3');

// 1️⃣ إعداد خادم الويب (Keep-Alive لمنصة Render)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('World Cup 2026 Live Updates Bot 🔥 Online!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// 2️⃣ إعداد قاعدة البيانات الشاملة (SQLite3)
const db = new Database('worldcup2026.db');

// جدول الأعضاء، النقاط، والفرق المفضلة والإحصائيات
db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        username TEXT,
        points INTEGER DEFAULT 0,
        favoriteTeam TEXT DEFAULT 'لم يحدد بعد ⚽',
        lastLuckyCard TEXT,
        goalsScored INTEGER DEFAULT 0
    )
`).run();

// جدول إعدادات السيرفر وروم الأخبار المخصص
db.prepare(`
    CREATE TABLE IF NOT EXISTS config (
        guildId TEXT PRIMARY KEY,
        newsChannelId TEXT,
        verificationRole TEXT
    )
`).run();

// جدول توقعات المباريات
db.prepare(`
    CREATE TABLE IF NOT EXISTS predictions (
        userId TEXT PRIMARY KEY,
        prediction TEXT
    )
`).run();

// 3️⃣ إنشاء عميل الديسكورد وتحديد الصلاحيات والنوايا المطلوبة
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const BOT_NAME = "World Cup 2026 Bot";
const BOT_VERSION = "2.0v 🏆 Ultimate Live";
const activeGames = new Set();

// 4️⃣ قواميس البيانات للألعاب التفاعلية (أعلام + لاعبين)
const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" },
    { countryAr: "الأرجنتين", countryEn: "argentina", flagUrl: "https://flagcdn.com/w640/ar.png" },
    { countryAr: "فرنسا", countryEn: "france", flagUrl: "https://flagcdn.com/w640/fr.png" },
    { countryAr: "البرازيل", countryEn: "brazil", flagUrl: "https://flagcdn.com/w640/br.png" },
    { countryAr: "المكسيك", countryEn: "mexico", flagUrl: "https://flagcdn.com/w640/mx.png" },
    { countryAr: "أمريكا", countryEn: "usa", flagUrl: "https://flagcdn.com/w640/us.png" },
    { countryAr: "كندا", countryEn: "canada", flagUrl: "https://flagcdn.com/w640/ca.png" }
];

const playerData = [
    { nameAr: "ميسي", nameEn: "messi", hints: ["أسطورة الأرجنتين وحامل اللقب الأخير 🇦🇷", "يلعب بالقدم اليسرى السحرية 🪄", "صاحب الرقم 10 التاريخي"] },
    { nameAr: "رونالدو", nameEn: "ronaldo", hints: ["الهداف التاريخي لمنتخب البرتغال 🇵🇹", "يلقب بالدون أو الـ CR7 🏎️", "معروف بقوته البدنية وقفزاته الخارقة"] },
    { nameAr: "مبابي", nameEn: "mbappe", hints: ["صاروخ هجوم منتخب فرنسا السريع 🇫🇷", "سجل هاتريك تاريخي في نهائي 2022 ⚽", "ينشط حالياً في الدوري الإسباني"] },
    { nameAr: "حكيمي", nameEn: "hakimi", hints: ["الظهير الطائر النفاثة لمنتخب المغرب 🇲🇦", "ساهم في الإنجاز التاريخي والمركز الرابع عالمياً 🦁", "متخصص في تنفيذ الركلات الحرة الحاسمة"] },
    { nameAr: "صلاح", nameEn: "salah", hints: ["الملك المصري وقائد الفراعنة 🇪🇬", "أحد أفضل الأجنحة الهجومية في تاريخ البريميرليج 🏴󠁧󠁢󠁥󠁮󠁧󠁿", "صاحب السرعات الخارقة والإنهاء المميز"] },
    { nameAr: "الدوسري", nameEn: "al dawsari", hints: ["التورنيدو ونجم منتخب السعودية 🇸🇦", "سجل هدف الفوز الأسطوري التاريخي ضد الأرجنتين في 2022 🏆", "يتميز بمهاراته الفردية العالية واحتفاليته الشهيرة"] }
];

const teamsList = [
    { name: "🇲🇦 المغرب", id: "morocco" }, { name: "🇸🇦 السعودية", id: "saudi_arabia" },
    { name: "🇪🇬 مصر", id: "egypt" }, { name: "🇲🇽 المكسيك", id: "mexico" },
    { name: "🇺🇸 أمريكا", id: "usa" }, { name: "🇨🇦 كندا", id: "canada" },
    { name: "🇦🇷 الأرجنتين", id: "argentina" }, { name: "🇧🇷 البرازيل", id: "brazil" },
    { name: "🇫🇷 فرنسا", id: "france" }, { name: "🇪🇸 إسبانيا", id: "spain" },
    { name: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 إنجلترا", id: "england" }, { name: "🇩🇪 ألمانيا", id: "germany" }
];

// 5️⃣ تسجيل وتحديث جميع الـ Slash Commands التفاعلية
client.once('ready', async () => {
    console.log(`Logged in successfully as ${client.user.tag}!`);
    console.log(`Current Bot Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض دليل المساعدة والأوامر بالكامل / Help Menu'),
        new SlashCommandBuilder().setName('teams').setDescription('عرض المنتخبات والمجموعات المبرمجة كأس العالم / Show Groups'),
        new SlashCommandBuilder().setName('guess-flag').setDescription('بدء جولة تخمين سريعة لاسم العلم (عربي/إنجليزي)'),
        new SlashCommandBuilder().setName('guess-player').setDescription('بدء تحدي "من أنا؟" لتخمين نجم المونديال من خلال التلميحات'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي، نقاطك وفريقك المفضل / Player Profile'),
        new SlashCommandBuilder().setName('countdown').setDescription('مؤقت الوقت المتبقي لصافرة البداية والافتتاح / Countdown'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('عرض لوحة الصدارة لأعلى المشجعين بالنقاط / Leaderboard'),
        new SlashCommandBuilder().setName('info').setDescription('معلومات البوت التقنية والمطور وسرعة الاتصال'),
        new SlashCommandBuilder().setName('lucky-card').setDescription('اسحب بطاقتك المونديالية اليومية لتربح جوائز ونقاط عشوائية 🎁'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح المباشر بالأزرار ضد البوت الذكي ⚽'),
        new SlashCommandBuilder().setName('setup-verify').setDescription('إنشاء رسالة التحقق والـ Verification التلقائية بالأزرار (للإدارة)'),

        new SlashCommandBuilder()
            .setName('choose-team')
            .setDescription('اختر فريقك الذي تدعمه وتشجعه في المونديال ليظهر في ملفك 🏆')
            .addStringOption(opt => 
                opt.setName('team')
                .setDescription('اختر المنتخب المفضل')
                .setRequired(true)
                .addChoices(...teamsList.map(t => ({ name: t.name, value: t.name })))),

        new SlashCommandBuilder()
            .setName('predict')
            .setDescription('توقع نتيجة مباراة الافتتاح (المكسيك ضد كندا) واكسب +3 نقاط مجاناً! 🔮')
            .addIntegerOption(opt => opt.setName('mexico').setDescription('أهداف المكسيك').setRequired(true))
            .addIntegerOption(opt => opt.setName('canada').setDescription('أهداف كندا').setRequired(true)),

        new SlashCommandBuilder()
            .setName('set-news')
            .setDescription('تحديد قناة بث مباريات، أحداث، وأمطار وأخبار كأس العالم المباشرة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(opt => opt.setName('room').setDescription('اختر الروم المخصص للاخبار والاحداث المباشرة').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('⚡ All Updated Global Interactivity Slash Commands Registered Perfectly.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }

    setupAutomaticMatchResult();
    setupLiveWorldCupSimulator();
});

// دالة مساعدة لإدارة وإضافة النقاط لقاعدة البيانات
function addPoints(userId, username, amount) {
    const row = db.prepare('SELECT points FROM users WHERE userId = ?').get(userId);
    if (row) {
        db.prepare('UPDATE users SET points = points + ?, username = ? WHERE userId = ?').run(amount, username, userId);
        return row.points + amount;
    } else {
        db.prepare('INSERT INTO users (userId, username, points) VALUES (?, ?, ?)').run(userId, username, amount);
        return amount;
    }
}

// دالة مساعدة لإضافة إحصائية أهداف ركلات الجزاء المسجلة
function addPenaltyGoal(userId) {
    db.prepare('UPDATE users SET goalsScored = goalsScored + 1 WHERE userId = ?').run(userId);
}

// 6️⃣ محرك الألعاب التفاعلية المطور بالشات (أعلام / لاعبين)
async function startGuessGame(channel, type = 'flag') {
    if (activeGames.has(channel.id)) return channel.send('❌ هناك جولة قائمة بالفعل في هذه القناة، انتظر انتهائها! / Game is active.');
    activeGames.add(channel.id);

    if (type === 'flag') {
        const chosen = flagData[Math.floor(Math.random() * flagData.length)];
        const gameEmbed = new EmbedBuilder()
            .setTitle('🤔 خمن اسم الدولة صاحبة هذا العلم الأثري! / Guess the Flag')
            .setDescription('⏱️ أمامك **15 ثانية** فقط لكتابة اسم الدولة! (مقبول بالعربية أو English)')
            .setImage(chosen.flagUrl)
            .setColor(0xF39C12);

        await channel.send({ embeds: [gameEmbed] });

        const filter = res => {
            const ans = res.content.trim().toLowerCase();
            return ans === chosen.countryAr || ans === chosen.countryEn;
        };

        const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });
        let won = false;

        collector.on('collect', async m => {
            won = true;
            const total = addPoints(m.author.id, m.author.username, 1);
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 إجابة صحيحة خارقة ومذهلة! / Correct Answer!')
                .setDescription(`🏆 كفو يا بطل ${m.author}! عرفت العلم قبل الجميع!\nالدولة هي: **${chosen.countryAr}** | **${chosen.countryEn.toUpperCase()}**\nتم منحك **+1 نقطة**! رصيدك الكلي: \`${total}\``)
                .setColor(0x2ECC71);
            await channel.send({ embeds: [successEmbed] });
            collector.stop();
        });

        collector.on('end', () => {
            activeGames.delete(channel.id);
            if (!won) channel.send(`⏱️ انتهت الـ 15 ثانية! الإجابة الصحيحة هي: **${chosen.countryAr}** / **${chosen.countryEn.toUpperCase()}** 😔`);
        });

    } else if (type === 'player') {
        const chosen = playerData[Math.floor(Math.random() * playerData.length)];
        let hintText = chosen.hints.map((h, i) => `💡 **تلميح ${i+1}:** ${h}`).join('\n');

        const gameEmbed = new EmbedBuilder()
            .setTitle('🧠 تحدي "من أنا؟" المونديالي العبقري! / Guess the Player')
            .setDescription(`⏱️ أمامك **20 ثانية** لمعرفة هذا النجم المونديالي الشهير:\n\n${hintText}\n\nاكتب الاسم الآن بالشات (بالعربي أو English)!`)
            .setColor(0x9B59B6);

        await channel.send({ embeds: [gameEmbed] });

        const filter = res => {
            const ans = res.content.trim().toLowerCase();
            return ans === chosen.nameAr || ans === chosen.nameEn;
        };

        const collector = channel.createMessageCollector({ filter, time: 20000, max: 1 });
        let won = false;

        collector.on('collect', async m => {
            won = true;
            const total = addPoints(m.author.id, m.author.username, 2);
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 وااااو! كشفت قناع اللاعب المونديالي بنجاح!')
                .setDescription(`🏆 اللاعب هو النجم الأسطوري: **${chosen.nameAr.toUpperCase()}** / **${chosen.nameEn.toUpperCase()}**\nمنحتك الهيئة الرياضية **+2 نقاط** لسرعة بديهتك! رصيدك: \`${total}\``)
                .setColor(0x2ECC71);
            await channel.send({ embeds: [successEmbed] });
            collector.stop();
        });

        collector.on('end', () => {
            activeGames.delete(channel.id);
            if (!won) channel.send(`⏱️ انتهى وقت التحدي العبقري! اللاعب المفقود كان: **${chosen.nameAr.toUpperCase()}** 😔`);
        });
    }
}

// 7️⃣ استقبال الأوامر السريعة عبر الشات المباشر (.w فقط بعد إزالة التيشرتات)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const msgContent = message.content.trim().toLowerCase();
    if (msgContent === '.w') {
        await startGuessGame(message.channel, 'flag');
    }
});

// 8️⃣ معالجة الـ Slash Commands والتفاعلات بالكامل
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_member') {
            await interaction.deferReply({ ephemeral: true });
            let verifyRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
            if (!verifyRole) {
                return interaction.editReply({ content: '❌ لم يتم العثور على رتبة باسم `Member` في هذا السيرفر! يرجى إنشائها أولاً لتفعيل الزر.' });
            }
            try {
                await interaction.member.roles.add(verifyRole);
                return interaction.editReply({ content: `✅ تم التحقق منك بنجاح ومنحك رتبة **${verifyRole.name}**! استمتع معنا بالمونديال. 🎉` });
            } catch (err) {
                return interaction.editReply({ content: '❌ واجهت مشكلة أثناء محاولة إعطائك الرتبة! تأكد أن رتبة البوت أعلى من رتبة الأعضاء.' });
            }
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, channel, user, guild } = interaction;

    if (commandName === 'setup-verify') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص لمسؤولي السيرفر فقط!', ephemeral: true });
        }
        await interaction.deferReply();
        const verifyEmbed = new EmbedBuilder()
            .setTitle('🛡️ نظام التحقق والأمان التلقائي / Verification System')
            .setDescription('اضغط على الزر الأخضر بالأسفل لتأكيد هويتك، فتح جميع روم الشات، والوصول المباشر لألعاب المونديال! ⚽🚀\nClick the button below to verify.')
            .setColor(0x2980B9);

        const verifyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('verify_member').setLabel('تأكيد الحساب ✅').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [verifyEmbed], components: [verifyRow] });
        await interaction.editReply({ content: '📢 تم إرسال رسالة التحقق للغرفة الحالية بنجاح!' });
    }

    if (commandName === 'choose-team') {
        await interaction.deferReply();
        const selectedTeam = options.getString('team');
        const row = db.prepare('SELECT userId FROM users WHERE userId = ?').get(user.id);
        if (!row) {
            db.prepare('INSERT INTO users (userId, username, favoriteTeam) VALUES (?, ?, ?)').run(user.id, user.username, selectedTeam);
        } else {
            db.prepare('UPDATE users SET favoriteTeam = ?, username = ? WHERE userId = ?').run(selectedTeam, user.username, user.id);
        }
        await interaction.editReply({ content: `🏆 تم تسجيل **${selectedTeam}** كفريقك المفضل المشجع بالكامل! سيظهر في هويتك الرياضية ولوحة المتصدرين! ⚽🔥` });
    }

    if (commandName === 'predict') {
        await interaction.deferReply({ ephemeral: true });
        const goalsMex = options.getInteger('mexico');
        const goalsCan = options.getInteger('canada');
        const predictionStr = `${goalsMex}-${goalsCan}`;
        db.prepare('INSERT INTO predictions (userId, prediction) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET prediction = ?')
            .run(user.id, predictionStr, predictionStr);
        await interaction.editReply({ content: `🔮 تم حفظ توقعك الذكي لمباراة الافتتاح: **المكسيك ${goalsMex} - ${goalsCan} كندا**. سيقوم النظام بفحص النتيجة وتوزيع النقاط تلقائياً! ✨` });
    }

    if (commandName === 'profile') {
        await interaction.deferReply();
        let userData = db.prepare('SELECT points, favoriteTeam, goalsScored FROM users WHERE userId = ?').get(user.id);
        
        if (!userData) {
            db.prepare('INSERT INTO users (userId, username) VALUES (?, ?)').run(user.id, user.username);
            userData = { points: 0, favoriteTeam: 'لم يحدد بعد ⚽', goalsScored: 0 };
        }

        const profileEmbed = new EmbedBuilder()
            .setTitle(`🪪 الهوية والملف الرياضي الشخصي لـ ${user.username}`)
            .setDescription('بطاقتك الرسمية المونديالية لمتابعة إنجازاتك في ألعاب وتوقعات السيرفر:')
            .setColor(0x27AE60)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🥇 إجمالي نقاطك:', value: `\`${userData.points}\` نقطة`, inline: true },
                { name: '🥅 أهداف ركلات الترجيح:', value: `\`${userData.goalsScored}\` هدف مسجل`, inline: true },
                { name: '❤️ المنتخب المشجع والمفضل:', value: `**${userData.favoriteTeam}**`, inline: false }
            )
            .setFooter({ text: `World Cup Player ID: ${user.id}` });

        await interaction.editReply({ embeds: [profileEmbed] });
    }

    if (commandName === 'penalty') {
        await interaction.deferReply();
        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shoot_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shoot_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shoot_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );

        const startEmbed = new EmbedBuilder()
            .setTitle('⚽ تحدي ركلات الترجيح الكبرى 🥅')
            .setDescription(`أهلاً بك اللاعب القدير **${user.username}**! ركز جيداً، حدد زاوية التسديد، وحاول التغلب على قفزة الحارس الذكي!`)
            .setColor(0x2980B9);

        const msg = await interaction.editReply({ embeds: [startEmbed], components: [rowAction] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        collector.on('collect', async btnInteraction => {
            if (btnInteraction.user.id !== user.id) {
                return btnInteraction.reply({ content: '❌ اترك ركلة الجزاء هذه للاعبها!', ephemeral: true });
            }
            await btnInteraction.deferUpdate();
            const directions = ['shoot_left', 'shoot_center', 'shoot_right'];
            const botGoalkeeperJump = directions[Math.floor(Math.random() * directions.length)];
            const userShoot = btnInteraction.customId;

            let resultTitle, resultDesc, finalColor;
            if (userShoot === botGoalkeeperJump) {
                resultTitle = '❌ تصدى لها الحارس بطريقة إعجازية!';
                resultDesc = `💥 قفز الحارس لنفس زاوية تسديدتك وتصدى لها! حاول مجدداً ولا تيأس!`;
                finalColor = 0xC0392B;
            } else {
                resultTitle = '⚽ هدف! تهتز الشباك المونديالية الحارقة!';
                const newTotal = addPoints(user.id, user.username, 1);
                addPenaltyGoal(user.id);
                resultDesc = `🎉 تسديدة بارعة ومخادعة! ارتمى الحارس في جهة أخرى لتسكن الكرة الشباك!\nتم إضافة **+1 نقطة** ورفع رصيد أهدافك! رصيدك: \`${newTotal}\``;
                finalColor = 0x27AE60;
            }

            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(resultTitle).setDescription(resultDesc).setColor(finalColor)], components: [] });
            collector.stop();
        });
    }

    if (commandName === 'lucky-card') {
        await interaction.deferReply();
        const nowStr = new Date().toDateString();
        const userData = db.prepare('SELECT lastLuckyCard, points FROM users WHERE userId = ?').get(user.id);
        if (userData && userData.lastLuckyCard === nowStr) {
            return interaction.editReply({ content: '🗓️ لقد سحبت بطاقتك اليومية بالفعل! يرجى الانتظار والعودة مجدداً غداً.' });
        }

        const luckyRewards = [
            { text: "🥇 حظ أسطوري نادر! حصلت على تشجيع الجماهير ونلت +3 نقاط مجاناً!", pts: 3, color: 0xF1C40F },
            { text: "👟 حذاء ذهبي تكتيكي! منحتك الهيئة الرياضية +1 نقطة إضافية لمهارتك!", pts: 1, color: 0x2ECC71 },
            { text: "🟨 كرت أصفر من الحكم للتمثيل داخل منطقة الجزاء! لم تكسب شيئاً اليوم.", pts: 0, color: 0xE67E22 },
            { text: "🟥 كرت أحمر وطرد من منصة الحظ لليوم! حظاً أوفر في المرات القادمة.", pts: 0, color: 0xE74C3C }
        ];

        const finalReward = luckyRewards[Math.floor(Math.random() * luckyRewards.length)];
        if (!userData) {
            db.prepare('INSERT INTO users (userId, username, points, lastLuckyCard) VALUES (?, ?, ?, ?)').run(user.id, user.username, finalReward.pts, nowStr);
        } else {
            db.prepare('UPDATE users SET points = points + ?, lastLuckyCard = ?, username = ? WHERE userId = ?').run(finalReward.pts, nowStr, user.username, user.id);
        }

        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`🎁 بطاقة الحظ لـ ${user.username}`).setDescription(finalReward.text).setColor(finalReward.color)] });
    }

    if (commandName === 'info') {
        await interaction.deferReply();
        const infoEmbed = new EmbedBuilder()
            .setTitle(`🤖 البيانات الفنية لـ ${BOT_NAME}`)
            .setColor(0x34495E)
            .addFields(
                { name: '💿 إصدار النظام المحدث:', value: `\`${BOT_VERSION}\``, inline: true },
                { name: '👑 كبير مطوري البوت:', value: `\`Lead Developer (BRQ & RTR)\``, inline: true },
                { name: '🌐 إجمالي السيرفرات المتصلة:', value: `\`${client.guilds.cache.size}\``, inline: false },
                { name: '⚡ سرعة استجابة الشبكة (Ping):', value: `\`${client.ws.ping}ms\``, inline: true }
            );
        await interaction.editReply({ embeds: [infoEmbed] });
    }

    if (commandName === 'help') {
        await interaction.deferReply();
        const helpEmbed = new EmbedBuilder()
            .setTitle(`📖 الدليل الإرشادي لبوت المونديال الأسطوري / Bot Help Menu`)
            .setDescription(`قائمة متكاملة لجميع الأوامر المبرمجة حالياً بدعم اللغتين العربي والإنجليزي:`)
            .addFields(
                { name: '🎮 ألعاب وتحديات ترفيهية / Games', value: '`/penalty` - تحدي ركلات ترجيح كامل بالأزرار\n`/lucky-card` - كرت الحظ اليومي لربح النقاط\n`/guess-player` - تحدي "من أنا؟" لتخمين لاعبين\n`.w` - تشغيل تخمين علم الدولة المونديالية بالشات', inline: true },
                { name: '🏆 شؤون كأس العالم / World Cup', value: '`/profile` - عرض ملفك الشخصي الرياضي وأهدافك ونقاطك\n`/choose-team` - حدد منتخبك المفضل في البطولة\n`/predict` - توقع مباراة الافتتاح لتكسب +3 نقاط\n`/teams` - عرض المجموعات والمنتخبات\n`/countdown` - الوقت المتبقي على الافتتاح المكسيكي', inline: true },
                { name: '🛠️ أدوات الإدارة والأمن / Admin Tools', value: '`/set-news` - تحديد الروم الرسمي لاستقبال البث والأحداث الحية والأمطار والأهداف\n`/setup-verify` - إرسال رسالة التحقق بالأزرار التلقائية لحماية السيرفر', inline: false }
            ).setColor(0x8E44AD);
        await interaction.editReply({ embeds: [helpEmbed] });
    }

    if (commandName === 'teams') {
        await interaction.deferReply();
        const teamsEmbed = new EmbedBuilder()
            .setTitle('🌍 تفاصيل مجموعات كأس العالم والمنتخبات المتاحة للتشجيع')
            .setDescription(`🏆 **الهيكلية البرمجية المعتمدة حالياً:**\n\n• **المجموعة أ:** المكسيك 🇲🇽، كندا 🇨🇦، أمريكا 🇺🇸\n• **المجموعة ب:** الأرجنتين 🇦🇷، فرنسا 🇫🇷، البرازيل 🇧🇷، المغرب 🇲🇦، مصر 🇪🇬، السعودية 🇸🇦.`)
            .setColor(0x16A085);
        await interaction.editReply({ embeds: [teamsEmbed] });
    }

    if (commandName === 'guess-flag') {
        await startGuessGame(channel, 'flag');
    }

    if (commandName === 'guess-player') {
        await startGuessGame(channel, 'player');
    }

    if (commandName === 'countdown') {
        await interaction.deferReply();
        const worldCupDate = new Date('2026-06-11T18:00:00Z');
        const difference = worldCupDate - new Date();
        if (difference <= 0) return interaction.editReply({ content: '🎉 انطلقت صافرة البداية الرسمية لكأس العالم 2026 والافتتاح الآن بالمكسيك! ⚽🏆' });

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const cdEmbed = new EmbedBuilder()
            .setTitle('⏳ المؤقت التنازلي لانطلاق كأس العالم')
            .setDescription(`🏟️ المتبقي على الافتتاح الرسمي التاريخي: **${days}** يوم و **${hours}** ساعة و **${minutes}** دقيقة!`)
            .setColor(0x2980B9);
        await interaction.editReply({ embeds: [cdEmbed] });
    }

    if (commandName === 'leaderboard') {
        await interaction.deferReply();
        const rows = db.prepare('SELECT username, points, favoriteTeam FROM users ORDER BY points DESC LIMIT 10').all();
        if (rows.length === 0) return interaction.editReply({ content: '📊 لا توجد نقاط مسجلة للاعبين حالياً!' });

        let description = "🏆 **ترتيب أعلى 10 مشجعين بالنقاط والمنتخب المشجع:**\n\n";
        rows.forEach((row, index) => {
            let medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            description += `${medal} **${row.username}** — \`${row.points}\` نقطة [الفريق: ${row.favoriteTeam}]\n`;
        });
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📊 لوحة الصدارة العالمية لجمهور السيرفر').setDescription(description).setColor(0xF1C40F)] });
    }

    if (commandName === 'set-news') {
        await interaction.deferReply({ ephemeral: true });
        const targetRoom = options.getChannel('room');
        db.prepare('INSERT INTO config (guildId, newsChannelId) VALUES (?, ?) ON CONFLICT(guildId) DO UPDATE SET newsChannelId = ?').run(guild.id, targetRoom.id, targetRoom.id);
        await interaction.editReply({ content: `📢 تم ربط وتعيين روم ${targetRoom} لاستقبال بث أحداث المونديال الحية (الأهداف، انطلاق المونديال، والطقس)!` });
    }
});

// 9️⃣ ميكانيكية إعلان نتيجة الافتتاح التلقائي للتواريخ الثابتة
function setupAutomaticMatchResult() {
    const matchEndTime = new Date('2026-06-11T21:30:00Z'); 
    const delay = matchEndTime - new Date();

    if (delay > 0) {
        setTimeout(async () => {
            const correctResult = "2-1";
            const guildsConfig = db.prepare('SELECT * FROM config').all();
            const winners = db.prepare('SELECT userId FROM predictions WHERE prediction = ?').all(correctResult);

            for (const conf of guildsConfig) {
                try {
                    const channel = await client.channels.fetch(conf.newsChannelId);
                    if (!channel) continue;

                    let winnersMentions = winners.map(w => `<@${w.userId}>`).join(', ') || "لا يوجد مشجع توقع النتيجة بدقة تامة للاسف 😔";
                    winners.forEach(w => { db.prepare('UPDATE users SET points = points + 3 WHERE userId = ?').run(w.userId); });

                    const resultEmbed = new EmbedBuilder()
                        .setTitle('🚨 صافرة النهاية: النتيجة الرسمية وجوائز التوقعات 🔮')
                        .setDescription(`⚽ **مباراة الافتتاح:** المكسيك **2 - 1** كندا\n\n🥇 **المشجعين أصحاب التوقع الصحيح الذين فازوا بـ +3 نقاط:**\n${winnersMentions}`)
                        .setColor(0xF1C40F);

                    await channel.send({ embeds: [resultEmbed] });
                } catch (err) { console.error(err); }
            }
        }, delay);
    }
}

// 🔟 محاكاة الأحداث المونديالية والطقس والأهداف المباشرة تلقائياً (تشتغل دورياً بالروم المختار)
function setupLiveWorldCupSimulator() {
    const liveEvents = [
        { title: "🚨 عاجل: انطلاق صافرة بداية كأس العالم 2026 رسميًا!", desc: "🏟️ الألعاب النارية تغطي سماء ملعب الافتتاح بالمكسيك والجماهير تهتف بحرارة! انطلقت البطولة الأعظم تاريخيًا! ⚽🏆", color: 0x27AE60 },
        { title: "🌦️ تقلبات الطقس في المنديال: هطول أمطار غزيرة!", desc: "🌧️ عاصفة مطرية مفاجئة تضرب أرضية الميدان الآن! الكرة تصبح أسرع والمدربون يغيرون الخطط التكتيكية فوراً! ⛈️", color: 0x3498DB },
        { title: "❄️ تحديث الأجواء المونديالية: موجة برد وثلوج خفيفة!", desc: "❄️ تساقط بلورات الثلج الخفيفة في الملاعب الشمالية المفتوحة! اللاعبون يرتدون القفازات الحرارية والجمهور يشعل المدرجات بالهتاف! 🥶", color: 0xECF0F1 },
        { title: "⚽ جـوووووول! المنتخب المغربي يسجل الهدف الأول!", desc: "🔥 أسود الأطلس يفتتحون التسجيل بكرة رأسية قوية وصاروخية تمزق شباك الخصم! المدرجات تشتعل باللون الأحمر! 🇲🇦🦁", color: 0xC0392B },
        { title: "⚽ جـوووووول! الصقور الخضر يهزون الشباك بنجاح!", desc: "🇸🇦 هجمة مرتدة تكتيكية سريعة تنتهي بتسديدة ساحرة من المنتخب السعودي تعلن عن هدف رائع في شباك الخصم! 🟢🦅", color: 0x2ECC71 },
        { title: "⚽ جـوووووول! الفراعنة يفجرون المرمى بهدف حاسم!", desc: "🇪🇬 تمريرة بينية متقنة تضع هجوم منتخب مصر في انفراد تام ليسكنها شباك الخصم ببراعة لا تصدق! تاش تاش! 🔥", color: 0xE74C3C }
    ];

    // يعمل النظام على بث حدث مونديالي مباشر مشوق عشوائياً كل 45 دقيقة بالرومات المحددة من قبل الإدارة
    setInterval(async () => {
        const guildsConfig = db.prepare('SELECT * FROM config').all();
        if (guildsConfig.length === 0) return;

        const randomEvent = liveEvents[Math.floor(Math.random() * liveEvents.length)];
        const liveEmbed = new EmbedBuilder()
            .setTitle(randomEvent.title)
            .setDescription(randomEvent.desc)
            .setColor(randomEvent.color)
            .setTimestamp();

        for (const conf of guildsConfig) {
            try {
                const channel = await client.channels.fetch(conf.newsChannelId);
                if (channel) await channel.send({ embeds: [liveEmbed] });
            } catch (err) {
                // تخطي إذا كانت الغرفة غير موجودة أو الصلاحيات ناقصة
            }
        }
    }, 45 * 60 * 1000); 
}

// تسجيل الدخول بالتوكن المرفق في البيئة المحمية
client.login(process.env.TOKEN);
