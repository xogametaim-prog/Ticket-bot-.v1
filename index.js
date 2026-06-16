const { 
    Client, 
    GatewayIntentBits, 
    ChannelType, 
    PermissionFlagsBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');

// استدعاء ملف خادم الويب للتشغيل 24/7 على Render
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

// --- تهيئة قاعدة البيانات (سحابية MongoDB أو محلية JSON كخيار احتياطي) ---
const MONGO_URI = process.env.MONGO_URI; 
let useMongoDB = false;
let localDatabase = {};

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('✅ تم الاتصال بنجاح بقاعدة بيانات MongoDB السحابية.');
            useMongoDB = true;
        })
        .catch((err) => console.error('❌ فشل الاتصال بقاعدة بيانات MongoDB، سيتم استخدام الملف المحلي الاحتياطي:', err));
} else {
    console.warn('⚠️ تنبيه: لم يتم ضبط متغير البيئة MONGO_URI. سيتم حفظ مستويات الأعضاء محلياً في ملف database.json (ملاحظة: سيُمسح هذا الملف عند إعادة تشغيل البوت على Render).');
    if (fs.existsSync('./database.json')) {
        try {
            localDatabase = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        } catch (e) {
            localDatabase = {};
        }
    }
}

// هيكل قاعدة بيانات الأعضاء لـ MongoDB
const userSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 }
});
const UserLevelModel = mongoose.model('UserLevel', userSchema);

// جلب بيانات العضو
async function getUserData(guildId, userId) {
    if (useMongoDB) {
        let data = await UserLevelModel.findOne({ guildId, userId });
        if (!data) {
            data = new UserLevelModel({ guildId, userId, level: 1, xp: 0, messageCount: 0 });
            await data.save();
        }
        return data;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId][userId]) {
            localDatabase[guildId][userId] = { level: 1, xp: 0, messageCount: 0 };
        }
        return localDatabase[guildId][userId];
    }
}

