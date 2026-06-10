/**
 * Bot Version: 3.5 (Full Cloud & Interactivity Edition)
 * Developer: ta_im1
 * Team: TRL for development
 */

const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const express = require('express');
const { Pool } = require('pg');

// 1️⃣ إعداد خادم الويب (حل مشكلة الـ Port Scan و الـ Timeout على Render)
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Bot Online! Supported by TRL for development 🚀'));
app.listen(port, () => console.log(`Web server successfully listening on port ${port}`));

// 2️⃣ إعداد عميل الديسكورد والنوايا المطلوبة
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const BOT_VERSION = "3.5v ☁️ Cloud Persistence Edition";
const footerText = { text: "Development: ta_im1 | Team: TRL for development" };
const activeGames = new Set();

// 3️⃣ إعداد قاعدة البيانات السحابية (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                userId TEXT PRIMARY KEY,
                username TEXT,
                points INTEGER DEFAULT 0,
                favoriteTeam TEXT DEFAULT 'لم يحدد بعد ⚽',
                lastLuckyCard TEXT,
                goalsScored INTEGER DEFAULT 0
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS config (
                guildId TEXT PRIMARY KEY,
                newsChannelId TEXT,
                verificationRole TEXT
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS predictions (
                userId TEXT PRIMARY KEY,
                prediction TEXT
            )
        `);
        console.log('✅ Connected to Cloud Database successfully!');
    } catch (err) {
        console.error('❌ Database Init Error:', err);
    }
}
initDatabase();

// دالة إضافة النقاط وإرسال تنبيه خاص للعضو (DM)
async function addPoints(userId, username, amount) {
    let newPoints = amount;
    const res = await pool.query('SELECT points FROM users WHERE userId = $1', [userId]);
    if (res.rows.length > 0) {
        newPoints = res.rows[0].points + amount;
        await pool.query('UPDATE users SET points = $1, username = $2 WHERE userId = $3', [newPoints, username, userId]);
    } else {
        await pool.query('INSERT INTO users (userId, username, points) VALUES ($1, $2, $3)', [userId, username, amount]);
    }

    // إرسال رسالة خاصة تلقائياً عند كسب نقاط
    try {
        const user = await client.users.fetch(userId);
        if (user) {
            await user.send(`🎉 مبروك يا بطل! لقد حصلت على **+${amount}** نقطة جديدة!\nرصيدك الإجمالي الحالي هو: \`${newPoints}\` نقطة 🏆`);
        }
    } catch (e) {
        console.log(`Could not send DM to user ${userId}, probably DMs are closed.`);
    }
    return newPoints;
}

async function addPenaltyGoal(userId) {
    await pool.query('UPDATE users SET goalsScored = goalsScored + 1 WHERE userId = $1', [userId]);
}

// القواميس والبيانات الأساسية للالعاب والفرق
const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" },
    { countryAr: "الأرجنتين", countryEn: "argentina", flagUrl: "https://flagcdn.com/w640/ar.png" },
    { countryAr: "فرنسا", countryEn: "france", flagUrl: "https://flagcdn.com/w640/fr.png" },
    { countryAr: "البرازيل", countryEn: "brazil", flagUrl: "https://flagcdn.com/w640/br.png" }
];

const playerData = [
    { nameAr: "ميسي", nameEn: "messi", hints: ["أسطورة الأرجنتين وحامل اللقب الأخير 🇦رجنتين 🇦🇷", "صاحب الرقم 10 التاريخي"] },
    { nameAr: "رونالدو", nameEn: "ronaldo", hints: ["الهداف التاريخي لمنتخب البرتغال 🇵🇹", "يلقب بالدون أو الـ CR7"] }
];

const teamsList = [
    { name: "🇲🇦 المغرب", id: "morocco" }, { name: "🇸🇦 السعودية", id: "saudi_arabia" },
    { name: "🇪🇬 مصر", id: "egypt" }, { name: "🇦🇷 الأرجنتين", id: "argentina" },
    { name: "🇧🇷 البرازيل", id: "brazil" }, { name: "🇫🇷 فرنسا", id: "france" }
];

