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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
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
    console.warn('⚠️ تنبيه: لم يتم ضبط متغير البيئة MONGO_URI. سيتم حفظ مستويات الأعضاء محلياً في ملف database.json.');
    if (fs.existsSync('./database.json')) {
        try {
            localDatabase = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
        } catch (e) {
            localDatabase = {};
        }
    }
}

// هيكل قاعدة بيانات الأعضاء والاقتصاد لـ MongoDB
const userSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null }
});
const UserLevelModel = mongoose.model('UserLevel', userSchema);

// هيكل إعدادات السيرفر المتطور لـ MongoDB
const configSchema = new mongoose.Schema({
    guildId: String,
    levelChannelId: String,
    islamicChannelId: String,
    roleRewards: [{ roleId: String, messagesNeeded: Number }]
});
const GuildConfigModel = mongoose.model('GuildConfig', configSchema);

// مصفوفة الرامات الصوتية المؤقتة لتتبعها وحذفها عند خروج الجميع
const tempVoiceChannels = new Map();

// مصفوفة المشاركين في مسابقات الـ Giveaways الحالية
const activeGiveaways = new Map();

// مكتبة الأذكار والآيات القرآنية لنظام النشر التلقائي
const ISLAMIC_REMINDERS = [
    "📖 قَالَ اللَّهُ تَعَالَى: {وَمَنْ يَتَّقِ اللَّهَ يَجْعَلْ لَهُ مَخْرَجًا * وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ}",
    "🕌 قَالَ رَسُولُ اللَّهِ ﷺ: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ'",
    "📖 قَالَ اللَّهُ تَعَالَى: {أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ}",
    "🕌 سُبْحَانَ اللَّهِ وَبِحَمْدِهِ ، سُبْحَانَ اللَّهِ الْعَظِيمِ",
    "🕌 لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ العَلِيِّ العَظِيمِ (كنز من كنوز الجنة)",
    "📖 قَالَ اللَّهُ تَعَالَى: {إِنَّ اللَّهَ وَمَلَائِكَتَهُ يُصَلُّونَ عَلَى النَّبِيِّ ۚ يَا أَيُّهَا الَّذِينَ آمَنُوا صَلُّوا عَلَيْهِ وَسَلِّمُوا تَسْلِيمًا}",
    "🕌 قَالَ رَسُولُ اللَّهِ ﷺ: 'كَلِمَتَانِ خَفِيفَتَانِ عَلَى اللِّسَانِ، ثَقِيلَتَانِ فِي الْمِيزَانِ، حَبِيبَتَانِ إِلَى الرَّحْمَنِ: سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ'",
    "🕌 اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنَّا",
    "📖 قَالَ اللَّهُ تَعَالَى: {رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ}",
    "🕌 لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ"
];

// جلب بيانات العضو
async function getUserData(guildId, userId) {
    if (useMongoDB) {
        let data = await UserLevelModel.findOne({ guildId, userId });
        if (!data) {
            data = new UserLevelModel({ guildId, userId, level: 1, xp: 0, messageCount: 0, coins: 0, lastDaily: null });
            await data.save();
        }
        return data;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].users) localDatabase[guildId].users = {};
        if (!localDatabase[guildId].users[userId]) {
            localDatabase[guildId].users[userId] = { level: 1, xp: 0, messageCount: 0, coins: 0, lastDaily: null };
        }
        return localDatabase[guildId].users[userId];
    }
}

// حفظ بيانات العضو
async function saveUserData(guildId, userId, data) {
    if (useMongoDB) {
        await UserLevelModel.updateOne({ guildId, userId }, {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount,
            coins: data.coins,
            lastDaily: data.lastDaily
        });
    } else {
        localDatabase[guildId].users[userId] = {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount,
            coins: data.coins,
            lastDaily: data.lastDaily
        };
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

// جلب إعدادات السيرفر
async function getGuildConfig(guildId) {
    if (useMongoDB) {
        let config = await GuildConfigModel.findOne({ guildId });
        if (!config) {
            config = new GuildConfigModel({ guildId, levelChannelId: null, islamicChannelId: null, roleRewards: [] });
            await config.save();
        }
        return config;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].config) {
            localDatabase[guildId].config = { levelChannelId: null, islamicChannelId: null, roleRewards: [] };
        }
        return localDatabase[guildId].config;
    }
}

