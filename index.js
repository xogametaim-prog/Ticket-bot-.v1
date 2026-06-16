const { 
    Client, 
    GatewayIntentBits, 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder 
} = require('discord.js');

// استدعاء ملف تشغيل الخادم 24/7
const keepAlive = require('./server.js');
keepAlive();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// هيكل رومات السيرفر
const STRUCTURE = [
    {
        category: null,
        channels: [
            { name: "🔒・°•- اثبت • نفسك 🎴", type: "text" },
            { name: "🔒・°•- الحرق ⚠️", type: "text" }
        ]
    },
    {
        category: "🌍 | Start",
        channels: [
            { name: "🔒・°•-📜 › القوانين || Rules", type: "text" },
            { name: "🔒・°•-📢 › الاخبار || News", type: "text" },
            { name: "🔒・°•-🛫 › الترحيب || Welcome", type: "text" },
            { name: "🔒・°•-🌐 › فروعنا || Branches", type: "text" },
            { name: "🔒・°•-🐒 › تشهير", type: "text" },
            { name: "🔒・°•-🎖️ › اختر • رتبك", type: "text" },
            { name: "🔒・°•-🏆 › كأس • العالم", type: "text" }
        ]
    },
    {
        category: "💬 | General",
        channels: [
            { name: "💬・°•-💭 › الشات || Chat", type: "text" },
            { name: "💬・°•-💠 › رتب • التفاعل", type: "text" },
            { name: "💬・°•-🤖 › الاوامر || Commands", type: "text" },
            { name: "💬・°•-🏦 › البنك || Bank", type: "text" },
            { name: "💬・°•-🎮 › دردشة • مع • البوت", type: "text" }
        ]
    },
    {
        category: "🎁 | Event",
        channels: [
            { name: "🎁・°•-🔮 › Supporters || الداعمين", type: "text" },
            { name: "🎁・°•-🔮 › Supporters • مميزات", type: "text" },
            { name: "🎁・°•-🛸 › Deliveries || التسليمات", type: "text" },
            { name: "🎁・°•-🎁 › Gifts || الهدايا", type: "text" }
        ]
    },
    {
        category: "🔌 | YouTube",
        channels: [
            { name: "🔌・°•-🔌 › YouTube • اخبار • قناة", type: "text" },
            { name: "🔌・°•-📹 › YouTube • فيديوهات", type: "text" }
        ]
    },
    {
        category: "✉️ | Support",
        channels: [
            { name: "✉️・°•-✉️ › الدعم • الفني", type: "text" },
            { name: "✉️・°•-📋 › تقييم • الادارة", type: "text" }
        ]
    },
    {
        category: "🛠️ | تقديم • الادارة",
        channels: [
            { name: "❄️・°•-🛠️ › تقديم • الادارة", type: "text" },
            { name: "❄️・°•-🏛️ › تسليمات • الأدارة", type: "text" },
            { name: "❄️・°•-🛠️ › نتائج • الادارة", type: "text" }
        ]
    },
    {
        category: "💵 | Ads",
        channels: [
            { name: "💵・°•-💸 › اسعار • الاعلانات", type: "text" },
            { name: "💵・°•-💸 › تكت • الاعلانات", type: "text" },
            { name: "💵・°•-💸 › تقييم • الاعلانات", type: "text" }
        ]
    },
    {
        category: "⚖️ | BRQ - Meditators",
        channels: [
            { name: "⚖️・°•-📜 › قوانين • التوسط", type: "text" },
            { name: "⚖️・°•-🌀 › حدود • الوسطاء", type: "text" },
            { name: "⚖️・°•-🎫 › طلب • وسيط", type: "text" },
            { name: "⚖️・°•-📄 › تسجيلات • الوسطاء", type: "text" },
            { name: "⚖️・°•-☑️ › تقيم • الوسطاء", type: "text" },
            { name: "⚖️・°•-⚖️ › بانل • وسيط", type: "text" }
        ]
    },
    {
        category: "👑 | Owner",
        channels: [
            { name: "🔒・°•-👑 › تريدة • الاونر", type: "text" },
            { name: "🔒・°•-👑 › مسؤوليات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › قوانين • الاونر", type: "text" },
            { name: "🔒・°•-👑 › اخبار • الاونر", type: "text" },
            { name: "🔒・°•-👑 › رواتب • الاونر", type: "text" },
            { name: "🔒・°•-👑 › شات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › ترقيات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › العقوبات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › مهام • الاونر", type: "text" },
            { name: "🔒・°•-👑 › اجازات • الاونر", type: "text" },
            { name: "🔒・°•-👑 › استقالة • الاونر", type: "text" }
        ]
    },
    {
        category: "🛠️ | Staff",
        channels: [
            { name: "🔒・°•-🛠️ › الثريد", type: "text" },
            { name: "🔒・°•-🛠️ › قوانين • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › اخبار • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › النظام • الاداري", type: "text" },
            { name: "🔒・°•-🛠️ › مهام • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › شات • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › العقوبات • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › الترقيات • اداره", type: "text" },
            { name: "🔒・°•-🛠️ › الإجازات", type: "text" },
            { name: "🔒・°•-🛠️ › استقالة • الإدارة", type: "text" },
            { name: "🔒・°•-🛠️ › نظام • الترقيات", type: "text" },
            { name: "🔒・°•-🛠️ › هدايا • الادارة", type: "text" },
            { name: "🔒・°•-🛠️ › دلائل • تكتات", type: "text" }
        ]
    },
    {
        category: "🛠️ | Logo",
        channels: [
            { name: "🔒・°•-🛠️ › لوق • الباند", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الطرد", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرومات", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرتب", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • التايم", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الرسائل", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الاعضاء", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • العامة", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • اللفلات", type: "text" },
            { name: "👥-members-6141", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • الدعوات", type: "text" }
        ]
    },
    {
        category: "🎙️ | Vios",
        channels: [
            { name: "🔒・°•-🛠️ › التحكم • بالفويس", type: "text" },
            { name: "قرآن 🕌", type: "voice" },
            { name: "انشاء • فويس 🔊", type: "voice" }
        ]
    },
    {
        category: "🔊 | غرف صوتية",
        channels: [
            { name: "مسرح المواهب القرآنية 🎙️", type: "voice", userLimit: 99 }
        ]
    }
];

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح كـ: ${client.user.tag}`);
    
    // قائمة الأوامر التفاعلية (Slash Commands)
    const commands = [
        {
            name: 'ban',
            description: 'حظر عضو من السيرفر',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد حظره', required: true },
                { name: 'reason', type: 3, description: 'السبب', required: false }
            ]
        },
        {
            name: 'timeout',
            description: 'إعطاء تايم أوت (كتم مؤقت) لعضو في السيرفر',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد كتمه', required: true },
                { name: 'minutes', type: 4, description: 'المدة بالدقائق', required: true },
                { name: 'reason', type: 3, description: 'السبب', required: false }
            ]
        },
        {
            name: 'setup_server',
            description: 'إنشاء رومات وقنوات وتصنيفات السيرفر تلقائياً مع الصلاحيات والرتب الكاملة (+100 رتبة)'
        },
        {
            name: 'setup_ticket',
            description: 'إرسال لوحة التحكم بنظام التذاكر'
        },
        {
            name: 'delete_all_channels',
            description: 'حذف جميع الرومات والقنوات من السيرفر بالكامل (خاص بمالك السيرفر فقط)'
        },
        {
            name: 'delete_channel',
            description: 'حذف روم معين يدوياً (خاص بمالك السيرفر فقط)',
            options: [
                { name: 'channel', type: 7, description: 'الروم المراد حذفه', required: true }
            ]
        },
        {
            name: 'add',
            description: 'إضافة عضو معين إلى التذكرة الحالية',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد إضافته', required: true }
            ]
        },
        {
            name: 'remove',
            description: 'إزالة عضو معين من التذكرة الحالية',
            options: [
                { name: 'member', type: 6, description: 'العضو المراد إزالته', required: true }
            ]
        },
        {
            name: 'claim',
            description: 'استلام التذكرة الحالية وتخصيصها لك فقط كعضو إدارة'
        },
        {
            name: 'unclaim',
            description: 'إلغاء استلام التذكرة وإتاحتها مجدداً لكافة أعضاء الإدارة'
        },
        {
            name: 'rename',
            description: 'إعادة تسمية التذكرة الحالية',
            options: [
                { name: 'name', type: 3, description: 'الاسم الجديد للتذكرة', required: true }
            ]
        },
        {
            name: 'close',
            description: 'إغلاق وحذف التذكرة الحالية'
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('تمت مزامنة جميع أوامر السلاش كوماند بنجاح.');
    } catch (error) {
        console.error('فشلت عملية تسجيل الأوامر:', error);
    }
});

// معالجة كافة التفاعلات
client.on('interactionCreate', async (interaction) => {
    
    // 1. التفاعل مع الأزرار (Buttons)
    if (interaction.isButton()) {
        const { guild, member, customId, channel } = interaction;

        if (customId === 'create_ticket_btn') {
            await interaction.deferReply({ ephemeral: true });

            let category = guild.channels.cache.find(c => c.name === '🎫 | Tickets' && c.type === ChannelType.GuildCategory);
            if (!category) {
                try {
                    category = await guild.channels.create({
                        name: '🎫 | Tickets',
                        type: ChannelType.GuildCategory
                    });
                } catch (e) {
                    return interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء تصنيف التذاكر.', ephemeral: true });
                }
            }

            const staffRole = guild.roles.cache.find(r => r.name === 'Staff');

            try {
                // إعداد صلاحيات التذكرة بدقة تامة لضمان عدم حدوث تسريب في الرومات
                const overwrites = [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: member.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    },
                    {
                        id: guild.members.me.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                    }
                ];

                if (staffRole) {
                    overwrites.push({
                        id: staffRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
                    });
                }

                const ticketChannel = await guild.channels.create({
                    name: `🎫-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: overwrites
                });

                const embed = new EmbedBuilder()
                    .setTitle('نظام التذاكر الموحد')
                    .setDescription(`مرحباً بك ${member} في نظام الدعم الفني الخاص بنا.\nالرجاء كتابة مشكلتك أو طلبك هنا، وسيقوم فريق الدعم بالرد عليك في أقرب وقت ممكن.`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'لإغلاق التذكرة، اضغط على الزر بالأسفل.' });

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket_btn')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ embeds: [embed], components: [closeRow] });
                await interaction.followUp({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء روم التذكرة.', ephemeral: true });
            }
        }

        if (customId === 'close_ticket_btn') {
            await interaction.reply({ content: 'سيتم إغلاق وحذف التذكرة خلال 5 ثوانٍ...', ephemeral: false });
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (e) {
                    console.error('Failed to delete channel:', e);
                }
            }, 5000);
        }
    }

    // 2. التفاعل مع أوامر السلاش (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel } = interaction;

        // أوامر خاصة بالمالك فقط (Owner Only)
        if (commandName === 'delete_all_channels') {
            if (interaction.user.id !== guild.ownerId) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص لمالك السيرفر الأساسي فقط!', ephemeral: true });
            }
            await interaction.reply({ content: '⏳ جاري بدء مسح كافة القنوات والرومات في السيرفر...', ephemeral: true });
            try {
                const channels = await guild.channels.fetch();
                for (const ch of channels.values()) {
                    if (ch) await ch.delete().catch(() => {});
                }
            } catch (e) {
                console.error(e);
            }
        }

        if (commandName === 'delete_channel') {
            if (interaction.user.id !== guild.ownerId) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص لمالك السيرفر الأساسي فقط!', ephemeral: true });
            }
            const targetCh = options.getChannel('channel');
            try {
                await targetCh.delete();
                await interaction.reply({ content: `✅ تم حذف الروم بنجاح!`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل حذف الروم: ${e.message}`, ephemeral: true });
            }
        }

        // أوامر التذاكر المتقدمة المستوحاة من صور المنيو المرفقة
        if (commandName === 'add') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            const targetMember = options.getMember('member');
            try {
                await channel.permissionOverwrites.edit(targetMember.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await interaction.reply({ content: `✅ تم إضافة ${targetMember} إلى التذكرة الحالية بنجاح.` });
            } catch (e) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء الإضافة: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'remove') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            const targetMember = options.getMember('member');
            try {
                await channel.permissionOverwrites.delete(targetMember.id);
                await interaction.reply({ content: `✅ تم إزالة ${targetMember} من التذكرة بنجاح.` });
            } catch (e) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء الإزالة: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'claim') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
            try {
                if (staffRole) {
                    // حجب الرؤية عن رتبة Staff العامة لمنع التداخل
                    await channel.permissionOverwrites.edit(staffRole.id, { ViewChannel: false });
                }
                // منح العضو الذي استلم التذكرة صلاحية كاملة لرؤيتها بمفرده مع صاحب التذكرة والادمنز
                await channel.permissionOverwrites.edit(interaction.user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await interaction.reply({ content: `💼 تم استلام التذكرة الحالية بواسطة ${interaction.user}.` });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل استلام التذكرة: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'unclaim') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
            try {
                if (staffRole) {
                    await channel.permissionOverwrites.edit(staffRole.id, { ViewChannel: true });
                }
                await interaction.reply({ content: `🔓 تم إلغاء الاستلام، وأصبحت التذكرة متاحة مجدداً لكافة المشرفين.` });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل إلغاء الاستلام: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'rename') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            const newName = options.getString('name');
            try {
                await channel.setName(newName);
                await interaction.reply({ content: `✅ تم إعادة تسمية التذكرة بنجاح إلى: **${newName}**` });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل إعادة التسمية: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'close') {
            if (!channel.name.startsWith('🎫-') && !channel.name.startsWith('ticket-')) {
                return interaction.reply({ content: '❌ يمكنك استخدام هذا الأمر داخل رومات التذاكر فقط!', ephemeral: true });
            }
            await interaction.reply({ content: 'سيتم إغلاق وحذف التذكرة خلال 5 ثوانٍ...', ephemeral: false });
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (e) {
                    console.error('Failed to delete channel:', e);
                }
            }, 5000);
        }

        // الأوامر العامة والإشرافية
        if (commandName === 'ban') {
            if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
                return interaction.reply({ content: '❌ لا تملك صلاحية حظر الأعضاء.', ephemeral: true });
            }
            const target = options.getMember('member');
            const reason = options.getString('reason') || 'لا يوجد سبب';

            if (!target) return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو.', ephemeral: true });

            try {
                await target.ban({ reason });
                await interaction.reply({ content: `✅ تم حظر ${target} بنجاح. السبب: ${reason}` });
            } catch (e) {
                await interaction.reply({ content: `❌ لم أتمكن من حظر العضو: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'timeout') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({ content: '❌ لا تملك صلاحية التحكم في كتم الأعضاء.', ephemeral: true });
            }
            const target = options.getMember('member');
            const minutes = options.getInteger('minutes');
            const reason = options.getString('reason') || 'لا يوجد سبب';

            if (!target) return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو.', ephemeral: true });

            try {
                const duration = minutes * 60 * 1000;
                await target.timeout(duration, reason);
                await interaction.reply({ content: `✅ تم إعطاء تايم أوت لـ ${target} لمدة ${minutes} دقيقة. السبب: ${reason}` });
            } catch (e) {
                await interaction.reply({ content: `❌ لم أتمكن من إعطاء تايم أوت للعضو: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'setup_server') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }
            await interaction.reply({ content: '⏳ جاري تهيئة السيرفر بالكامل وتنسيق الرومات وإنشاء الرتب (أكثر من 100 رتبة)، يرجى الانتظار...', ephemeral: true });

            try {
                // 1. إنشاء رتب الإدارة الأساسية
                const ownerRole = await guild.roles.create({ name: 'Owner', color: 0xFFD700, reason: 'Setup Roles' });
                const highAdminRole = await guild.roles.create({ name: 'High Admin', color: 0xE50000, reason: 'Setup Roles' });
                const adminRole = await guild.roles.create({ name: 'Admin', color: 0xFF5555, reason: 'Setup Roles' });
                const staffRole = await guild.roles.create({ name: 'Staff', color: 0x55FF55, reason: 'Setup Roles' });
                const meditatorRole = await guild.roles.create({ name: 'Meditator', color: 0x00AAAA, reason: 'Setup Roles' });

                // 2. إنشاء رتب VIP القابلة للشراء (45 رتبة)
                for (let i = 1; i <= 45; i++) {
                    await guild.roles.create({ name: `VIP ${i}`, color: 0x99AAB5 });
                    await sleep(150);
                }

                // 3. إنشاء رتب الأعضاء (50 رتبة)
                for (let i = 1; i <= 50; i++) {
                    // how
                    // 
                    // for items
                    await guild.roles.create({ name: `Member Level ${i}`, color: 0x2ECC71 });
                    await sleep(150);
                }

                // 4. البدء في إنشاء الرومات مع تطبيق الصلاحيات بدقة تامة لمنع أي تسريب
                for (const group of STRUCTURE) {
                    let category = null;
                    let overwrites = [];

                    // توزيع الصلاحيات الصارمة على التصنيفات الحساسة
                    if (group.category === "👑 | Owner") {
                        overwrites = [
                            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ];
                    } else if (group.category === "🛠️ | Staff" || group.category === "🛠️ | Logo") {
                        overwrites = [
                            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: highAdminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ];
                    } else if (group.category === "⚖️ | BRQ - Meditators") {
                        overwrites = [
                            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                            { id: meditatorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                            { id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
                        ];
                    }

                    if (group.category) {
                        category = await guild.channels.create({
                            name: group.category,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites: overwrites
                        });
                        await sleep(500);
                    }

                    for (const ch of group.channels) {
                        await guild.channels.create({
                            name: ch.name,
                            type: ch.type === 'voice' ? ChannelType.GuildVoice : ChannelType.GuildText,
                            parent: category ? category.id : null,
                            userLimit: ch.userLimit || undefined,
                            permissionOverwrites: category ? category.permissionOverwrites.cache.map(o => o) : []
                        });
                        await sleep(500);
                    }
                }

                await interaction.followUp({ content: '✅ تم الانتهاء من إعداد الرومات وتوزيع الصلاحيات وإنشاء أكثر من 100 رتبة بنجاح!', ephemeral: true });

            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: `❌ حدث خطأ أثناء إعداد الرومات: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'setup_ticket') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('تذكرة الدعم الفني | Tickets Panel 🎫')
                .setDescription('إذا كنت تواجه مشكلة، أو ترغب بتقديم شكوى أو استفسار، يرجى فتح تذكرة عبر الضغط على الزر أدناه وسيقوم فريق العمل بتقديم المساعدة.')
                .setColor(0x0099FF)
                .setFooter({ text: 'نظام تذاكر سيرفر BRQ Community' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket_btn')
                    .setLabel('إنشاء تذكرة 🎫')
                    .setStyle(ButtonStyle.Success)
            );

            try {
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ تم إرسال لوحة التحكم بالتذاكر بنجاح!', ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء إرسال اللوحة: ${e.message}`, ephemeral: true });
            }
        }
    }
});

const TOKEN = process.env.DISCORD_TOKEN || 'ضع_توكن_البوت_الخاص_بِك_هنا';
client.login(TOKEN);