// 4️⃣ تسجيل الـ Slash Commands
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض دليل المساعدة والأوامر بالكامل'),
        new SlashCommandBuilder().setName('teams').setDescription('عرض المنتخبات والمجموعات المبرمجة'),
        new SlashCommandBuilder().setName('guess-flag').setDescription('بدء جولة تخمين سريعة لاسم العلم'),
        new SlashCommandBuilder().setName('guess-player').setDescription('بدء تحدي "من أنا؟" لتخمين نجم المونديال'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي، نقاطك وفريقك المفضل'),
        new SlashCommandBuilder().setName('countdown').setDescription('مؤقت الوقت المتبقي لصافرة البداية والافتتاح'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('عرض لوحة الصدارة لأعلى المشجعين بالنقاط'),
        new SlashCommandBuilder().setName('lucky-card').setDescription('اسحب بطاقتك المونديالية اليومية لتربح جوائز ونقاط'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح المباشر بالأزرار ضد البوت'),
        new SlashCommandBuilder().setName('setup-verify').setDescription('إنشاء رسالة التحقق والـ Verification التلقائية بالأزرار (للإدارة)'),
        new SlashCommandBuilder().setName('guess-nationality').setDescription('بدء لعبة خمن جنسية اللاعب الجديدة (شبكة 3x3)'),
        
        new SlashCommandBuilder()
            .setName('match-poll')
            .setDescription('إنشاء تصويت تفاعلي بالأزرار لمباراة مونديالية (للإدارة فقط)')
            .addStringOption(opt => opt.setName('description').setDescription('وصف المباراة').setRequired(true))
            .addStringOption(opt => opt.setName('team1').setDescription('اسم المنتخب الأول').setRequired(true))
            .addStringOption(opt => opt.setName('team2').setDescription('اسم المنتخب الثاني').setRequired(true))
            .addBooleanOption(opt => opt.setName('allow-draw').setDescription('هل تريد إتاحة خيار التعادل؟').setRequired(true)),

        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('إنشاء قيف اوي مونديالي منظم بالوقت والإيموجي (للإدارة فقط)')
            .addStringOption(opt => opt.setName('prize').setDescription('الجائزة').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('المدة الزمنية').setRequired(true))
            .addStringOption(opt => opt.setName('unit').setDescription('وحدة الوقت').setRequired(true).addChoices({ name: 'دقائق', value: 'm' }, { name: 'ساعات', value: 'h' }))
            .addStringOption(opt => opt.setName('emoji').setDescription('الإيموجي الخاص بالتفاعل').setRequired(true))
            .addIntegerOption(opt => opt.setName('winners').setDescription('عدد الفائزين')),

        new SlashCommandBuilder()
            .setName('choose-team')
            .setDescription('اختر فريقك الذي تدعمه وتشجعه في المونديال')
            .addStringOption(opt => opt.setName('team').setDescription('اختر المنتخب المفضل').setRequired(true).addChoices(...teamsList.map(t => ({ name: t.name, value: t.name })))),

        new SlashCommandBuilder()
            .setName('predict')
            .setDescription('توقع نتيجة مباراة الافتتاح واكسب نقاط!')
            .addIntegerOption(opt => opt.setName('mexico').setDescription('أهداف المكسيك').setRequired(true))
            .addIntegerOption(opt => opt.setName('canada').setDescription('أهداف كندا').setRequired(true)),

        new SlashCommandBuilder()
            .setName('set-news')
            .setDescription('تحديد قناة بث مباريات وأحداث كأس العالم المباشرة')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
            .addChannelOption(opt => opt.setName('room').setDescription('اختر الروم المخصص للاخبار').setRequired(true))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('⚡ All Slash Commands Registered.');
    } catch (error) { console.error(error); }
});

