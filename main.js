const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const express = require('express');

// إعداد خادم ويب لمنصة Render للحفاظ على استمرارية البوت
const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('World Cup 2026 Bot Is Online!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

// إنشاء العميل مع النوايا المطلوبة لقراءة الرسائل في الشات
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// الإصدار واسم البوت
const BOT_NAME = "World Cup 2026 Bot";
const BOT_VERSION = "v1.2";

// بيانات الأعلام والدول تدعم العربي والإنجليزي (تخطي حالة الأحرف للإنجليزي تلقائياً في الكود)
const gameData = [
    { arabic: "المغرب", english: "morocco", flagUrl: "https://flagcdn.com/w640/ma.png" },
    { arabic: "السعودية", english: "saudi arabia", flagUrl: "https://flagcdn.com/w640/sa.png" },
    { arabic: "مصر", english: "egypt", flagUrl: "https://flagcdn.com/w640/eg.png" },
    { arabic: "الأرجنتين", english: "argentina", flagUrl: "https://flagcdn.com/w640/ar.png" },
    { arabic: "فرنسا", english: "france", flagUrl: "https://flagcdn.com/w640/fr.png" },
    { arabic: "البرازيل", english: "brazil", flagUrl: "https://flagcdn.com/w640/br.png" },
    { arabic: "المكسيك", english: "mexico", flagUrl: "https://flagcdn.com/w640/mx.png" },
    { arabic: "أمريكا", english: "usa", flagUrl: "https://flagcdn.com/w640/us.png" },
    { arabic: "كندا", english: "canada", flagUrl: "https://flagcdn.com/w640/ca.png" }
];

// مصفوفة المجموعات والأفرقة المشاركة في كأس العالم 2026
const teamsData = {
    ar: [
        { group: "المجموعة A", teams: "🇲🇽 المكسيك، 🇺🇸 أمريكا، 🇨🇦 كندا + بقية المتأهلين قريباً" },
        { group: "المجموعة B", teams: "تحدد المجموعات الكاملة فور انتهاء التصفيات النهائية" }
    ],
    en: [
        { group: "Group A", teams: "🇲🇽 Mexico, 🇺🇸 USA, 🇨🇦 Canada + other qualifiers soon" },
        { group: "Group B", teams: "Full groups will be updated post-qualifiers" }
    ]
};

const activeGames = new Set();

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    // بناء الأوامر وتسجيلها في الديسكورد
    const commands = [
        // 1. أمر المساعدة بلغتين
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('عرض قائمة المساعدة والأوامر / View help list')
            .addStringOption(option => 
                option.setName('language')
                    .setDescription('اختر اللغة / Choose language')
                    .setRequired(true)
                    .addChoices(
                        { name: 'العربية', value: 'ar' },
                        { name: 'English', value: 'en' }
                    )),

        // 2. أمر الأفرقة المشاركة بلغتين
        new SlashCommandBuilder()
            .setName('teams')
            .setDescription('عرض المجموعات والأفرقة / View teams and groups')
            .addStringOption(option => 
                option.setName('language')
                    .setDescription('اختر اللغة / Choose language')
                    .setRequired(true)
                    .addChoices(
                        { name: 'العربية', value: 'ar' },
                        { name: 'English', value: 'en' }
                    )),

        // 3. لعبة احزر العلم
        new SlashCommandBuilder()
            .setName('احزر-العلم')
            .setDescription('شغل لعبة تخمين علم الدولة في الشات (يدعم عربي/إنجليزي)'),

        // 4. العداد التنازلي للمونديال
        new SlashCommandBuilder()
            .setName('مونديال-2026')
            .setDescription('حساب الوقت المتبقي لافتتاح كأس العالم 2026 في المكسيك'),

        // 5. أمر إرسال رسائل إمبد (مخصص للمشرفين فقط لحماية السيرفر)
        new SlashCommandBuilder()
            .setName('send-embed')
            .setDescription('إرسال رسالة إمبد مخصصة من خلال البوت')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addStringOption(option => option.setName('title').setDescription('عنوان رسالة الإمبد').setRequired(true))
            .addStringOption(option => option.setName('description').setDescription('محتوى ووصف الرسالة').setRequired(true))
            .addStringOption(option => 
                option.setName('color')
                    .setDescription('اختر لون الإمبد')
                    .setRequired(false)
                    .addChoices(
                        { name: 'أزرق', value: 'Blue' },
                        { name: 'أخضر', value: 'Green' },
                        { name: 'أحمر', value: 'Red' },
                        { name: 'ذهبي', value: 'Gold' }
                    ))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, channelId, options } = interaction;

    // 1️⃣ أمر المساعدة (Help)
    if (commandName === 'help') {
        await interaction.deferReply();
        const lang = options.getString('language');

        const embed = new EmbedBuilder()
            .setThumbnail(client.user.displayAvatarURL())
            .setFooter({ text: `${BOT_NAME} • ${BOT_VERSION}` });

        if (lang === 'ar') {
            embed.setTitle('📋 قائمة أوامر البوت')
                .setDescription(`مرحباً بك في بوت كأس العالم 2026 المطور! إليك الأوامر المتاحة:`)
                .setColor(0x2ECC71)
                .addFields(
                    { name: '🔹 `/help`', value: 'عرض هذه القائمة واختيار اللغة.' },
                    { name: '🔹 `/teams`', value: 'عرض المجموعات والأفرقة المشاركة.' },
                    { name: '🔹 `/احزر-العلم`', value: 'بدء لعبة تخمين أعلام الدول (تقبل عربي أو إنجليزي).' },
                    { name: '🔹 `/مونديال-2026`', value: 'عداد تنازلي دقيق حتى موعد انطلاق البطولة.' },
                    { name: '🔹 `/send-embed`', value: 'إرسال رسالة إمبد منسقة (للمشرفين فقط).' }
                );
        } else {
            embed.setTitle('📋 Bot Commands List')
                .setDescription(`Welcome to the advanced World Cup 2026 Bot! Here are the available commands:`)
                .setColor(0x3498DB)
                .addFields(
                    { name: '🔹 `/help`', value: 'Show this list and select language.' },
                    { name: '🔹 `/teams`', value: 'Display tournament groups and qualified teams.' },
                    { name: '🔹 `/احزر-العلم`', value: 'Start guessing the flag game (Accepts Arabic or English).' },
                    { name: '🔹 `/مونديال-2026`', value: 'Live countdown timer until the tournament kickoff.' },
                    { name: '🔹 `/send-embed`', value: 'Send a custom formatted embed message (Staff only).' }
                );
        }
        await interaction.editReply({ embeds: [embed] });
    }

    // 2️⃣ أمر الأفرقة المشاركة (Teams)
    if (commandName === 'teams') {
        await interaction.deferReply();
        const lang = options.getString('language');
        
        const embed = new EmbedBuilder()
            .setColor(lang === 'ar' ? 0x27AE60 : 0xE74C3C)
            .setFooter({ text: `${BOT_NAME} • ${BOT_VERSION}` });

        if (lang === 'ar') {
            embed.setTitle('⚽ المجموعات والمنتخبات المشاركة بكأس العالم 2026');
            teamsData.ar.forEach(g => embed.addFields({ name: g.group, value: g.teams }));
        } else {
            embed.setTitle('⚽ World Cup 2026 Groups & Teams');
            teamsData.en.forEach(g => embed.addFields({ name: g.group, value: g.teams }));
        }
        await interaction.editReply({ embeds: [embed] });
    }

    // 3️⃣ لعبة احزر العلم (يدعم اللغتين)
    if (commandName === 'احزر-العلم') {
        if (activeGames.has(channelId)) {
            return interaction.reply({ content: '❌ هناك لعبة قائمة بالفعل في هذه القناة، انتظر حتى تنتهي!', ephemeral: true });
        }

        await interaction.deferReply();
        activeGames.add(channelId);

        const chosen = gameData[Math.floor(Math.random() * gameData.length)];

        const gameEmbed = new EmbedBuilder()
            .setTitle('🤔 خمن اسم الدولة صاحبة هذا العلم!')
            .setDescription('⏱️ لديك **15 ثانية** فقط!\n💡 يمكنك كتابة الإجابة بـ **العربية** أو **الإنجليزية**.')
            .setImage(chosen.flagUrl)
            .setColor(0xE67E22)
            .setFooter({ text: `${BOT_NAME} • لعبة التخمين` });

        await interaction.editReply({ embeds: [gameEmbed] });

        // مجمع للتحقق من النص بالعربي أو بالإنجليزي (تجاهل الفراغات وحالة الأحرف)
        const filter = response => {
            const answer = response.content.trim().toLowerCase();
            return answer === chosen.arabic || answer === chosen.english;
        };

        const collector = interaction.channel.createMessageCollector({ filter, time: 15000, max: 1 });
        let won = false;

        collector.on('collect', async m => {
            won = true;
            const successEmbed = new EmbedBuilder()
                .setTitle('🎉 إجابة صحيحة كفو!')
                .setDescription(`البطل **${m.author}** عرف الإجابة الصحيحة وهي: **${chosen.arabic}** (${chosen.english.toUpperCase()}) 🏆`)
                .setColor(0x2ECC71)
                .setThumbnail(chosen.flagUrl);
            
            await interaction.followUp({ embeds: [successEmbed] });
            collector.stop();
        });

        collector.on('end', async () => {
            activeGames.delete(channelId);
            if (!won) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ انتهى الوقت!')
                    .setDescription(`لأسف لم يعرف أحد الإجابة الصحيحة. 😔\n\nالدولة هي: **${chosen.arabic}** | **${chosen.english.toUpperCase()}**`)
                    .setColor(0xE74C3C)
                    .setThumbnail(chosen.flagUrl);

                await interaction.followUp({ embeds: [timeoutEmbed] });
            }
        });
    }

    // 4️⃣ العداد التنازلي لكأس العالم 2026
    if (commandName === 'مونديال-2026') {
        await interaction.deferReply();

        const worldCupDate = new Date('2026-06-11T18:00:00Z'); 
        const now = new Date();
        const difference = worldCupDate - now;

        if (difference <= 0) {
            return interaction.editReply({ content: '🎉 انطلقت بطولة كأس العالم 2026 الجارية الآن في المكسيك وأمريكا وكندا! ⚽🏆' });
        }

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        const countdownEmbed = new EmbedBuilder()
            .setTitle('🏆 العداد التنازلي لبطولة كأس العالم 2026 ⚽')
            .setDescription('المباراة الافتتاحية ستنطلق في المكسيك بملعب أزتيكا التاريخي العريق!')
            .addFields({ name: '⏳ الوقت المتبقي للبطولة:', value: `**${days}** يوم و **${hours}** ساعة و **${minutes}** دقيقة و **${seconds}** ثانية` })
            .setColor(0x3498DB)
            .setThumbnail('https://flagcdn.com/w640/mx.png')
            .setFooter({ text: `${BOT_NAME} • العداد الزمني` });

        await interaction.editReply({ embeds: [countdownEmbed] });
    }

    // 5️⃣ أمر إرسال رسائل إمبد مخصصة (/send-embed)
    if (commandName === 'send-embed') {
        const title = options.getString('title');
        const description = options.getString('description');
        const colorName = options.getString('color') || 'Blue';

        // خريطة تحويل الألوان
        const colors = { 'Blue': 0x3498DB, 'Green': 0x2ECC71, 'Red': 0xE74C3C, 'Gold': 0xF1C40F };

        const customEmbed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description.replace(/\\n/g, '\n')) // يدعم النزول لسطر جديد بـ \n
            .setColor(colors[colorName])
            .setTimestamp()
            .setFooter({ text: `${BOT_NAME}`, iconURL: client.user.displayAvatarURL() });

        // إرسال رد مخفي للمشرف ليرى نجاح العملية
        await interaction.reply({ content: '✅ تم إرسال رسالة الإمبد بنجاح في القناة!', ephemeral: true });
        
        // إرسال الإمبد الفعلي في القناة للجميع
        await interaction.channel.send({ embeds: [customEmbed] });
    }
});

client.login(process.env.TOKEN);
