const { 
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, 
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require('discord.js');
const http = require('http');
const axios = require('axios');

// قراءة التوكن مباشرة من إعدادات ريندر بأمان
const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// حفظ مؤقت للرتبة المسؤولة عن التيكت في السيرفر
let ticketStaffRole = {}; 

client.once('ready', () => {
  console.log(`🤖 تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
  
  // 1. إنشاء الـ Web Service لـ Render ولـ UptimeRobot
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Zone Ticket Bot is active 24/7! (Anti-Sleep Triggered)');
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`🌐 الويب سيرفر شغال على المنفذ: ${PORT}`);
    
    // 2. خدعة الـ Self-Ping: البوت "يضحك" على ريندر ويرسل طلب لنفسه كل 5 دقائق
    // ملاحظة: ريندر يغلق الويب سيرفس إذا مرت 15 دقيقة بدون أي حركّة
    setInterval(async () => {
      try {
        // إذا كنت تملك رابط .onrender.com الخاص بك وضعه هنا، أو دعه يكتشف المنفذ المحلي تلقائياً
        const appUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
        await axios.get(appUrl);
        console.log('⏰ [Self-Ping] تم تنشيط البوت ذاتياً بنجاح لمنع وضع النوم!');
      } catch (error) {
        console.log('⚠️ [Self-Ping] فشل التنشيط الذاتي المؤقت (لا تقلق السيرفر يعمل):', error.message);
      }
    }, 5 * 60 * 1000); // كل 5 دقائق بالضبط
  });
});

client.on('interactionCreate', async interaction => {
  
  // تشغيل أوامر السلاش
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-ticket') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const buttonText = interaction.options.getString('button_text');
      const staffRole = interaction.options.getRole('staff_role');

      ticketStaffRole[interaction.guildId] = staffRole.id;

      // الإمبد الرئيسي لنظام التيكت مع الخلفية الخضراء التكنولوجية المستطيلة V1.0
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#00ff88')
        .setImage('https://i.imgur.com/v8S7z8z.png') 
        .setFooter({ text: 'Welcome to Zone Members Support!', iconURL: interaction.guild.iconURL() });

      // قائمة الاختيار مطابقة للصورة تماماً
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('Choose an option...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(buttonText)
            .setDescription('اضغط هنا لفتح تذكرة دعم فني جديدة')
            .setValue('open_ticket')
            .setEmoji('🎫'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Rest / Reset')
            .setDescription('إعادة تعيين وإلغاء الاختيار المفتوح')
            .setValue('reset_select')
            .setEmoji('🔄')
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({ content: '✅ تم إنشاء لوحة التذاكر الاحترافية بنجاح!', ephemeral: true });
      await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    if (commandName === 'embed') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const imageUrl = interaction.options.getString('image_url');
      const color = interaction.options.getString('color') || '#00ff88';

      const customEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color.startsWith('#') ? color : `#${color}`);

      if (imageUrl) customEmbed.setImage(imageUrl);

      await interaction.reply({ content: '✅ تم إرسال الإمبد المخصص بنجاح.', ephemeral: true });
      await interaction.channel.send({ embeds: [customEmbed] });
    }
  }

  // معالجة فتح التيكت عند الاختيار من القائمة
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_select') {
      if (interaction.values[0] === 'reset_select') {
        return interaction.reply({ content: '🔄 تم إلغاء الاختيار بنجاح.', ephemeral: true });
      }

      if (interaction.values[0] === 'open_ticket') {
        const staffRoleId = ticketStaffRole[interaction.guildId];
        if (!staffRoleId) {
          return interaction.reply({ content: '❌ خطأ: يرجى إعداد النظام أولاً باستخدام الأمر `/setup-ticket` لتحديد الرتبة.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        // إنشاء روم التيكت (العضو مسموح له إرسال الصور والملفات AttachFiles)
        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }, 
            { id: staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
          ]
        });

        // رسالة الإمبد داخل التيكت مع اللوجو الدائري الأخضر V1.0
        const ticketEmbed = new EmbedBuilder()
          .setTitle('الدعم الفني | Technical Support')
          .setDescription(`أهلاً بك ${interaction.user} في تذكرتك المفتوحة.\nيرجى كتابة مشكلتك أو إرسال صور الدعم هنا، وسيقوم فريق الإدارة بالرد عليك قريباً.\n\n**الرتبة المسؤولة:** <@&${staffRoleId}>`)
          .setColor('#00ff88')
          .setThumbnail('https://i.imgur.com/7gK7N9Z.png') 
          .setTimestamp();

        const buttonsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('claim_ticket').setLabel('استلام التذكرة (Staff)').setStyle(ButtonStyle.Success).setEmoji('🙋‍♂️'),
          new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة (Staff)').setStyle(ButtonStyle.Danger).setEmoji('🔒')
        );

        await ticketChannel.send({ content: `${interaction.user} | <@&${staffRoleId}>`, embeds: [ticketEmbed], components: [buttonsRow] });
        await interaction.editReply({ content: `✅ تم فتح تذكرتك بنجاح: ${ticketChannel}` });
      }
    }
  }

  // التحكم بالحماية والأزرار (منع العضو والسماح للادارة فقط)
  if (interaction.isButton()) {
    const staffRoleId = ticketStaffRole[interaction.guildId];

    // نظام الأمان: إذا العضو ضغط على زر الاستلام أو الإغلاق يرفضه فوراً وممنوع يتحكم
    if (!interaction.member.roles.cache.has(staffRoleId)) {
      return interaction.reply({ content: '❌ عذراً، هذه الأزرار مخصصة لطاقم الدعم الفني فقط وممنوع استخدامها من قبل الأعضاء.', ephemeral: true });
    }

    // زر استلام التيكت
    if (interaction.customId === 'claim_ticket') {
      await interaction.reply({ content: `👋 تم استلام هذه التذكرة بواسطة الإداري: ${interaction.user}` });
      
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('claim_ticket').setLabel('تم الاستلام').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
      );
      await interaction.message.edit({ components: [disabledRow] });
    }

    // زر إغلاق التيكت وحذف الروم
    if (interaction.customId === 'close_ticket') {
      await interaction.reply({ content: '🔒 تم طلب إغلاق التذكرة، سيتم حذف الروم نهائياً بعد 5 ثوانٍ...' });
      setTimeout(async () => {
        try {
          await interaction.channel.delete();
        } catch (err) {
          console.log('خطأ أثناء حذف قناة التيكت:', err);
        }
      }, 5000);
    }
  }
});

client.login(token);
