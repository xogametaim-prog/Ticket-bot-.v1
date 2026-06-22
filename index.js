const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');
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

// ---------------- [ مخططات حفظ البيانات Schemas ] ----------------
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    coins: { type: Number, default: 0 },
    verified: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    bankId: { type: String, default: '' },
    mozz3Role: { type: String, default: '' },
    clientRole: { type: String, default: '' },
    logChannel: { type: String, default: '' },
    taxChannel: { type: String, default: '' },
    transferChannel: { type: String, default: '' },
    price: { type: Number, default: 1 },
    minLimit: { type: Number, default: 1 },
    stockCount: { type: Number, default: 0 }
});
const BotConfig = mongoose.model('BotConfig', configSchema);

// ---------------- [ إعداد عميل البوت ] ----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const PREFIX = '+';
const OWNER_ID = '123456789012345678'; // ⚠️ ضع هنا الآيدي الخاص بحسابك الشخصي في ديسكورد

// دالات جلب البيانات
async function getUserData(id) {
    let userData = await User.findOne({ userId: id });
    if (!userData) {
        userData = new User({ userId: id, coins: 0 });
        await userData.save();
    }
    return userData;
}

async function getBotConfig(guildId) {
    let config = await BotConfig.findOne({ guildId });
    if (!config) {
        config = new BotConfig({ guildId });
        await config.save();
    }
    return config;
}

// ---------------- [ تسجيل أوامر السلاش ] ----------------
const slashCommands = [
    new SlashCommandBuilder().setName('help').setDescription('لعرض قائمة المساعدة والأوامر مقسمة'),
    new SlashCommandBuilder().setName('info').setDescription('لعرض ملفك الشخصي ومعلومات مطور البوت'),
    new SlashCommandBuilder().setName('coins').setDescription('لمعرفة رصيدك الحالي من الكوينز')
        .addUserOption(option => option.setName('user').setDescription('العضو المراد فحص رصيده')),
    new SlashCommandBuilder().setName('stock').setDescription('لمعرفة ستوك الأعضاء المتواجد في المخزون'),
    new SlashCommandBuilder().setName('top').setDescription('أعلى شخصيات تمتلك كوينز في البوت')
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`✅ تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('🔄 جاري تحديث أوامر السلاش (/) ...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ تم تسجيل أوامر السلاش بنجاح!');
    } catch (error) {
        console.error('❌ خطأ أثناء تسجيل أوامر السلاش:', error);
    }
});

// ---------------- [ التفاعل مع أوامر السلاش ] ----------------
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId, user } = interaction;
    const config = await getBotConfig(guildId);

    if (commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('📚 قائمة مساعدة FROM TRL TEAM™')
            .setDescription('يرجى اختيار القسم الذي تريد استعراضه من خلال الأزرار أدناه:')
            .setThumbnail('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002184.png'); // استخدام اسم الملف 1000002184.png

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_owner').setLabel('👑 أوامر الأونر').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('help_public').setLabel('👥 الأوامر العامة').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setLabel('🔗 إضافة البوت من هنا').setStyle(ButtonStyle.Link).setURL('https://discord.com/oauth2/authorize?client_id=1518357964984156300&permissions=8&integration_type=0&scope=bot+applications.commands')
        );
        return interaction.reply({ embeds: [helpEmbed], components: [row] });
    }

    if (commandName === 'info') {
        const infoEmbed = new EmbedBuilder()
            .setColor('#00F0FF')
            .setTitle('👑 الملف الشخصي والمعلومات الأساسية')
            .setThumbnail('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002188.png') // استخدام اسم الملف 1000002188.png
            .setDescription('**الاسم:** تيم (Taim)\n**المسمى التقني:** مؤسس وقائد فريق TRL.dev\n**البريد الإلكتروني:** hacked909h@gmail.com')
            .addFields(
                { name: '🚀 المهارات والقدرات', value: '• تطوير بوتات ديسكورد وتطبيقات الويب\n• لغات البرمجة: Python, JavaScript' }
            );
        return interaction.reply({ embeds: [infoEmbed] });
    }

    if (commandName === 'coins') {
        const target = interaction.options.getUser('user') || user;
        const data = await getUserData(target.id);
        return interaction.reply(`💰 رصيد **${target.username}** الحالي هو: \`${data.coins}\` كوينز.`);
    }

    if (commandName === 'stock') {
        const stockEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle('📦 مخزون الأعضاء')
            .setDescription(`ستوك الأعضاء المتواجد حالياً هو: \`${config.stockCount}\` عضو.`)
            .setThumbnail('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002186.png'); // استخدام اسم الملف 1000002186.png
        return interaction.reply({ embeds: [stockEmbed] });
    }

    if (commandName === 'top') {
        const topUsers = await User.find().sort({ coins: -1 }).limit(6);
        let description = topUsers.map((u, i) => `**#${i + 1}** | <@${u.userId}> — \`${u.coins}\` كوينز`).join('\n') || 'لا يوجد أعضاء.';
        const topEmbed = new EmbedBuilder().setColor('#FFD700').setTitle('🏆 أعلى 6 أشخاص يمتلكون كوينز').setDescription(description);
        return interaction.reply({ embeds: [topEmbed] });
    }
});

