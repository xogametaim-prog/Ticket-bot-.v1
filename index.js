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
    Routes
} = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Multi-Ticket Bot Active!'));
app.listen(PORT, '0.0.0.0', () => console.log(`Server connected to port ${PORT}`));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const TICKET_PREFIX = '-st'; // لإنشاء بوكس تكت متعدد ومخصص
const EMBED_PREFIX = '-em';  // لإنشاء إمبد مخصص مع أزرار

const tempSetup = new Map();
const embedSetup = new Map();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const commands = [
        { name: 'setup', description: 'بدء الإعداد التفاعلي لتخصيص بوكس التذاكر الخاص بك' },
        { name: 'embed', description: 'بدء إعداد إمبد مخصص مع أزرار' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Slash commands registered successfully.');
    } catch (error) {
        console.error(error);
    }
});

// دالة بدء الإعداد التفاعلي لبوكس التكت المتعدد
async function startInteractiveSetup(messageOrInteraction, channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        const replyContent = '❌ عذراً، هذا الأمر مخصص للإداريين فقط.';
        if (messageOrInteraction.reply) {
            return messageOrInteraction.reply({ content: replyContent, ephemeral: true });
        } else {
            return channel.send(replyContent);
        }
    }

    // إعداد الهيكل الجديد لدعم خيارات متعددة في بوكس واحد
    const setupState = { 
        step: 'get_count', // الخطوة الأولى: معرفة عدد الأقسام
        optionsCount: 0,
        currentOptionIndex: 0,
        options: [], // مصفوفة لتخزين الأقسام المخصصة
        imageUrl: null,
        categoryId: null
    };
    tempSetup.set(user.id, setupState);

    const welcomeMsg = `⚙️ **بدء إعداد بوكس تذاكر تفاعلي جديد ومتعدد الأقسام**\n\n**الخطوة [1]:** كم عدد الأقسام (الخيارات) التي تريد وضعها في هذا البوكس الموحد؟ (اكتب رقماً من **1 إلى 5**):`;
    if (messageOrInteraction.reply) {
        await messageOrInteraction.reply({ content: welcomeMsg, ephemeral: true });
    } else {
        await channel.send(`${user}, ${welcomeMsg}`);
    }
}

// دالة بدء الإعداد التفاعلي للإمبد المخصص مع الأزرار
async function startEmbedSetup(messageOrInteraction, channel, user) {
    const member = channel.guild.members.cache.get(user.id);
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        const replyContent = '❌ عذراً، هذا الأمر مخصص للإداريين فقط.';
        if (messageOrInteraction.reply) {
            return messageOrInteraction.reply({ content: replyContent, ephemeral: true });
        } else {
            return channel.send(replyContent);
        }
    }

    const embedState = { step: 1, title: null, description: null, buttonLabel: null, buttonStyle: 'Primary' };
    embedSetup.set(user.id, embedState);

    const welcomeMsg = `📝 **بدء إعداد إمبد مخصص**\n\n**الخطوة [1/3]:** يرجى كتابة **عنوان (Title)** الإمبد:`;
    if (messageOrInteraction.reply) {
        await messageOrInteraction.reply({ content: welcomeMsg, ephemeral: true });
    } else {
        await channel.send(`${user}, ${welcomeMsg}`);
    }
}

