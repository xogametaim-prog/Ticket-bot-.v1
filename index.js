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

// 🌐 تشغيل سيرفر وهمي للحفاظ على استمرارية البوت (مثلاً على ريندر)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Advanced Economy Bot is Running!');
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

// 💾 قاعدة بيانات وهمية لتخزين بيانات الأعضاء والأسواق
const db = new Map(); 
// هيكلية بيانات العضو الافتراضية: { balance: 10000, gold: 50, inventory: {} }

// 📈 نظام المنتجات والأسعار (مستوحى من ملفات 1000002016.jpg و 1000002021.jpg)
let marketPrices = {
    // منتجات القائمة الأولى (1000002016.jpg)
    cars: { name: 'سيارات 🚗', price: 63046 },
    stocks: { name: 'أسهم 📊', price: 68212 },
    lands: { name: 'أراضي 🏢', price: 342215 },
    trains: { name: 'قطارات 🚂', price: 565291 },
    phones: { name: 'هواتف 📱', price: 24468 },
    planes: { name: 'طائرات ✈️', price: 183472 },
    stadiums: { name: 'ملاعب 🏟️', price: 4561547 },
    
    // منتجات القائمة الثانية (1000002021.jpg)
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

// 🕒 دالة تحديث الأسعار تلقائياً كل ساعة (1 ساعة = 3600000 مللي ثانية)
setInterval(() => {
    console.log('🔄 جاري تحديث أسعار السوق والبورصة تلقائياً...');
    for (const key in marketPrices) {
        const currentPrice = marketPrices[key].price;
        // نسبة تغيير عشوائية بين صعود وهبوط (-15% إلى +15%)
        const changePercent = (Math.random() * 30 - 15) / 100; 
        const changeAmount = Math.floor(currentPrice * changePercent);
        
        marketPrices[key].price = Math.max(1000, currentPrice + changeAmount); // التأكد ألا يقل السعر عن 1000
        marketPrices[key].lastChange = changeAmount >= 0 ? '🟢 صعود' : '🔴 هبوط';
    }
}, 3600000);

// 🛠️ دالة مساعدة لجلب بيانات العضو أو إنشائها
function getUserData(userId) {
    if (!db.has(userId)) {
        db.set(userId, { balance: 50000, gold: 10, inventory: {} });
    }
    return db.get(userId);
}

// 🚀 تسجيل أوامر السلاش الذكية
const commands = [
    new SlashCommandBuilder().setName('bank').setDescription('🏦 عرض قائمة المنتجات المتوفرة وأسعارها الحالية'),
    new SlashCommandBuilder().setName('market').setDescription('📈 عرض بورصة الأسعار الحالية ونسبة الصعود والهبوط'),
    new SlashCommandBuilder().setName('top').setDescription('🏆 عرض قائمة الأثرياء والمتصدرين في السيرفر'),
    new SlashCommandBuilder().setName('mines').setDescription('💣 بدء لعبة الألغام لربح الذهب والرصيد'),
    new SlashCommandBuilder().setName('wheel').setDescription('🎡 تدوير عجلة الحظ اليومية لتجربة حظك'),
    new SlashCommandBuilder().setName('status').setDescription('🟢 عرض حالة أنظمة البوت والفعاليات المتاحة')
].map(cmd => cmd.toJSON());

client.on('ready', async () => {
    console.log(`👑 البوت شغال وجاهز باسم: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل جميع أوامر السلاش الاقتصادية بنجاح!');
    } catch (err) { console.error(err); }
});

// ⚡ معالجة الأوامر والتفاعلات
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        const userData = getUserData(interaction.user.id);

        // 1. أمر البنك واختيار المنتج (1000002016.jpg)
        if (commandName === 'bank') {
            const embed = new EmbedBuilder()
                .setTitle('📥 اختر المنتج للشراء أو الاستثمار')
                .setColor('#1a1a1a')
                .setDescription(
                    `🚗 **${marketPrices.cars.name}**: ${marketPrices.cars.price.toLocaleString()} $\n` +
                    `📊 **${marketPrices.stocks.name}**: ${marketPrices.stocks.price.toLocaleString()} $\n` +
                    `🏢 **${marketPrices.lands.name}**: ${marketPrices.lands.price.toLocaleString()} $\n` +
                    `🚂 **${marketPrices.trains.name}**: ${marketPrices.trains.price.toLocaleString()} $\n` +
                    `📱 **${marketPrices.phones.name}**: ${marketPrices.phones.price.toLocaleString()} $\n` +
                    `✈️ **${marketPrices.planes.name}**: ${marketPrices.planes.price.toLocaleString()} $\n` +
                    `🏟️ **${marketPrices.stadiums.name}**: ${marketPrices.stadiums.price.toLocaleString()} $`
                );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('buy_product')
                .setPlaceholder('اختر المنتج من القائمة...')
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

        // 2. بورصة الأسعار المتغيرة كل ساعة (1000002021.jpg)
        if (commandName === 'market') {
            const embed = new EmbedBuilder()
                .setTitle('📊 البورصة وسوق العقارات العالمي')
                .setDescription('💡 *يتم تحديث الأسعار تلقائياً كل 1 ساعة بناءً على حركة السوق الكلية!*')
                .setColor('#f1c40f');

            for (const key in marketPrices) {
                // تخطي المعروضات البسيطة وعرض العقارات الثقيلة كمثال للملف 1000002021.jpg
                if (['cars', 'stocks', 'lands', 'phones', 'planes', 'stadiums'].includes(key)) continue;
                const item = marketPrices[key];
                const statusEmoji = item.lastChange ? (item.lastChange.includes('🟢') ? '🔽' : '🔻') : '⚪';
                embed.addFields({ 
                    name: `${item.name}`, 
                    value: `${statusEmoji} ${item.price.toLocaleString()} $ \n━━━━━━━`, 
                    inline: false 
                });
            }
            return interaction.reply({ embeds: [embed] });
        }

        // 3. قائمة الأثرياء (1000002017.jpg)
        if (commandName === 'top') {
            const sorted = [...db.entries()].sort((a, b) => b[1].balance - a.balance).slice(0, 10);
            let description = '';
            
            if (sorted.length === 0) {
                description = '❌ لا توجد بيانات أثرياء مسجلة حالياً، كن أول من يتصدر!';
            } else {
                sorted.forEach(([id, data], index) => {
                    description += `**#${index + 1}** | <@${id}> | ${(data.balance / 1000000000).toFixed(2)}b 💰\n\n`;
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('🏆 قائمة الأثرياء والمتصدرين')
                .setDescription(description)
                .setColor('#ffd700');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('check_balance').setLabel('الرصيد 💰').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('check_gold').setLabel('الذهب 🪙').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('check_upgrades').setLabel('التطويرات 🆙').setStyle(ButtonStyle.Secondary)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // 4. لعبة الألغام الذكية (1000002018.jpg)
        if (commandName === 'mines') {
            const embed = new EmbedBuilder()
                .setTitle('💣 لعبة الألغام والتحدي')
                .setDescription('اضغط على المربعات الخضراء لتجميع الذهب وتجنب الألغام المخفية!')
                .addFields(
                    { name: 'الخسارة', value: '0 / 3', inline: true },
                    { name: 'الذهب المكتسب', value: `0 / 30 🪙`, inline: true }
                )
                .setColor('#2ecc71');

            // مصفوفة أزرار 5x5 تمثل الحقل الجغرافي للعبة
            const rows = [];
            for (let i = 0; i < 5; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`mine_${i}_${j}`)
                            .setLabel(`${Math.floor(Math.random() * 2) + 1}`)
                            .setStyle(ButtonStyle.Success)
                    );
                }
                rows.push(row);
            }

            return interaction.reply({ embeds: [embed], components: rows });
        }

        // 5. عجلة الحظ (1000002019.jpg)
        if (commandName === 'wheel') {
            const embed = new EmbedBuilder()
                .setTitle('🎡 عجلة الحظ والجوائز اليومية')
                .setDescription('اضغط على الزر أدناه لتدوير العجلة ومعرفة جائزتك الحالية!')
                .setImage('https://i.imgur.com/your_wheel_image_placeholder.png') // يمكنك استبدالها برابط عجلة مخصص
                .setColor('#e74c3c');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('spin_now').setLabel('🎰 تدوير العجلة الآن').setStyle(ButtonStyle.Danger)
            );

            return interaction.reply({ embeds: [embed], components: [row] });
        }

        // 6. قائمة الأنظمة والحالة (1000002020.jpg)
        if (commandName === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('⚙️ لوحة تحكم وحالة الأنظمة الحية')
                .setDescription(
                    `🟢 زر\n🟢 تحدي\n🟢 كراش\n🟢 نرد\n🟢 ايموجي\n🟢 الوان\n🟢 استثمار\n` +
                    `🟢 أرقام\n🟢 لعبة\n🟢 سلوت\n🟢 تداول\n🟢 اكس-او\n🟢 خمن\n🟢 فواكه\n` +
                    `🟢 اختباء\n🟢 مخاطرة\n🟢 نمط\n🟢 شراء\n🟢 بيع\n🟢 بخشيش\n🟢 الراتب\n🟢 نهب`
                )
                .setColor('#2ecc71');
            return interaction.reply({ embeds: [embed] });
        }
    }

    // 🎛️ معالجة التفاعلات مع الأزرار والقوائم المنسدلة
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'buy_product') {
            const selected = interaction.values[0];
            const product = marketPrices[selected];
            const userData = getUserData(interaction.user.id);

            if (userData.balance < product.price) {
                return interaction.reply({ content: `❌ رصيدك الحالي لا يكفي لشراء ${product.name}! سعره الحالي هو ${product.price.toLocaleString()} $`, ephemeral: true });
            }

            userData.balance -= product.price;
            userData.inventory[selected] = (userData.inventory[selected] || 0) + 1;

            return interaction.reply({ content: `✅ مبروك! قمت بنجاح بنقل ملكية [${product.name}] إلى حسابك واستثمارك الخاص!`, ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const userData = getUserData(interaction.user.id);

        if (interaction.customId === 'check_balance') {
            return interaction.reply({ content: `💰 رصيدك الحالي في البنك المركزي هو: **${userData.balance.toLocaleString()} $**`, ephemeral: true });
        }
        if (interaction.customId === 'check_gold') {
            return interaction.reply({ content: `🪙 مخزون الذهب الخاص بك: **${userData.gold} ذهبة**`, ephemeral: true });
        }
        if (interaction.customId === 'check_upgrades') {
            return interaction.reply({ content: `🆙 ليس لديك تطويرات نشطة حالياً. ارفع مستوى تفاعلك لفتح المزايا!`, ephemeral: true });
        }

        // تفاعل تدوير العجلة (1000002019.jpg)
        if (interaction.customId === 'spin_now') {
            const prizes = [
                { text: '100 ذهب 🪙', action: () => userData.gold += 100 },
                { text: 'حماية 24h 🛡️', action: () => {} },
                { text: 'حماية 10h 🛡️', action: () => {} },
                { text: '25 ذهب 🪙', action: () => userData.gold += 25 },
                { text: 'حماية 3h 🛡️', action: () => {} },
                { text: 'رصيد 30k 💰', action: () => userData.balance += 30000 },
                { text: '75 ذهب 🪙', action: () => userData.gold += 75 },
                { text: 'حماية 15h 🛡️', action: () => {} },
                { text: 'تسريع الوقت ⚡', action: () => {} },
                { text: 'حاول مرة أخرى 🛠️', action: () => {} }
            ];

            const result = prizes[Math.floor(Math.random() * prizes.length)];
            result.action();

            const resultEmbed = new EmbedBuilder()
                .setTitle('🎡 نتيجة تدوير العجلة!')
                .setDescription(`لقد حصلت على: **${result.text}** 🎉\n حظاً موفقاً في المرات القادمة!`)
                .setColor('#3498db');

            return interaction.reply({ embeds: [resultEmbed], ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