// ---------------- [ أوامر البريفكس العادية (+)] ----------------
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isOwner = message.author.id === OWNER_ID;
    const config = await getBotConfig(message.guild.id);

    if (command === 'tax') {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) return message.reply('⚠️ مثال: `+tax 1000`');
        const tax = Math.floor(amount * (20 / 19)) + 1;
        return message.reply(`💰 المبلغ مع الضريبة هو: \`${tax}\``);
    }

    // ==================== [ أوامر الأونر بالبريفكس ] ====================
    if (!isOwner) return;

    if (command === 'give') {
        const target = message.mentions.users.first(); const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return message.reply('⚠️ `+give [@user] [amount]`');
        const data = await getUserData(target.id); data.coins += amount; await data.save();
        return message.reply(`✅ تم إضافة \`${amount}\` كوينز لـ ${target}.`);
    }

    if (command === 'take') {
        const target = message.mentions.users.first(); const amount = parseInt(args[1]);
        if (!target || isNaN(amount)) return message.reply('⚠️ `+take [@user] [amount]`');
        const data = await getUserData(target.id); data.coins = Math.max(0, data.coins - amount); await data.save();
        return message.reply(`✅ تم سحب \`${amount}\` كوينز من ${target}.`);
    }

    if (command === 'bank') {
        if (!args[0]) return message.reply('⚠️ `+bank [id]`');
        config.bankId = args[0]; await config.save();
        return message.reply(`✅ تم تعيين البنك: \`${config.bankId}\``);
    }

    if (command === 'limite') {
        const limit = parseInt(args[0]); if (isNaN(limit)) return message.reply('⚠️ `+limite [number]`');
        config.minLimit = limit; await config.save();
        return message.reply(`✅ الحد الأدنى: \`${config.minLimit}\``);
    }

    if (command === 'clinet') {
        const roleId = args[0]?.replace(/[<@&>]/g, ''); if (!roleId) return message.reply('⚠️ `+clinet [role_id]`');
        config.clientRole = roleId; await config.save();
        return message.reply(`✅ تم تعيين رول الشراء.`);
    }

    if (command === 'mozz3') {
        const roleId = args[0]?.replace(/[<@&>]/g, ''); if (!roleId) return message.reply('⚠️ `+mozz3 [role_id]`');
        config.mozz3Role = roleId; await config.save();
        return message.reply(`✅ تم تعيين رول الموزعين.`);
    }

    if (command === 'price') {
        const prc = parseInt(args[0]); if (isNaN(prc)) return message.reply('⚠️ `+price [number]`');
        config.price = prc; await config.save();
        return message.reply(`✅ سعر العضو: \`${config.price}\` كوينز.`);
    }

    if (command === 'refresh') {
        config.stockCount = Math.floor(Math.random() * 400) + 150; await config.save();
        return message.reply(`🔄 تم تحديث الستوك: \`${config.stockCount}\``);
    }

    if (command === 'log') {
        const chId = args[0]?.replace(/[<#>]/g, ''); if (!chId) return message.reply('⚠️ `+log [#channel]`');
        config.logChannel = chId; await config.save(); return message.reply(`✅ تم تعيين روم اللوج.`);
    }

    if (command === 'send') {
        const embed = new EmbedBuilder().setColor('#2F3136').setTitle('🔗 نظام التوثيق الفوري').setThumbnail('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002188.png'); // استخدام اسم الملف 1000002188.png
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verify_user').setLabel('✅ وثق نفسك هنا').setStyle(ButtonStyle.Success));
        return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (command === 'panel') {
        const panelEmbed = new EmbedBuilder()
            .setColor('#00FF66')
            .setTitle('🛒 لوحة شراء الأعضاء والخدمات')
            .setDescription(`• سعر العضو الحالي: \`${config.price}\` كوينز.\n• الحد الأدنى: \`${config.minLimit}\` عضو.`)
            .setImage('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002184.png'); // استخدام اسم الملف 1000002184.png
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('buy_members').setLabel('🛒 شراء أعضاء').setStyle(ButtonStyle.Success));
        return message.channel.send({ embeds: [panelEmbed], components: [row] });
    }

    if (command === 'delete-tickets') {
        const tickets = message.guild.channels.cache.filter(ch => ch.name.startsWith('ticket-'));
        tickets.forEach(ch => ch.delete().catch(() => null));
        return message.reply(`🗑️ تم حذف \`${tickets.size}\` تذكرة مفتوحة.`);
    }

    if (command === 'restart') {
        await message.reply('🔄 جاري عمل Restart للبوت...'); process.exit(0);
    }
});