// حفظ بيانات العضو
async function saveUserData(guildId, userId, data) {
    if (useMongoDB) {
        await UserLevelModel.updateOne({ guildId, userId }, {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount
        });
    } else {
        localDatabase[guildId][userId] = {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount
        };
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

// التحقق مما إذا كان المستخدم من طاقم الإدارة (Staff فما فوق)
function isStaffOrAdmin(member) {
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const managementRoles = ["Staff", "Admin", "High Admin", "Owner", "Co-Owner", "Founder", "Staff Supervisor", "Supervisor"];
    return member.roles.cache.some(r => managementRoles.includes(r.name));
}

// إرسال سجل التذاكر تلقائياً
async function sendTicketLog(guild, embed) {
    const logChannel = guild.channels.cache.find(c => 
        c.name.includes('لوق • التذاكر') || 
        c.name.includes('لوق-التذاكر') || 
        c.name.includes('لوق • العامة')
    );
    if (logChannel) {
        await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
}

// --- هيكل الرومات والتصنيفات ---
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
            { name: "🔒・°•-🛠️ › لوق • الدعوات", type: "text" },
            { name: "🔒・°•-🛠️ › لوق • التذاكر", type: "text" }
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

// --- رتب السيرفر الـ 100 ---
const MANAGEMENT_ROLES = [
    "Owner", "Co-Owner", "Founder", "High Admin", "Senior Admin", "Admin", "Junior Admin",
    "Head Moderator", "Senior Moderator", "Moderator", "Junior Moderator", "Head Helper",
    "Senior Helper", "Helper", "Support Team", "Security Team", "Developer", "Lead Developer",
    "Web Developer", "Bot Developer", "Event Manager", "Event Coordinator", "Community Manager",
    "Public Relations (PR)", "Social Media Manager", "Graphic Designer", "Content Creator",
    "Partner Manager", "Translator", "Head Staff", "Supervisor", "Director", "Assistant Director",
    "HR Manager", "Recruiter", "Trainer", "Tester", "Server Booster Manager", "Media Head",
    "Advertiser", "Security Lead", "Ticket Manager", "Ticket Support", "Middleman Manager",
    "Head Middleman", "Senior Middleman", "Middleman (الوسيط)", "Trial Middleman",
    "Staff Supervisor", "Executive Assistant"
];

const MEMBER_ROLES = [
    "VIP Elite", "VIP Legendary", "VIP Mythic", "VIP Champion", "VIP Master", "VIP Diamond",
    "VIP Ruby", "VIP Emerald", "VIP Sapphire", "VIP Gold", "VIP Silver", "VIP Bronze",
    "Ultimate Member", "Elite Member", "Legend Member", "Active Member", "Veteran Member",
    "Loyalty Member", "Regular Member", "Booster (VIP)", "Nitro Booster VIP", "Level 1 Member",
    "Level 2 Member", "Level 3 Member", "Level 4 Member", "Level 5 Member", "Level 6 Member",
    "Level 7 Member", "Level 8 Member", "Level 9 Member", "Level 10 Member", "Level 11 Member",
    "Level 12 Member", "Level 13 Member", "Level 14 Member", "Level 15 Member", "Level 16 Member",
    "Level 17 Member", "Level 18 Member", "Level 19 Member", "Level 20 Member", "Level 21 Member",
    "Level 22 Member", "Level 23 Member", "Level 24 Member", "Level 25 Member", "Level 26 Member",
    "Level 27 Member", "Level 28 Member", "Level 29 Member"
];

client.once('ready', async () => {
    console.log(`تم تسجيل الدخول بنجاح كـ: ${client.user.tag}`);
    
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
            description: 'إنشاء رومات وقنوات السيرفر وتطبيق الصلاحيات وإنشاء 100 رتبة متنوعة'
        },
        {
            name: 'setup_ticket',
            description: 'إرسال لوحة التحكم بنظام التذاكر'
        },
        {
            name: 'delete_all_channels',
            description: 'حذف جميع رومات وقنوات السيرفر بالكامل (للإداريين فقط)'
        },
        {
            name: 'delete_channel',
            description: 'حذف روم معين يدوياً (للإداريين فقط)',
            options: [
                { name: 'channel', type: 7, description: 'الروم المراد حذفه', required: true }
            ]
        },
        {
            name: 'delete_all_roles',
            description: 'حذف جميع الرتب الموجودة في السيرفر باستثناء رتبة البوت (للإداريين فقط)'
        },
        {
            name: 'publish_rules',
            description: 'نشر قوانين وإرشادات السيرفر في الروم المخصص (للإداريين فقط)'
        },
        {
            name: 'rank',
            description: 'عرض بطاقة المستوى وعدد رسائل العضو الحالية بشكل مصور',
            options: [
                { name: 'user', type: 6, description: 'العضو المراد عرض مستواه (اختياري)', required: false }
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
        console.log('تمت مزامنة جميع أوامر السلاش بنجاح.');
    } catch (error) {
        console.error('فشلت عملية تسجيل الأوامر:', error);
    }
});

// نظام احتساب الخبرة ومعدل الرسائل التلقائي للأعضاء
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    try {
        const userData = await getUserData(guildId, userId);
        userData.messageCount += 1;
        
        // إضافة نقاط خبرة عشوائية بين 10 و 20 مع كل رسالة
        const xpToAdd = Math.floor(Math.random() * 11) + 10;
        userData.xp += xpToAdd;

        const xpNeeded = userData.level * 150; // معادلة الخبرة المطلوبة للمستوى التالي
        if (userData.xp >= xpNeeded) {
            userData.xp -= xpNeeded;
            userData.level += 1;
            
            // إرسال رسالة تهنئة اختيارية داخل الشات عند زيادة المستوى
            await message.channel.send(`🎉 تهانينا ${message.author}! لقد ارتفع مستواك التفاعلي في السيرفر إلى المستوى **${userData.level}**!`).catch(() => {});
        }

        await saveUserData(guildId, userId, userData);
    } catch (e) {
        console.error('Error in leveling system:', e);
    }
});

client.on('interactionCreate', async (interaction) => {
    
    // 1. التفاعل مع أزرار التذاكر
    if (interaction.isButton()) {
        const { guild, member, customId, channel } = interaction;

        const topic = channel.topic || '';
        const match = topic.match(/creator-id:\s*(\d+)/);
        const creatorId = match ? match[1] : null;

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
                    topic: `creator-id: ${member.id}`,
                    permissionOverwrites: overwrites
                });

                const embed = new EmbedBuilder()
                    .setTitle('نظام التذاكر الموحد')
                    .setDescription(`مرحباً بك ${member} في نظام الدعم الفني الخاص بنا.\nالرجاء كتابة مشكلتك أو طلبك هنا، وسيقوم فريق الدعم بالرد عليك في أقرب وقت ممكن.`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'التحكم بالتذكرة مخصص فقط لأعضاء الإدارة وطاقم العمل.' });

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('claim_ticket_btn')
                        .setLabel('استلام التذكرة 💼')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('close_ticket_btn')
                        .setLabel('إغلاق التذكرة 🔒')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('call_member_btn')
                        .setLabel('نداء العضو 🔔')
                        .setStyle(ButtonStyle.Secondary)
                );

                await ticketChannel.send({ embeds: [embed], components: [actionRow] });
                await interaction.followUp({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

                const logEmbed = new EmbedBuilder()
                    .setTitle('🟢 تذكرة جديدة مفتوحة')
                    .setDescription(`تم إنشاء تذكرة دعم فني جديدة في السيرفر.`)
                    .addFields(
                        { name: 'صاحب التذكرة:', value: `${member} (${member.id})`, inline: true },
                        { name: 'روم التذكرة:', value: `${ticketChannel}`, inline: true }
                    )
                    .setColor(0x2ECC71)
                    .setTimestamp();

                await sendTicketLog(guild, logEmbed);

            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: '❌ حدث خطأ أثناء إنشاء روم التذكرة.', ephemeral: true });
            }
        }

        if (customId === 'claim_ticket_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ هذا الزر مخصص فقط لطاقم العمل والإدارة.', ephemeral: true });
            }

            const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
            try {
                if (staffRole) {
                    await channel.permissionOverwrites.edit(staffRole.id, { ViewChannel: false });
                }
                await channel.permissionOverwrites.edit(member.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.reply({ content: `💼 تم استلام ومتابعة التذكرة الحالية بواسطة المشرف: ${member}.` });

                const logEmbed = new EmbedBuilder()
                    .setTitle('🔵 تم استلام تذكرة')
                    .setDescription(`قام أحد المشرفين باستلام تذكرة لمتابعتها.`)
                    .addFields(
                        { name: 'المستلم:', value: `${member}`, inline: true },
                        { name: 'روم التذكرة:', value: `${channel}`, inline: true }
                    )
                    .setColor(0x3498DB)
                    .setTimestamp();

                await sendTicketLog(guild, logEmbed);

            } catch (e) {
                console.error(e);
                await interaction.reply({ content: `❌ فشل استلام التذكرة: ${e.message}`, ephemeral: true });
            }
        }

        if (customId === 'close_ticket_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة. صلاحية الإغلاق متاحة فقط لطاقم العمل من رتبة Staff وما فوق.', ephemeral: true });
            }

            await interaction.reply({ content: 'سيتم إغلاق وحذف التذكرة خلال 5 ثوانٍ...', ephemeral: false });

            const logEmbed = new EmbedBuilder()
                .setTitle('🔴 تم إغلاق تذكرة')
                .setDescription(`تم إغلاق وحذف التذكرة بنجاح بشكل تلقائي.`)
                .addFields(
                    { name: 'المسؤول المغلق:', value: `${member}`, inline: true },
                    { name: 'اسم روم التذكرة:', value: `\`${channel.name}\``, inline: true }
                )
                .setColor(0xE74C3C)
                .setTimestamp();

            await sendTicketLog(guild, logEmbed);

            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (e) {
                    console.error('Failed to delete channel:', e);
                }
            }, 5000);
        }

        if (customId === 'call_member_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ هذا الزر مخصص فقط لطاقم العمل والإدارة.', ephemeral: true });
            }

            if (!creatorId) {
                return interaction.reply({ content: '❌ لم أتمكن من العثور على صاحب التذكرة لإرسال نداء له.', ephemeral: true });
            }

            await interaction.reply({ content: `🔔 نداء: يرجى التواجد في التذكرة للتحدث مع الإدارة <@${creatorId}>!` });
        }
    }

    // 2. التعامل مع النوافذ المنبثقة (Modals)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'publish_rules_modal') {
            const title = interaction.fields.getTextInputValue('rules_title');
            const content = interaction.fields.getTextInputValue('rules_content');
            const guild = interaction.guild;

            const rulesChannel = guild.channels.cache.find(c => 
                c.name.includes('القوانين') || 
                c.name.includes('rules')
            );

            if (!rulesChannel) {
                return interaction.reply({ content: '❌ لم أتمكن من العثور على روم القوانين في السيرفر حالياً.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(content)
                .setColor(0x0099FF)
                .setThumbnail(guild.iconURL({ dynamic: true }) || null)
                .setFooter({ text: `تم النشر بواسطة: ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                .setTimestamp();

            try {
                await rulesChannel.send({ embeds: [embed] });
                await interaction.reply({ content: `✅ تم نشر القوانين والتعليمات بنجاح داخل الروم: ${rulesChannel}`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء إرسال القوانين: ${e.message}`, ephemeral: true });
            }
        }
    }

    // 3. التعامل مع أوامر السلاش (Slash Commands)
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel } = interaction;

        const isAdministrator = member.permissions.has(PermissionFlagsBits.Administrator);

        // أمر استخراج بطاقة العضو التفاعلية والمصورة (/rank)
        if (commandName === 'rank') {
            await interaction.deferReply();
            
            const targetUser = options.getUser('user') || interaction.user;
            const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
            
            if (!targetMember) {
                return interaction.followUp({ content: '❌ لم يتم العثور على هذا العضو في السيرفر حالياً.' });
            }

            try {
                const userData = await getUserData(guild.id, targetUser.id);
                const nextLevelXP = userData.level * 150;

                // إنشاء لوحة الرسم بأبعاد مخصصة ومصقولة
                const canvas = createCanvas(800, 250);
                const ctx = canvas.getContext('2d');

                // خلفية بطاقة الرتبة (تدرج لوني داكن)
                const gradient = ctx.createLinearGradient(0, 0, 800, 250);
                gradient.addColorStop(0, '#111726');
                gradient.addColorStop(1, '#1e293b');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 800, 250);

                // تأثير الهالة المضيئة حول الصورة الشخصية
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 15;

                // رسم الصورة الشخصية (Avatar) بشكل دائري
                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
                const avatarImage = await loadImage(avatarUrl).catch(() => null);

                ctx.save();
                ctx.beginPath();
                ctx.arc(110, 125, 65, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                
                if (avatarImage) {
                    ctx.drawImage(avatarImage, 45, 60, 130, 130);
                } else {
                    ctx.fillStyle = '#475569';
                    ctx.fill();
                }
                ctx.restore();

                // إزالة تأثير الظل للخطوط
                ctx.shadowBlur = 0;

                // كتابة اسم المستخدم
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 32px sans-serif';
                ctx.fillText(targetUser.username, 210, 75);

                // كتابة تفاصيل المستوى وعدد الرسائل
                ctx.fillStyle = '#38bdf8';
                ctx.font = '22px sans-serif';
                ctx.fillText(`المستوى: ${userData.level}`, 210, 120);

                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`الخبرة الحالية: ${userData.xp} / ${nextLevelXP} XP`, 210, 155);
                ctx.fillText(`إجمالي الرسائل: ${userData.messageCount} رسالة`, 210, 190);

                // رسم شريط التقدم (XP Progress Bar)
                const barWidth = 530;
                const barHeight = 16;
                const barX = 210;
                const barY = 210;

                // شريط الخلفية الرمادي
                ctx.fillStyle = '#334155';
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, 8);
                ctx.fill();

                // شريط التقدم الفعلي (أزرق متدرج مائي)
                const progressPercent = Math.min(userData.xp / nextLevelXP, 1);
                if (progressPercent > 0) {
                    const progressGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                    progressGradient.addColorStop(0, '#0284c7');
                    progressGradient.addColorStop(1, '#06b6d4');
                    ctx.fillStyle = progressGradient;
                    ctx.beginPath();
                    ctx.roundRect(barX, barY, barWidth * progressPercent, barHeight, 8);
                    ctx.fill();
                }

                const buffer = canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });

                await interaction.followUp({ files: [attachment] });

            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: '❌ حدث خطأ غير متوقع أثناء معالجة ورسم بطاقة الرتبة.' });
            }
        }

        // أمر فتح النافذة المنبثقة لنشر القوانين
        if (commandName === 'publish_rules') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص لمن يمتلكون صلاحية الإدارة (Administrator) فقط!', ephemeral: true });
            }

            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

            const modal = new ModalBuilder()
                .setCustomId('publish_rules_modal')
                .setTitle('نشر قوانين السيرفر 📜');

            const titleInput = new TextInputBuilder()
                .setCustomId('rules_title')
                .setLabel('عنوان رسالة القوانين')
                .setStyle(TextInputStyle.Short)
                .setValue('قوانين وإرشادات سيرفر BRQ Community ⚖️')
                .setRequired(true);

            const rulesInput = new TextInputBuilder()
                .setCustomId('rules_content')
                .setLabel('اكتب القوانين هنا بالتفصيل')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('1. الاحترام المتبادل بين الأعضاء.\n2. يمنع نشر الروابط الإعلانية دون إذن الإدارة.')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
            const secondActionRow = new ActionRowBuilder().addComponents(rulesInput);
            modal.addComponents(firstActionRow, secondActionRow);

            await interaction.showModal(modal);
        }

        // أوامر التحكم الإدارية (حذف القنوات والرتب)
        if (commandName === 'delete_all_channels') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص لمن يمتلكون صلاحية الإدارة (Administrator) فقط!', ephemeral: true });
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
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص لمن يمتلكون صلاحية الإدارة (Administrator) فقط!', ephemeral: true });
            }
            const targetCh = options.getChannel('channel');
            try {
                await targetCh.delete();
                await interaction.reply({ content: `