// 5️⃣ محرك الألعاب والـ messageCreate التفاعلي القديم والجديد
async function startGuessGame(channel, type = 'flag') {
    if (activeGames.has(channel.id)) return channel.send('❌ هناك جولة قائمة بالفعل في هذه القناة!');
    activeGames.add(channel.id);

    if (type === 'flag') {
        const chosen = flagData[Math.floor(Math.random() * flagData.length)];
        const gameEmbed = new EmbedBuilder().setTitle('🤔 خمن اسم الدولة صاحبة هذا العلم!').setImage(chosen.flagUrl).setColor(0xF39C12).setFooter(footerText);
        await channel.send({ embeds: [gameEmbed] });

        const filter = res => { const ans = res.content.trim().toLowerCase(); return ans === chosen.countryAr || ans === chosen.countryEn; };
        const collector = channel.createMessageCollector({ filter, time: 15000, max: 1 });
        let won = false;

        collector.on('collect', async m => {
            won = true;
            const total = await addPoints(m.author.id, m.author.username, 1);
            await channel.send({ embeds: [new EmbedBuilder().setTitle('🎉 إجابة صحيحة!').setDescription(`الدولة هي: **${chosen.countryAr}**\nتم منحك **+1 نقطة**! رصيدك: \`${total}\``).setColor(0x2ECC71).setFooter(footerText)] });
            collector.stop();
        });
        collector.on('end', () => { activeGames.delete(channel.id); if (!won) channel.send(`⏱️ انتهى الوقت! الدولة هي: **${chosen.countryAr}**`); });
    }
}

// استقبال الأوامر السريعة وأمر الإداريين المطور للإرسال الخاص لقائمة السيرفر كاملاً
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;
    
    if (message.content.trim().toLowerCase() === '.w') {
        await startGuessGame(message.channel, 'flag');
    }

    // أمر الإداريين المخصص لإرسال رسائل خاصة لجميع الأعضاء (DM ALL)
    if (message.content.startsWith('/dm-all')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ هذا الأمر مخصص فقط لمسؤولي السيرفر (Administrator)!');
        }
        const textToSend = message.content.replace('/dm-all', '').trim();
        if (!textToSend) return message.reply('❌ يرجى كتابة نص الرسالة بعد الأمر! مثال: `/dm-all أهلاً بالجميع`');

        try {
            const members = await message.guild.members.fetch();
            let count = 0;
            members.forEach(member => {
                if (!member.user.bot) {
                    member.send(`📢 **رسالة إدارية هامة من سيرفرنا:**\n\n${textToSend}`).then(() => count++).catch(() => {});
                }
            });
            await message.reply(`✅ جاري إرسال الرسالة الخاصة للأعضاء في الخلفية بنجاح!`);
        } catch (err) {
            message.reply('❌ واجهت مشكلة أثناء جلب الأعضاء.');
        }
    }
});

