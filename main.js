/**
 * Bot Version: 7.0.0v (The Infinite Loop Classic Mafia Game)
 * Developer: ta_im1 | Team: TRL for development
 * Platform: Optimized for Mobile (Pydroid 3 / Replit)
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Gangster-bot Classic Mafia Loop is Active! 🚀'));
app.listen(port, () => console.log(`[SYSTEM] Web server active on port ${port}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const BOT_VERSION = "7.0.0v";
const tempUsers = new Map();
let activeMafiaGame = null;
let TICKET_LOG_CHANNEL_ID = "ضع_هنا_ايدي_روم_الادارة"; 

function getUserData(userId, username) {
    if (!tempUsers.has(userId)) {
        tempUsers.set(userId, { userId, username: username || 'مشجع مونديالي', points: 0, favoriteTeam: 'لم يحدد بعد ⚽', goalsScored: 0 });
    }
    return tempUsers.get(userId);
}

const flagData = [
    { countryAr: "المغرب", countryEn: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { countryAr: "السعودية", countryEn: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { countryAr: "مصر", countryEn: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" }
];

// 1️⃣ تسجيل الأوامر المائلة الشاملة (مع إضافة أمر /info ℹ️ وأمر التحديثات)
client.once('ready', async () => {
    console.log(`[ONLINE] Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض جميع أوامر البوت الفعالة حالياً دون استثناء'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي ونقاطك'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح التفاعلي ضد البوت'),
        new SlashCommandBuilder().setName('guess-nationality').setDescription('بدء لعبة خمن جنسية اللاعب من العلم'),
        new SlashCommandBuilder().setName('updates').setDescription('عرض التحديثات الجديدة والأنظمة الأسطورية التي تمت إضافتها للبوت'),
        new SlashCommandBuilder().setName('info').setDescription('ℹ️ دليل وشرح لعبة المافيا الكلاسيكية بالتفصيل والملخص'),
        new SlashCommandBuilder()
            .setName('mafia')
            .setDescription('بدء جولة بطولة المافيا الكلاسيكية الكبرى (نظام الجولات اللانهائية)')
            .addBooleanOption(opt => opt.setName('mention_everyone').setDescription('منشن إيفري وان (خاص بالأدمنستريتر فقط)').setRequired(false)),
        new SlashCommandBuilder()
            .setName('vote')
            .setDescription('إنشاء تصويت سريع وعادل بالأزرار للأعضاء')
            .addStringOption(opt => opt.setName('question').setDescription('موضوع التصويت').setRequired(true)),
        new SlashCommandBuilder()
            .setName('giveaway')
            .setDescription('إنشاء مسابقة جيف اواي تفاعلية بنظام الأزرار')
            .addStringOption(opt => opt.setName('prize').setDescription('الجائزة المعروضة').setRequired(true))
            .addIntegerOption(opt => opt.setName('duration').setDescription('المدة بالدقائق').setRequired(true)),
        new SlashCommandBuilder()
            .setName('setup-ticket')
            .setDescription('إنشاء رسالة نظام التذاكر المطور بالـ Modals المفتوحة دائماً')
            .addStringOption(opt => opt.setName('title').setDescription('عنوان إمبيد التكت').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('وصف أو شروط التكت').setRequired(true))
            .addStringOption(opt => opt.setName('button_text').setDescription('النص المكتوب على زر الفتح').setRequired(true)),
        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('نظام الرسائل الخاصة الإداري الشامل')
            .addSubcommand(sub => sub
                .setName('user')
                .setDescription('إرسال رسالة مخصصة لعضو محدد على الخاص')
                .addUserOption(opt => opt.setName('target').setDescription('العضو المستهدف').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('all')
                .setDescription('إرسال رسالة جماعية شاملة لكل أعضاء السيرفر على الخاص')
                .addStringOption(opt => opt.setName('title').setDescription('عنوان الرسالة الجماعية').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة الجماعية').setRequired(true)))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] All global slash commands successfully operational!');
    } catch (e) { console.error(e); }
});

// 2️⃣ استقبال الاختصارات النصية (.w و .dm)
client.on('messageCreate', async message => {
    if (!message.guild || message.author.bot) return;
    const msgContent = message.content.trim().toLowerCase();

    if (msgContent === '.w') {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('✨ أهلاً بك في مجتمع BRQ Community!')
            .setDescription(`منور السيرفر يا بطل <@${message.author.id}> نتمنى لك وقتاً أسطورياً معنا! 🔥`)
            .setColor(0x3498DB)
            .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png');
        return message.channel.send({ embeds: [welcomeEmbed] });
    }

    if (msgContent.startsWith('.dm')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const args = message.content.slice('.dm'.length).trim().split(/ +/);
        if (args.length < 1) return;

        if (args[0] === 'كل' || args[0].toLowerCase() === 'all') {
            const broadcastText = args.slice(1).join(' ');
            if (!broadcastText) return;
            const members = await message.guild.members.fetch();
            members.forEach(m => { if (!m.user.bot) m.send(`📢 **إشعار جماعي عاجل من الإدارة:**\n\n${broadcastText}`).catch(() => {}); });
        } else {
            const targetUser = message.mentions.users.first();
            const directText = args.slice(1).join(' ');
            if (!targetUser || !directText) return;
            try { await targetUser.send(`📢 **رسالة إدارية مباشرة:**\n\n${directText}`); } catch (e) {}
        }
    }
});

// 3️⃣ إدارة نظام المافيا الكلاسيكي المتكرر والأوامر المائلة الجديدة
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // أمر الشرح الشامل والملخص للماميا /info ℹ️
    if (interaction.commandName === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setTitle('ℹ️ دليل وإستراتيجيات لعبة المافيا الكلاسيكية الشامل')
            .setDescription(
                '**🕵️‍♂️ ما هي لعبة مافيا؟ (الشرح الطويل التفصيلي):**\n' +
                'لعبة ذكاء واجتماع تعتمد على الخداع والإقناع وقراءة لغة الجسد. تقوم على صراع بين مجموعتين:\n' +
                '• **الأغلبية غير الواعية (المواطنون):** لا يعرفون هويات بعضهم، وهدفهم كشف المافيا نهاراً عبر النقاش والتصويت العادل.\n' +
                '• **الأقلية الواعية (المافيا):** عصابة مختبئة تعرف بعضها وتختار ضحية لتصفيتها كل ليلة دون الانكشاف.\n\n' +
                '**🎭 الأدوار الأساسية وقدراتها السرية:**\n' +
                '• 🟥 **المافيا العادي 🔫:** يختار ضحية مع عصابته ليلاً ويتظاهر بالبراءة نهاراً.\n' +
                '• 🧑‍🌾 **المواطن العادي 👤:** قوته في صوته ونقاشه الذكي لكشف الكاذبين.\n' +
                '• 🔍 **المحقق / الشرطي 🕵️‍♂️:** يستيقظ ليلاً ليفحص هويّة لاعب واحد ويعرف إن كان مافيا أم لا.\n' +
                '• 🩺 **الطبيب / الدكتور 🚑:** يختار شخصاً كل ليلة لحمايته وإنقاذه من القتل السري.\n\n' +
                '**📝 ملخص اللعبة السريع (في ثوانٍ):**\n' +
                'تنام المدينة ليلاً 🌙 ⟵ تقتل المافيا شخصاً ⟵ يحمي الطبيب شخصاً ⟵ يفحص المحقق شخصاً ⟵ يستيقظ الجميع نهاراً ☀️ ⟵ يُعلن البوت نجاح أو فشل القتل ⟵ يبدأ نقاش وتصويت لإقصاء المتهم الأكبر ⟵ تتكرر الدورة حتى يتم طرد كل المافيا (فوز المواطنين) أو يتساوى العدد (فوز المافيا).'
            )
            .setColor(0x5865F2)
            .setThumbnail('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png')
            .setFooter({ text: 'تطوير بواسطة: ta_im1 | Gangster-bot' });
        return interaction.reply({ embeds: [infoEmbed] });
    }

    if (interaction.commandName === 'updates') {
        const updateEmbed = new EmbedBuilder()
            .setTitle('🚀 التحديثات الجديدة للبطولات والأنظمة | Gangster-bot')
            .setDescription('• 🔁 **نظام الجولات المتتالية اللانهائي:** اللعبة الآن لا تنتهي بتصويت واحد، بل تستمر وتتعاقب الأطوار (ليل ثم نهار) تلقائياً مع إعلانات نجاح أو فشل القتلات حتى يتم تلبية شروط الفوز الفعلي.\n' +
                            '• 🎭 **العودة للجذور الكلاسيكية:** إرجاع أدوار المافيا، الطبيب، المحقق، والمواطنين بناءً على دليل القوانين الأصلي.\n' +
                            '• ℹ️ **أمر الشرح المطور:** إضافة أمر `/info` لاستعراض الاستراتيجيات والشرح المفصل والملخص للأعضاء الجدد بالسيرفر.')
            .setColor(0x2ECC71)
            .setFooter({ text: `تطوير بواسطة: ta_im1 | الاصدار: ${BOT_VERSION}` });
        return interaction.reply({ embeds: [updateEmbed] });
    }

    if (interaction.commandName === 'mafia') {
        if (activeMafiaGame) return interaction.reply({ content: '⚠️ هناك جولة مافيا قائمة بالفعل في هذا الشات الحين!', ephemeral: true });

        const doMention = interaction.options.getBoolean('mention_everyone') || false;
        if (doMention && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ خيار المنشن مخصص فقط للـ Administrator!', ephemeral: true });
        }

        activeMafiaGame = { 
            hostChannel: interaction.channel.id, 
            players: new Map(),
            round: 1,
            nightActions: { mafiaKill: null, doctorSave: null, detectiveCheck: null }
        };

        const updateEmbed = () => {
            const playerList = Array.from(activeMafiaGame.players.values()).map((p, idx) => `${idx + 1}- <@${p.id}> ${p.isBot ? '🤖 [AI]' : '👤'}`).join('\n') || 'لا يوجد لاعبين مسجلين حتى الآن.';
            return new EmbedBuilder()
                .setTitle('✨ .•°•-BRQ Community Mafia-•°•? ✨')
                .setDescription('**📖 شرح اللعبة والقوانين الرسمية:**\n' +
                                '1- انضم للعبة عبر الزر الأخضر الموجود في الأسفل.\n' +
                                '2- كل لاعب يحصل على دور سري (مافيا 🟥، طبيب 🩺، محقق 🔍، مواطن 👤).\n' +
                                '3- تتصرف الأدوار الخاصة سراً ليلاً؛ نهاراً يصوت الجميع لطرد مشتبه به.\n' +
                                '4- يفوز المواطنون بإقصاء جميع القاتلين، وتفوز المافيا إن تفوق عددهم أو تساوى مع الأحياء.\n\n' +
                                `**المشاركين الحاليين في البطولة (${activeMafiaGame.players.size}/25):**\n\n${playerList}\n\n` +
                                `⏱️ ستبدأ اللعبة تلقائياً بعد انتهاء الـ 30 ثانية لتجميع اللاعبين...`)
                .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') // الخلفية الأسطورية الفخمة الثابتة بالإمبيد
                .setColor(0x5865F2)
                .setFooter({ text: 'تطوير بواسطة: ta_im1 | Gangster-bot', iconURL: 'https://images2.imgbox.com/71/34/4mP9Y7C1_o.png' });
        };

        const memberRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mafia_in').setEmoji('📥').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('mafia_out').setEmoji('📤').setStyle(ButtonStyle.Danger)
        );
        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mafia_admin_add_bot').setLabel('🤖 إضافة بوت (أدمن)').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ content: '✅ تم إطلاق ساحة المافيا بنجاح!', ephemeral: true });
        
        let gameMsg = doMention 
            ? await interaction.channel.send({ content: '@everyone 🔥 **بدأت بطولة المافيا الكلاسيكية الكبرى! انضموا الآن!**', embeds: [updateEmbed()], components: [memberRow, adminRow] })
            : await interaction.channel.send({ embeds: [updateEmbed()], components: [memberRow, adminRow] });

        const lobbyCollector = gameMsg.createMessageComponentCollector({ time: 30000 }); // الانتظار 30 ثانية كاملة قبل البدء

        lobbyCollector.on('collect', async i => {
            if (i.customId === 'mafia_in') {
                if (activeMafiaGame.players.has(i.user.id)) return i.reply({ content: '❌ أنت مسجل بالفعل!', ephemeral: true });
                activeMafiaGame.players.set(i.user.id, { id: i.user.id, username: i.user.username, isBot: false, alive: true, role: 'مواطن 👤' });
                await i.deferUpdate(); await gameMsg.edit({ embeds: [updateEmbed()] });
            }
            if (i.customId === 'mafia_out') {
                if (!activeMafiaGame.players.has(i.user.id)) return i.reply({ content: '❌ أنت غير مسجل أصلاً لتخرج!', ephemeral: true });
                activeMafiaGame.players.delete(i.user.id);
                await i.deferUpdate(); await gameMsg.edit({ embeds: [updateEmbed()] });
            }
            if (i.customId === 'mafia_admin_add_bot') {
                if (!i.member.permissions.has(PermissionFlagsBits.Administrator)) return i.reply({ content: '❌ للأدمن فقط!', ephemeral: true });
                const botId = `bot_${Math.floor(Math.random() * 100000)}`;
                const botName = `Mafia-AI-${activeMafiaGame.players.size + 1}`;
                activeMafiaGame.players.set(botId, { id: interaction.client.user.id, username: botName, isBot: true, alive: true, role: 'مواطن 👤', fakeId: botId });
                await i.reply({ content: `🤖 تم إدخال البوت: **${botName}**`, ephemeral: true });
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }
        });

        lobbyCollector.on('end', async () => {
            if (!activeMafiaGame) return;
            if (activeMafiaGame.players.size < 3) {
                await interaction.channel.send('❌ تم إلغاء الجولة لعدم اكتمال الحد الأدنى المطلوب لإدارة أدوار اللعبة (3 لاعبين على الأقل).');
                activeMafiaGame = null;
                return;
            }

            // توزيع الأدوار الكلاسيكية سراً في بداية الجولة الأولى
            const playersArr = Array.from(activeMafiaGame.players.values());
            const shuffled = playersArr.sort(() => 0.5 - Math.random());
            shuffled[0].role = 'مافيا 🟥';
            shuffled[1].role = 'طبيب 🩺';
            if (shuffled.length > 2) shuffled[2].role = 'محقق 🔍';

            playersArr.forEach(p => {
                if (!p.isBot) {
                    client.users.fetch(p.id).then(u => u.send(`🎮 بدأت معركة المافيا! دورك السري المقدس هو: **${p.role}**`).catch(() => {}));
                }
            });

            await interaction.channel.send('🎮 **تم إغلاق التسجيل وتوزيع البطاقات السرية على الخاص! بدأت الجولات المتعاقبة الآن!**');
            runGameLoop(interaction.channel); // إطلاق حلقة اللعب التلقائية اللانهائية
        });
    }
});

// 4️⃣ الحلقة التكرارية لإدارة الأطوار (الليل والنهار ونتائج القتل والتصويت)
async function runGameLoop(channel) {
    if (!activeMafiaGame) return;

    // فحص شروط الفوز أولاً قبل كل ليلة جديدة
    const playersArr = Array.from(activeMafiaGame.players.values()).filter(p => p.alive);
    const mafiaCount = playersArr.filter(p => p.role === 'مافيا 🟥').length;
    const citizensCount = playersArr.length - mafiaCount;

    if (mafiaCount === 0) {
        await channel.send('🎉 **انتصرت المدينة! تم القضاء على جميع أفراد المافيا بنجاح! فوز ساحق للمواطنين والجمهور الأوفياء!** 🥳');
        activeMafiaGame = null; return;
    }
    if (mafiaCount >= citizensCount) {
        await channel.send('😈 **سيطرت العصابة! تساوى عدد المافيا مع المواطنين، تم الاستيلاء على السيرفر وفازت المافيا كلياً!** 🔥');
        activeMafiaGame = null; return;
    }

    await channel.send(`\n🌙 **[الجولة ${activeMafiaGame.round}] - حلّ الليل الآن وتنام المدينة بالكامل.. الاستيقاظ للأدوار الخاصة فقط سراً!**`);
    activeMafiaGame.nightActions = { mafiaKill: null, doctorSave: null, detectiveCheck: null };

    // محاكاة الأفعال الليلية الذكية (لتجنب الوقوف التام على الخاص وبدء المتعة المباشرة بالتصويت المفتوح)
    const alivePlayers = playersArr;
    const mafiaUser = alivePlayers.find(p => p.role === 'مافيا 🟥');
    const doctorUser = alivePlayers.find(p => p.role === 'طبيب 🩺');
    const detectiveUser = alivePlayers.find(p => p.role === 'محقق 🔍');

    const targets = alivePlayers.map(p => p.fakeId || p.id);
    
    if (mafiaUser) activeMafiaGame.nightActions.mafiaKill = targets[Math.floor(Math.random() * targets.length)];
    if (doctorUser) activeMafiaGame.nightActions.doctorSave = targets[Math.floor(Math.random() * targets.length)];
    if (detectiveUser) activeMafiaGame.nightActions.detectiveCheck = targets[Math.floor(Math.random() * targets.length)];

    // الانتظار 10 ثوانٍ لتمثيل طور الليل سراً
    setTimeout(async () => {
        await channel.send('🌅 **تستيقظ المدينة الحين! طلع النهار والكل يفتح عيونه للنقاش العام!**');
        
        const killTarget = activeMafiaGame.nightActions.mafiaKill;
        const saveTarget = activeMafiaGame.nightActions.doctorSave;

        // التحقق وإعلان نجاح أو فشل عملية القتل بناءً على الشرح الأصلي
        if (killTarget && killTarget !== saveTarget) {
            const deadPlayer = alivePlayers.find(p => (p.fakeId || p.id) === killTarget);
            if (deadPlayer) {
                deadPlayer.alive = false;
                await channel.send(`🩸 **أخبار فاجعة! نجحت عملية الاغتيال ليلاً، وتمت تصفية وطرد اللاعب: <@${deadPlayer.id}> ${deadPlayer.isBot ? `[${deadPlayer.username}]` : ''} من الساحة!**`);
            }
        } else {
            await channel.send('🛡️ **ليلة هادئة وصالحة جداً! حاولت المافيا القتل ولكن عملية القتل فشلت تماماً بفضل تدخل الطبيب المنقذ السريع!**');
        }

        // نقاش سريع ثم لوحة التصويت لإقصاء المتهم التالي لزيادة اللاعبين والأصوات
        await channel.send('⏱️ **لديك 20 ثانية للتفكير والمناقشة الحية بشات السيرفر لكشف الكاذبين قبل فتح صناديق التصويت العادلة!**');

        setTimeout(async () => {
            const currentAlive = Array.from(activeMafiaGame.players.values()).filter(p => p.alive);
            if (currentAlive.length < 2) {
                await channel.send('🏁 انتهت المباراة لعدم وجود لاعبين كافيين للاستمرار!');
                activeMafiaGame = null; return;
            }

            await channel.send('🗳️ **فتحت الآن ساحة التصويت النهارية لتقليص وطرد المشتبه بهم! اضغطوا على الأزرار فوراً:**');
            
            const rows = [];
            let currentRow = new ActionRowBuilder();
            const votesMap = new Map();
            const votedUsersSet = new Set();

            currentAlive.forEach(p => votesMap.set(p.fakeId || p.id, 0));

            for (let i = 0; i < currentAlive.length; i++) {
                if (i > 0 && i % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                const labelName = currentAlive[i].username.slice(0, 10);
                currentRow.addComponents(
                    new ButtonBuilder().setCustomId(`loop_vote_${currentAlive[i].fakeId || currentAlive[i].id}`).setLabel(labelName).setStyle(ButtonStyle.Primary)
                );
            }
            if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
            currentRow.addComponents(new ButtonBuilder().setCustomId('loop_vote_skip').setLabel('⏭️ تخطي').setStyle(ButtonStyle.Danger));
            rows.push(currentRow);

            const voteEmbed = new EmbedBuilder().setTitle('🗳️ لوحة تصويت جولة المافيا الكلاسيكية المتزامنة').setDescription('صوت ضد المتهم الأكبر وسيحدث العداد فوراً بالشات!').setColor(0xE74C3C);
            const voteMsg = await channel.send({ embeds: [voteEmbed], components: rows });

            const collector = voteMsg.createMessageComponentCollector({ time: 20000 });

            collector.on('collect', async v => {
                const voter = currentAlive.find(p => p.id === v.user.id || (p.isBot && p.id === v.user.id));
                if (votedUsersSet.has(v.user.id)) return v.reply({ content: '❌ صوتك مسجل سابقاً بالجولة الحالية!', ephemeral: true });

                if (v.customId === 'loop_vote_skip') {
                    votedUsersSet.add(v.user.id);
                    await v.reply({ content: '✅ اخترت التخطي!', ephemeral: true });
                    await channel.send(`⏭️ <@${v.user.id}> فضّل **تخطي** هذه الجولة نهاراً.`);
                    return;
                }

                const tId = v.customId.replace('loop_vote_', '');
                const count = votesMap.get(tId) || 0;
                votesMap.set(tId, count + 1);
                votedUsersSet.add(v.user.id);

                const targetObj = currentAlive.find(p => (p.fakeId || p.id) === tId);
                await v.reply({ content: `✅ صوتك اعتمد ضد ${targetObj.username}`, ephemeral: true });
                await channel.send(`🎯 <@${v.user.id}> صوت ضد **${targetObj.username}**! [العداد الحالي: \`${count + 1}\` أصوات] 📈`);
            });

            collector.on('end', async () => {
                let highestId = null; let maxVotes = 0;
                for (const [id, count] of votesMap.entries()) {
                    if (count > maxVotes) { maxVotes = count; highestId = id; }
                }

                if (highestId && maxVotes > 0) {
                    const expelled = currentAlive.find(p => (p.fakeId || p.id) === highestId);
                    if (expelled) {
                        expelled.alive = false;
                        await channel.send(`⚖️ **بأغلبية الأصوات الحرة، قررت المدينة إقصاء وإعدام: <@${expelled.id}> [${expelled.username}]! وعند كشف أوراقه اتضح أنه كان يحمل دور: ||${expelled.role}||**`);
                    }
                } else {
                    await channel.send('⏭️ **انتهى النهار بتوافق الآراء على التخطي ولم يُطرد أحد في هذه الجولة المفتوحة!**');
                }

                // تقدم الجولة وإعادة الحلقة تلقائياً للاستمرار والتعاقب حتى الفوز الفعلي
                activeMafiaGame.round += 1;
                setTimeout(() => runGameLoop(channel), 5000);
            });

        }, 20000);

    }, 10000);
}

// 5️⃣ باقي الأنظمة التفاعلية المحفوظة (Ticket, Giveaway, Vote, Games)
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticket') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للمدراء فقط!', ephemeral: true });
        TICKET_LOG_CHANNEL_ID = interaction.channel.id;

        const ticketEmbed = new EmbedBuilder().setTitle(interaction.options.getString('title')).setDescription(interaction.options.getString('description')).setColor(0x3498DB);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('trigger_modal_action').setLabel(interaction.options.getString('button_text')).setStyle(ButtonStyle.Primary).setEmoji('🎟️'));
        await interaction.reply({ content: '✅ تم التثبيت!', ephemeral: true });
        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'trigger_modal_action') {
        const modal = new ModalBuilder().setCustomId('ticket_screen_modal').setTitle('General Support');
        const reasonInput = new TextInputBuilder().setCustomId('ticket_field_reason').setLabel('What is your question?').setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_screen_modal') {
        const problem = interaction.fields.getTextInputValue('ticket_field_reason');
        const ch = await interaction.guild.channels.create({
            name: `ticket-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
            ]
        });
        await interaction.reply({ content: `✅ تم فتح تذكرتك: ${ch}`, ephemeral: true });
        await ch.send({ content: `⚠️ استدعاء عاجل للمدراء!`, embeds: [new EmbedBuilder().setTitle('🎟️ تذكرة دعم').setDescription(`تفاصيل المشكلة:\n\`\`\`text\n${problem}\n\`\`\``).setColor(0x2ECC71)] });
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'giveaway') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ للمدراء فقط!', ephemeral: true });
        const prize = interaction.options.getString('prize');
        const duration = interaction.options.getInteger('duration');

        const giveEmbed = new EmbedBuilder().setTitle('🎉 **GIVEAWAY / مسابقة** 🎉').setDescription(`**الجائزة:** \`${prize}\`\n**المدة:** \`${duration}\` دقيقة`).setColor(0xE74C3C);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_give_event').setLabel('🎉 دخول السحب').setStyle(ButtonStyle.Danger));
        await interaction.reply({ content: '✅ تم الإطلاق!', ephemeral: true });
        const giveMsg = await interaction.channel.send({ embeds: [giveEmbed], components: [row] });

        const entrants = [];
        const giveCollector = giveMsg.createMessageComponentCollector({ time: duration * 60000 });
        giveCollector.on('collect', async i => {
            if (i.customId === 'join_give_event') {
                if (entrants.includes(i.user.id)) return i.reply({ content: '❌ مسجل سابقاً!', ephemeral: true });
                entrants.push(i.user.id); await i.reply({ content: '✅ تم دخول السحب!', ephemeral: true });
            }
        });
        giveCollector.on('end', async () => {
            if (entrants.length === 0) return interaction.channel.send('❌ انتهت المسابقة ولم يشترك أحد.');
            const winner = entrants[Math.floor(Math.random() * entrants.length)];
            await interaction.channel.send(`🎉 **مبروك الفائز هو: <@${winner}>! حصلت على: \`${prize}\`**`);
        });
    }

    if (interaction.commandName === 'vote') {
        const question = interaction.options.getString('question');
        const voteEmbed = new EmbedBuilder().setTitle('🗳️ إستطلاع رأي').setDescription(`**الموضوع:**\n\n${question}`).setColor(0x9B59B6);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('v_yes').setLabel('موافق 👍').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('v_no').setLabel('معارض 👎').setStyle(ButtonStyle.Danger));
        await interaction.reply({ content: '✅ تم النشر!', ephemeral: true });
        await interaction.channel.send({ embeds: [voteEmbed], components: [row] });
    }

    if (interaction.commandName === 'profile') {
        const data = getUserData(interaction.user.id, interaction.user.username);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🪪 ملف ${interaction.user.username}`).addFields({ name: '🥈 النقاط:', value: `\`${data.points}\`` }).setColor(0x27AE60)] });
    }
    if (interaction.commandName === 'penalty') {
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('p_l').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('p_r').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary));
        await interaction.reply({ content: '⚽ سدد ركلة الترجيح الآن:', components: [row] });
    }
    if (interaction.commandName === 'guess-nationality') {
        const flag = flagData[Math.floor(Math.random() * flagData.length)];
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🌍 خمن العلم المونديالي التالي!').setImage(flag.flagUrl).setColor(0xF39C12)] });
    }
});

// 6️⃣ قائمة المساعدة الفورية الشاملة لكل الأنظمة والأوامر المائلة
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'help') return;

    const helpEmbed = new EmbedBuilder()
        .setTitle('🤖 قائمة تحكم وأنظمة البوت المائلة بالكامل')
        .setDescription('**كل الميزات الشغالة والمحدثة بالنظام الجديد:**\n\n• 🛑 **الإدارة العليا (Admin)**\n └ `/dm user`, `/dm all`, `/setup-ticket`\n\n• 🎉 **المسابقات والفعاليات (Giveaway & Vote)**\n └ `/giveaway` (السحبات بالأزرار)، `/vote` (لوحات التصويت الحي)\n\n• 👥 **الألعاب والترفيه (Games)**\n └ `/mafia` (لعبة المافيا التكرارية الكلاسيكية)، `/info` (دليل وشرح اللعبة المطور)، `/updates` (عرض التحديثات الجديدة والأنظمة المضافة)، `/profile`, `/penalty`, `/guess-nationality`\n\n• 🎟️ **الاختصارات النصية المباشرة (Shortcuts)**\n └ `.w` (الترحيب الفوري وعرض الإمبيد)')
        .setColor(0x5865F2)
        .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png'); 

    await interaction.reply({ embeds: [helpEmbed] });
});

client.login(process.env.TOKEN);
