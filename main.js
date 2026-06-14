require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. تهيئة عميل ديسكورد (Discord Client)
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// 2. إعداد طريقة حفظ واسترجاع بيانات المستخدم داخل الجلسة
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// 3. تهيئة استراتيجية الدخول عبر ديسكورد (OAuth2)
passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds'] // طلب الوصول لبيانات الحساب والسيرفرات المشترك بها
}, (accessToken, refreshToken, profile, done) => {
    // يمكن هنا حفظ المستخدم في قاعدة بيانات إذا رغبت مستقبلاً
    process.nextTick(() => done(null, profile));
}));

// 4. إعداد الجلسات (Sessions)
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false // اجعلها true فقط إذا كنت تستخدم بروتوكول https آمن (على رندر ستعمل بشكل تلقائي)
    }
}));

// 5. تفعيل نظام passport لإدارة الجلسات
app.use(passport.initialize());
app.use(passport.session());

// ================= المسارات (Routes) =================

// الصفحة الرئيسية
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1>مرحباً بك، ${req.user.username}</h1>
                <p>تم تسجيل دخولك بنجاح عبر حساب ديسكورد.</p>
                <a href="/dashboard" style="text-decoration: none; background: #5865F2; color: white; padding: 10px 20px; border-radius: 5px;">لوحة التحكم</a>
                <br><br>
                <a href="/auth/logout" style="color: red;">تسجيل الخروج</a>
            </div>
        `);
    } else {
        res.send(`
            <div style="font-family: Arial, sans-serif; text-align: center; margin-top: 50px;">
                <h1>لوحة تحكم البوت</h1>
                <p>يرجى تسجيل الدخول للوصول إلى لوحة التحكم الخاصة بك.</p>
                <a href="/auth/discord" style="text-decoration: none; background: #5865F2; color: white; padding: 12px 24px; border-radius: 5px; font-weight: bold; display: inline-block;">
                    تسجيل الدخول عبر ديسكورد
                </a>
            </div>
        `);
    }
});

// مسار بدء عملية تسجيل الدخول وتوجيه المستخدم لديسكورد
app.get('/auth/discord', passport.authenticate('discord'));

// مسار استقبال الرد من ديسكورد (Callback URL)
app.get('/auth/redirect', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

// صفحة لوحة التحكم المحمية
app.get('/dashboard', (req, res) => {
    // التحقق من أن المستخدم قام بتسجيل الدخول فعلاً
    if (!req.isAuthenticated()) return res.redirect('/');
    
    res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2>لوحة التحكم الخاصة بك</h2>
            <p><strong>اسم المستخدم:</strong> ${req.user.username}</p>
            <p><strong>معرّف الحساب (ID):</strong> ${req.user.id}</p>
            <p><strong>عدد السيرفرات المشترك بها:</strong> ${req.user.guilds ? req.user.guilds.length : 0}</p>
            <hr>
            <a href="/" style="color: blue; text-decoration: none;">العودة للرئيسية</a>
        </div>
    `);
});

// مسار تسجيل الخروج
app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

// ================= تشغيل البوت والسيرفر =================

client.once('ready', () => {
    console.log(`[BOT] تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
});

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(err => {
        console.error("[ERROR] فشل تسجيل دخول البوت:", err.message);
    });
} else {
    console.warn("[WARNING] لم يتم العثور على DISCORD_TOKEN في المتغيرات البيئية.");
}

app.listen(PORT, () => {
    console.log(`[SERVER] السيرفر يعمل على منفذ: ${PORT}`);
});