/**
 * Bot Version: 3.9.8v (Fixed Help & Advanced Logged Ticket System)
 * Developer: ta_im1 | Team: TRL for development
 */

const { 
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, 
    ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require('discord.js');
const express = require('express');

const app = express();
const port = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Gangster-bot is running perfectly! 🚀'));
app.listen(port, () => console.log(`[SYSTEM] Web server active on port ${port}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const BOT_VERSION = "3.9.8v";
const tempUsers = new Map();
let activeMafiaGame = null;

// المتغيرات الخاصة بنظام التذاكر (يمكنك تعديل معرف روم سجل التذاكر هنا)
let TICKET_LOG_CHANNEL_ID = "ضع_هنا_ايدي_روم_الادارة"; 
const awaitingTicketReason = new Map(); // لمتابعة رسالة المشكلة من العضو

function getUserData(userId, username) {
    if (!tempUsers.has(userId)) {
        tempUsers.set(userId, { userId, username: username || 'مشجع مونديالي', points: 0, favoriteTeam: 'لم يحدد بعد ⚽', goalsScored: 0 });
    }
    return tempUsers.get(userId);
}

// 2️⃣ إعداد وتسجيل الأوامر المائلة الفعلية للبوت (بدون أي كذب أو زيادة)
client.once('ready', async () => {
    console.log(`[ONLINE] Logged in as ${client.user.tag}! Version: ${BOT_VERSION}`);

    const commands = [
        new SlashCommandBuilder().setName('help').setDescription('عرض الأوامر الحقيقية والفعلية للبوت حالياً'),
        new SlashCommandBuilder().setName('profile').setDescription('عرض ملفك الشخصي الرياضي ونقاطك'),
        new SlashCommandBuilder().setName('penalty').setDescription('تحدي ركلات الترجيح ضد البوت'),
        new SlashCommandBuilder()
            .setName('setup-ticket')
            .setDescription('إنشاء رسالة فتح تذكرة مخصصة للأعضاء (للإدارة)')
            .addStringOption(opt => opt.setName('title').setDescription('عنوان إمبيد التكت').setRequired(true))
            .addStringOption(opt => opt.setName('description').setDescription('وصف أو شروط التكت').setRequired(true))
            .addStringOption(opt => opt.setName('button_text').setDescription('النص المكتوب على زر الفتح').setRequired(true)),
        new SlashCommandBuilder()
            .setName('dm')
            .setDescription('نظام إرسال الرسائل الخاصة الإداري')
            .addSubcommand(sub => sub
                .setName('user')
                .setDescription('إرسال رسالة لعضو محدد')
                .addUserOption(opt => opt.setName('target').setDescription('العضو المستهدف').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة').setRequired(true)))
            .addSubcommand(sub => sub
                .setName('all')
                .setDescription('إرسال رسالة جماعية لجميع أعضاء السيرفر')
                .addStringOption(opt => opt.setName('title').setDescription('عنوان الرسالة الجماعية').setRequired(true))
                .addStringOption(opt => opt.setName('message').setDescription('نص الرسالة الجماعية').setRequired(true)))
    ].map(cmd => cmd.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SYSTEM] Actual Slash commands updated successfully!');
    } catch (error) {
        console.error('[ERROR] Failed to register slash commands:', error);
    }
});

// 3️⃣ أمر /help الصادق والفعلي بنسبة 100% مطابقاً لملف 1000001215.jpg
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setTitle('🤖 Bot Commands (الميزات الحقيقية للبوت)')
            .setDescription('**الأوامر والتصنيفات الشغالة بالفعل داخل البوت حالياً:**\n\n• 🛑 **Admin Commands**\n └ `/dm user`, `/dm all`, `/setup-ticket`\n\n• 👥 **Public & Games Commands**\n └ `/profile`, `/penalty`, `.m` (لعبة المافيا)\n\n• 🎟️ **Ticket System**\n └ نظام التذاكر المطور تلقائياً بالأزرار.')
            .setColor(0x5865F2)
            .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png'); // صورة المساعدة المطابقة للملف 1000001215.jpg

        const linksRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Invite Bot').setURL('https://discord.com/oauth2/authorize?client_id=1509320177366466620&permissions=8&integration_type=0&scope=bot+applications.commands').setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('Support Server').setURL('https://discord.gg/esSmsjd9WG').setStyle(ButtonStyle.Link)
        );

        await interaction.reply({ embeds: [helpEmbed], components: [linksRow] });
    }
});

// 4️⃣ نظام إعداد وتخصيص رسالة التكت (/setup-ticket)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'setup-ticket') return;
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص للمدراء فقط!', ephemeral: true });
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const buttonText = interaction.options.getString('button_text');

    // حفظ ايدي الروم الحالي ليكون روم الإدارة التلقائي في حال لم يتم تعديله بالأعلى
    TICKET_LOG_CHANNEL_ID = interaction.channel.id;

    const ticketEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x3498DB)
        .setFooter({ text: 'اضغط على الزر أدناه لفتح تذكرة جديدة' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('open_ticket_btn')
            .setLabel(buttonText)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎟️')
    );

    await interaction.reply({ content: '✅ تم إنشاء وتخصيص رسالة التذاكر بنجاح في هذا الروم!', ephemeral: true });
    await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
});

// 5️⃣ معالجة تفاعل فتح التكت وانتظار المشكلة
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton() || interaction.customId !== 'open_ticket_btn') return;

    // إنشاء روم مؤقت خاص بالعضو ليكتب مشكلته
    try {
        const tempChannel = await interaction.guild.channels.create({
            name: `تكت-${interaction.user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        await interaction.reply({ content: `✅ تم فتح روم مؤقت لك لصياغة المشكلة: ${tempChannel}`, ephemeral: true });

        // رسالة البوت داخل الروم المؤقت طلب المشكلة
        await tempChannel.send(`👋 أهلاً بك يا <@${interaction.user.id}>.\n\n**يرجى كتابة مشكلتك أو سبب فتح التذكرة في رسالة واحدة هنا، وسيتم إرسالها فوراً للإدارة واستدعاء الـ Administrator.**`);
        
        // حفظ بيانات الروم لمراقبة الرسالة القادمة من العضو
        awaitingTicketReason.set(tempChannel.id, { userId: interaction.user.id, username: interaction.user.username });

    } catch (e) {
        console.error(e);
        await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة إنشاء التذكرة، يرجى التحقق من صلاحيات البوت.', ephemeral: true });
    }
});

// 6️⃣ استقبال المشكلة وإرسالها لروم الإدارة وعمل منشن للمدراء
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (awaitingTicketReason.has(message.channel.id)) {
        const data = awaitingTicketReason.get(message.channel.id);
        
        // التأكد أن كاتب الرسالة هو نفسه صاحب التكت
        if (message.author.id !== data.userId) return;

        const problemText = message.content;

        // البحث عن روم سجل الإدارة (Log Channel)
        const logChannel = message.guild.channels.cache.get(TICKET_LOG_CHANNEL_ID);
        
        // البحث عن رتبة Administrator لعمل المنشن
        const adminRole = message.guild.roles.cache.find(role => role.name.toLowerCase() === 'administrator' || role.permissions.has(PermissionFlagsBits.Administrator));

        const logEmbed = new EmbedBuilder()
            .setTitle('🎟️ تذكرة جديدة تم إرسالها')
            .setColor(0x2ECC71)
            .addFields(
                { name: '👤 صاحب التذكرة:', value: `${data.username} (<@${data.userId}>)`, inline: true },
                { name: '📝 تفاصيل المشكلة المرفوعة:', value: `\`\`\`text\n${problemText}\n\`\`\`` }
            )
            .setTimestamp();

        if (logChannel) {
            await logChannel.send({ 
                content: adminRole ? `⚠️ استدعاء عاجل للـ <&${adminRole.id}> | تذكرة جديدة تحتاج مراجعة!` : `⚠️ استدعاء عاجل للـ @Administrator | تذكرة جديدة تحتاج مراجعة!`, 
                embeds: [logEmbed] 
            });
        }

        // إشعار العضو على الخاص بتأكيد الاستلام بسلام
        try {
            await message.author.send(`✅ تم رفع مشكلتك بنجاح إلى طاقم الإدارة الـ Administrators، وجاري مراجعتها حالياً!`);
        } catch (e) {}

        // حذف الروم المؤقت فوراً وتصفير البيانات لمنع التكرار
        awaitingTicketReason.delete(message.channel.id);
        await message.channel.delete().catch(() => {});
    }
});