// حفظ الإعدادات
async function saveGuildConfig(guildId, configData) {
    if (useMongoDB) {
        await GuildConfigModel.updateOne({ guildId }, {
            levelChannelId: configData.levelChannelId,
            islamicChannelId: configData.islamicChannelId,
            roleRewards: configData.roleRewards
        });
    } else {
        localDatabase[guildId].config = configData;
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

// مزامنة الأوامر على ديسكورد
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
            name: 'setup_middleman_panel',
            description: 'إرسال لوحة التحكم بطلب وسطاء معتمدين (للإداريين فقط)'
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
            name: 'set_level_channel',
            description: 'تحديد الغرفة المخصصة لإشعارات وصور زيادة المستويات (للإداريين فقط)',
            options: [
                { name: 'channel', type: 7, description: 'الغرفة المخصصة للإشعارات', required: true }
            ]
        },
        {
            name: 'set_islamic_channel',
            description: 'تحديد الغرفة المخصصة لنشر الآيات والأذكار التلقائية (للإداريين فقط)',
            options: [
                { name: 'channel', type: 7, description: 'الغرفة الإسلامية المخصصة', required: true }
            ]
        },
        {
            name: 'add_role_reward',
            description: 'ربط رتبة بعدد رسائل محدد للحصول عليها تلقائياً (للإداريين فقط)',
            options: [
                { name: 'role', type: 8, description: 'الرتبة المراد منحها كهدية', required: true },
                { name: 'messages_needed', type: 4, description: 'عدد الرسائل المطلوبة للحصول على الرتبة', required: true }
            ]
        },
        {
            name: 'daily',
            description: 'الحصول على المكافأة المالية اليومية للبنك 🪙'
        },
        {
            name: 'coins',
            description: 'عرض رصيدك الحالي من عملات BRQ Coins في البنك',
            options: [
                { name: 'user', type: 6, description: 'العضو المراد عرض رصيده (اختياري)', required: false }
            ]
        },
        {
            name: 'transfer',
            description: 'تحويل عملات BRQ Coins من حسابك لعضو آخر في السيرفر',
            options: [
                { name: 'user', type: 6, description: 'العضو المراد تحويل العملات إليه', required: true },
                { name: 'amount', type: 4, description: 'المبلغ المراد تحويله', required: true }
            ]
        },
        {
            name: 'shop',
            description: 'عرض متجر رتب السيرفر الافتراضية المتاحة للشراء'
        },
        {
            name: 'buy',
            description: 'شراء رتبة من متجر السيرفر عبر خصم العملات من حسابك',
            options: [
                { name: 'role', type: 8, description: 'الرتبة المراد شراؤها من المتجر', required: true }
            ]
        },
        {
            name: 'giveaway_start',
            description: 'بدء مسابقة جيف اواي تفاعلية بنظام الشروط في السيرفر (للإداريين فقط)',
            options: [
                { name: 'prize', type: 3, description: 'الجائزة المقدمة', required: true },
                { name: 'duration_minutes', type: 4, description: 'مدة المسابقة بالدقائق', required: true },
                { name: 'winners_count', type: 4, description: 'عدد الفائزين', required: true },
                { name: 'level_requirement', type: 4, description: 'مستوى التفاعل المطلوب كحد أدنى للمشاركة (0 للمفتوح)', required: true }
            ]
        },
        {
            name: 'help',
            description: 'دليل وأوامر البوت للتحكم في كافة الأنظمة والخيارات'
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

// نظام الردود التلقائية والخبرة ومعدل الرسائل والعملات
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const trimmedMsg = message.content.trim();
    const guildId = message.guild.id;
    const userId = message.author.id;

    // 1. نظام الردود التلقائية المباشر
    if (trimmedMsg === "سلام عليكم") {
        return message.reply("و عليكم السلام ورحمه الله وبركاته").catch(() => {});
    } else if (trimmedMsg === "باك") {
        return message.reply("ولكمم").catch(() => {});
    } else if (trimmedMsg === "برب") {
        return message.reply("يلا لا طول علينا").catch(() => {});
    } else if (trimmedMsg === "هاي") {
        return message.reply("وتسب برو").catch(() => {});
    }

    try {
        const userData = await getUserData(guildId, userId);
        userData.messageCount += 1;
        
        // إعطاء عملات عشوائية (بين 10 و 30 عملة) لكل رسالة تفاعلية
        const coinsToAdd = Math.floor(Math.random() * 21) + 10;
        userData.coins += coinsToAdd;

        // إضافة نقاط خبرة عشوائية (بين 10 و 20 XP)
        const xpToAdd = Math.floor(Math.random() * 11) + 10;
        userData.xp += xpToAdd;

        const xpNeeded = userData.level * 150;
        
        // حدوث زيادة المستوى (Level Up)
        if (userData.xp >= xpNeeded) {
            const oldLevel = userData.level;
            userData.xp -= xpNeeded;
            userData.level += 1;
            const newLevel = userData.level;

            const config = await getGuildConfig(guildId);
            let announceChannel = message.channel;
            if (config.levelChannelId) {
                const targetChannel = message.guild.channels.cache.get(config.levelChannelId);
                if (targetChannel) announceChannel = targetChannel;
            }

            // رسم وتوليد صورة الترقية بالخلفية المرفقة (1280x543)
            try {
                const canvas = createCanvas(1280, 543);
                const ctx = canvas.getContext('2d');

                const bg = await loadImage('./input_file_22.jpeg').catch(() => null);
                if (bg) {
                    ctx.drawImage(bg, 0, 0, 1280, 543);
                } else {
                    ctx.fillStyle = '#0f172a';
                    ctx.fillRect(0, 0, 1280, 543);
                }

                ctx.shadowColor = '#a855f7';
                ctx.shadowBlur = 20;

                const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 128 });
                const avatarImage = await loadImage(avatarUrl).catch(() => null);

                ctx.save();
                ctx.beginPath();
                ctx.arc(190, 271.5, 95, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                
                if (avatarImage) {
                    ctx.drawImage(avatarImage, 95, 176.5, 190, 190);
                } else {
                    ctx.fillStyle = '#475569';
                    ctx.fill();
                }
                ctx.restore();

                ctx.shadowBlur = 0;

                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 44px sans-serif';
                ctx.fillText('ترقية تفاعلية جديدة! 🎉', 360, 160);

                ctx.fillStyle = '#c084fc';
                ctx.font = 'bold 32px sans-serif';
                ctx.fillText(`المستوى السابق: ${oldLevel} ➡️ المستوى الحالي: ${newLevel}`, 360, 240);

                ctx.fillStyle = '#94a3b8';
                ctx.font = '24px sans-serif';
                ctx.fillText(`اسم العضو: ${message.author.username}`, 360, 310);
                ctx.fillText(`إجمالي الرسائل: ${userData.messageCount}`, 360, 370);

                ctx.fillStyle = '#a855f7';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(`ID: ${userId}`, 980, 60);

                const buffer = canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: `levelup-${userId}.png` });

                await announceChannel.send({ 
                    content: `🎉 **ترقية تفاعلية للأعضاء!**\nلقد كنت في مستوى **${oldLevel}** وأصبحت الآن في مستوى **${newLevel}**!\nالرتبة التفاعلية السابقة: **Level ${oldLevel}** ➡️ الرتبة الجديدة: **Level ${newLevel}**`,
                    files: [attachment] 
                }).catch(() => {});

            } catch (err) {
                console.error(err);
                await announceChannel.send(`🎉 تهانينا ${message.author}! لقد كنت في مستوى **${oldLevel}** وأصبحت الآن في مستوى **${newLevel}**!`).catch(() => {});
            }
        }

        // التحقق من الرتب الممنوحة كجائزة على الرسائل
        const config = await getGuildConfig(guildId);
        if (config && config.roleRewards && config.roleRewards.length > 0) {
            for (const reward of config.roleRewards) {
                if (userData.messageCount >= reward.messagesNeeded) {
                    const role = message.guild.roles.cache.get(reward.roleId);
                    if (role && !message.member.roles.cache.has(role.id)) {
                        try {
                            await message.member.roles.add(role);
                            await message.channel.send(`🎉 مبارك <@${userId}>! لقد حصلت على رتبة **${role.name}** لمشاركتك المتميزة ووصولك لـ **${reward.messagesNeeded}** رسالة!`);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        }

        await saveUserData(guildId, userId, userData);
    } catch (e) {
        console.error(e);
    }
});

// 1. نظام الرومات الصوتية المؤقتة الذكي (Temp Voice Rooms)
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    const guild = newState.guild;

    // حالة الانضمام لروم "انشاء • فويس 🔊"
    if (newState.channelId) {
        const joinChannel = guild.channels.cache.get(newState.channelId);
        if (joinChannel && (joinChannel.name.includes('انشاء • فويس') || joinChannel.name.includes('انشاء-فويس'))) {
            try {
                // إنشاء روم صوتي مؤقت مخصص للعضو باسمه في نفس الكاتيجوري
                const tempChannel = await guild.channels.create({
                    name: `🎙️ | فويس ${member.displayName}`,
                    type: ChannelType.GuildVoice,
                    parent: joinChannel.parentId,
                    userLimit: 10,
                    permissionOverwrites: [
                        {
                            id: member.id,
                            allow: [PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers]
                        }
                    ]
                });

                // نقل العضو إلى الفويس الجديد
                await member.voice.setChannel(tempChannel);
                tempVoiceChannels.set(tempChannel.id, member.id);
            } catch (e) {
                console.error('Failed to create dynamic temp voice room:', e);
            }
        }
    }

    // حالة الخروج من روم مؤقت وحذفه فور خلوه من الأعضاء
    if (oldState.channelId) {
        const leaveChannel = guild.channels.cache.get(oldState.channelId);
        if (leaveChannel && tempVoiceChannels.has(leaveChannel.id)) {
            if (leaveChannel.members.size === 0) {
                try {
                    await leaveChannel.delete();
                    tempVoiceChannels.delete(leaveChannel.id);
                } catch (e) {
                    console.error('Failed to delete empty temp voice room:', e);
                }
            }
        }
    }
});

