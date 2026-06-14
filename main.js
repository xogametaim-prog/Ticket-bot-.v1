require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenAI } = require('@google/genai');

// 1. تهيئة عميل ديسكورد مع الـ Intents الأساسية لقراءة الرسائل
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // ضروري جداً لكي يقرأ البوت نصوص الرسائل
    ]
});

// 2. تهيئة مكتبة Google Gen AI باستخدام المفتاح المخزن في .env
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// اسم الروم المخصص للذكاء الاصطناعي (يمكنك تغييره للاسم الذي تفضله في سيرفرك)
const AI_CHANNEL_NAME = 'روم-الذكاء-الاصطناعي';

client.once('ready', () => {
    console.log(`[BOT] تم تشغيل Bank Bot بنجاح! متصل كـ: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // تجاهل رسائل البوتات وتجاهل رسائل البوت نفسه لمنع التكرار اللانهائي
    if (message.author.bot) return;

    // التحقق مما إذا كان العضو قد عمل منشن للبوت، أو يرسل في الروم المخصص للذكاء الاصطناعي
    const isMentioned = message.mentions.has(client.user.id) && !message.mentions.everyone;
    const isInAIChannel = message.channel.name === AI_CHANNEL_NAME;

    if (isMentioned || isInAIChannel) {
        // تشغيل مؤشر "يكتب الآن..." لإعطاء مظهر تفاعلي طبيعي
        message.channel.sendTyping();

        // تنظيف نص الرسالة من المنشن لتمرير السؤال الصافي للذكاء الاصطناعي
        let cleanPrompt = message.content.replace(`<@${client.user.id}>`, '').trim();

        // رد سريع إذا تم المنشن دون كتابة سؤال
        if (!cleanPrompt && isMentioned) {
            return message.reply("مرحباً! أنا **Bank Bot** 🏦، كيف يمكنني مساعدتك مالياً أو الإجابة على استفساراتك اليوم؟");
        }

        try {
            // استدعاء نموذج gemini-2.5-flash الأحدث والسريع
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: cleanPrompt,
                config: {
                    // توجيهات النظام لتحديد شخصية البوت المصرفية والذكية
                    systemInstruction: "أنت 'Bank Bot' (بانك بوت)، بوت ديسكورد تفاعلي ذكي متخصص في الاقتصاد والعملات والألعاب التفاعلية. أسلوبك واثق، راقٍ وممتع، وأجوبتك مختصرة وتناسب محادثات الشات السريعة."
                }
            });

            const replyText = response.text;

            // التحقق من طول الرسالة لأن ديسكورد يمنع إرسال أكثر من 2000 حرف دفعة واحدة
            if (replyText.length > 2000) {
                const chunks = replyText.match(/[\s\S]{1,1950}/g) || [replyText];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(replyText);
            }

        } catch (error) {
            console.error("[GEMINI ERROR] حدث خطأ أثناء معالجة الرد الذكي:", error);
            await message.reply("عذراً، واجهت مشكلة في التفكير حالياً. يرجى محاولة سؤالي لاحقاً! 🏛️");
        }
    }
});

// تسجيل دخول البوت
if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
} else {
    console.error("[ERROR] لم يتم العثور على DISCORD_TOKEN في ملف .env");
}