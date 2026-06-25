const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits, 
    ChannelType,
    REST,
    Routes,
    MessageFlags
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Ticket Bot is Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TICKET_PREFIX = '-st'; 
const EMBED_PREFIX = '-em';  

const embedSetup = new Map();

// ==================== إعدادات نظام التذاكر المطور والمستقر ====================
const TICKET_CONFIG = {
    categoryID: 'ايدي_قسم_التذاكر_هنا', // ضع هنا أيدي قسم التذاكر

    // روابط الصور
    mainEmbedImage: 'https://i.imgur.com/ضع_رابط_صورة_البوكس_الرئيسي_هنا.png', 
    ticketEmbedImage: 'https://i.imgur.com/ضع_رابط_صورة_التذكرة_الداخلية_هنا.png',

    // الخيارات الخمسة المستقلة مع رتبها
    options: [
        {
            value: 'option_1',
            label: 'الدعم الفني والتقني',
            description: 'للمشاكل البرمجية والتقنية داخل السيرفر',
            emoji: '🛠️',
            roleId: 'ايدي_رتبة_القسم_1_هنا', 
        },
        {
            value: 'option_2',
            label: 'الاستفسارات العامة',
            description: 'لأي سؤال عام تود طرحه على الإدارة',
            emoji: '❓',
            roleId: 'ايدي_رتبة_القسم_2_هنا', 
        },
        {
            value: 'option_3',
            label: 'الشكاوى والبلاغات',
            description: 'لتقديم شكوى ضد عضو أو الإبلاغ عن مشكلة',
            emoji: '⚠️',
            roleId: 'ايدي_رتبة_القسم_3_هنا', 
        },
        {
            value: 'option_4',
            label: 'المبيعات والاشتراكات',
            description: 'للاستفسار عن الأسعار أو الشراء المباشر',
            emoji: '💰',
            roleId: 'ايدي_رتبة_القسم_4_هنا', 
        },
        {
            value: 'option_5',
            label: 'الإدارة العليا',
            description: 'للتواصل المباشر والحالات الخاصة جداً',
            emoji: '👑',
            roleId: 'ايدي_رتبة_القسم_5_هنا', 
        }
    ]
};
// ====================================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        {
            name: 'setup-ticket',
            description: 'إنشاء رسالة نظام التذاكر بالقائمة المنسدلة'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error(error);
    }
});

