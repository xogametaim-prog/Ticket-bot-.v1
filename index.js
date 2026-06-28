const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    EmbedBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    REST,
    Routes,
    PermissionFlagsBits,
    Events,
    ChannelType,
    MessageFlags
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose'); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ==================== إعداد وتوصيل قاعدة بيانات MongoDB ====================
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => console.error('Failed to connect to MongoDB:', err));

const UserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    accessToken: { type: String, required: true },
    username: { type: String },
    guildId: { type: String }
});

const VerifiedUser = mongoose.model('VerifiedUser', UserSchema);

// نظام حفظ عداد التذاكر التراكمي لترقيم التكتات تصاعدياً
const CounterSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', CounterSchema);

async function getNextSequence(name) {
    const counter = await Counter.findOneAndUpdate(
        { id: name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}
// ====================================================================

const tempSetup = new Map(); 
const dmSetup = new Map();
const verifyBroadcastSetup = new Map();
const ticketInactivityTimers = new Map(); // لتتبع خمول التذاكر لمدة 45 دقيقة

let liveCounterMessageId = null; 
let liveCounterChannelId = null; 
let logVerifyChannelId = null; 
let logTicketChannelId = null; 

app.get('/', (req, res) => res.send('OAuth2 Verify & Ticket AI Bot is Running!'));

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    const guildId = req.query.state; 
    
    if (!code) {
        return res.send('<h1>❌ Verification Failed. Please try again.</h1>');
    }

    try {
        const tokenResponse = await axios.post('https://discord.com/api/v10/oauth2/token', new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET, 
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `https://${req.hostname}/callback` 
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;

        const userResponse = await axios.get('https://discord.com/api/v10/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userId = userResponse.data.id;
        const username = userResponse.data.username;

        await VerifiedUser.findOneAndUpdate(
            { userId: userId },
            { accessToken: accessToken, username: username, guildId: guildId || 'Unknown' },
            { upsert: true, new: true }
        );

        if (logVerifyChannelId) {
            const logChannel = client.channels.cache.get(logVerifyChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ عضو جديد أتم التحقق الذاتي')
                    .setColor('#2ecc71')
                    .addFields(
                        { name: '👤 العضو', value: `<@${userId}> | \`${username}\``, inline: true },
                        { name: '🆔 أيدي الحساب', value: `\`${userId}\``, inline: true },
                        { name: '📺 السيرفر المصدر', value: guildId ? `\`أيدي: ${guildId}\`` : '`غير معروف`', inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
            }
        }

        if (liveCounterChannelId && liveCounterMessageId) {
            const counterChannel = client.channels.cache.get(liveCounterChannelId);
            if (counterChannel) {
                const totalCount = await VerifiedUser.countDocuments();
                const counterMessage = await counterChannel.messages.fetch(liveCounterMessageId).catch(() => null);
                if (counterMessage) {
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle('📊 عداد التحقق المباشر | Live Counter')
                        .setDescription(`🟢 تم تحديث العداد تلقائياً وبشكل حي!\n\n👥 العدد الإجمالي للأعضاء الموثقين والجاهزين للسحب في السيرفر هو:\n🌟 **\`${totalCount}\` عضو مفعّل** 🌟`)
                        .setColor('#2ecc71')
                        .setTimestamp();
                    await counterMessage.edit({ embeds: [updatedEmbed] }).catch(() => {});
                }
            }
        }

        if (guildId) {
            const guild = client.guilds.cache.get(guildId);
            if (guild) {
                const member = await guild.members.fetch(userId).catch(() => null);
                if (member) {
                    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
                    if (verifiedRole) {
                        await member.roles.add(verifiedRole).catch(err => console.error(err));
                    }
                }
            }
        }

        res.send(`<h1>✅ Verified Successfully! Thank you ${username}. You can now close this tab.</h1>`);
    } catch (error) {
        console.error('Error during callback:', error.response ? error.response.data : error.message);
        res.send('<h1>❌ Error during verification.</h1>');
    }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

// الاختصارات والأوامر الأساسية
const VERIFY_SETUP_PREFIX = '-vr';    
const COUNT_VERIFY_PREFIX = '-vf';    
const PULL_MEMBERS_PREFIX = '-pull';  
const LOG_VERIFY_PREFIX = '-tv';      
const LIVE_COUNTER_PREFIX = '-lc';    

const TICKET_SETUP_PREFIX = '-st'; 
const LOG_TICKET_PREFIX = '-lgt';  

const DM_BROADCAST_PREFIX = '-t';      
const DM_VERIFY_PREFIX = '-vt';         

// ==================== قاعدة بيانات الذكاء الاصطناعي والرد التلقائي للتذاكر ====================
const AUTO_RESPONSES = [
    { keys: ['سعر', 'اسعار', 'الاسعار', 'بكم', 'اشتراك'], reply: '💳 **أهلاً بك! بخصوص أسعار المنتجات والاشتراكات، يمكنك مراجعة روم المتجر المخصص، أو كتابة تفاصيل طلبك هنا وسيقوم المشرف المسؤول بالرد عليك وتلبية طلبك قريباً.**' },
    { keys: ['رتبه', 'رتبة', 'رتب', 'رولات'], reply: '👑 **أهلاً بك! للحصول على رتبة معينة أو الاستفسار عن الشروط المخصصة للرتب الإشرافية والتفاعلية، يرجى كتابة اسم الرتبة المطلوبة وسيقوم طاقم الإدارة بفحص حسابك ومساعدتك فوراً.**' },
    { keys: ['مشكله', 'مشكلة', 'خطا', 'خطأ', 'ما يشتغل'], reply: '🛠️ **أهلاً بك! يؤسفنا سماع ذلك. يرجى إرسال لقطة شاشة (Screenshot) توضح المشكلة أو الخطأ الذي يظهر لك بالتفصيل بداخل هذا الشات، وسيقوم فريق الدعم الفني بحل المشكلة لك في أقرب وقت.**' },
    { keys: ['كيف', 'طريقة', 'طريقه'], reply: '❓ **أهلاً بك! يرجى توضيح استفسارك بالتفصيل (كيف تفعل ماذا بالتحديد؟)، لكي نتمكن من شرح الطريقة لك بدقة وبشكل فوري.**' }
];
// =========================================================================================

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

async function createVerifyRoles(guild) {
    try {
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
        if (!verifiedRole) {
            await guild.roles.create({
                name: 'Verified',
                color: '#2ecc71',
                reason: 'Auto-created role for verified users'
            });
        }

        let ownerRole = guild.roles.cache.find(r => r.name === 'Ownerv');
        if (!ownerRole) {
            await guild.roles.create({
                name: 'Ownerv',
                color: '#e74c3c',
                permissions: [PermissionFlagsBits.Administrator],
                reason: 'Auto-created control role for verification administrators'
            });
        }
    } catch (error) {
        console.error(error);
    }
}

client.once('ready', async () => {
    console.log(`Verify & Ticket AI Bot is Online as ${client.user.tag}`);
    client.guilds.cache.forEach(async (guild) => {
        await createVerifyRoles(guild);
    });
});

client.on(Events.GuildCreate, async (guild) => {
    await createVerifyRoles(guild);
});

// دالة لتحديث أو إعادة تشغيل مؤقت الخمول (45 دقيقة) للتذكرة المفتوحة
function resetInactivityTimer(channel, memberId) {
    if (ticketInactivityTimers.has(channel.id)) {
        clearTimeout(ticketInactivityTimers.get(channel.id));
    }

    // 45 دقيقة بالملي ثانية = 45 * 60 * 1000 = 2,700,000 مللي ثانية
    const timer = setTimeout(async () => {
        const member = channel.guild.members.cache.get(memberId);
        if (member) {
            await channel.send(`🔔 ${member}، **تنبيه خمول:** لقد مضت 45 دقيقة دون أي تفاعل في هذه التذكرة. إذا لم تكن بحاجة إليها، يرجى كتابة **(سكرها)** أو **(اغلقها)** أو الضغط على زر الإغلاق المخصص ليتم تصفية الروم وحفظ اللوج.`);
        }
    }, 2700000);

    ticketInactivityTimers.set(channel.id, timer);
}

// معالجة اللوج والتقييمات والتذاكر المغلّقة
async function sendTicketLog(guild, channelName, creatorId, claimerId, closerUser) {
    if (!logTicketChannelId) return;
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const creator = guild.members.cache.get(creatorId);
    const claimer = claimerId ? guild.members.cache.get(claimerId) : 'لا يوجد (لم تُستلم التذكرة)';

    const logEmbed = new EmbedBuilder()
        .setTitle('📂 سجل إغلاق تذكرة | Ticket Logs')
        .setColor('#e74c3c')
        .addFields(
            { name: '📝 اسم التذكرة', value: `\`${channelName}\``, inline: true },
            { name: '👤 منشئ التذكرة', value: creator ? `${creator}` : `\`أيدي: ${creatorId}\``, inline: true },
            { name: '🙋‍♂️ الإداري المستلم', value: claimerId ? `${claimer}` : '`لم يتم الاستلام`', inline: true },
            { name: '🔒 مغلق التذكرة', value: `${closerUser}`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [logEmbed] });
    } catch (err) {
        console.error(err);
    }
}

async function sendRatingLog(guild, creator, rating, claimerName) {
    if (!logTicketChannelId) return; 
    const logChannel = guild.channels.cache.get(logTicketChannelId);
    if (!logChannel) return;

    const ratingStars = '⭐'.repeat(rating);

    const embed = new EmbedBuilder()
        .setTitle('⭐ تقييم تكت فني جديد | Feedback')
        .setColor('#f1c40f')
        .addFields(
            { name: '👤 العضو المقيم', value: `${creator}`, inline: true },
            { name: '🙋‍♂️ الإداري المسؤول', value: `\`${claimerName}\``, inline: true },
            { name: '📊 التقييم المستلم', value: `${ratingStars} (${rating}/5)`, inline: true }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
    }
}

// دالة تنفيذ الإغلاق الفوري للتكت لتفادي التكرار
async function executeTicketClose(channel, closerUser) {
    const topic = channel.topic || '';
    const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
    const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;

    if (ticketInactivityTimers.has(channel.id)) {
        clearTimeout(ticketInactivityTimers.get(channel.id));
        ticketInactivityTimers.delete(channel.id);
    }

    await channel.send('⚠️ **جاري إرسال اللوج وحذف التذكرة خلال 5 ثوانٍ يدوياً...**');
    await sendTicketLog(channel.guild, channel.name, creatorId, claimerId, closerUser);

    setTimeout(async () => {
        await channel.delete().catch(() => {});
    }, 5000);
}

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim();
    const isAuthorized = message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.roles.cache.some(r => r.name === 'Ownerv');

    // ==================== ميزة الرد التلقائي الذكي ومراقبة خمول وكلام التذاكر ====================
    if (message.channel.name.startsWith('ticket-')) {
        const topic = message.channel.topic || '';
        const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
        
        // إعادة تنشيط مؤقت الخمول (45 دقيقة) فور ورود أي رسالة جديدة من العضو
        if (message.author.id === creatorId) {
            resetInactivityTimer(message.channel, creatorId);
        }

        // الاستماع لأوامر الإغلاق النصية من العضو
        if (message.author.id === creatorId && (content === 'سكرها' || content === 'اغلقها' || content === 'أغلقها')) {
            return await executeTicketClose(message.channel, message.author);
        }

        let matched = false;
        for (const response of AUTO_RESPONSES) {
            if (response.keys.some(key => content.toLowerCase().includes(key))) {
                await message.channel.sendTyping();
                setTimeout(async () => {
                    await message.reply({ content: response.reply });
                }, 1500);
                matched = true;
                break;
            }
        }
        if (!matched && !topic.includes('ai_notified:true')) {
            await message.channel.setTopic(`${topic};ai_notified:true`);
            await message.channel.send({ content: `🤖 **أهلاً بك يا ${message.author}! أنا البوت المساعد التلقائي.\nيرجى كتابة تفاصيل استفسارك أو مشكلتك بدقة بداخل الشات، وسأحاول إجابتك فوراً وصامتاً أو تنبيه طاقم الإدارة لمساعدتك.**` });
        }
    }
    // =========================================================================================

    // 1. الإعداد التفاعلي لبوكس التحقق والزر بالسؤال عن الرابط
    if (content === VERIFY_SETUP_PREFIX) {
        if (!isAuthorized) {
            return message.reply('❌ عذراً، هذا الأمر مخصص للإدارة أو أصحاب رتبة **Ownerv** فقط.');
        }

        const setupState = { step: 'get_url', messagesToDelete: [] };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, 🛡️ **يرجى كتابة أو لصق رابط التحقق (OAuth2 URL) الخاص بك الآن في الشات:**`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 'get_url') {
            const inputUrl = message.content.trim();
            if (!inputUrl.startsWith('http')) {
                const errPrompt = await message.reply('❌ رابط غير صحيح. يرجى لصق رابط OAuth2 صحيح يبدأ بـ http:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            verifyUrl = inputUrl;
            
            const finalUrl = `${verifyUrl}&state=${message.guild.id}`;

            const embed = new EmbedBuilder()
                .setTitle('🛡️ Server Verification / التحقق الذاتي')
                .setDescription('Please click the button below to verify yourself and get full access to the server.\n\nالرجاء الضغط على الزر أدناه لإتمام التحقق وتفعيل حسابك بالكامل بداخل السيرفر الحصول على رتبة **Verified**.')
                .setColor('#2b2d31');

            const verifyButton = new ButtonBuilder()
                .setLabel('Verify yourself')
                .setURL(finalUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✅');

            const row = new ActionRowBuilder().addComponents(verifyButton);

            await message.channel.send({ embeds: [embed], components: [row] });

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
            return;
        }

        // مصلح إعداد التذاكر التفاعلي المتعدد -st
        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 10) {
                const errPrompt = await message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 10 فقط:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            const nextPrompt = await message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, description: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_desc';
            const nextPrompt = await message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n📝 يرجى كتابة **الشرح/الوصف** الذي تريده أن يظهر كشرح فرعي لهذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_desc') {
            const desc = message.content.trim();
            state.options[state.currentOptionIndex].description = desc;
            state.step = 'get_option_role';
            const nextPrompt = await message.reply(`✅ تم حفظ الوصف.\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن تذاكر هذا القسم:`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_option_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                const errPrompt = await message.reply('❌ أيدي الرتبة غير صحيح. يرجى كتابة أيدي رتبة صحيح وموجود بالسيرفر:');
                state.messagesToDelete.push(errPrompt.id);
                return;
            }

            state.options[state.currentOptionIndex].roleId = roleId;
            state.currentOptionIndex++;

            if (state.currentOptionIndex < state.optionsCount) {
                state.step = 'get_option_label';
                const nextPrompt = await message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل للقسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم المربع / الخيار**:`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            } else {
                state.step = 'get_image';
                const nextPrompt = await message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼 يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
                state.messagesToDelete.push(nextPrompt.id);
                return;
            }
        }

        if (state.step === 'get_image') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }
            state.step = 'get_category';
            const nextPrompt = await message.reply(`✅ تم حفظ إعدادات الصورة.\n\n📂 يرجى كتابة **أيدي القسم (Category ID)** الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
            state.messagesToDelete.push(nextPrompt.id);
            return;
        }

        if (state.step === 'get_category') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            const embed = new EmbedBuilder()
                .setTitle('بوابة الدعم الفني والمساعدات | Support Portal')
                .setDescription(`يرجى تحديد القسم المناسب لمشكلتك من القائمة المنسدلة أدناه لفتح تذكرة مباشرة مع الطاقم المختص ومتابعتك.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

            const uniqueId = Date.now().toString().slice(-4);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`multi_t_menu_${uniqueId}_${state.categoryId || 'none'}`)
                .setPlaceholder('الرجاء اختيار قسم لفتح التذكرة...');

            state.options.forEach(opt => {
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setValue(`opaction_${opt.roleId}`) 
                        .setLabel(opt.label)
                        .setDescription(opt.description || `تذكرة بقسم ${opt.label}`)
                        .setEmoji('🎫')
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            
            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            tempSetup.delete(message.author.id);
        }
    }

    // تعيين قناة لوج التحقق (-tv [#القناة])
    if (content.startsWith(LOG_VERIFY_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(LOG_VERIFY_PREFIX.length).trim().split(/ +/);
        const channelMention = message.mentions.channels.first();
        const inputId = args[0];

        const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply('❌ يرجى منشن قناة نصية صحيحة أو وضع الأيدي لتعيين قناة لوج التحقق:');
        }

        logVerifyChannelId = targetChannel.id;
        await message.reply(`✅ **تم بنجاح تعيين قناة لوج التحقق على: ${targetChannel}**`);
        await message.delete().catch(() => {});
        return;
    }

    // تعيين قناة لوج التذاكر المغلّقة (-lgt [#القناة])
    if (content.startsWith(LOG_TICKET_PREFIX)) {
        if (!isAuthorized) return;
        logTicketChannelId = await handleConfigSetup(message, LOG_TICKET_PREFIX, 'سجلات التذاكر (-lgt)');
        return;
    }

    if (content === LIVE_COUNTER_PREFIX) {
        if (!isAuthorized) return;

        try {
            const totalCount = await VerifiedUser.countDocuments();
            const counterEmbed = new EmbedBuilder()
                .setTitle('📊 عداد التحقق المباشر | Live Counter')
                .setDescription(`🟢 جاري بدء المراقبة وتحديث الإحصائيات الحية...\n\n👥 العدد الإجمالي للأعضاء الموثقين والجاهزين للسحب في السيرفر هو:\n🌟 **\`${totalCount}\` عضو مفعّل** 🌟`)
                .setColor('#2ecc71')
                .setTimestamp();

            const sentMessage = await message.channel.send({ embeds: [counterEmbed] });
            liveCounterMessageId = sentMessage.id;
            liveCounterChannelId = message.channel.id;

            await message.reply('✅ **تم بنجاح تفعيل عداد التحقق المباشر في هذه القناة!**');
            await message.delete().catch(() => {});
        } catch (err) {
            console.error(err);
        }
        return;
    }

    if (content === COUNT_VERIFY_PREFIX) {
        if (!isAuthorized) return;
        try {
            const count = await VerifiedUser.countDocuments();
            await message.reply(`📊 **إحصائية التحقق المطور (MongoDB):**\nالعدد الكلي للأعضاء الموثقين المحفوظين والجاهزين للسحب هو: \`${count}\` عضو.`);
        } catch (err) {
            console.error(err);
            await message.reply('❌ حدث خطأ أثناء محاولة جلب الإحصائية من قاعدة البيانات.');
        }
        return;
    }

    if (content.startsWith(PULL_MEMBERS_PREFIX)) {
        if (!isAuthorized) return;

        const args = content.slice(PULL_MEMBERS_PREFIX.length).trim().split(/ +/);
        const targetGuildId = args[0] || message.guild.id; 

        try {
            const totalCount = await VerifiedUser.countDocuments();

            if (totalCount === 0) {
                return message.reply('❌ لا يوجد أي أعضاء موثقين مسجلين في قاعدة البيانات حالياً لسحبهم.');
            }

            const targetGuild = client.guilds.cache.get(targetGuildId);
            if (!targetGuild) {
                return message.reply('❌ البوت ليس موجوداً بداخل السيرفر المستهدف، يرجى دعوة البوت أولاً.');
            }

            const statusMsg = await message.channel.send(`⏳ **جاري جلب الأعضاء وبدء سحب وإدخال \`${totalCount}\` عضو إلى السيرفر المستهدف...**`);

            let successCount = 0;
            let failCount = 0;
            let alreadyInCount = 0;

            const allVerifiedUsers = await VerifiedUser.find();

            let index = 0;
            const interval = setInterval(async () => {
                if (index >= allVerifiedUsers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتملت عملية سحب الأعضاء بنجاح!**\n\n📬 تم إدخال: \`${successCount}\` عضو.\n🔄 كانوا موجودين بالسيرفر سابقاً: \`${alreadyInCount}\` عضو.\n❌ فشل سحبهم (انتهى توكن حسابهم): \`${failCount}\` عضو.`);
                    return;
                }

                const userData = allVerifiedUsers[index];
                const isMember = targetGuild.members.cache.has(userData.userId);

                if (isMember) {
                    alreadyInCount++;
                } else {
                    try {
                        await axios.put(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${userData.userId}`, {
                            access_token: userData.accessToken
                        }, {
                            headers: {
                                Authorization: `Bot ${TOKEN}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        successCount++;
                    } catch (err) {
                        failCount++;
                    }
                }

                await statusMsg.edit(`⏳ **جاري السحب الفوري للأعضاء...**\n\n📊 التقدم الحالي: \`${index + 1}/${allVerifiedUsers.length}\` عضو.\n✅ تم الإدخال: \`${successCount}\` | 🔄 موجود سابقاً: \`${alreadyInCount}\` | ❌ فشل: \`${failCount}\``);
                index++;
            }, 1200); 

        } catch (err) {
            console.error(err);
            await message.reply('❌ حدث خطأ غير متوقع أثناء محاولة بدء عملية السحب.');
        }
        return;
    }

    if (content === DM_BROADCAST_PREFIX) {
        if (!isAuthorized) return;

        const broadcastState = { step: 1, title: null, description: null, imageUrl: null, messagesToDelete: [] };
        dmSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست الخاص الذكي مع المنشن (أونلاين أولاً)**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان** رسالة البرودكاست:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (dmSetup.has(message.author.id)) {
        const state = dmSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/3]:** يرجى كتابة **الوصف (محتوى الرسالة)**:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();
            state.step = 3;
            const prompt3 = await message.reply(`✅ تم حفظ الوصف.\n\n**الخطوة [3/3] الأخيرة:** ضع رابط صورة للرسالة (أو اكتب \`لا\` للإلغاء):`);
            state.messagesToDelete.push(prompt3.id);
            return;
        }

        if (state.step === 3) {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }

            const statusMsg = await message.channel.send('⏳ **جاري بدء عملية البرودكاست التدريجي والآمن مع الإشارة للعضو (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل البرودكاست بنجاح!**\n\n📬 تم الإرسال إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`👋 مرحباً بك يا ${targetMember}!\n\n${state.description}`)
                    .setColor('#5865F2')
                    .setTimestamp();

                if (state.imageUrl) {
                    personalEmbed.setImage(state.imageUrl);
                }

                try {
                    await targetMember.send({ embeds: [personalEmbed] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                const progressType = index < onlineMembers.length ? '🟢 جاري إرسال المتصلين (Online)' : '⚫ جاري إرسال غير المتصلين (Offline)';
                await statusMsg.edit(`⏳ **${progressType}...**\n\n📊 التقدم الحالي: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2500); 

            dmSetup.delete(message.author.id);
            return;
        }
    }

    if (content === DM_VERIFY_PREFIX) {
        if (!isAuthorized) return;

        const broadcastState = { step: 1, title: null, description: null, messagesToDelete: [] };
        verifyBroadcastSetup.set(message.author.id, broadcastState);

        const prompt = await message.channel.send(`${message.author}, 📢 **بدء إعداد برودكاست رابط التحقق الذاتي (أونلاين أولاً)**\n\n**الخطوة [1/2]:** يرجى كتابة **عنوان** رسالة التحقق:`);
        broadcastState.messagesToDelete.push(message.id, prompt.id);
        return;
    }

    if (verifyBroadcastSetup.has(message.author.id)) {
        const state = verifyBroadcastSetup.get(message.author.id);
        state.messagesToDelete.push(message.id);

        if (state.step === 1) {
            state.title = message.content.trim();
            state.step = 2;
            const prompt2 = await message.reply(`✅ تم حفظ العنوان.\n\n**الخطوة [2/2] الأخيرة:** يرجى كتابة **وصف وحث الأعضاء** على إتمام التحقق:`);
            state.messagesToDelete.push(prompt2.id);
            return;
        }

        if (state.step === 2) {
            state.description = message.content.trim();

            const statusMsg = await message.channel.send('⏳ **جاري بدء برودكاست رابط التحقق التدريجي والآمن مع الإشارة للعضو (أونلاين أولاً)...**');

            setTimeout(async () => {
                for (const msgId of state.messagesToDelete) {
                    await message.channel.messages.delete(msgId).catch(() => {});
                }
            }, 1000);

            const members = await message.guild.members.fetch({ withPresences: true });
            const allMembers = Array.from(members.values()).filter(m => !m.user.bot);

            const onlineMembers = allMembers.filter(m => m.presence && m.presence.status !== 'offline');
            const offlineMembers = allMembers.filter(m => !m.presence || m.presence.status === 'offline');

            const sortedMembers = [...onlineMembers, ...offlineMembers];

            let sentCount = 0;
            let failedCount = 0;
            let index = 0;

            const finalUrl = `${verifyUrl}&state=${message.guild.id}`;

            const verifyButton = new ButtonBuilder()
                .setLabel('Verify yourself')
                .setURL(finalUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('✅');

            const row = new ActionRowBuilder().addComponents(verifyButton);

            const interval = setInterval(async () => {
                if (index >= sortedMembers.length) {
                    clearInterval(interval);
                    await statusMsg.edit(`✅ **اكتمل برودكاست رابط التحقق بنجاح!**\n\n📬 تم إرسال الرابط إلى: \`${sentCount}\` عضو.\n❌ فشل الإرسال لـ: \`${failedCount}\` عضو.`);
                    return;
                }

                const targetMember = sortedMembers[index];
                
                const personalEmbed = new EmbedBuilder()
                    .setTitle(state.title)
                    .setDescription(`👋 مرحباً بك يا ${targetMember}!\n\n${state.description}\n\nالرجاء الضغط على الزر أدناه لإتمام التحقق وتفعيل حسابك بالكامل بداخل السيرفر الحصول على رتبة **Verified**.\n\n🛡️ Server Verification / التحقق الذاتي`)
                    .setColor('#2b2d31')
                    .setTimestamp();

                try {
                    await targetMember.send({ embeds: [personalEmbed], components: [row] });
                    sentCount++;
                } catch (err) {
                    failedCount++;
                }

                const progressType = index < onlineMembers.length ? '🟢 جاري إرسال المتصلين (Online)' : '⚫ جاري إرسال غير المتصلين (Offline)';
                await statusMsg.edit(`⏳ **${progressType}...**\n\n📊 التقدم الحالي: \`${index + 1}/${sortedMembers.length}\` عضو.\n✅ تم الإرسال: \`${sentCount}\` | ❌ فشل: \`${failedCount}\``);
                index++;
            }, 2500); 

            verifyBroadcastSetup.delete(message.author.id);
            return;
        }
    }

    // إعداد التذاكر المتعددة تفاعلياً (-st)
    if (content === TICKET_SETUP_PREFIX) {
        if (!isAuthorized) return;

        const setupState = { 
            step: 'get_count',
            optionsCount: 0,
            currentOptionIndex: 0,
            options: [], 
            imageUrl: null,
            categoryId: null,
            messagesToDelete: [] 
        };
        tempSetup.set(message.author.id, setupState);

        const prompt = await message.channel.send(`${message.author}, ⚙️ **بدء إعداد بوكس تذاكر مخصص بالكامل**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس؟ (اكتب رقماً من **1 إلى 10**):`);
        setupState.messagesToDelete.push(message.id, prompt.id);
        return;
    }
});

