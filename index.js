const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express'); // استيراد مكتبة إكسبريس لإنشاء السيرفر الوهمي

// ---------------- [ الخدعة لـ Render و UptimeRobot ] ----------------
const app = express();
const PORT = process.env.PORT || 3000; // ريندر بيعطي البوت بورت تلقائي

app.get('/', (req, res) => {
    res.send('FROM TRL TEAM™ Bot is Online and Running 24/7! 🚀');
});

app.listen(PORT, () => {
    console.log(`🌐 السيرفر الوهمي يعمل الآن على المنفذ: ${PORT}`);
});
// ------------------------------------------------------------------

// إنشاء عميل البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);

    // تسجيل أمر /help كـ Slash Command
    try {
        await client.application.commands.create({
            name: 'help',
            description: 'عرض قائمة الأوامر المتاحة',
        });
        console.log('🔹 تم تسجيل أمر /help بنجاح!');
    } catch (error) {
        console.error('خطأ أثناء تسجيل الأمر:', error);
    }
});

// منع البوت من الرد على نفسه في الشات
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === 'هلا') {
        message.reply('هلا بك! كيف بقدر أساعدك اليوم؟');
    }
});

// التعامل مع الـ Slash Commands والتفاعل مع الأزرار
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'help') {
            
            const helpEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📚 قائمة المساعدة للقروب')
                .setDescription('مرحباً بك! يرجى اختيار القسم الذي تريد استعراضه من خلال الأزرار أدناه:');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('help_owner')
                    .setLabel('👑 أوامر الأونر')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('help_public')
                    .setLabel('👥 الأوامر العامة (للجميع)')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [helpEmbed], components: [row], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'help_owner') {
            const ownerEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('👑 صلاحيات وأوامر الأونر (المطور)')
                .setDescription('هذه الأوامر مخصصة فقط لإدارة البوت والسيرفر بشكل كامل:')
                .addFields(
                    { name: '• إعدادات البوت', value: 'التحكم بالباند، التيكتات، وتعديل الخصائص.' },
                    { name: '• الصيانة', value: 'إعادة تشغيل البوت أو تحديث الملفات.' }
                );

            await interaction.update({ embeds: [ownerEmbed] });
        }

        if (interaction.customId === 'help_public') {
            const publicEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setTitle('👥 الأوامر العامة (للجميع)')
                .setDescription('هذه الأوامر متاحة لجميع أعضاء السيرفر بدون استثناء:')
                .addFields(
                    { name: '• الألعاب', value: 'لعب الالعاب الفردية أو الجماعية داخل السيرفر.' },
                    { name: '• نظام اللفل', value: 'التحقق من مستواك وخبرتك الحاليين.' },
                    { name: '• معلومات', value: 'عرض معلومات الحساب أو السيرفر.' }
                );

            await interaction.update({ embeds: [publicEmbed] });
        }
    }
});

// تشغيل البوت
client.login(process.env.DISCORD_TOKEN);
