const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. الاتصال بقاعدة بيانات MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('تم الاتصال بقاعدة بيانات MongoDB بنجاح.'))
    .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

// 2. تشغيل ملف البوت (index.js) ليعمل مع السيرفر تلقائياً
require('./index.js');

app.use(express.json());

// 3. صفحة الداشبورد الرئيسية (مظهر بسيط جداً لتأكيد عمل البوت)
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>لوحة تحكم البوت</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; background-color: #2c2f33; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                .card { text-align: center; background-color: #23272a; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); max-width: 400px; width: 90%; }
                h1 { color: #5865F2; margin-bottom: 10px; font-size: 24px; }
                p { color: #b9bbbe; font-size: 16px; margin-bottom: 20px; }
                .status { display: inline-block; padding: 8px 20px; background-color: #43b581; color: white; border-radius: 20px; font-weight: bold; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>لوحة تحكم البوت</h1>
                <p>البوت متصل بقاعدة البيانات ويعمل الآن بنجاح على منصة Render.</p>
                <div class="status">متصل (Online)</div>
            </div>
        </body>
        </html>
    `);
});

// 4. تشغيل السيرفر على المنفذ المطلوب
app.listen(PORT, () => {
    console.log(`السيرفر يعمل الآن على المنفذ: ${PORT}`);
});