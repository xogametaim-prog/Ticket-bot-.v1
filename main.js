const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    REST, 
    Routes, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require('discord.js');
const http = require('http');

// 🌐 تشغيل السيرفر الوهمي الخاص بـ Render لمنع توقف البوت
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TRL Economy Bot is Running Online!');
});
server.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// 💾 قاعدة بيانات ذكية مقسمة حسب السيرفرات لضمان خصوصية كل خادم
const db = new Map(); 

// الحقوق البرمجية الخاصة بك (حقوق المطور والفريق)
const DEV_INFO = {
    developer: 'ta_im1',
    team: 'TRL for development'
};

// 📈 البورصة العامة وأسعار المنتجات الحالية
let marketPrices = {
    cars: { name: 'سيارات 🚗', price: 63046 },
    stocks: { name: 'أسهم 📊', price: 68212 },
    lands: { name: 'أراضي 🏢', price: 342215 },
    trains: { name: 'قطارات 🚂', price: 565291 },
    phones: { name: 'هواتف 📱', price: 24468 },
    planes: { name: 'طائرات ✈️', price: 183472 },
    stadiums: { name: 'ملاعب 🏟️', price: 4561547 },
    mansion: { name: 'قصر 🏰', price: 1094216 },
    restaurant: { name: 'مطعم 🍔', price: 2367585 },
    diamond: { name: 'الماس 💎', price: 1291389 },
    ship: { name: 'سفينة 🚢', price: 2064849 },
    hotel: { name: 'فندق 🏨', price: 1819762 },
    cafe: { name: 'مقهى ☕', price: 668810 },
    island: { name: 'جزيرة 🏝️', price: 3456322 },
    nasa: { name: 'وكالة ناسا 🚀', price: 3962922 },
    game: { name: 'لعبة 🎮', price: 282209 }
};

// 🕒 دالة تحديث الأسعار التلقائية كل 1 ساعة
setInterval(() => {
    console.log('🔄 [TRL Market] جاري تحديث البورصة والأسعار...');
    for (const key in marketPrices) {
        const currentPrice = marketPrices[key].price;
        const changePercent = (Math.random() * 30 - 15) / 100; // صعود أو هبوط بنسبة 15%
        const changeAmount = Math.floor(currentPrice * changePercent);
        
        marketPrices[key].price = Math.max(1000, currentPrice + changeAmount);
        marketPrices[key].lastChange = changeAmount >= 0 ? '🟢 صعود' : '🔴 هبوط';
    }
}, 3600000);

// 🛠️ دالة جلب بيانات العضو بشكل منفصل لكل سيرفر (Guild-Based Storage)
function getGuildUserData(guildId, userId) {
    if (!db.has(guildId)) {
        db.set(guildId, new Map());
    }
    const guildMap = db.get(guildId);
    if (!guildMap.has(userId)) {
        guildMap.set(userId, { balance: 50000, gold: 10, inventory: {} });
    }
    return guildMap.get(userId);
}

// 🚀 تعريف أوامر السلاش العامة للسيرفرات
const commands = [
    new SlashCommandBuilder().setName('bank').setDescription('🏦 عرض قائمة المنتجات المتوفرة وأسعارها الحالية بالسيرفر'),
    new SlashCommandBuilder().setName('market').setDescription('📈 عرض بورصة الأسعار الحالية ونسبة الصعود والهبوط'),
    new SlashCommandBuilder().setName('top').setDescription('🏆 عرض قائمة أثرياء هذا السيرفر فقط'),
    new SlashCommandBuilder().setName('mines').setDescription('💣 بدء لعبة الألغام لربح الذهب والرصيد'),
    new SlashCommandBuilder().setName('wheel').setDescription('🎡 تدوير عجلة الحظ اليومية لتجربة حظك'),
    new SlashCommandBuilder().setName('status').setDescription('🟢 عرض حالة أنظمة البوت والفعاليات المتاحة')
].map(cmd => cmd.toJSON());

client.on('ready', async () => {
    console.log(`=============================================`);
    console.log(`👑 TRL Economy Bot is Active Now!`);
    console.log(`👤 Developer: ${DEV_INFO.developer}`);
    console.log(`🛡️ Team: ${DEV_INFO.team}`);
    console.log(`🤖 Logged in as: ${client.user.tag}`);
    console.log(`=============================================`);

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        // تسجيل الأوامر بشكل عام (Global) لتشتغل في كل السيرفرات تلقائياً
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل أوامر السلاش العامة في جميع الخوادم بنجاح!');
    } catch (err) { console.error(err); }
});

