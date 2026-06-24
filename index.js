const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// جلب التوكن من متغيرات البيئة في ريندر
const TOKEN = process.env.TOKEN; 
const CLIENT_ID = "1254845579979329618"; // آيدي البوت تبعك (World Cup Bot)

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
const commandsArray = [];

// جلب الأوامر من مجلد commands (تأكد أن المجلد والملفات موجودة على غيت هاب)
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            commandsArray.push(command.data.toJSON());
        }
    }
}

// تشغيل تسجيل أوامر السلاش عند إقلاع البوت
client.once('ready', async () => {
    console.log(`✅ ${client.user.tag} Is Online Now!`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('⏳ Started refreshing application (/) commands...');
        
        // تسجيل الأوامر عالمياً لجميع السيرفرات المتواجد فيها البوت
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commandsArray },
        );

        console.log('🎉 Successfully reloaded application (/) commands!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// معالج الأوامر (Interaction Create) لشتغيل السلاش
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر!', ephemeral: true });
        } else {
            await interaction.reply({ content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر!', ephemeral: true });
        }
    }
});

// جلب نظام الحماية والأنظمة الأخرى (system.js) إذا كان منفصلاً
const systemPath = path.join(__dirname, 'system.js');
if (fs.existsSync(systemPath)) {
    require('./system.js')(client);
}

client.login(TOKEN);
