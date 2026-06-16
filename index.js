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
    console.warn('⚠️ تنبيه: لم يتم ضبط متغير البيئة MONGO_URI. سيتم حفظ مستويات الأعضاء محلياً في ملف database.json.');
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

// هيكل إعدادات السيرفر لـ MongoDB
const configSchema = new mongoose.Schema({
    guildId: String,
    levelChannelId: String,
    roleRewards: [{ roleId: String, messagesNeeded: Number }]
});
const GuildConfigModel = mongoose.model('GuildConfig', configSchema);

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
        if (!localDatabase[guildId].users) localDatabase[guildId].users = {};
        if (!localDatabase[guildId].users[userId]) {
            localDatabase[guildId].users[userId] = { level: 1, xp: 0, messageCount: 0 };
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
            messageCount: data.messageCount
        });
    } else {
        localDatabase[guildId].users[userId] = {
            level: data.level,
            xp: data.xp,
            messageCount: data.messageCount
        };
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

// جلب إعدادات السيرفر
async function getGuildConfig(guildId) {
    if (useMongoDB) {
        let config = await GuildConfigModel.findOne({ guildId });
        if (!config) {
            config = new GuildConfigModel({ guildId, levelChannelId: null, roleRewards: [] });
            await config.save();
        }
        return config;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].config) {
            localDatabase[guildId].config = { levelChannelId: null, roleRewards: [] };
        }
        return localDatabase[guildId].config;
    }
}

// حفظ إعدادات السيرفر
async function saveGuildConfig(guildId, configData) {
    if (useMongoDB) {
        await GuildConfigModel.updateOne({ guildId }, {
            levelChannelId: configData.levelChannelId,
            roleRewards: configData.roleRewards
        });
    } else {
        localDatabase[guildId].config = configData;
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

// التحقق مما إذا كان المستخدم يمتلك صلاحية الإدارة (Administrator) تلقائياً
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

// معالجة الرسائل: نظام الردود التلقائية والخبرة ومكافآت الرتب
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const trimmedMsg = message.content.trim();
    const guildId = message.guild.id;
    const userId = message.author.id;

    // 1. نظام الردود التلقائية
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
        
        const xpToAdd = Math.floor(Math.random() * 11) + 10;
        userData.xp += xpToAdd;

        const xpNeeded = userData.level * 150;
        
        // إذا زاد مستوى العضو (Level Up)
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

            // رسم بطاقة الترقية بالخلفية المرفقة (1280x543)
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

                // البيانات على الصورة بدقة ووضوح تام
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

                // كتابة الآي دي في الأعلى بشكل منسق
                ctx.fillStyle = '#a855f7';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(`ID: ${userId}`, 980, 60);

                const buffer = canvas.toBuffer('image/png');
                const attachment = new AttachmentBuilder(buffer, { name: `levelup-${userId}.png` });

                await announceChannel.send({ 
                    content: `🎉 **تهانينا للتفاعل المميز!**\nلقد كنت في مستوى **${oldLevel}** وأصبحت الآن في مستوى **${newLevel}**!\nالرتبة التفاعلية السابقة: **Level ${oldLevel}** ➡️ الرتبة الجديدة: **Level ${newLevel}**`,
                    files: [attachment] 
                }).catch(() => {});

            } catch (err) {
                console.error(err);
                await announceChannel.send(`🎉 تهانينا ${message.author}! لقد كنت في مستوى **${oldLevel}** وأصبحت الآن في مستوى **${newLevel}**!`).catch(() => {});
            }
        }

        // 2. التحقق من مكافآت الرتب التلقائية بمعدل الرسائل
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