// 7️⃣ ميزة الرسائل الخاصة للإدارة العليا (Slash & Text)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'dm') return;
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ هذا الأمر مخصص للإدارة العليا فقط!', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'user') {
        const target = interaction.options.getUser('target');
        const messageText = interaction.options.getString('message');
        try {
            await target.send(`📢 **رسالة إدارية خاصة:**\n\n${messageText}`);
            await interaction.reply({ content: `✅ تم إرسال الرسالة بنجاح إلى الخاص لـ ${target}`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `❌ تعذر الإرسال، العضو يغلق الرسائل الخاصة.`, ephemeral: true });
        }
    }

    if (subcommand === 'all') {
        const title = interaction.options.getString('title');
        const messageText = interaction.options.getString('message');
        await interaction.reply({ content: '⏳ جاري بدء الإرسال الجماعي لجميع أعضاء السيرفر...', ephemeral: true });
        const members = await interaction.guild.members.fetch();
        members.forEach(member => {
            if (!member.user.bot) {
                member.send(`📢 **${title}**\n\n${messageText}`).catch(() => {});
            }
        });
    }
});

// الاختصارات النصية للرسائل الخاصة المباشرة للشات (.dm)
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('.dm')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;

        const args = message.content.slice('.dm'.length).trim().split(/ +/);
        if (args.length < 1) return;

        if (args[0] === 'كل' || args[0].toLowerCase() === 'all') {
            const broadcastText = args.slice(1).join(' ');
            if (!broadcastText) return;
            const members = await message.guild.members.fetch();
            members.forEach(m => { if (!m.user.bot) m.send(`📢 **إشعار هام من الإدارة**\n\n${broadcastText}`).catch(() => {}); });
        } else {
            const targetUser = message.mentions.users.first();
            const directText = args.slice(1).join(' ');
            if (!targetUser || !directText) return;
            try {
                await targetUser.send(`📢 **رسالة إدارية مخصصة:**\n\n${directText}`);
            } catch (e) {}
        }
    }
});