// ⚡ استقبال التفاعلات والأوامر والتحقق من خصوصية الخادم
client.on('interactionCreate', async interaction => {
    if (!interaction.guildId) return interaction.reply({ content: '❌ لا يمكنك استخدام أوامر الاقتصاد داخل الخاص!', ephemeral: true });

    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const userData = getGuildUserData(guildId, userId);

    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        // 1. أمر البنك (منتجات السيرفر الحالي)
        if (commandName === 'bank') {
            const embed = new EmbedBuilder()
                .setTitle('📥 قائمة المنتجات والاستثمار المتاحة')
                .setColor('#121212')
                .setDescription(
                    `🚗 **${marketPrices.cars.name}**: ${marketPrices.cars.price.toLocaleString()} $\n` +
                    `📊 **${marketPrices.stocks.name}**: ${marketPrices.stocks.price.toLocaleString()} $\n` +
                    `🏢 **${marketPrices.lands.name}**: ${marketPrices.lands.price.toLocaleString()} $\n` +
                    `🚂 **${marketPrices.trains.name}**: ${marketPrices.trains.price.toLocaleString()} $\n` +
                    `📱 **${marketPrices.phones.name}**: ${marketPrices.phones.price.toLocaleString()} $\n` +
                    `✈️ **${marketPrices.planes.name}**: ${marketPrices.planes.price.toLocaleString()} $\n` +
                    `🏟️ **${marketPrices.stadiums.name}**: ${marketPrices.stadiums.price.toLocaleString()} $`
                )
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('buy_product')
                .setPlaceholder('اختر المنتج الذي ترغب في استثماره...')
                .addOptions([
                    { label: 'سيارات', value: 'cars', emoji: '🚗' },
                    { label: 'أسهم', value: 'stocks', emoji: '📊' },
                    { label: 'أراضي', value: 'lands', emoji: '🏢' },
                    { label: 'قطارات', value: 'trains', emoji: '🚂' },
                    { label: 'هواتف', value: 'phones', emoji: '📱' },
                    { label: 'طائرات', value: 'planes', emoji: '✈️' },
                    { label: 'ملاعب', value: 'stadiums', emoji: '🏟️' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // 2. بورصة الأسعار الحية المتغيرة كل ساعة
        if (commandName === 'market') {
            const embed = new EmbedBuilder()
                .setTitle('📊 البورصة العالمية وسوق العقارات')
                .setDescription('💡 *يتم تحديث المؤشرات والأسعار تلقائياً كل 1 ساعة بشكل عشوائي!*')
                .setColor('#f39c12')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            for (const key in marketPrices) {
                if (['cars', 'stocks', 'lands', 'phones', 'planes', 'stadiums'].includes(key)) continue;
                const item = marketPrices[key];
                const statusEmoji = item.lastChange ? (item.lastChange.includes('🟢') ? '🔼' : '🔻') : '⚪';
                embed.addFields({ 
                    name: `${item.name}`, 
                    value: `${statusEmoji} ${item.price.toLocaleString()} $ \n━━━━━━━`, 
                    inline: false 
                });
            }
            return interaction.reply({ embeds: [embed] });
        }

        // 3. توب أثرياء الخادم الحالي فقط (المستقل)
        if (commandName === 'top') {
            const guildMap = db.get(guildId);
            const sorted = guildMap ? [...guildMap.entries()].sort((a, b) => b[1].balance - a.balance).slice(0, 10) : [];
            let description = '';
            
            if (sorted.length === 0) {
                description = '❌ لا توجد تداولات أو أثرياء في هذا الخادم حالياً!';
            } else {
                sorted.forEach(([id, data], index) => {
                    description += `**#${index + 1}** | <@${id}> | ${(data.balance / 1000000000).toFixed(2)}b 💰\n\n`;
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`🏆 أثرياء خادم: ${interaction.guild.name}`)
                .setDescription(description)
                .setColor('#f1c40f')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('check_balance').setLabel('الرصيد 💰').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('check_gold').setLabel('الذهب 🪙').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('check_upgrades').setLabel('التطويرات 🆙').setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // 4. لعبة الألغام 5x5
        if (commandName === 'mines') {
            const embed = new EmbedBuilder()
                .setTitle('💣 حقل الألغام الإلكتروني')
                .setDescription('انقر على المربعات الخضراء لتجميع النقاط والذهب، واحذر من تفجير الحقل!')
                .addFields(
                    { name: 'الخسارة', value: '0 / 3', inline: true },
                    { name: 'الذهب المكتسب', value: `0 / 30 🪙`, inline: true }
                )
                .setColor('#27ae60')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            const rows = [];
            for (let i = 0; i < 5; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mine_${guildId}_${i}_${j}`) // ربط الأزرار بآيدي السيرفر لضمان عدم التداخل
                            .setLabel(`${Math.floor(Math.random() * 2) + 1}`)
                            .setStyle(ButtonStyle.Success)
                    );
                }
                rows.push(row);
            }
            return interaction.reply({ embeds: [embed], components: rows });
        }

        // 5. عجلة الحظ
        if (commandName === 'wheel') {
            const embed = new EmbedBuilder()
                .setTitle('🎡 عجلة الحظ الفورية')
                .setDescription('اضغط على الزر أدناه لتدوير العجلة واكتشاف جائزتك وسحبها لرصيدك!')
                .setColor('#c0392b')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('spin_now').setLabel('🎰 تدوير العجلة').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // 6. لوحة الحالة والفعاليات
        if (commandName === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('🟢 لوحة تحكم وحالة الأنظمة الحية للـ Bot')
                .setDescription(
                    `🟢 زر | 🟢 تحدي | 🟢 كراش | 🟢 نرد\n🟢 ايموجي | 🟢 الوان | 🟢 استثمار\n` +
                    `🟢 أرقام | 🟢 لعبة | 🟢 سلوت | 🟢 تداول\n🟢 اكس-او | 🟢 خمن | 🟢 فواكه\n` +
                    `🟢 اختباء | 🟢 مخاطرة | 🟢 نمط | 🟢 شراء\n🟢 بيع | 🟢 بخشيش | 🟢 الراتب | 🟢 نهب`
                )
                .setColor('#2ecc71')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });
            return interaction.reply({ embeds: [embed] });
        }
    }

    // 🎛️ معالجة الضغطات والعمليات الشرائية المنفصلة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'buy_product') {
            const selected = interaction.values[0];
            const product = marketPrices[selected];

            if (userData.balance < product.price) {
                return interaction.reply({ content: `❌ رصيدك في هذا السيرفر لا يكفي لشراء ${product.name}! تحتاج إلى ${product.price.toLocaleString()} $`, ephemeral: true });
            }

            userData.balance -= product.price;
            userData.inventory[selected] = (userData.inventory[selected] || 0) + 1;

            return interaction.reply({ content: `✅ تمت عملية الشراء بنجاح! تم تسجيل الاستثمار [${product.name}] داخل محفظتك في هذا السيرفر.`, ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'check_balance') {
            return interaction.reply({ content: `💰 رصيدك الحالي في هذا السيرفر هو: **${userData.balance.toLocaleString()} $**`, ephemeral: true });
        }
        if (interaction.customId === 'check_gold') {
            return interaction.reply({ content: `🪙 رصيد الذهب المتوفر لديك هنا: **${userData.gold} ذهبة**`, ephemeral: true });
        }
        if (interaction.customId === 'check_upgrades') {
            return interaction.reply({ content: `🆙 لا توجد ترقيات مفعلة لحسابك حالياً في هذا الخادم.`, ephemeral: true });
        }

        if (interaction.customId === 'spin_now') {
            const prizes = [
                { text: '100 ذهب 🪙', action: () => userData.gold += 100 },
                { text: 'حماية 24h 🛡️', action: () => {} },
                { text: '25 ذهب 🪙', action: () => userData.gold += 25 },
                { text: 'رصيد 30k 💰', action: () => userData.balance += 30000 },
                { text: '75 ذهب 🪙', action: () => userData.gold += 75 },
                { text: 'حاول مرة أخرى 🛠️', action: () => {} }
            ];

            const result = prizes[Math.floor(Math.random() * prizes.length)];
            result.action();

            const resultEmbed = new EmbedBuilder()
                .setTitle('🎡 عجلة الحظ - النتيجة')
                .setDescription(`🎉 مبروك! حصلت على: **${result.text}** داخل هذا السيرفر!`)
                .setColor('#3498db')
                .setFooter({ text: `Developed by ${DEV_INFO.developer} | Team: ${DEV_INFO.team}` });

            return interaction.reply({ embeds: [resultEmbed], ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