client.on('interactionCreate', async (interaction) => {
    
    // 1. التفاعل مع الأزرار الثلاثية للتذكرة
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
                        value: '`/setup_server` • لتهيئة السيرفر وإنشاء الرومات والرتب.\n`/setup_ticket` • لإرسال بانل التذاكر التفاعلي.\n`/delete_all_channels` • لمسح كافة الرومات بالسيرفر يدوياً.\n`/delete_channel` • لحذف روم محدد.\n`/delete_all_roles` • لمسح جميع الرتب التلقائية بالسيرفر.\n`/publish_rules` • لنشر قوانين السيرفر كبطاقة إمبد.' 
                    },
                    { 
                        name: '📊 أوامر التفاعل والمستويات', 
                        value: '`/rank` • لعرض بطاقة المستوى وعدد رسائل العضو كصورة مخصصة.\n`/set_level_channel` • لتخصيص روم إشعارات زيادة المستوى.\n`/add_role_reward` • لربط رتبة بعدد رسائل محدد للأعضاء.' 
                    },
                    { 
                        name: '🎫 أوامر نظام التذاكر', 
                        value: '`/add` • لإدخال عضو للتذكرة.\n`/remove` • لإزالة عضو من التذكرة.\n`/claim` • لاستلام تذكرة لمتابعتها.\n`/unclaim` • لترك التذكرة ليعود المشرفين لاستلامها.\n`/rename` • لتعديل اسم روم التذكرة.\n`/close` • لإغلاق وحذف التذكرة الحالية.' 
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

        // أمر استخراج بطاقة العضو التفاعلية والمصورة
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

                // جلب الجائزة القادمة وحساب المتبقي من الرسائل
                const config = await getGuildConfig(guild.id);
                let rewardStatusText = 'لا توجد رتب مكافآت متبقية (أنت في القمة! 👑)';
                if (config && config.roleRewards && config.roleRewards.length > 0) {
                    // ترتيب المكافآت لمعرفة أقرب واحدة
                    const sortedRewards = [...config.roleRewards].sort((a, b) => a.messagesNeeded - b.messagesNeeded);
                    const nextReward = sortedRewards.find(r => userData.messageCount < r.messagesNeeded);
                    if (nextReward) {
                        const remaining = nextReward.messagesNeeded - userData.messageCount;
                        const role = guild.roles.cache.get(nextReward.roleId);
                        const roleName = role ? role.name : 'رتبة تفاعلية';
                        rewardStatusText = `بقي ${remaining} رسالة للوصول إلى مكافأة: [ ${roleName} ]`;
                    }
                }

                // إنشاء لوحة الرسم بأبعاد الصورة المرفقة تماماً (1280x543)
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

                // كتابة تفاصيل المستوى وعدد الرسائل الحالية بشكل منسق جداً
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

                // كتابة آي دي العضو في أعلى جهة اليمين
                ctx.fillStyle = '#a855f7';
                ctx.font = 'bold 22px sans-serif';
                ctx.fillText(`ID: ${targetUser.id}`, 980, 60);

                // رسم شريط التقدم للخبرة (Progress Bar)
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

        // أمر تحديد الغرفة المخصصة لرسائل ليفل أب
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

        // أمر ربط الرتبة بعدد الرسائل المطلوبة (مكافأة)
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
    }
});

// جلب إعدادات العضو أو السيرفر الافتراضية
async function getGuildConfig(guildId) {
    if (useMongoDB) {
        let config = await GuildConfigModel.findOne({ guildId });
        if (!config) {
            config = new GuildConfigModel({ guildId, levelChannelId: null, roleRewards: [] });
            await config.save();
        }
        return config;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].config) {
            localDatabase[guildId].config = { levelChannelId: null, roleRewards: [] };
        }
        return localDatabase[guildId].config;
    }
}