// 2. نظام النشر التلقائي للآيات والأذكار (كل ساعة)
setInterval(async () => {
    try {
        const guilds = client.guilds.cache;
        for (const guild of guilds.values()) {
            const config = await getGuildConfig(guild.id);
            if (config && config.islamicChannelId) {
                const targetChannel = guild.channels.cache.get(config.islamicChannelId);
                if (targetChannel) {
                    const randomReminder = ISLAMIC_REMINDERS[Math.floor(Math.random() * ISLAMIC_REMINDERS.length)];
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🕌 تذكير إسلامي دوري أجر لي ولك 🕌')
                        .setDescription(`**${randomReminder}**`)
                        .setColor(0x10b981)
                        .setFooter({ text: 'سبحان الله وبحمده ، سبحان الله العظيم' })
                        .setTimestamp();

                    await targetChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        }
    } catch (e) {
        console.error('Error in Islamic auto-poster interval:', e);
    }
}, 3600000); // 3,600,000 مللي ثانية = 1 ساعة دقيقة تماماً

// معالجة كافة التفاعلات والأوامر
client.on('interactionCreate', async (interaction) => {
    
    // أزرار التذاكر والوسطاء وجيف اوايز
    if (interaction.isButton()) {
        const { guild, member, customId, channel } = interaction;

        // استخراج معرف صاحب التذكرة من الوصف
        const topic = channel.topic || '';
        const match = topic.match(/creator-id:\s*(\d+)/);
        const creatorId = match ? match[1] : null;

        // 3. بوابة نظام الوسطاء المتفاعل (Middleman Buttons)
        if (customId === 'request_middleman_btn') {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

            const modal = new ModalBuilder()
                .setCustomId('request_middleman_modal')
                .setTitle('طلب وسيط معتمد للصفقة ⚖️');

            const sellerInput = new TextInputBuilder()
                .setCustomId('seller_id')
                .setLabel('آي دي (ID) البائع بالكامل')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 123456789012345678')
                .setRequired(true);

            const dealInput = new TextInputBuilder()
                .setCustomId('deal_details')
                .setLabel('تفاصيل السلعة / الصفقة')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('مثال: بيع حساب تيك توك مقابل كاش وبطاقات الدفع...')
                .setRequired(true);

            const priceInput = new TextInputBuilder()
                .setCustomId('deal_price')
                .setLabel('المبلغ وطريقة الدفع المتفق عليها')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 50 دولار عبر الـ PayPal')
                .setRequired(true);

            const row1 = new ActionRowBuilder().addComponents(sellerInput);
            const row2 = new ActionRowBuilder().addComponents(dealInput);
            const row3 = new ActionRowBuilder().addComponents(priceInput);
            modal.addComponents(row1, row2, row3);

            return interaction.showModal(modal);
        }

        // أزرار التحكم بالوساطة للوسطاء المعتمدين
        if (customId === 'claim_deal_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ هذا الإجراء مخصص للوسطاء المعتمدين والإدارة فقط.', ephemeral: true });
            }
            await interaction.reply({ content: `💼 تم استلام عملية الوساطة الحالية ومتابعتها بواسطة الوسيط: ${member}` });
        }

        if (customId === 'complete_deal_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ هذا الإجراء مخصص للوسطاء المعتمدين والإدارة فقط.', ephemeral: true });
            }
            await interaction.reply({ content: `✅ تم إتمام وتسليم الصفقة بنجاح تحت إشراف الوسيط: ${member}!\nسيتم أرشفة وإغلاق الروم خلال 10 ثوانٍ...` });
            setTimeout(() => channel.delete().catch(() => {}), 10000);
        }

        if (customId === 'cancel_deal_btn') {
            if (!isStaffOrAdmin(member)) {
                return interaction.reply({ content: '❌ هذا الإجراء مخصص للوسطاء المعتمدين والإدارة فقط.', ephemeral: true });
            }
            await interaction.reply({ content: `❌ تم إلغاء الصفقة والوساطة بواسطة الوسيط: ${member}.\nسيتم أرشفة وإغلاق الروم خلال 10 ثوانٍ...` });
            setTimeout(() => channel.delete().catch(() => {}), 10000);
        }

        // نظام الاشتراك في الجيف اواي (Giveaway Join)
        if (customId === 'join_giveaway_btn') {
            const gw = activeGiveaways.get(interaction.message.id);
            if (!gw) return interaction.reply({ content: '❌ انتهت هذه المسابقة أو لم تعد صالحة.', ephemeral: true });

            if (gw.participants.includes(member.id)) {
                return interaction.reply({ content: '❌ أنت مشارك بالفعل في هذا الجيف اواي مسبقاً!', ephemeral: true });
            }

            // فحص شرط المستوى المطلوب للدخول في التوزيع للعدل والتفاعل
            const userData = await getUserData(guild.id, member.id);
            if (userData.level < gw.levelRequirement) {
                return interaction.reply({ content: `❌ لا يمكنك المشاركة في هذا الجيف اواي. المستوى المطلوب للمشاركة هو **${gw.levelRequirement}** على الأقل (مستواك الحالي: **${userData.level}**). تفاعل أكثر للدخول!`, ephemeral: true });
            }

            gw.participants.push(member.id);
            await interaction.reply({ content: '✅ تم تسجيل مشاركتك بنجاح في الجيف اواي، نتمنى لك التوفيق! 🎁', ephemeral: true });
        }

        // أزرار تذكرة الدعم الفني الافتراضية
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

    // النوافذ المنبثقة (Modals) للـ الوسطاء والقوانين
    if (interaction.isModalSubmit()) {
        const { guild, member, customId, fields } = interaction;

        // معالجة إرسال طلب الوساطة وإنشاء تذكرة وسيط تلقائياً مع الصلاحيات الصارمة
        if (customId === 'request_middleman_modal') {
            await interaction.deferReply({ ephemeral: true });

            const sellerId = fields.getTextInputValue('seller_id').trim();
            const dealDetails = fields.getTextInputValue('deal_details');
            const dealPrice = fields.getTextInputValue('deal_price');

            // فحص صحة الآي دي المدخل للبائع في ديسكورد
            const sellerMember = await guild.members.fetch(sellerId).catch(() => null);

            let category = guild.channels.cache.find(c => c.name === '⚖️ | BRQ - Meditators' && c.type === ChannelType.GuildCategory);
            if (!category) {
                category = await guild.channels.create({ name: '⚖️ | BRQ - Meditators', type: ChannelType.GuildCategory });
            }

            const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
            const mmRole = guild.roles.cache.find(r => r.name === 'Middleman (الوسيط)');

            const overwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ];

            if (sellerMember) {
                overwrites.push({ id: sellerMember.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            }
            if (staffRole) {
                overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            }
            if (mmRole) {
                overwrites.push({ id: mmRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
            }

            try {
                const mmChannel = await guild.channels.create({
                    name: `وساطة-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: overwrites
                });

                const dealEmbed = new EmbedBuilder()
                    .setTitle('⚖️ صفقة تجارية معلقة - تذكرة وساطة رسمية ⚖️')
                    .setDescription('مرحباً بكما في بوابة الصفقات الآمنة لـ BRQ Community.\nيرجى الانتظار لحين استلام الصفقة من قبل أحد الوسطاء المعتمدين.')
                    .setColor(0x00AAAA)
                    .addFields(
                        { name: '👤 صاحب الطلب (المشتري):', value: `${member} (${member.id})`, inline: true },
                        { name: '👤 الطرف الآخر (البائع):', value: sellerMember ? `${sellerMember} (${sellerId})` : `\`لم يُعثر على الآي دي المدخل: ${sellerId}\``, inline: true },
                        { name: '📦 تفاصيل الصفقة:', value: `\`\`\`${dealDetails}\`\`\`` },
                        { name: '💰 قيمة الصفقة وطريقة الدفع:', value: `\`${dealPrice}\`` }
                    )
                    .setFooter({ text: 'التحكم بالصفقة مخصص للوسطاء المعتمدين فقط.' });

                const mmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('claim_deal_btn').setLabel('استلام الصفقة 🔒').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('complete_deal_btn').setLabel('إتمام الصفقة ✅').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('cancel_deal_btn').setLabel('إلغاء الصفقة ❌').setStyle(ButtonStyle.Danger)
                );

                await mmChannel.send({ content: `<@&${mmRole ? mmRole.id : ''}> نداء تذكرة وساطة جديدة بحاجة لمتابعتكم.`, embeds: [dealEmbed], components: [mmRow] });
                await interaction.followUp({ content: `✅ تم إنشاء تذكرة الوساطة بنجاح والتنسيق بين الأطراف: ${mmChannel}`, ephemeral: true });

            } catch (e) {
                console.error(e);
                await interaction.followUp({ content: '❌ حدث خطأ غير متوقع أثناء فتح تذكرة الوساطة.', ephemeral: true });
            }
        }

        if (customId === 'publish_rules_modal') {
            const title = fields.getTextInputValue('rules_title');
            const content = fields.getTextInputValue('rules_content');

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

    // 3. التعامل مع أوامر السلاش (Slash Commands) الكتابية
    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel } = interaction;

        const isAdministrator = member.permissions.has(PermissionFlagsBits.Administrator);

        // أمر المساعدة الشامل والمقسم بدقة (Help Command)
        if (commandName === 'help') {
            const embed = new EmbedBuilder()
                .setTitle('دليل وأوامر بوت سيرفر BRQ Community 🤖')
                .setDescription('مرحباً بك في قائمة المساعدة المخصصة للتحكم بكافة أنظمة البوت.')
                .setColor(0xa855f7)
                .setThumbnail(guild.iconURL({ dynamic: true }) || null)
                .addFields(
                    { 
                        name: '🛡️ أوامر الإدارة العامة', 
                        value: '`/setup_server` • لتهيئة السيرفر وإنشاء الرومات والرتب والجوائز.\n`/setup_ticket` • لإرسال بانل التذاكر التفاعلي.\n`/setup_middleman_panel` • لإرسال بانل الوسطاء التفاعلي.\n`/delete_all_channels` • لمسح كافة الرومات بالسيرفر يدوياً.\n`/delete_channel` • لحذف روم محدد.\n`/delete_all_roles` • لمسح جميع الرتب التلقائية بالسيرفر.\n`/publish_rules` • لنشر قوانين السيرفر كبطاقة إمبد.' 
                    },
                    { 
                        name: '📊 أوامر التفاعل والمستويات والعملات (الجديدة)', 
                        value: '`/rank` • لعرض بطاقة المستوى وعدد رسائل العضو كصورة مخصصة.\n`/set_level_channel` • لتخصيص روم إشعارات زيادة المستوى.\n`/set_islamic_channel` • لتخصيص روم النشر الإسلامي التلقائي.\n`/add_role_reward` • لربط رتبة بعدد رسائل محدد للأعضاء.\n`/daily` • للحصول على مكافأتك اليومية بالعملات.\n`/coins` • لعرض رصيدك ببنك ديسكورد.\n`/transfer` • لتحويل العملات للأعضاء.\n`/shop` • لعرض متجر رتب السيرفر.\n`/buy` • لشراء رتبة من المتجر الافتراضي.' 
                    },
                    { 
                        name: '🎫 أوامر نظام التذاكر والوسطاء', 
                        value: '`/add` • لإدخال عضو للتذكرة.\n`/remove` • لإزالة عضو من التذكرة.\n`/claim` • لاستلام تذكرة لمتابعتها.\n`/unclaim` • لترك التذكرة ليعود المشرفين لاستلامها.\n`/rename` • لتعديل اسم روم التذكرة.\n`/close` • لإغلاق وحذف التذكرة الحالية.' 
                    },
                    { 
                        name: '🎁 أوامر التوزيع والـ Giveaways (الجديدة)', 
                        value: '`/giveaway_start` • لبدء جيف اواي تفاعلي بشروط المستويات والتفاعل بالسيرفر.' 
                    },
                    { 
                        name: '🔨 أوامر الإشراف الأساسية', 
                        value: '`/ban` • لحظر عضو من السيرفر.\n`/timeout` • لإعطاء تايم أوت (كتم مؤقت) لعضو.' 
                    }
                )
                .setFooter({ text: 'تمت برمجة البوت وتطويره بالكامل بواسطة محقق كونان 🔎' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // أمر الـ Giveaway المتطور والداعم لشروط المستويات لمنع الخمول والعدل
        if (commandName === 'giveaway_start') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }

            const prize = options.getString('prize');
            const duration = options.getInteger('duration_minutes');
            const winnersCount = options.getInteger('winners_count');
            const levelReq = options.getInteger('level_requirement') || 0;

            await interaction.reply({ content: '⏳ جاري بدء ونشر الـ Giveaway في الغرفة الحالية...', ephemeral: true });

            const endTime = Date.now() + duration * 60 * 1000;

            const embed = new EmbedBuilder()
                .setTitle('🎁 سحب وجيف اواي تفاعلي جديد! 🎁')
                .setDescription(`اضغط على الزر أدناه للدخول في السحب التلقائي.\n\n🏆 **الجائزة المقدمة:** **${prize}**\n⏱️ **المدة الزمنية:** **${duration}** دقيقة\n👤 **عدد الفائزين:** **${winnersCount}** فائز(ين)\n⭐ **الحد الأدنى لمستوى التفاعل للدخول:** المستوى **${levelReq === 0 ? 'مفتوح للجميع 🔓' : levelReq}**`)
                .setColor(0xfbbf24)
                .setFooter({ text: `ينتهي في` })
                .setTimestamp(endTime);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_giveaway_btn').setLabel('المشاركة في التوزيع 🎁').setStyle(ButtonStyle.Success)
            );

            const msg = await channel.send({ embeds: [embed], components: [row] });

            // حفظ بيانات الـ Giveaway في الذاكرة لمتابعة السحب
            activeGiveaways.set(msg.id, {
                prize,
                levelRequirement: levelReq,
                winnersCount,
                participants: []
            });

            // مؤقت سحب الفائزين العشوائي التلقائي
            setTimeout(async () => {
                const gw = activeGiveaways.get(msg.id);
                if (!gw) return;

                const winners = [];
                const participants = gw.participants;

                // التحقق من تواجد عدد كافٍ من المشاركين
                if (participants.length > 0) {
                    const tempParticipants = [...participants];
                    for (let i = 0; i < Math.min(gw.winnersCount, participants.length); i++) {
                        const randomIndex = Math.floor(Math.random() * tempParticipants.length);
                        const winnerId = tempParticipants.splice(randomIndex, 1)[0];
                        winners.push(`<@${winnerId}>`);
                    }
                }

                // تحديث الإمبد لإعلان الانتهاء وأسماء الفائزين
                const endedEmbed = new EmbedBuilder()
                    .setTitle('🎉 انتهى السحب التفاعلي والـ Giveaway! 🎉')
                    .setDescription(`🏆 **الجائزة الموزعة:** **${gw.prize}**\n\n👥 **الفائزين المحظوظين:**\n${winners.length > 0 ? winners.join('\n') : 'لا يوجد فائزين (لم يشارك أحد يطابق الشروط)'}`)
                    .setColor(0x94a3b8)
                    .setTimestamp();

                const disabledRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('join_giveaway_btn').setLabel('انتهت المسابقة ❌').setStyle(ButtonStyle.Secondary).setDisabled(true)
                );

                await msg.edit({ embeds: [endedEmbed], components: [disabledRow] }).catch(() => {});
                
                if (winners.length > 0) {
                    await channel.send(`🎉 مبارك الفوز لـ ${winners.join(', ')} بجائزة: **${gw.prize}**! يرجى التوجه للإدارة وتأكيد الاستلام.`);
                }

                activeGiveaways.delete(msg.id);

            }, duration * 60 * 1000);
        }

        // أوامر الاقتصاد والبنك التفاعلية
        if (commandName === 'daily') {
            const userData = await getUserData(guild.id, interaction.user.id);
            const now = new Date();

            // فحص مهلة الـ 24 ساعة للحصول على المكافأة اليومية
            if (userData.lastDaily) {
                const cooldown = 24 * 60 * 60 * 1000; // 24 ساعة بالملي ثانية
                const diff = now - new Date(userData.lastDaily);
                if (diff < cooldown) {
                    const timeLeft = cooldown - diff;
                    const hours = Math.floor(timeLeft / (60 * 60 * 1000));
                    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
                    return interaction.reply({ content: `❌ لقد قمت باستلام مكافأتك اليومية بالفعل! يرجى الانتظار **${hours} ساعة و ${minutes} دقيقة** للمطالبة بها مجدداً.`, ephemeral: true });
                }
            }

            const dailyAmount = Math.floor(Math.random() * 301) + 200; // مبلغ عشوائي بين 200 و 500 عملة
            userData.coins += dailyAmount;
            userData.lastDaily = now;

            await saveUserData(guild.id, interaction.user.id, userData);
            await interaction.reply({ content: `🪙 تم استلام مكافأتك اليومية بنجاح بنك السيرفر! تم إيداع **${dailyAmount} BRQ Coins** في حسابك.` });
        }

        if (commandName === 'coins') {
            const targetUser = options.getUser('user') || interaction.user;
            const userData = await getUserData(guild.id, targetUser.id);

            await interaction.reply({ content: `💰 رصيد الحساب المالي لـ ${targetUser} الحالي في بنك السيرفر هو: **${userData.coins} BRQ Coins**.` });
        }

        if (commandName === 'transfer') {
            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');

            if (targetUser.id === interaction.user.id) {
                return interaction.reply({ content: '❌ لا يمكنك تحويل العملات إلى حسابك الشخصي!', ephemeral: true });
            }
            if (amount <= 0) {
                return interaction.reply({ content: '❌ يرجى كتابة مبلغ تحويل صحيح أكبر من صفر.', ephemeral: true });
            }

            const senderData = await getUserData(guild.id, interaction.user.id);
            if (senderData.coins < amount) {
                return interaction.reply({ content: `❌ رصيدك الحالي غير كافٍ لإتمام عملية التحويل (رصيدك الحالي: **${senderData.coins} BRQ Coins**).`, ephemeral: true });
            }

            const receiverData = await getUserData(guild.id, targetUser.id);
            senderData.coins -= amount;
            receiverData.coins += amount;

            await saveUserData(guild.id, interaction.user.id, senderData);
            await saveUserData(guild.id, targetUser.id, receiverData);

            await interaction.reply({ content: `✅ تم بنجاح تحويل **${amount} BRQ Coins** من حسابك إلى العضو ${targetUser}.` });
        }

        if (commandName === 'shop') {
            const embed = new EmbedBuilder()
                .setTitle('🛒 متجر رتب السيرفر التفاعلي | BRQ Shop 🛒')
                .setDescription('قم بتجميع العملات وتفاعلك بالشات لتتمكن من شراء هذه الرتب المميزة والحصول عليها تلقائياً.')
                .setColor(0x06b6d4)
                .addFields(
                    { name: '🟢 الرتب الأساسية المتوفرة للشراء:', value: '• **Level 5 Member** ⬅️ القيمة: `1500` عملة 🪙\n• **Level 10 Member** ⬅️ القيمة: `3000` عملة 🪙\n• **Level 20 Member** ⬅️ القيمة: `6000` عملة 🪙' },
                    { name: '✨ رتب الـ VIP الفاخرة المتاحة للشراء:', value: '• **VIP Elite** ⬅️ القيمة: `15000` عملة 🪙\n• **VIP Legendary** ⬅️ القيمة: `30000` عملة 🪙\n• **VIP Mythic** ⬅️ القيمة: `50000` عملة 🪙' }
                )
                .setFooter({ text: 'لشراء رتبة محددة، استخدم الأمر: /buy' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }

        if (commandName === 'buy') {
            const targetRole = options.getRole('role');
            
            // تحديد أسعار الرتب المتوفرة للشراء بدقة
            const shopPrices = {
                "Level 5 Member": 1500,
                "Level 10 Member": 3000,
                "Level 20 Member": 6000,
                "VIP Elite": 15000,
                "VIP Legendary": 30000,
                "VIP Mythic": 50000
            };

            const price = shopPrices[targetRole.name];
            if (!price) {
                return interaction.reply({ content: '❌ هذه الرتبة غير معروضة للبيع في متجر السيرفر حالياً. يرجى مراجعة معروضات المتجر عبر أمر `/shop`.', ephemeral: true });
            }

            if (member.roles.cache.has(targetRole.id)) {
                return interaction.reply({ content: '❌ أنت تمتلك هذه الرتبة بالفعل مسبقاً في حسابك!', ephemeral: true });
            }

            const userData = await getUserData(guild.id, interaction.user.id);
            if (userData.coins < price) {
                return interaction.reply({ content: `❌ رصيدك الحالي في البنك غير كافٍ لشراء هذه الرتبة (القيمة: **${price}** عملة، رصيدك الحالي: **${userData.coins}** عملة).`, ephemeral: true });
            }

            // إتمام عملية الشراء وخصم العملات وإعطاء الرتبة تلقائياً
            try {
                userData.coins -= price;
                await saveUserData(guild.id, interaction.user.id, userData);
                await member.roles.add(targetRole);

                await interaction.reply({ content: `🎉 مبارك الفوز! لقد قمت بشراء رتبة **${targetRole.name}** بنجاح من متجر السيرفر، وتم خصم **${price} BRQ Coins** من حسابك بنك السيرفر.` });
            } catch (e) {
                console.error(e);
                await interaction.reply({ content: '❌ حدث خطأ برمي أثناء محاولة منحك الرتبة، يرجى التأكد من أن رتبة البوت أعلى من الرتبة المراد شراؤها.', ephemeral: true });
            }
        }

        // إعداد وتخصيص الروم الإسلامي للأذكار التلقائية
        if (commandName === 'set_islamic_channel') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }
            const targetChannel = options.getChannel('channel');
            try {
                const config = await getGuildConfig(guild.id);
                config.islamicChannelId = targetChannel.id;
                await saveGuildConfig(guild.id, config);

                await interaction.reply({ content: `✅ تم بنجاح تحديد الغرفة ${targetChannel} كغرفة مخصصة لنشر الآيات والأذكار التلقائية كل ساعة.`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل حفظ الإعداد: ${e.message}`, ephemeral: true });
            }
        }

        // بقية الأوامر الإدارية الأساسية والوسطاء
        if (commandName === 'setup_middleman_panel') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('⚖️ بوابة صفقات الوسطاء المعتمدين الآمنة ⚖️')
                .setDescription('تجنب عمليات النصب خارج السيرفر بالكامل! يرجى الضغط على الزر بالأسفل لفتح تذكرة طلب وساطة رسمية للتنسيق وتأمين صفقاتك (بيع، شراء، استبدال) تحت إشراف طاقم وسطائنا المعتمدين.')
                .setColor(0x00AAAA)
                .setFooter({ text: 'طاقم وسطاء سيرفر BRQ Community' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('request_middleman_btn').setLabel('طلب وسيط معتمد ⚖️').setStyle(ButtonStyle.Primary)
            );

            try {
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ تم إرسال لوحة التحكم بالوسطاء المعتمدين بنجاح!', ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل إرسال اللوحة: ${e.message}`, ephemeral: true });
            }
        }

        // الأوامر المتبقية
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

                const config = await getGuildConfig(guild.id);
                let rewardStatusText = 'لا توجد رتب مكافآت متبقية (أنت في القمة! 👑)';
                if (config && config.roleRewards && config.roleRewards.length > 0) {
                    const sortedRewards = [...config.roleRewards].sort((a, b) => a.messagesNeeded - b.messagesNeeded);
                    const nextReward = sortedRewards.find(r => userData.messageCount < r.messagesNeeded);
                    if (nextReward) {
                        const remaining = nextReward.messagesNeeded - userData.messageCount;
                        const role = guild.roles.cache.get(nextReward.roleId);
                        const roleName = role ? role.name : 'رتبة تفاعلية';
                        rewardStatusText = `بقي ${remaining} رسالة للوصول إلى مكافأة: [ ${roleName} ]`;
                    }
                }

                const canvas = createCanvas(1280, 543);
                const ctx = canvas.getContext('2d');

                const bg = await loadImage('./input_file_22.jpeg').catch(() => null);
                if (bg) {
                    ctx.drawImage(bg, 0, 0, 1280, 543);
                } else {
                    ctx.fillStyle = '#111726';
                    ctx.fillRect(0, 0, 1280, 543);
                }

                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 20;

                const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 128 });
                const avatarImage = await loadImage(avatarUrl).catch(() => null);

                ctx.save();
                ctx.beginPath();
                ctx.arc(190, 271.5, 95, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                
                if (avatarImage) {
                    ctx.drawImage(avatarImage, 95, 176.5, 190, 190);
                } else {
                    ctx.fillStyle = '#475569';
                    ctx.fill();
                }
                ctx.restore();

                ctx.shadowBlur = 0;

                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 38px sans-serif';
                ctx.fillText(targetUser.username, 360, 130);

                ctx.fillStyle = '#38bdf8';
                ctx.font = '24px sans-serif';
                ctx.fillText(`المستوى الحالي: ${userData.level}`, 360, 195);

                ctx.fillStyle = '#94a3b8';
                ctx.fillText(`الخبرة التراكمية: ${userData.xp} / ${nextLevelXP} XP`, 360, 255);
                ctx.fillText(`مجموع رسائل اليوم الكلي: ${userData.messageCount} رسالة`, 360, 315);

                ctx.fillStyle = '#22d3ee';
                ctx.font = 'bold 20px sans-serif';
                ctx.fillText(rewardStatusText, 360, 375);

                ctx.fillStyle = '#a855f7';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(`ID: ${targetUser.id}`, 980, 60);

                const barWidth = 850;
                const barHeight = 24;
                const barX = 360;
                const barY = 430;

                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, 10);
                ctx.fill();

                const progressPercent = Math.min(userData.xp / nextLevelXP, 1);
                if (progressPercent > 0) {
                    const progressGradient = ctx.createLinearGradient(barX, 0, barX + barWidth, 0);
                    progressGradient.addColorStop(0, '#0ea5e9');
                    progressGradient.addColorStop(1, '#a855f7');
                    ctx.fillStyle = progressGradient;
                    ctx.beginPath();
                    ctx.roundRect(barX, barY, barWidth * progressPercent, barHeight, 10);
                    ctx.fill();
                }

                const buffer = canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: `rank-${targetUser.id}.png` });

                await interaction.followUp({ files: [attachment] });

            } catch (err) {
                console.error(err);
                await interaction.followUp({ content: '❌ حدث خطأ غير متوقع أثناء رسم بطاقة الرتبة.' });
            }
        }

        // بقية الأوامر والتهيئة
        if (commandName === 'set_level_channel') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }
            const targetChannel = options.getChannel('channel');
            try {
                const config = await getGuildConfig(guild.id);
                config.levelChannelId = targetChannel.id;
                await saveGuildConfig(guild.id, config);

                await interaction.reply({ content: `✅ تم بنجاح تحديد الغرفة ${targetChannel} كغرفة مخصصة لإرسال إشعارات وصور زيادة المستويات.`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل حفظ الإعداد: ${e.message}`, ephemeral: true });
            }
        }

        if (commandName === 'add_role_reward') {
            if (!isAdministrator) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }
            const targetRole = options.getRole('role');
            const messagesNeeded = options.getInteger('messages_needed');

            try {
                const config = await getGuildConfig(guild.id);
                if (!config.roleRewards) config.roleRewards = [];
                
                config.roleRewards = config.roleRewards.filter(r => r.roleId !== targetRole.id);
                config.roleRewards.push({ roleId: targetRole.id, messagesNeeded });
                
                await saveGuildConfig(guild.id, config);
                await interaction.reply({ content: `✅ تم بنجاح ربط الرتبة **${targetRole.name}** بـ **${messagesNeeded}** رسالة كمكافأة للأعضاء النشطين.`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: `❌ فشل إضافة الرتبة للمكافآت: ${e.message}`, ephemeral: true });
            }
        }

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
    }
});

// جلب إعدادات العضو
async function getUserData(guildId, userId) {
    if (useMongoDB) {
        let data = await UserLevelModel.findOne({ guildId, userId });
        if (!data) {
            data = new UserLevelModel({ guildId, userId, level: 1, xp: 0, messageCount: 0, coins: 0, lastDaily: null });
            await data.save();
        }
        return data;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].users) localDatabase[guildId].users = {};
        if (!localDatabase[guildId].users[userId]) {
            localDatabase[guildId].users[userId] = { level: 1, xp: 0, messageCount: 0, coins: 0, lastDaily: null };
        }
        return localDatabase[guildId].users[userId];
    }
}

// حفظ بيانات العضو
async function saveUserData(guildId, userId, data) {
    if (useMongoDB) {
        await UserLevelModel.updateOne({ guildId, userId }, {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount,
            coins: data.coins,
            lastDaily: data.lastDaily
        });
    } else {
        localDatabase[guildId].users[userId] = {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount,
            coins: data.coins,
            lastDaily: data.lastDaily
        };
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

const TOKEN = process.env.DISCORD_TOKEN || 'ضع_توكن_البوت_الخاص_بِك_هنا';
client.login(TOKEN);