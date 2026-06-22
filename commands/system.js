const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

function getDB() { return JSON.parse(fs.readFileSync('./db.json', 'utf8')); }
function saveDB(db) { fs.writeFileSync('./db.json', JSON.stringify(db, null, 2)); }

// دالة مساعدة لإرسال اللوج (Voucher) تلقائياً عند حدوث أي عقوبة
async function sendVoucher(guild, title, description, color = '#ff0000') {
  const db = getDB();
  const channelId = db.vouchers?.[guild.id];
  if (!channelId) return;
  
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(`📜 سجل العمليات | ${title}`)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  
  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  // تفعيل روم السجل (Voucher)
  'voucher': {
    name: 'voucher',
    shortcuts: ['فاوتشر', 'سجل'],
    data: new SlashCommandBuilder()
      .setName('voucher')
      .setDescription('تحديد روم الحالية لتكون روم سجل العمليات والتوثيق')
      .addChannelOption(opt => opt.setName('channel').setDescription('اختر الروم').setRequired(true)),
    executeSlash: async (interaction) => {
      const channel = interaction.options.getChannel('channel');
      const db = getDB();
      if (!db.vouchers) db.vouchers = {};
      db.vouchers[interaction.guild.id] = channel.id;
      saveDB(db);
      interaction.reply(`✅ تم اعتماد الروم ${channel} لتكون روم الـ **voucher** الرسمية.`);
    },
    executeMessage: async (message) => {
      const db = getDB();
      if (!db.vouchers) db.vouchers = {};
      db.vouchers[message.guild.id] = message.channel.id;
      saveDB(db);
      message.reply(`✅ تم تحديد هذه الروم لتكون روم الـ **voucher** بنجاح.`);
    }
  },

  // إضافة رد تلقائي جديد بسؤال وجواب
  'add-reply': {
    name: 'add-reply',
    shortcuts: ['اضف-رد'],
    data: new SlashCommandBuilder()
      .setName('add-reply')
      .setDescription('إضافة كلمة أو سؤال ورد تلقائي عليه')
      .addStringOption(opt => opt.setName('question').setDescription('الكلمة التي يكتبها العضو (مثال: سلام عليكم)').setRequired(true))
      .addStringOption(opt => opt.setName('answer').setDescription('رد البوت التلقائي').setRequired(true)),
    executeSlash: async (interaction) => {
      const question = interaction.options.getString('question').trim().toLowerCase();
      const answer = interaction.options.getString('answer');
      const db = getDB();
      
      if (!db.replies) db.replies = {};
      if (!db.replies[interaction.guild.id]) db.replies[interaction.guild.id] = {};
      
      db.replies[interaction.guild.id][question] = answer;
      saveDB(db);
      
      interaction.reply(`✅ تم إضافة الرد التلقائي بنجاح!\n**الكلمة:** ${question}\n**الرد:** ${answer}`);
    },
    executeMessage: async (message, args) => {
      // الاستخدام بالشات: اضف-رد الكلمة | الرد
      const content = args.join(' ');
      const parts = content.split('|');
      if (parts.length < 2) return message.reply('❌ الاستخدام الصحيح: `اضف-رد الكلمة | الرد المكتوب`');
      
      const question = parts[0].trim().toLowerCase();
      const answer = parts[1].trim();
      
      const db = getDB();
      if (!db.replies) db.replies = {};
      if (!db.replies[message.guild.id]) db.replies[message.guild.id] = {};
      
      db.replies[message.guild.id][question] = answer;
      saveDB(db);
      
      message.reply(`✅ تم إضافة الرد التلقائي لـ "**${question}**".`);
    }
  },

  // الأوامر الأساسية السابقة مع دمج الـ Voucher بها تلقائياً:
  'ban': {
    name: 'ban', shortcuts: ['باند', 'حظر', 'ب'],
    data: new SlashCommandBuilder().setName('ban').setDescription('حظر عضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'بدون سبب';
      await interaction.guild.members.ban(user, { reason });
      interaction.reply(`✅ تم حظر الحساب ${user.tag}.`);
      sendVoucher(interaction.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ff0000');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
      if (!user) return message.reply('❌ يرجى منشن العضو.');
      const reason = args.slice(1).join(' ') || 'بدون سبب';
      await message.guild.members.ban(user, { reason });
      message.reply(`✅ تم حظر الحساب **${user.tag}**.`);
      sendVoucher(message.guild, 'الحظر (Ban)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ff0000');
    }
  },

  'kick': {
    name: 'kick', shortcuts: ['طرد', 'ط'],
    data: new SlashCommandBuilder().setName('kick').setDescription('طرد عضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addStringOption(o => o.setName('reason').setDescription('السبب')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'بدون سبب';
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ غير موجود.', ephemeral: true });
      await member.kick(reason);
      interaction.reply(`✅ تم طرد ${user.tag}.`);
      sendVoucher(interaction.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**السبب:** ${reason}`, '#ffa500');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
      if (!user) return message.reply('❌ يرجى تحديد العضو.');
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('❌ غير موجود.');
      const reason = args.slice(1).join(' ') || 'بدون سبب';
      await member.kick(reason);
      message.reply(`✅ تم طرد **${user.tag}**.`);
      sendVoucher(message.guild, 'الطرد (Kick)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**السبب:** ${reason}`, '#ffa500');
    }
  },

  'mute': {
    name: 'mute', shortcuts: ['ميوت', 'م'],
    data: new SlashCommandBuilder().setName('mute').setDescription('ميوت عضو').addUserOption(o => o.setName('user').setRequired(true).setDescription('العضو')).addIntegerOption(o => o.setName('time').setRequired(true).setDescription('الوقت بالدقائق')),
    executeSlash: async (interaction) => {
      const user = interaction.options.getUser('user');
      const time = interaction.options.getInteger('time');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);
      if (!member) return interaction.reply('❌ غير موجود.');
      await member.timeout(time * 60 * 1000, 'أمر ميوت إداري');
      interaction.reply(`✅ تم إعطاء ميوت لـ ${user.tag} لمدة ${time} دقيقة.`);
      sendVoucher(interaction.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${interaction.user.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
    },
    executeMessage: async (message, args) => {
      const user = message.mentions.users.first();
      const time = parseInt(args[1]);
      if (!user || isNaN(time)) return message.reply('❌ الإستخدام: `ميوت @العضو الدقائق`');
      const member = await message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return message.reply('❌ غير موجود.');
      await member.timeout(time * 60 * 1000, 'أمر ميوت إداري');
      message.reply(`✅ تم إعطاء ميوت لـ **${user.tag}** لمدة ${time} دقيقة.`);
      sendVoucher(message.guild, 'كتم (Mute)', `**العضو:** ${user.tag}\n**المسؤول:** ${message.author.tag}\n**المدة:** ${time} دقيقة`, '#ffff00');
    }
  },

  'lock': {
    name: 'lock', shortcuts: ['قفل', 'ق'],
    data: new SlashCommandBuilder().setName('lock').setDescription('قفل الروم الحالية'),
    executeSlash: async (interaction) => {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      interaction.reply('🔒 تم قفل هذه الروم بنجاح.');
      sendVoucher(interaction.guild, 'قفل شات (Lock)', `**الروم:** ${interaction.channel}\n**المسؤول:** ${interaction.user.tag}`, '#0000ff');
    },
    executeMessage: async (message) => {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      message.reply('🔒 تم قفل هذه الروم بنجاح.');
      sendVoucher(message.guild, 'قفل شات (Lock)', `**الروم:** ${message.channel}\n**المسؤول:** ${message.author.tag}`, '#0000ff');
    }
  },

  'unlock': {
    name: 'unlock', shortcuts: ['فتح', 'ف'],
    data: new SlashCommandBuilder().setName('unlock').setDescription('فتح الروم الحالية'),
    executeSlash: async (interaction) => {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      interaction.reply('🔓 تم فتح الروم بنجاح.');
      sendVoucher(interaction.guild, 'فتح شات (Unlock)', `**الروم:** ${interaction.channel}\n**المسؤول:** ${interaction.user.tag}`, '#00ff00');
    },
    executeMessage: async (message) => {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      message.reply('🔓 تم فتح الروم بنجاح.');
      sendVoucher(message.guild, 'فتح شات (Unlock)', `**الروم:** ${message.channel}\n**المسؤول:** ${message.author.tag}`, '#00ff00');
    }
  },

  'info': {
    name: 'info', shortcuts: ['انفو', 'معلومات', 'ا'],
    data: new SlashCommandBuilder().setName('info').setDescription('عرض ملف المطور الشخصي لـ تيم والمعلومات الأساسية لـ TRL.dev'),
    executeSlash: async (interaction) => { interaction.reply({ embeds: [createInfoEmbed()] }); },
    executeMessage: async (message) => { message.reply({ embeds: [createInfoEmbed()] }); }
  }
};

function createInfoEmbed() {
  return new EmbedBuilder()
    .setTitle('📋 الملف الشخصي والمعلومات الأساسية')
    .setColor('#7289da')
    .addFields(
      { name: '👤 الاسم', value: 'تيم (Taim)', inline: true },
      { name: '🛠️ المسمى التقني', value: 'مؤسس وقائد فريق TRL.dev (Lead Developer)', inline: true },
      { name: '📧 البريد الإلكتروني', value: 'hacked909h@gmail.com', inline: false },
      { name: '⚡ المهارات والقدرات التقنية', value: '• تطوير وبرمجة بوتات منصة Discord و Twitch\n• تصميم وتطوير مواقع الويب والتطبيقات (HTML, CSS, JavaScript)\n• تطوير وبناء الألعاب الرقمية\n• إتقان لغات البرمجة: Python, JavaScript' },
      { name: '🚀 المشاريع والإنجازات (تحت مظلة TRL.dev)', value: '• **بوتات إدارة الخوادم والأنظمة:** حماية وإدارة صلاحيات.\n• **بوت كأس العالم:** متابعة المباريات والجدولة تلقائياً.\n• **بوت Gangster bot:** البوت الخاص بالفريق وتطوير ميزاته.' }
    )
    .setFooter({ text: 'system bot for all • Powered by TRL.dev' })
    .setTimestamp();
}