// حفظ الإعدادات الافتراضية
async function saveGuildConfig(guildId, configData) {
    if (useMongoDB) {
        await GuildConfigModel.updateOne({ guildId }, {
            levelChannelId: configData.levelChannelId,
            roleRewards: configData.roleRewards
        });
    } else {
        localDatabase[guildId].config = configData;
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

// أمر التهيئة الكامل لإنشاء الرومات و 100 رتبة وتوزيع الصلاحيات الصارمة ونشر إرشادات المستويات التلقائية للجميع
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild, member } = interaction;
    const isAdministrator = member.permissions.has(PermissionFlagsBits.Administrator);

    if (commandName === 'setup_server') {
        if (!isAdministrator) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص لمن يمتلكون صلاحية الإدارة (Administrator) فقط!', ephemeral: true });
        }
        await interaction.reply({ content: '⏳ جاري بدء تهيئة السيرفر بالكامل وتنسيق الرومات وإنشاء 100 رتبة وتوزيع الصلاحيات، يرجى الانتظار...', ephemeral: true });

        try {
            // 1. إنشاء رتب الإدارة الخمسين (50 Management Roles)
            const createdManagementRoles = {};
            for (const roleName of MANAGEMENT_ROLES) {
                const role = await guild.roles.create({ name: roleName, color: 0x3498DB });
                createdManagementRoles[roleName] = role;
                await sleep(150);
            }

            // 2. إنشاء رتب الأعضاء الخمسين (50 Member Roles)
            const createdMemberRoles = {};
            for (const roleName of MEMBER_ROLES) {
                // how
                // 
                // for items
                const role = await guild.roles.create({ name: roleName, color: 0x2ECC71 });
                createdMemberRoles[roleName] = role;
                await sleep(150);
            }

            const ownerRole = createdManagementRoles["Owner"];
            const highAdminRole = createdManagementRoles["High Admin"];
            const adminRole = createdManagementRoles["Admin"];
            const staffRole = createdManagementRoles["Staff"];
            const middlemanRole = createdManagementRoles["Middleman (الوسيط)"];
            const mmManagerRole = createdManagementRoles["Middleman Manager"];

            // 3. البدء في إنشاء الرومات مع تطبيق الصلاحيات بشكل صارم ومنع التداخل
            for (const group of STRUCTURE) {
                let category = null;
                let overwrites = [];

                if (group.category === "👑 | Owner") {
                    overwrites = [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
                    ];
                    if (ownerRole) overwrites.push({ id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                } else if (group.category === "🛠️ | Staff" || group.category === "🛠️ | Logo") {
                    overwrites = [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
                    ];
                    if (staffRole) overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (highAdminRole) overwrites.push({ id: highAdminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (ownerRole) overwrites.push({ id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                } else if (group.category === "⚖️ | BRQ - Meditators") {
                    overwrites = [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
                    ];
                    if (middlemanRole) overwrites.push({ id: middlemanRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (mmManagerRole) overwrites.push({ id: mmManagerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (staffRole) overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (adminRole) overwrites.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
                    if (ownerRole) overwrites.push({ id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
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

            // 4. تهيئة وضبط مكافآت الرتب التلقائية فوراً وحفظها في قاعدة البيانات
            const config = await getGuildConfig(guild.id);
            config.roleRewards = [];

            // خريطة بمكافآت الرتب التلقائية الافتراضية المناسبة للأعضاء
            const defaultRewardsLayout = [
                { name: "Level 1 Member", messages: 50 },
                { name: "Level 5 Member", messages: 150 },
                { name: "Level 10 Member", messages: 300 },
                { name: "Level 15 Member", messages: 500 },
                { name: "Level 20 Member", messages: 750 },
                { name: "Level 25 Member", messages: 1000 },
                { name: "VIP Elite", messages: 1500 },
                { name: "VIP Legendary", messages: 2000 },
                { name: "VIP Mythic", messages: 3000 }
            ];

            let rewardListDescription = '';
            for (const item of defaultRewardsLayout) {
                const role = createdMemberRoles[item.name];
                if (role) {
                    config.roleRewards.push({ roleId: role.id, messagesNeeded: item.messages });
                    rewardListDescription += `• عند الوصول إلى **${item.messages}** رسالة ⬅️ تُمنح تلقائياً رتبة **${role.name}**\n`;
                }
            }
            await saveGuildConfig(guild.id, config);

            // 5. إنشاء الغرفة المخصصة لإرشادات المستويات ونشر الإرشادات بها تلقائياً للوضوح والشفافية التامة
            const guideCategory = guild.channels.cache.find(c => c.name === '🌍 | Start' && c.type === ChannelType.GuildCategory);
            const guideChannel = await guild.channels.create({
                name: '🔒・إرشادات • المستويات',
                type: ChannelType.GuildText,
                parent: guideCategory ? guideCategory.id : null
            });

            const guideEmbed = new EmbedBuilder()
                .setTitle('📊 دليل ومكافآت نظام المستويات والتفاعل بالسيرفر')
                .setDescription('مرحباً بكم جميعاً! تم إعداد وتفعيل نظام تفاعلي متطور يمنحكم نقاط خبرة ورتباً بشكل ذاتي عند تفاعلكم ومشاركتكم في السيرفر لضمان الشفافية والوضوح للجميع.')
                .setColor(0xa855f7)
                .addFields(
                    { 
                        name: '📈 كيف يعمل نظام المستويات؟', 
                        value: 'كل رسالة ترسلها في رومات السيرفر تمنحك نقاط خبرة (XP) عشوائية وتزيد معدل رسائلك اليومي والتراكمي. يمكنك دائماً التحقق من بطاقتك الشخصية وصورتك عبر كتابة الأمر: `/rank`' 
                    },
                    { 
                        name: '🎁 مكافآت الرتب التفاعلية التلقائية (Milestones):', 
                        value: rewardListDescription || 'سيتم إدراج الرتب هنا تلقائياً بمجرد إتمام التثبيت.' 
                    },
                    { 
                        name: '🏆 الترقية الفورية والجوائز:', 
                        value: 'يقوم البوت تلقائياً بتحديث رتبتك ومنحك الرتب التفاعلية بمجرد بلوغك لعدد الرسائل الموضح أعلاه فوراً مع منشن وإشعار مصور رائع يظهر لجميع الأعضاء.' 
                    }
                )
                .setFooter({ text: 'نتمنى لكم قضاء وقت ممتع وتفاعل استثنائي في BRQ Community' })
                .setTimestamp();

            await guideChannel.send({ embeds: [guideEmbed] });

            await interaction.followUp({ content: '✅ تم الانتهاء من إعداد الرومات وتوزيع الصلاحيات وإنشاء 100 رتبة ونشر دليل المستويات بنجاح!', ephemeral: true });

        } catch (e) {
            console.error(e);
            await interaction.followUp({ content: `❌ حدث خطأ أثناء إعداد الرومات: ${e.message}`, ephemeral: true });
        }
    }
});

const TOKEN = process.env.DISCORD_TOKEN || 'ضع_توكن_البوت_الخاص_بِك_هنا';
client.login(TOKEN);