// 6️⃣ معالجة الأوامر التفاعلية والأزرار بالكامل
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_member') {
            await interaction.deferReply({ ephemeral: true });
            let verifyRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'member');
            if (!verifyRole) return interaction.editReply({ content: '❌ لم يتم العثور على رتبة باسم `Member`.' });
            try {
                await interaction.member.roles.add(verifyRole);
                return interaction.editReply({ content: `✅ تم التحقق منك بنجاح ورتبتك جاهزة! 🎉` });
            } catch (err) { return interaction.editReply({ content: '❌ مشكلة في إعطاء الرتبة.' }); }
        }

        // منطق التحقق للعبة خمن جنسية اللاعب (3x3 Grid)
        if (interaction.customId.startsWith('nat_')) {
            await interaction.deferReply({ ephemeral: true });
            const answer = interaction.customId.split('_')[1];
            if (answer === 'correct') {
                const total = await addPoints(interaction.user.id, interaction.user.username, 1);
                await interaction.editReply({ content: `✅ كفوو! إجابة صحيحة تامة! نلت **+1 نقطة** وعلم البرازيل هو جنسية نيمار الصحيحة! رصيدك الإجمالي: \`${total}\`` });
                await interaction.message.delete().catch(() => {});
            } else {
                await interaction.editReply({ content: `❌ خطأ! هذا العلم ليس الجنسية الصحيحة للاعب، حاول في التحدي القادم!` });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, channel, user, guild } = interaction;

    // حماية أوامر المسؤولين التلقائية بسيرفر ديسكورد
    const isAdminCommand = ['setup-verify', 'match-poll', 'giveaway', 'set-news'].includes(commandName);
    if (isAdminCommand && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ خطأ إداري: هذا الأمر مخصص فقط لمسؤولي السيرفر (Administrator)!', ephemeral: true });
    }

    // لعبة خمن جنسية اللاعب المفتوحة المحدثة 3x3
    if (commandName === 'guess-nationality') {
        await interaction.deferReply();
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong1').setLabel('🇲🇦 المغرب').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong2').setLabel('🇸🇦 السعودية').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong3').setLabel('🇪🇬 مصر').setStyle(ButtonStyle.Secondary)
        );
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong4').setLabel('🇲🇽 المكسيك').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_correct').setLabel('🇧🇷 البرازيل').setStyle(ButtonStyle.Success), // الإجابة الصح
            new ButtonBuilder().setCustomId('nat_wrong5').setLabel('🇦🇷 الأرجنتين').setStyle(ButtonStyle.Secondary)
        );
        const row3 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('nat_wrong6').setLabel('🇫🇷 فرنسا').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong7').setLabel('🇪🇸 إسبانيا').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('nat_wrong8').setLabel('🇩🇪 ألمانيا').setStyle(ButtonStyle.Secondary)
        );

        const embed = new EmbedBuilder()
            .setTitle('🧠 تحدي جنسية اللاعب الذكي (3x3)!')
            .setDescription('⚽ اللاعب هو النجم الساحر: **[ نيمار / Neymar ]**\n\nاضغط على علم بلد جنسيته الصحيحة من الشبكة أدناه لتفوز!')
            .setColor(0x27AE60)
            .setFooter(footerText);

        await interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
    }

    if (commandName === 'profile') {
        await interaction.deferReply();
        const res = await pool.query('SELECT points, favoriteTeam, goalsScored FROM users WHERE userId = $1', [user.id]);
        let userData = res.rows[0] || { points: 0, favoriteTeam: 'لم يحدد بعد ⚽', goalsScored: 0 };

        const profileEmbed = new EmbedBuilder()
            .setTitle(`🪪 الهوية الرياضية لـ ${user.username}`)
            .setColor(0x27AE60)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🥇 إجمالي نقاطك:', value: `\`${userData.points}\` نقطة`, inline: true },
                { name: '🥅 أهداف الترجيح:', value: `\`${userData.goalsScored || 0}\` هدف`, inline: true },
                { name: '❤️ المنتخب المشجع:', value: `**${userData.favoriteTeam}**`, inline: false }
            ).setFooter(footerText);
        await interaction.editReply({ embeds: [profileEmbed] });
    }

    if (commandName === 'penalty') {
        await interaction.deferReply();
        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('shoot_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('shoot_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('shoot_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );
        const startEmbed = new EmbedBuilder().setTitle('⚽ تحدي ركلات الترجيح الكبرى 🥅').setDescription(`سدد الآن يا بطل!`).setColor(0x2980B9).setFooter(footerText);
        const msg = await interaction.editReply({ embeds: [startEmbed], components: [rowAction] });
        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        collector.on('collect', async btnInteraction => {
            if (btnInteraction.user.id !== user.id) return btnInteraction.reply({ content: '❌ ليس دورك!', ephemeral: true });
            await btnInteraction.deferUpdate();
            const botGoalkeeperJump = ['shoot_left', 'shoot_center', 'shoot_right'][Math.floor(Math.random() * 3)];
            
            if (btnInteraction.customId === botGoalkeeperJump) {
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ تصدى لها الحارس!').setColor(0xC0392B).setFooter(footerText)], components: [] });
            } else {
                const newTotal = await addPoints(user.id, user.username, 1);
                await addPenaltyGoal(user.id);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚽ هدف هز الشباك المونديالية الحارقة!').setDescription(`تم إضافة **+1 نقطة** وترقية رصيدك سحابياً وبإشعار خاص! رصيدك: \`${newTotal}\``).setColor(0x27AE60).setFooter(footerText)], components: [] });
            }
            collector.stop();
        });
    }

    if (commandName === 'leaderboard') {
        await interaction.deferReply();
        const res = await pool.query('SELECT username, points, favoriteTeam FROM users ORDER BY points DESC LIMIT 10');
        if (res.rows.length === 0) return interaction.editReply({ content: '📊 لا توجد نقاط مسجلة حالياً!' });

        let description = "🏆 **ترتيب أعلى 10 مشجعين بالنقاط في السحاب:**\n\n";
        res.rows.forEach((row, index) => { description += `${index + 1}. **${row.username}** — \`${row.points}\` نقطة [الفريق: ${row.favoriteteam}]\n`; });
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📊 لوحة الصدارة العالمية').setDescription(description).setColor(0xF1C40F).setFooter(footerText)] });
    }

    if (commandName === 'match-poll') {
        await interaction.deferReply();
        const desc = options.getString('description');
        const t1 = options.getString('team1');
        const t2 = options.getString('team2');
        const allowDraw = options.getBoolean('allow-draw');

        let votes = { t1: 0, t2: 0, draw: 0 };
        const votedUsers = new Set();

        const generateEmbed = () => {
            return new EmbedBuilder()
                .setTitle('📊 تصويت ومراهنة على مباراة مونديالية حية!')
                .setDescription(`🏆 **تفاصيل الحدث:**\n${desc}\n\nاضغط لتوقعك الفائز!`)
                .addFields(
                    { name: `🔹 ${t1}`, value: `\`${votes.t1}\` تصويت`, inline: true },
                    allowDraw ? { name: `🤝 التعادل`, value: `\`${votes.draw}\` تصويت`, inline: true } : { name: '—', value: '—', inline: true },
                    { name: `🔸 ${t2}`, value: `\`${votes.t2}\` تصويت`, inline: true }
                ).setColor(0xE67E22).setFooter(footerText);
        };

        const pollRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vote_t1').setLabel(t1).setStyle(ButtonStyle.Primary),
            ...(allowDraw ? [new ButtonBuilder().setCustomId('vote_draw').setLabel('🤝 التعادل').setStyle(ButtonStyle.Secondary)] : []),
            new ButtonBuilder().setCustomId('vote_t2').setLabel(t2).setStyle(ButtonStyle.Success)
        );

        const pollMessage = await interaction.editReply({ embeds: [generateEmbed()], components: [pollRow] });
        const collector = pollMessage.createMessageComponentCollector({ componentType: ComponentType.Button, time: 24 * 60 * 60 * 1000 });

        collector.on('collect', async btnInt => {
            if (votedUsers.has(btnInt.user.id)) return btnInt.reply({ content: '❌ لقد قمت بالتصويت مسبقاً!', ephemeral: true });
            votedUsers.add(btnInt.user.id);
            if (btnInt.customId === 'vote_t1') votes.t1++;
            if (btnInt.customId === 'vote_t2') votes.t2++;
            if (btnInt.customId === 'vote_draw') votes.draw++;
            await btnInt.deferUpdate();
            await interaction.editReply({ embeds: [generateEmbed()] });
        });
    }

    if (commandName === 'giveaway') {
        await interaction.reply({ content: '🎉 تم إطلاق القيف اوي بنجاح في الغرفة!', ephemeral: true });
        const prize = options.getString('prize');
        const duration = options.getInteger('duration');
        const unit = options.getString('unit');
        const customEmoji = options.getString('emoji');
        const winnersCount = options.getInteger('winners');

        const durationMs = unit === 'm' ? duration * 60 * 1000 : duration * 60 * 60 * 1000;
        const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);

        const giveawayEmbed = new EmbedBuilder()
            .setTitle(`🎁 قيف اوي المونديال الكبرى`)
            .setDescription(`🏆 **الجائزة المتاحة:** **${prize}**\n⚡ **عدد الفائزين:** \`${winnersCount}\`\n⏱️ **ينتهي في:** <t:${endTimestamp}:R>\n\nاضغط على الإيموجي لتشترك!`)
            .setColor(0xD35400).setFooter(footerText);

        const giveawayMsg = await channel.send({ embeds: [giveawayEmbed] });
        try { await giveawayMsg.react(customEmoji); } catch (err) { return channel.send('❌ خطأ في الإيموجي.'); }

        setTimeout(async () => {
            try {
                const refreshedMsg = await channel.messages.fetch(giveawayMsg.id);
                const reaction = refreshedMsg.reactions.cache.get(customEmoji);
                if (!reaction) return;
                const usersReaction = await reaction.users.fetch();
                const eligibleUsers = usersReaction.filter(u => !u.bot).map(u => u.id);

                if (eligibleUsers.length === 0) return channel.send(`😔 انتهى وقت القيف اوي ولم يشترك أحد!`);
                const shuffled = eligibleUsers.sort(() => 0.5 - Math.random());
                const winners = shuffled.slice(0, winnersCount).map(id => `<@${id}>`);

                await channel.send({ content: `🥳 مبروك للفائزين بالقيف اوي: ${winners.join(', ')}! جاري الحفظ والتوزيع التلقائي.` });
            } catch (err) { console.error(err); }
        }, durationMs);
    }

    if (commandName === 'choose-team') {
        await interaction.deferReply();
        const selectedTeam = options.getString('team');
        await pool.query('INSERT INTO users (userId, username, favoriteTeam) VALUES ($1, $2, $3) ON CONFLICT(userId) DO UPDATE SET favoriteTeam = $4, username = $5', [user.id, user.username, selectedTeam, selectedTeam, user.username]);
        await interaction.editReply({ content: `🏆 تم تسجيل **${selectedTeam}** كفريقك المفضل المشجع بنجاح سحابياً! 🔥` });
    }

    if (commandName === 'help') {
        await interaction.deferReply();
        const helpEmbed = new EmbedBuilder()
            .setTitle(`📖 دليل الأوامر وتحديثات v3.5 الشاملة`)
            .addFields(
                { name: '🎮 الألعاب والتحديات الترفيهية', value: '`/penalty` | `/guess-nationality` | `/guess-flag` | `.w`', inline: true },
                { name: '🏆 شؤون الكأس والملف', value: '`/profile` | `/choose-team` | `/leaderboard`', inline: true },
                { name: '🛠️ أدوات الإدارة الصارمة', value: '`/match-poll` | `/giveaway` | `/set-news` | `/dm-all (في الشات)`', inline: false }
            ).setColor(0x8E44AD).setFooter(footerText);
        await interaction.editReply({ embeds: [helpEmbed] });
    }
    
    // الأوامر المتبقية المساعدة مثل البث والتايموت
    if (commandName === 'countdown') {
        await interaction.reply({ content: `🏟️ المتبقي على الافتتاح الرسمي التاريخي المونديالي بالمكسيك 2026 يقترب جداً! استعدوا للصافرة!` });
    }
    if (commandName === 'teams') {
        await interaction.reply({ content: `🌍 **المجموعات