// دالة إعداد لوج التذاكر
async function handleConfigSetup(message, prefix, name) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const channelMention = message.mentions.channels.first();
    const inputId = args[0];

    const targetChannel = channelMention || message.guild.channels.cache.get(inputId);

    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
        message.reply(`❌ يرجى منشن قناة نصية صحيحة أو وضع أيدي القناة لتعيين قناة **${name}**:`);
        return null;
    }

    await message.reply(`✅ **تم بنجاح ربط وتعيين قناة ${name} على: ${targetChannel}**`);
    await message.delete().catch(() => {});
    return targetChannel.id;
}

client.on('interactionCreate', async interaction => {
    // فتح تكت من القوائم المنسدلة المتعددة المستقلة مع الترقيم التلقائي
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            const selectedValue = interaction.values[0];
            const targetRoleId = selectedValue.replace('opaction_', '');

            const guild = interaction.guild;
            const member = interaction.member;

            const existingChannel = guild.channels.cache.find(c => c.name.startsWith('ticket-') && c.name.endsWith(member.user.username));
            if (existingChannel) {
                return interaction.editReply({ content: `❌ لا يمكنك فتح تذكرة جديدة؛ لأن لديك تذكرة مفتوحة بالفعل وهي: ${existingChannel}` });
            }

            const permissionOverwrites = [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ];

            if (targetRoleId && targetRoleId !== 'none') {
                permissionOverwrites.push({
                    id: targetRoleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                });
            }

            try {
                // ميزة ترقيم التذاكر تلقائياً (تصاعدياً) بدلاً من تسميتها باسم العضو
                const ticketNumber = await getNextSequence('tickets');
                const paddedNumber = String(ticketNumber).padStart(4, '0'); // لتنسيق الأرقام مثل 0001, 0002...

                const channel = await guild.channels.create({
                    name: `ticket-${paddedNumber}`, // الروم يظهر مرقماً بدقة
                    type: ChannelType.GuildText,
                    parent: targetCategoryId,
                    permissionOverwrites: permissionOverwrites
                });

                await channel.setTopic(`creator_id:${member.id}`);

                // بدء تشغيل مؤقت الخمول (45 دقيقة) للتذكرة المفتوحة تلقائياً لمنع الهجر
                resetInactivityTimer(channel, member.id);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('بوابة المساعدة الفنية والخدمات | Ticket Open')
                    .setDescription(`تفضل يا ${member}، كيف يمكننا مساعدتك اليوم؟\n\n💬 **سؤال هام:** هل قمت بقراءة الرومات والقوانين أولاً؟ إذا لم يكن هناك رومات يرجى توضيح طلبك مباشرة في الشات لخدمتك.\n\n🤖 **ملاحظة:** البوت المساعد مفعّل بداخل هذا الروم وسيستمع لاستفسارك ويحاول إجابتك فوراً وصامتاً!`)
                    .setColor('#5865F2')
                    .setTimestamp();

                // أزرار التحكم الكاملة والمطلوبة من قبلك داخل التكت المفتوح
                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_custom_ticket_${targetRoleId}`)
                    .setLabel('استلام التكت')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const alertStaffButton = new ButtonBuilder()
                    .setCustomId(`alert_staff_btn_${targetRoleId}`)
                    .setLabel('تنبيه الإدارة المستلمة')
                    .setStyle(ButtonStyle.Warning)
                    .setEmoji('⚠️');

                const alertUserButton = new ButtonBuilder()
                    .setCustomId(`alert_user_btn_${targetRoleId}`)
                    .setLabel('تنبيه العضو')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔔');

                const requestCloseButton = new ButtonBuilder()
                    .setCustomId(`request_close_btn_${targetRoleId}`)
                    .setLabel('طلب إغلاق التكت')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🛑');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_custom_ticket_${targetRoleId}`)
                    .setLabel('إغلاق التكت')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                // دمج الأزرار بحد أقصى 5 أزرار في السطر الواحد
                const row1 = new ActionRowBuilder().addComponents(claimButton, alertStaffButton, alertUserButton, requestCloseButton, closeButton);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row1] 
                });

                await interaction.editReply({ content: `تم فتح تذكرتك بنجاح في القناة: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إنشاء التذكرة.' });
            }
        }
    }

    if (interaction.isButton()) {
        const customId = interaction.customId;

        // 1. زر استلام التكت
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferUpdate();

            const topic = interaction.channel.topic || '';
            const creatorId = topic.split('creator_id:')[1]?.split(';')[0] || '';
            
            await interaction.channel.setTopic(`creator_id:${creatorId};claimed_by:${member.id};claimer_name:${member.user.username}`);

            const oldEmbed = interaction.message.embeds[0];
            const updatedEmbed = EmbedBuilder.from(oldEmbed)
                .addFields({ name: 'المشرف المستلم', value: `👤 تم الاستلام بواسطة: ${member}` });

            const disabledClaimButton = new ButtonBuilder()
                .setCustomId('claimed_disabled_btn')
                .setLabel(`مستلمة بواسطة ${member.user.username}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true);

            // جلب الأزرار الأخرى وحظر إظهار الـ Lag
            const alertStaffButton = new ButtonBuilder().setCustomId(`alert_staff_btn_${targetRoleId}`).setLabel('تنبيه الإدارة المستلمة').setStyle(ButtonStyle.Warning).setEmoji('⚠️');
            const alertUserButton = new ButtonBuilder().setCustomId(`alert_user_btn_${targetRoleId}`).setLabel('تنبيه العضو').setStyle(ButtonStyle.Secondary).setEmoji('🔔');
            const requestCloseButton = new ButtonBuilder().setCustomId(`request_close_btn_${targetRoleId}`).setLabel('طلب إغلاق التكت').setStyle(ButtonStyle.Secondary).setEmoji('🛑');
            const closeButton = new ButtonBuilder().setCustomId(`close_custom_ticket_${targetRoleId}`).setLabel('إغلاق التكت').setStyle(ButtonStyle.Danger).setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, alertStaffButton, alertUserButton, requestCloseButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // 2. زر تنبيه الإدارة المستلمة (⚠️)
        if (customId.startsWith('alert_staff_btn_')) {
            const topic = interaction.channel.topic || '';
            const claimerId = topic.includes('claimed_by:') ? topic.split('claimed_by:')[1].split(';')[0] : null;

            if (!claimerId) {
                return interaction.reply({ content: '❌ لم يتم استلام هذه التذكرة من قبل أي مشرف بعد لتنبيهه.', flags: MessageFlags.Ephemeral });
            }

            const claimerUser = interaction.guild.members.cache.get(claimerId);
            if (claimerUser) {
                await interaction.reply({ content: `⚠️ ${claimerUser}، يرجى مراجعة التكت فوراً؛ لأن صاحب الطلب بانتظار ردك.` });
            } else {
                await interaction.reply({ content: '❌ تعذر العثور على المشرف المستلم حالياً.', flags: MessageFlags.Ephemeral });
            }
        }

        // 3. زر تنبيه العضو (🔔)
        if (customId.startsWith('alert_user_btn_')) {
            const targetRoleId = customId.replace('alert_user_btn_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ هذا الزر مخصص للمشرف المستلم أو الإدارة لتنبيه العضو.', flags: MessageFlags.Ephemeral });
            }

            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;

            if (creatorId) {
                const creatorUser = interaction.guild.members.cache.get(creatorId);
                await interaction.reply({ content: `🔔 تنبيه للعضو ${creatorUser}! يرجى مراجعة التذكرة لمتابعة الرد مع الإدارة.` });
            } else {
                await interaction.reply({ content: '❌ لم يتم التعرف على صاحب التذكرة لتنبيهه.', flags: MessageFlags.Ephemeral });
            }
        }

        // 4. زر طلب إغلاق التكت (🛑)
        if (customId.startsWith('request_close_btn_')) {
            const topic = interaction.channel.topic || '';
            const creatorId = topic.includes('creator_id:') ? topic.split('creator_id:')[1].split(';')[0] : null;

            if (interaction.user.id !== creatorId) {
                return interaction.reply({ content: '❌ هذا الخيار مخصص لصاحب التذكرة لطلب الإغلاق من الإدارة.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: '🛑 **قام العضو بتقديم طلب لإغلاق هذه التذكرة. يرجى من الإدارة مراجعة الطلب والموافقة على الإغلاق.**' });
        }

        // 5. زر إغلاق التذكرة المخصصة ونظام التقييم (🔒)
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            
            const isAuthorizedToClose = member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(targetRoleId);
            
            if (!isAuthorizedToClose) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط للمشرف المستلم أو الإدارة العليا.', flags: MessageFlags.Ephemeral });
            }

            await executeTicketClose(interaction.channel, member);
        }

        // تسجيل التقييم في قناة اللوج فور ضغط العضو عليه بالخاص
        if (customId.startsWith('rate_')) {
            await interaction.deferUpdate();
            const parts = customId.split('_');
            const rating = parseInt(parts[1]);
            const claimerName = parts[2];

            await sendRatingLog(interaction.guild, interaction.user, rating, claimerName);
            await interaction.followUp({ content: '✅ **شكراً جزيلاً لك على تقييمك! تم إرسال التقييم للإدارة بنجاح.**', flags: MessageFlags.Ephemeral });
        }
    }
});

client.login(TOKEN);