// ---------------- [ التفاعل مع الأزرار ] ----------------
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'help_owner') {
        let ownerFields = commandsList.owner.map(cmd => ({ name: cmd.name, value: cmd.desc }));
        const ownerEmbed = new EmbedBuilder().setColor('#ED4245').setTitle('👑 أوامر الأونر (المطور)').addFields(ownerFields.slice(0, 25));
        
        // أزرار التنقل المضافة لسهولة العودة
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_public').setLabel('👥 الأوامر العامة').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setLabel('🔗 إضافة البوت من هنا').setStyle(ButtonStyle.Link).setURL('https://discord.com/oauth2/authorize?client_id=1518357964984156300&permissions=8&integration_type=0&scope=bot+applications.commands')
        );
        await interaction.update({ embeds: [ownerEmbed], components: [row] });
    }

    if (interaction.customId === 'help_public') {
        let publicFields = commandsList.public.map(cmd => ({ name: cmd.name, value: cmd.desc }));
        const publicEmbed = new EmbedBuilder().setColor('#57F287').setTitle('👥 الأوامر العامة (للجميع)').addFields(publicFields);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('help_owner').setLabel('👑 أوامر الأونر').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setLabel('🔗 إضافة البوت من هنا').setStyle(ButtonStyle.Link).setURL('https://discord.com/oauth2/authorize?client_id=1518357964984156300&permissions=8&integration_type=0&scope=bot+applications.commands')
        );
        await interaction.update({ embeds: [publicEmbed], components: [row] });
    }

    if (interaction.customId === 'verify_user') {
        let data = await User.findOne({ userId: interaction.user.id }) || new User({ userId: interaction.user.id });
        data.verified = true; await data.save();
        await interaction.reply({ content: '✅ لقد تم توثيق حسابك في النظام بنجاح!', ephemeral: true });
    }

    if (interaction.customId === 'buy_members') {
        const ticketEmbed = new EmbedBuilder()
            .setColor('#ED4245')
            .setTitle('🎫 تذكرة الشراء والدعم الفني')
            .setThumbnail('https://raw.githubusercontent.com/xogametaim/bot-assets/main/1000002187.png') // استخدام اسم الملف 1000002187.png
            .setDescription('يرجى كتابة الكمية التي تريد شراءها وسيتم الرد عليك فوراً.');
        await interaction.reply({ embeds: [ticketEmbed], ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);