// دالة إرسال البوكس الموحد
async function sendTicketSetup(channel) {
    const embed = new EmbedBuilder()
        .setTitle('الدعم الفني والخدمات | Support Portal')
        .setDescription('يرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص.')
        .setColor('#2b2d31');

    if (TICKET_CONFIG.mainEmbedImage && TICKET_CONFIG.mainEmbedImage.startsWith('http')) {
        embed.setImage(TICKET_CONFIG.mainEmbedImage);
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_menu_select')
        .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...')
        .addOptions(
            TICKET_CONFIG.options.map(opt => 
                new StringSelectMenuOptionBuilder()
                    .setValue(opt.value)
                    .setLabel(opt.label)
                    .setDescription(opt.description)
                    .setEmoji(opt.emoji)
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);
    await channel.send({ embeds: [embed], components: [row] });
}

// دالة بدء الإعداد التفاعلي للإمبد المخصص مع الأزرار
async function startEmbedSetup(channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        return channel.send('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
    }

    const embedState = { step: 1, title: null, description: null, buttonLabel: null };
    embedSetup.set(user.id, embedState);

    await channel.send(`${user}, 📝 **بدء إعداد إمبد مخصص**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان (Title)** الإمبد:`);
}

// التعامل مع الاختصارات والأوامر في الشات
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // الاختصار -st لبوكس التذاكر
    if (message.content.trim() === TICKET_PREFIX) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإداريين فقط.');
        }
        try {
            await sendTicketSetup(message.channel);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // الاختصار -em للإمبد المخصص
    if (message.content.trim() === EMBED_PREFIX) {
        try {
            await startEmbedSetup(message.channel, message.author);
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    // تتبع خطوات إعداد الإمبد المخصص -em
    if (embedSetup.has(message.author.id)) {
        const state = embedSetup.get(message.author.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            return message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **وصف (Description)** الإمبد:`);
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            return message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** يرجى كتابة **النص المكتوب على الزر** (مثال: فتح تذكرة، اضغط هنا...):`);
        }

        if (state.step === 3) {
            state.buttonLabel = message.content.trim();

            const customEmbed = new EmbedBuilder()
                .setTitle(state.title)
                .setDescription(state.description)
                .setColor('#5865F2');

            const customButton = new ButtonBuilder()
                .setCustomId('general_embed_button_action')
                .setLabel(state.buttonLabel)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫');

            const row = new ActionRowBuilder().addComponents(customButton);

            await message.channel.send({ embeds: [customEmbed], components: [row] });
            await message.reply('🎉 **تم إنشاء الإمبد المخصص مع الأزرار بنجاح!**');

            embedSetup.delete(message.author.id);
            return;
        }
    }

    // أمر استدعاء العضو داخل التكت المفتوح !ping
    if (message.content.trim().toLowerCase() === '!ping') {
        const topic = message.channel.topic || '';
        if (topic.includes('creator_id:')) {
            const creatorPart = topic.split('creator_id:')[1];
            const creatorId = creatorPart ? creatorPart.split(';')[0] : null;
            const member = message.guild.members.cache.get(creatorId);
            if (member) {
                return message.channel.send(`🔔 تنبيه للعضو: ${member}، يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.`);
            }
        }
    }
});

// التعامل مع السلاش والتفاعلات بشكل مستقر وسريع جداً
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup-ticket') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: 'عذراً، هذا الأمر مخصص للإداريين فقط.', flags: MessageFlags.Ephemeral });
            }
            await interaction.reply({ content: 'تم إرسال نظام التذاكر بنجاح!', flags: MessageFlags.Ephemeral });
            await sendTicketSetup(interaction.channel);
        }
    }

    // فتح تذكرة عند اختيار خيار من القائمة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'ticket_menu_select') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const selectedValue = interaction.values[0];
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === selectedValue);

            if (!selectedOption) {
                return interaction.editReply({ content: 'عذراً، حدث خطأ في معالجة طلبك.' });
            }

            const guild = interaction.guild;
            const member = interaction.member;

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (selectedOption.roleId) {
                permissionOverwrites.push({
                    id: selectedOption.roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            try {
                const channel = await guild.channels.create({
                    name: `ticket-${selectedOption.value}-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: TICKET_CONFIG.categoryID || null,
                    permissionOverwrites: permissionOverwrites
                });

                await channel.setTopic(`creator_id:${member.id}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(`تذكرة جديدة - ${selectedOption.label}`)
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك في قسم **${selectedOption.label}**.\n\nيرجى كتابة استفسارك هنا وانتظار استلام أحد أفراد الطاقم للمتابعة معك.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (TICKET_CONFIG.ticketEmbedImage && TICKET_CONFIG.ticketEmbedImage.startsWith('http')) {
                    welcomeEmbed.setImage(TICKET_CONFIG.ticketEmbedImage);
                }

                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_ticket_${selectedOption.value}`)
                    .setLabel('استلام التذكرة')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_ticket_${selectedOption.value}`)
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

                const supportRoleMention = selectedOption.roleId ? `<@&${selectedOption.roleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row] 
                });

                await interaction.editReply({ content: `تم إنشاء تذكرتك بنجاح في القناة: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: 'حدث خطأ أثناء محاولة إنشاء التذكرة.' });
            }
        }
    }

    // تفاعل الأزرار
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // زر استلام التذكرة
        if (customId.startsWith('claim_ticket_')) {
            const optionValue = customId.replace('claim_ticket_', '');
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === optionValue);

            if (!selectedOption) return;

            const member = interaction.member;
            const hasRequiredRole = member.roles.cache.has(selectedOption.roleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            const closeButton = new ButtonBuilder()
                .setCustomId(`close_ticket_${optionValue}`)
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // زر إغلاق التذكرة المخصصة
        if (customId.startsWith('close_ticket_')) {
            const optionValue = customId.replace('close_ticket_', '');
            const selectedOption = TICKET_CONFIG.options.find(opt => opt.value === optionValue);

            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = selectedOption && member.roles.cache.has(selectedOption.roleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Error deleting channel:', err);
                }
            }, 5000);
        }

        // زر الإمبد المخصص العام
        if (customId === 'general_embed_button_action') {
            await interaction.reply({ content: 'سيتم فتح تذكرة عامة لك الآن...', flags: MessageFlags.Ephemeral });
            const guild = interaction.guild;
            const member = interaction.member;

            try {
                const channel = await guild.channels.create({
                    name: `ticket-general-${member.user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                    ]
                });

                await channel.setTopic(`creator_id:${member.id}`);

                const embed = new EmbedBuilder()
                    .setTitle('تذكرة عامة مفتوحة')
                    .setDescription(`مرحباً بك ${member}، يرجى كتابة استفسارك هنا وسيجيبك الإشراف بأقرب وقت.`)
                    .setColor('#5865F2');

                const closeButton = new ButtonBuilder()
                    .setCustomId('close_custom_ticket_general')
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(closeButton);
                await channel.send({ content: `${member}`, embeds: [embed], components: [row] });
            } catch (err) {
                console.error(err);
            }
        }

        if (customId === 'close_custom_ticket_general') {
            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error(err);
                }
            }, 5000);
        }
    }
});

client.login(TOKEN);