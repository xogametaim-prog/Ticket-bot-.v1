const {
    Client, GatewayIntentBits, ChannelType, PermissionFlagsBits, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder
} = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const { Wordle, TicTacToe, Snake } = require('discord-gamecord');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildVoiceStates
    ]
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MONGO_URI = process.env.MONGO_URI;
let useMongoDB = false;
let localDatabase = {};

if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => { console.log('✅ Connected to MongoDB.'); useMongoDB = true; })
        .catch(() => console.log('❌ Database Connection Failed. Using JSON Fallback.'));
} else {
    if (fs.existsSync('./database.json')) {
        try { localDatabase = JSON.parse(fs.readFileSync('./database.json', 'utf8')); } catch (e) { localDatabase = {}; }
    }
}

const configSchema = new mongoose.Schema({
    guildId: String,
    ticketCategoryId: String,
    logsChannelId: String
});
const GuildConfigModel = mongoose.model('GuildConfig', configSchema);

async function getGuildConfig(guildId) {
    if (useMongoDB) {
        let config = await GuildConfigModel.findOne({ guildId });
        if (!config) {
            config = new GuildConfigModel({ guildId, ticketCategoryId: null, logsChannelId: null });
            await config.save();
        }
        return config;
    } else {
        if (!localDatabase[guildId]) localDatabase[guildId] = {};
        if (!localDatabase[guildId].config) {
            localDatabase[guildId].config = { ticketCategoryId: null, logsChannelId: null };
        }
        return localDatabase[guildId].config;
    }
}

async function saveGuildConfig(guildId, configData) {
    if (useMongoDB) {
        await GuildConfigModel.updateOne({ guildId }, {
            ticketCategoryId: configData.ticketCategoryId,
            logsChannelId: configData.logsChannelId
        });
    } else {
        localDatabase[guildId].config = configData;
        fs.writeFileSync('./database.json', JSON.stringify(localDatabase, null, 2));
    }
}

