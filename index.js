const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const commandsList = require('./commands.js');

// ---------------- [ سيرفر ريندر الوهمي ] ----------------
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('FROM TRL TEAM™ Bot is Online! 🚀'));
app.listen(PORT, () => console.log(`🌐 السيرفر الوهمي يعمل على منفذ: ${PORT}`));

// ---------------- [ الاتصال بـ MongoDB ] ----------------
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('📁 تم الاتصال بقاعدة بيانات MongoDB بنجاح!'))
    .catch((err) => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

// ---------------- [ مخطط حفظ البيانات Schema ] ----------------
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    coins: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

// ---------------- [ إعداد عميل البوت ] ----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = '+';
const OWNER_ID = 'YOUR_DISCORD_ID'; // ضع الآيدي الخاص بك هنا لتتمكن من استخدام أوامر الأونر

client.once('ready', () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // دالة لجلب أو إنشاء بيانات العضو من قاعدة البيانات تلقائياً
    async function getUserData(id) {
        let userData = await User.findOne({ userId: id });
        if (!userData) {
            userData = new User({ userId: id, coins: 0 });
            await userData.save();
        }
        return userData;
    }

    // أمر +help
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 قائمة مساعدة FROM TRL TEAM™')
            .setDescription('يرجى اختيار القسم الذي تريد استعراضه من خلال الأزرار أدناه:');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_owner').setLabel('👑 أوامر الأونر').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('help_public').setLabel('👥 الأوامر العامة').setStyle(ButtonStyle.Primary)
        );

        return message.reply({ embeds: [helpEmbed], components: [row] });
    }

    // أمر +info
    if (command === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setColor('#00F0FF')
            .setTitle('👑 الملف الشخصي والمعلومات الأساسية')
            .setDescription('**الاسم:** تيم (Taim)\n**المسمى التقني:** مؤسس وقائد فريق TRL.dev (Lead Developer)\n**البريد الإلكتروني:** hacked909h@gmail.com')
            .addFields(
                { 
                    name: '🚀 المهارات والقدرات التقنية', 
                    value: '• تطوير وبرمجة بوتات منصة Discord و Twitch\n• تصميم وتطوير مواقع الويب والتطبيقات (HTML, CSS, JavaScript)\n• تطوير وبناء الألعاب الرقمية\n• إتقان لغات البرمجة: Python, JavaScript\n• أدوات التطوير: GitHub, Google AI Studio' 
                },
                { 
                    name: '📁 المشاريع والإنجازات (تحت مظلة TRL.dev)', 
                    value: '• **بوتات إدارة الخوادم:** حماية وأنظمة تحقق فورية وتيكتات.\n• **بوت كأس العالم:** متابعة وجدولة المباريات وتزويد النتائج تلقائياً.\n• **RTR Bot:** بناء وتطوير البوت الخاص بالفريق وتحديث ميزاته باستمرار.\n• **لوحات التحكم (Dashboards):** تصميم لوحات ويب لربط وإدارة البوتات بسهولة.' 
                }
            )
            .setFooter({ text: 'FROM TRL TEAM™', iconURL: client.user.displayAvatarURL() });

        return message.reply({ embeds: [infoEmbed] });
    }

    // أمر +coins (لمعرفة الرصيد)
    if (command === 'coins') {
        const target = message.mentions.users.first() || message.author;
        const data = await getUserData(target.id);
        return message.reply(`💰 رصيد **${target.username}** الحالي هو: \`${data.coins}\` كوينز.`);
    }

    // أمر +give (إضافة كوينز - للأونر فقط)
    if (command === 'give') {
        if (message.author.id !== OWNER_ID) return message.reply('❌ هذا الأمر مخصص لإدارة وتطوير البوت فقط.');
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
            return message.reply('⚠️ الاستخدام الصحيح: `+give [@user] [amount]`');
        }

        const data = await getUserData(target.id);
        data.coins += amount;
        await data.save();

        return message.reply(`✅ تم إضافة \`${amount}\` كوينز لحساب ${target} بنجاح!`);
    }

    // أمر +take (سحب كوينز - للأونر فقط)
    if (command === 'take') {
        if (message.author.id !== OWNER_ID) return message.reply('❌ هذا الأمر مخصص لإدارة وتطوير البوت فقط.');
        const target = message.mentions.users.first();
        const amount = parseInt(args[1]);

        if (!target || isNaN(amount) || amount <= 0) {
            return message.reply('⚠️ الاستخدام الصحيح: `+take [@user] [amount]`');
        }

        const data = await getUserData(target.id);
        data.coins = Math.max(0, data.coins - amount); // لضمان عدم نزول الكوينز تحت الصفر
        await data.save();

        return message.reply(`✅ تم سحب \`${amount}\` كوينز من حساب ${target} بنجاح!`);
    }

    // أمر +top (أعلى 6 أشخاص يمتلكون كوينز)
    if (command === 'top') {
        const topUsers = await User.find().sort({ coins: -1 }).limit(6);
        if (topUsers.length === 0) return message.reply('📭 لا يوجد أعضاء مسجلين في قائمة الكوينز بعد.');

        let description = '';
        for (let i = 0; i < topUsers.length; i++) {
            try {
                const fetchedUser = await client.users.fetch(topUsers[i].userId);
                description += `**#${i + 1}** | ${fetchedUser.username} — \`${topUsers[i].coins}\` كوينز\n`;
            } catch {
                description += `**#${i + 1}** | مستخدم غير معروف — \`${topUsers[i].coins}\` كوينز\n`;
            }
        }

        const topEmbed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 قائمة أعلى 6 أشخاص يمتلكون كوينز')
            .setDescription(description)
            .setTimestamp();

        return message.reply({ embeds: [topEmbed] });
    }
});

// التفاعل مع الأزرار للـ help
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'help_owner') {
        let ownerFields = commandsList.owner.map(cmd => ({ name: cmd.name, value: cmd.desc }));
        const ownerEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('👑 أوامر الأونر (المطور)')
            .addFields(ownerFields.slice(0, 25));

        await interaction.update({ embeds: [ownerEmbed] });
    }

    if (interaction.customId === 'help_public') {
        let publicFields = commandsList.public.map(cmd => ({ name: cmd.name, value: cmd.desc }));
        const publicEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('👥 الأوامر العامة (للجميع)')
            .addFields(publicFields);

        await interaction.update({ embeds: [publicEmbed] });
    }
});

client.login(process.env.DISCORD_TOKEN);