// قراءة الإجابات والتحكم في الرسائل والخطوات التفاعلية المخصصة
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // تشغيل الإعداد التفاعلي للبوكس المخصص عبر -st
    if (message.content.trim() === TICKET_PREFIX) {
        return startInteractiveSetup(message, message.channel, message.author);
    }

    // تشغيل الإعداد التفاعلي للإمبد عبر -em
    if (message.content.trim() === EMBED_PREFIX) {
        return startEmbedSetup(message, message.channel, message.author);
    }

    // أمر استدعاء العضو داخل التكت المفتوح
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

    // 1. معالجة خطوات إعداد بوكس التكت المتعدد الذكي
    if (tempSetup.has(message.author.id)) {
        const state = tempSetup.get(message.author.id);

        // خطوة تحديد عدد الأقسام
        if (state.step === 'get_count') {
            const count = parseInt(message.content.trim());
            if (isNaN(count) || count < 1 || count > 5) {
                return message.reply('❌ يرجى كتابة رقم صحيح من 1 إلى 5 فقط:');
            }
            state.optionsCount = count;
            state.currentOptionIndex = 0;
            state.step = 'get_option_label';
            return message.reply(`✅ تم تحديد عدد الأقسام: **${count}**\n\n💬 **الآن لنبدأ بتجهيز القسم رقم [1]**:\nيرجى كتابة **اسم القسم** (مثال: الدعم الفني، مبيعات... إلخ):`);
        }

        // خطوة الحصول على اسم القسم الحالي
        if (state.step === 'get_option_label') {
            const label = message.content.trim();
            state.options.push({ label: label, roleId: null, value: `opt_${state.currentOptionIndex + 1}` });
            state.step = 'get_option_role';
            return message.reply(`✅ تم حفظ اسم القسم: **${label}**\n\n👤 يرجى كتابة **أيدي الرتبة (Role ID)** المسؤولة عن استلام تذاكر هذا القسم تحديداً:`);
        }

        // خطوة الحصول على رتبة القسم الحالي ومتابعة التكرار
        if (state.step === 'get_option_role') {
            const roleId = message.content.trim();
            const role = message.guild.roles.cache.get(roleId);
            if (!role) {
                return message.reply('❌ أيدي الرتبة غير صحيح. يرجى كتابة أيدي رتبة صحيح وموجود بالسيرفر:');
            }

            // حفظ الرتبة للقسم الحالي
            state.options[state.currentOptionIndex].roleId = roleId;
            state.currentOptionIndex++;

            // التحقق مما إذا كان هناك أقسام متبقية تحتاج إعداد
            if (state.currentOptionIndex < state.optionsCount) {
                state.step = 'get_option_label';
                return message.reply(`✅ تم ربط الرتبة **${role.name}** بالقسم السابق.\n\n💬 **لننتقل الآن لتجهيز القسم رقم [${state.currentOptionIndex + 1}]**:\nيرجى كتابة **اسم القسم**:`);
            } else {
                // الانتقال للخطوات العامة للبوكس بعد انتهاء الأقسام
                state.step = 'get_image';
                return message.reply(`✅ تم الانتهاء من إعداد جميع الأقسام بنجاح!\n\n🖼️ يرجى وضع **رابط الصورة (Image URL)** للبوكس الرئيسي (إذا كنت لا تريد صورة اكتب: \`لا\`):`);
            }
        }

        // خطوة الحصول على الصورة العامة للبوكس
        if (state.step === 'get_image') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا' && input.startsWith('http')) {
                state.imageUrl = input;
            } else {
                state.imageUrl = null;
            }
            state.step = 'get_category';
            return message.reply(`✅ تم حفظ إعدادات الصورة.\n\n📂 يرجى كتابة **أيدي القسم (Category ID)** الذي تفتح فيه التذاكر (إذا كنت تريدها تفتح في أي مكان اكتب: \`لا\`):`);
        }

        // الخطوة الأخيرة: بناء البوكس المتعدد المستقل وإرساله
        if (state.step === 'get_category') {
            const input = message.content.trim();
            if (input.toLowerCase() !== 'لا') {
                state.categoryId = input;
            } else {
                state.categoryId = null;
            }

            const embed = new EmbedBuilder()
                .setTitle('الدعم الفني والخدمات | Support Portal')
                .setDescription(`يرجى فتح القائمة أدناه واختيار القسم المناسب لمشكلتك، وسيتم تحويلك مباشرة للقسم المختص ومتابعتك مع المشرفين المسؤولين عن هذا القسم.`)
                .setColor('#2b2d31');

            if (state.imageUrl) {
                embed.setImage(state.imageUrl);
            }

            // تشفير خريطة الخيارات (الرتب والأقسام) داخل الـ Custom ID لتفادي التداخل نهائياً ولتسهيل المعالجة الفورية السريعة
            // الهيكل: multi_t_menu_[رقم عشوائي لتفادي التكرار]
            const uniqueId = Date.now().toString().slice(-4);
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`multi_t_menu_${uniqueId}_${state.categoryId || 'none'}`)
                .setPlaceholder('الرجاء اختيار قسم مناسب لفتح تذكرة...');

            // إضافة جميع الأقسام التي قمت أنت بإعدادها ديناميكياً بداخل القائمة المنسدلة الواحدة
            state.options.forEach(opt => {
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setValue(`opaction_${opt.roleId}`) // تخزين أيدي رتبة الاستلام بداخل قيمة الاختيار لسرعة الاتصال
                        .setLabel(opt.label)
                        .setDescription(`اضغط لفتح تذكرة بقسم ${opt.label}`)
                        .setEmoji('🎫')
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await message.channel.send({ embeds: [embed], components: [row] });
            await message.reply('🎉 **تم إنشاء البوكس الموحد بنجاح تام! يحتوي الآن على الأقسام المتعددة التي قمت بتخصيصها برتب استلام مختلفة ومستقلة.**');

            tempSetup.delete(message.author.id);
        }
    }

    // 2. تتبع خطوات إعداد إمبد -em المخصص
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
        }
    }
});

