const tmi = require('tmi.js');

// إعدادات الاتصال بالبوت
const opts = {
  identity: {
    username: 'taymksa12', // اسم الحساب الذي استخرجت له التوكن
    password: 'oauth:هنا_تضع_الـ_ACCESS_TOKEN_اللي_نسخته' // تأكد من ترك كلمة oauth: واكتب التوكن بعدها مباشرة
  },
  channels: [
    'هنا_تضع_اسم_قناتك_الأساسية' // اسم القناة التي تريد للبوت أن يدخل شاتها
  ]
};

// إنشاء عميل البوت
const client = new tmi.client(opts);

// حدث يتم تشغيله عندما يتصل البوت بالشات بنجاح
client.on('connected', (address, port) => {
  console.log(` تم تشغيل البوت بنجاح والاتصال بـ ${address}:${port}`);
});

// قراءة الرسائل والرد على الأوامر
client.on('message', (target, context, msg, self) => {
  if (self) { return; } // تجنب أن يرد البوت على نفسه

  // تنظيف الرسالة من الفراغات الزائدة
  const commandName = msg.trim();

  // أمر تجريبي: إذا كتب شخص !ping
  if (commandName === '!ping') {
    client.say(target, `pong! البوت شغال وجاهز بلغة JS يا ${context['display-name']} 🚀`);
  }
});

// تشغيل البوت
client.connect();