async function sendLog(guild, embed) {
    const config = await getGuildConfig(guild.id);
    if (config && config.logsChannelId) {
        const channel = guild.channels.cache.get(config.logsChannelId);
        if (channel) await channel.send({ embeds: [embed] }).catch(() => {});
    }
}

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
            name: 'setup_tickets',
            description: 'إرسال لوحة التحكم بنظام التذاكر' 
        },
        {
            name: 'game_wordle',
            description: 'بدء لعبة تخمين الكلمات Wordle الشهيرة داخل الشات بالتفاعل'
        },
        {
            name: 'game_tictactoe',
            description: 'بدء لعبة إكس أو (Tic Tac Toe) تفاعلية ضد عضو آخر بالسيرفر',
            options: [
                { name: 'opponent', type: 6, description: 'العضو المراد اللعب ضده', required: true }
            ]
        },
        {
            name: 'game_snake',
            description: 'بدء لعبة الثعبان (Snake Game) الكلاسيكية التفاعلية بالأزرار'
        }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('Registered application commands successfully.');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        const { guild, member, customId, channel } = interaction;

        if (customId === 'open_ticket_btn') {
            await interaction.deferReply({ ephemeral: true });
            const config = await getGuildConfig(guild.id);
            
            const overwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ];

            try {
                const ticketChannel = await guild.channels.create({
                    name: `🎫-${member.user.username}`,
                    type: ChannelType.GuildText,
                    parent: config.ticketCategoryId || null,
                    permissionOverwrites: overwrites
                });

                const embed = new EmbedBuilder()
                    .setTitle('نظام التذاكر والأمن الموحد')
                    .setDescription(`مرحباً بك <@${member.id}> في الدعم الفني الخاص بك.\nالرجاء طرح تفاصيل مشكلتك هنا بوضوح لكي يقوم المشرفون بالرد عليك في أقرب وقت ممكن.`)
                    .setColor(0x00FF00);

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket_btn').setLabel('إغلاق التذكرة والأرشفة 🔒').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ embeds: [embed], components: [closeRow] });
                await interaction.followUp({ content: `✅ تم إنشاء تذكرتك بنجاح: ${ticketChannel}`, ephemeral: true });

                const logEmbed = new EmbedBuilder()
                    .setTitle('🟢 تذكرة جديدة تم فتحها')
                    .setDescription(`صاحب التذكرة: <@${member.id}> (${member.id})\nاسم القناة: ${ticketChannel}`)
                    .setColor(0x2ECC71).setTimestamp();
                await sendLog(guild, logEmbed);

            } catch (e) { 
                console.error(e);
                await interaction.followUp({ content: '❌ حدث خطأ غير متوقع أثناء إعداد وتفعيل روم التذكرة.', ephemeral: true });
            }
        }

        if (customId === 'close_ticket_btn') {
            await interaction.reply({ content: '⏳ سيتم إغلاق وحذف روم التذكرة وتدوين السجل التفاعلي خلال 5 ثوانٍ...' });
            
            const logEmbed = new EmbedBuilder()
                .setTitle('🔴 تذكرة تم إغلاقها وحذفها')
                .setDescription(`المسؤول المعني بالإغلاق: <@${member.id}> (${member.id})\nاسم روم التذكرة: \`${channel.name}\``)
                .setColor(0xE74C3C).setTimestamp();
            await sendLog(guild, logEmbed);

            setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
    }

    if (interaction.isChatInputCommand()) {
        const { commandName, options, guild, member, channel } = interaction;

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
                
                const logEmbed = new EmbedBuilder().setTitle('🔨 حظر عضو جديد').setDescription(`العضو المحظور: ${target} (${target.id})\nبواسطة: <@${member.id}>\nالسبب: ${reason}`).setColor(0xE74C3C).setTimestamp();
                await sendLog(guild, logEmbed);
            } catch (e) { await interaction.reply({ content: `❌ فشل الحظر: ${e.message}`, ephemeral: true }); }
        }

        if (commandName === 'timeout') {
            if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                return interaction.reply({ content: '❌ لا تملك صلاحية كتم الأعضاء.', ephemeral: true });
            }
            const target = options.getMember('member');
            const minutes = options.getInteger('minutes');
            const reason = options.getString('reason') || 'لا يوجد سبب';
            if (!target) return interaction.reply({ content: '❌ لم يتم العثور على هذا العضو.', ephemeral: true });
            try {
                const duration = minutes * 60 * 1000;
                await target.timeout(duration, reason);
                await interaction.reply({ content: `✅ تم كتم العضو ${target} بنجاح لـ ${minutes} دقيقة.` });

                const logEmbed = new EmbedBuilder().setTitle('🔇 كتم عضو (Timeout)').setDescription(`العضو المكتوم: ${target}\nالمدة بالدقائق: ${minutes}\nبواسطة: <@${member.id}>`).setColor(0xfbbf24).setTimestamp();
                await sendLog(guild, logEmbed);
            } catch (e) { await interaction.reply({ content: `❌ فشل الكتم: ${e.message}`, ephemeral: true }); }
        }

        if (commandName === 'setup_tickets') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ هذا الأمر مخصص للإداريين فقط!', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('تذكرة الدعم الفني والمساعدة 🎫')
                .setDescription('إذا كنت تواجه مشكلة، ترغب بتقديم شكوى أو التحدث للإدارة، اضغط على الزر بالأسفل لفتح تذكرة خاصة بك.')
                .setColor(0x3b82f6);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('open_ticket_btn').setLabel('فتح تذكرة 🎫').setStyle(ButtonStyle.Success)
            );

            try {
                await channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ تم إرسال لوحة التذاكر التفاعلية بنجاح!', ephemeral: true });
            } catch (e) { await interaction.reply({ content: `❌ فشل إرسال اللوحة: ${e.message}`, ephemeral: true }); }
        }

        if (commandName === 'game_wordle') {
            const Game = new Wordle({
                message: interaction,
                isSlashGame: true,
                embed: { title: 'لعبة تخمين الكلمات Wordle 📝', color: '#5865F2' },
                customWord: null,
                timeoutTime: 60000,
                winMessage: '🎉 تهانينا! لقد نجحت بتخمين الكلمة الصحيحة وهي **{word}** بنجاح!',
                loseMessage: '❌ للأسف! لم تنجح بالتخمين، الكلمة الصحيحة هي: **{word}**',
                playerOnlyMessage: 'هذا الزر مخصص فقط لـ {player} للعب.'
            });
            Game.startGame();
        }

        if (commandName === 'game_tictactoe') {
            const opponent = options.getUser('opponent');
            if (opponent.id === interaction.user.id) return interaction.reply({ content: '❌ لا يمكنك اللعب ضد نفسك!', ephemeral: true });
            if (opponent.bot) return interaction.reply({ content: '❌ لا يمكنك اللعب ضد البوتات!', ephemeral: true });

            const Game = new TicTacToe({
                message: interaction,
                isSlashGame: true,
                opponent: opponent,
                embed: { title: 'لعبة إكس أو | Tic Tac Toe 🎮', color: '#5865F2' },
                emojis: { xButton: '❌', oButton: '🔵', blankButton: '➖' },
                mentionUser: true,
                timeoutTime: 60000,
                xMessage: '🎉 مبارك الفوز لـ {player} (❌)!',
                oMessage: '🎉 مبارك الفوز لـ {player} (🔵)!',
                drawMessage: '⚔️ انتهت المباراة بالتعادل بين الطرفين!',
                requestDelay: 5000,
                askMessage: 'مرحباً {opponent}، هل تقبل تحدي {player} في مباراة إكس أو تفاعلية؟',
                rejectMessage: '❌ رفض الطرف الآخر التحدي المقترح من قبلك.',
                timeoutMessage: '❌ انتهى الوقت المحدد للاستجابة للمباراة.',
                playerOnlyMessage: 'هذا التفاعل مخصص فقط لـ {player} و {opponent}.'
            });
            Game.startGame();
        }

        if (commandName === 'game_snake') {
            const Game = new Snake({
                message: interaction,
                isSlashGame: true,
                embed: { title: 'لعبة الثعبان التفاعلية الكلاسيكية 🐍', overTitle: 'انتهت اللعبة! 💀', color: '#5865F2' },
                emojis: { board: '⬛', food: '🍎', up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' },
                stopButton: 'إيقاف اللعبة 🛑',
                timeoutTime: 60000,
                snake: { head: '🟢', body: '🟩', tail: '🟢', over: '💀' },
                foods: ['🍎', '🍇', '🍊', '🍓'],
                playerOnlyMessage: 'أزرار اللعب مخصصة فقط لـ {player}.'
            });
            Game.startGame();
        }
    }
});

const startDashboard = require('./server.js');
startDashboard(client, getGuildConfig, saveGuildConfig);

const TOKEN = process.env.DISCORD_TOKEN || 'your_token_here';
client.login(TOKEN);