// التعامل مع التفاعلات والسلاش والأزرار وحل مشكلة التأخير (Lag) بالكامل
client.on('interactionCreate', async interaction => {
    // تشغيل الأوامر التفاعلية
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'setup') {
            await startInteractiveSetup(interaction, interaction.channel, interaction.user);
        }
        if (interaction.commandName === 'embed') {
            await startEmbedSetup(interaction, interaction.channel, interaction.user);
        }
    }

    // فتح تكت من القوائم المنسدلة المتعددة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('multi_t_menu_')) {
            // معالجة فورية وتأكيد الاستجابة فوراً لتجنب أي تعليق أو بطء
            await interaction.deferReply({ ephemeral: true });

            const parts = interaction.customId.split('_');
            const targetCategoryId = parts[4] === 'none' ? null : parts[4];

            // جلب أيدي رتبة الاستلام ديناميكياً من الاختيار المحدد لتفادي التداخل
            const selectedValue = interaction.values[0];
            const targetRoleId = selectedValue.replace('opaction_', '');

            const guild = interaction.guild;
            const member = interaction.member;

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
                const channel = await guild.channels.create({
                    name: `ticket-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: targetCategoryId,
                    permissionOverwrites: permissionOverwrites
                });

                // حفظ أيدي صانع التكت في التوبك فوراً
                await channel.setTopic(`creator_id:${member.id}`);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('تذكرة دعم جديدة')
                    .setDescription(`مرحباً بك ${member}، تم فتح التذكرة الخاصة بك بنجاح وتحويلها للقسم المختص.\n\nيرجى كتابة استفسارك هنا بوضوح وانتظار استلام المشرفين للتذكرة لمساعدتك.`)
                    .setColor('#5865F2')
                    .setTimestamp();

                const claimButton = new ButtonBuilder()
                    .setCustomId(`claim_custom_ticket_${targetRoleId}`)
                    .setLabel('استلام التذكرة')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🙋‍♂️');

                const closeButton = new ButtonBuilder()
                    .setCustomId(`close_custom_ticket_${targetRoleId}`)
                    .setLabel('إغلاق التذكرة')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒');

                const row = new ActionRowBuilder().addComponents(claimButton, closeButton);

                const supportRoleMention = targetRoleId ? `<@&${targetRoleId}>` : '';
                await channel.send({ 
                    content: `${member} ${supportRoleMention}`, 
                    embeds: [welcomeEmbed], 
                    components: [row] 
                });

                await interaction.editReply({ content: `تم فتح تذكرتك بنجاح في القناة: ${channel}` });

            } catch (error) {
                console.error(error);
                await interaction.editReply({ content: '❌ حدث خطأ غير متوقع أثناء محاولة إنشاء التذكرة.' });
            }
        }
    }

    // معالجة الأزرار (حل تعليق و Lag الاستلام والإغلاق بشكل كامل وفوري)
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // استلام تذكرة مخصصة
        if (customId.startsWith('claim_custom_ticket_')) {
            const targetRoleId = customId.replace('claim_custom_ticket_', '');
            const member = interaction.member;

            const hasRequiredRole = member.roles.cache.has(targetRoleId) || member.permissions.has(PermissionFlagsBits.Administrator);

            if (!hasRequiredRole) {
                return interaction.reply({ content: '❌ لا يمكنك استلام هذه التذكرة لأنك لا تملك الرتبة المخصصة للتحكم فيها!', ephemeral: true });
            }

            // الاستجابة بشكل فوري للغاية لإنهاء التفاعل لمنع ظهور "Interaction Failed"
            await interaction.deferUpdate();

            const topic = interaction.channel.topic || '';
            const creatorId = topic.split(':')[1]?.split(';')[0] || '';
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
                .setCustomId(`close_custom_ticket_${targetRoleId}`)
                .setLabel('إغلاق التذكرة')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🔒');

            const row = new ActionRowBuilder().addComponents(disabledClaimButton, closeButton);

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
            
            const creatorMention = creatorId ? `<@${creatorId}>` : '';
            await interaction.followUp({ content: `${creatorMention} **تم استلام تكت عن طريق هذا الإدارة: ${member}، تابع معه.**` });
        }

        // إغلاق تذكرة مخصصة
        if (customId.startsWith('close_custom_ticket_')) {
            const targetRoleId = customId.replace('close_custom_ticket_', '');
            const member = interaction.member;
            const topic = interaction.channel.topic || '';
            const isClaimer = topic.includes(`claimed_by:${member.id}`);
            const hasSupportRole = member.roles.cache.has(targetRoleId);
            const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

            if (!isClaimer && !hasSupportRole && !isAdmin) {
                return interaction.reply({ content: '❌ لا يمكنك إغلاق التذكرة، الإغلاق متاح فقط لمن استلمها أو الرتبة المخصصة للقسم.', ephemeral: true });
            }

            // استجابة فورية لتجنب الـ Lag وحذف القناة بعد 5 ثوانٍ مباشرة
            await interaction.reply({ content: '⚠️ سيتم حذف التذكرة نهائياً وإغلاق القناة خلال 5 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (err) {
                    console.error('Error deleting channel:', err);
                }
            }, 5000);
        }

        // التعامل مع زر الإمبد المخصص العام
        if (customId === 'general_embed_button_action') {
            await interaction.reply({ content: 'سيتم فتح تذكرة عامة لك الآن...', ephemeral: true });
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