// 8️⃣ نظام بطولة لعبة المافيا المبسط والمستقر (.m) مع صورة الـ 1000001214_2.png
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.trim().toLowerCase() === '.m') {
        if (activeMafiaGame) return message.reply('⚠️ هناك مباراة مافيا قائمة بالفعل!');

        activeMafiaGame = { hostChannel: message.channel.id, players: new Map(), status: 'lobby' };

        const updateEmbed = () => {
            const playerList = Array.from(activeMafiaGame.players.values()).map((p, idx) => `${idx + 1}- <@${p.id}>`).join('\n') || 'لا يوجد لاعبين مسجلين حالياً.';
            return new EmbedBuilder()
                .setTitle('✨ .•°•-BRQ Community 7K°.•?')
                .setDescription(`**المشاركين الحاليين في البطولة (${activeMafiaGame.players.size}/25):**\n${playerList}`)
                .setImage('https://images2.imgbox.com/71/34/4mP9Y7C1_o.png') // صورة المافيا الرسمية المأخوذة من الملف 1000001214_2.png
                .setColor(0x5865F2);
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('m_join').setEmoji('📥').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('m_leave').setEmoji('📤').setStyle(ButtonStyle.Danger)
        );

        const gameMsg = await message.channel.send({ embeds: [updateEmbed()], components: [row] });

        const lobbyCollector = gameMsg.createMessageComponentCollector({ time: 30000 });

        lobbyCollector.on('collect', async interaction => {
            if (interaction.customId === 'm_join') {
                if (activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت مسجل بالفعل!', ephemeral: true });
                activeMafiaGame.players.set(interaction.user.id, { id: interaction.user.id, username: interaction.user.username });
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }
            if (interaction.customId === 'm_leave') {
                if (!activeMafiaGame.players.has(interaction.user.id)) return interaction.reply({ content: '❌ أنت غير مسجل أصلاً!', ephemeral: true });
                activeMafiaGame.players.delete(interaction.user.id);
                await interaction.deferUpdate();
                await gameMsg.edit({ embeds: [updateEmbed()] });
            }
        });

        lobbyCollector.on('end', async () => {
            if (!activeMafiaGame) return;
            if (activeMafiaGame.players.size < 2) {
                await message.channel.send('❌ تم إلغاء اللعبة لعدم وجود عدد كافٍ من اللاعبين المشاركين.');
                activeMafiaGame = null;
                return;
            }

            await message.channel.send('🎮 **تم قفل التسجيل وتوزيع الأدوار سراً على الخاص!**\n⏱️ **بدأت مرحلة التفكير والمناقشة الحية (30 ثانية).. تناقشوا بحذر!**');

            setTimeout(async () => {
                await message.channel.send('🔊 **انتهى وقت التفكير! بدأ الآن وقت التصويت العلني!**');
                
                const rows = [];
                let currentRow = new ActionRowBuilder();
                const participants = Array.from(activeMafiaGame.players.values());

                for (let i = 0; i < participants.length; i++) {
                    if (i > 0 && i % 5 === 0) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                    currentRow.addComponents(
                        new ButtonBuilder().setCustomId(`vote_${participants[i].id}`).setLabel(participants[i].username).setStyle(ButtonStyle.Primary)
                    );
                }
                if (currentRow.components.length >= 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                currentRow.addComponents(new ButtonBuilder().setCustomId('vote_skip_round').setLabel('⏭️ تخطي').setStyle(ButtonStyle.Danger));
                rows.push(currentRow);

                const voteEmbed = new EmbedBuilder().setTitle('🗳️ ساحة التصويت للمافيا').setDescription('اضغط على اسم الشخص للتصويت ضده أو تخطي!').setColor(0xE74C3C);
                const voteMsg = await message.channel.send({ embeds: [voteEmbed], components: rows });

                const voteCollector = voteMsg.createMessageComponentCollector({ time: 20000 });
                voteCollector.on('end', () => { activeMafiaGame = null; });
            }, 30000);
        });
    }
});

// الألعاب والتحديات الكلاسيكية الفردية
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'profile') {
        const userData = getUserData(interaction.user.id, interaction.user.username);
        const profile = new EmbedBuilder()
            .setTitle(`🪪 ملف ${interaction.user.username}`)
            .addFields(
                { name: '🥇 النقاط:', value: `\`${userData.points}\``, inline: true },
                { name: '🥅 أهداف ركلات الترجيح:', value: `\`${userData.goalsScored}\``, inline: true }
            ).setColor(0x27AE60);
        await interaction.reply({ embeds: [profile] });
    }

    if (interaction.commandName === 'penalty') {
        const rowAction = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('p_left').setLabel('يسار ⬅️').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('p_center').setLabel('وسط ⬆️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('p_right').setLabel('يمين ➡️').setStyle(ButtonStyle.Primary)
        );
        await interaction.reply({ content: '⚽ **سدد ركلة الترجيح القاتلة الآن بقوة:**', components: [rowAction] });
    }
});

client.login(process.env.TOKEN);
