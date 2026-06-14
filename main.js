require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. تهيئة عميل ديسكورد
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: process.env.SESSION_SECRET || 'bank_bot_secret_key',
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// ================= المسارات (Routes) =================

// الصفحة الرئيسية (تسجيل الدخول)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/dashboard');
    
    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bank bot - بوابة تسجيل الدخول</title>
            <style>
                body {
                    background: radial-gradient(circle at center, #1e1f22, #111214);
                    color: #fff;
                    font-family: 'Segoe UI', sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .login-card {
                    background: #2b2d31;
                    padding: 40px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                    max-width: 400px;
                    width: 90%;
                    border: 1px solid #3f4248;
                }
                .logo {
                    width: 100px;
                    height: 100px;
                    border-radius: 50%;
                    background: #ffcc00;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 50px;
                    margin: 0 auto 20px auto;
                    box-shadow: 0 0 20px rgba(255, 204, 0, 0.4);
                }
                h1 { margin: 10px 0; font-size: 24px; color: #ffcc00; }
                p { color: #b5bac1; font-size: 14px; margin-bottom: 30px; }
                .btn-login {
                    background-color: #5865F2;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    font-size: 16px;
                    font-weight: bold;
                    border-radius: 6px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    transition: background 0.2s, transform 0.1s;
                }
                .btn-login:hover { background-color: #4752C4; transform: translateY(-2px); }
            </style>
        </head>
        <body>
            <div class="login-card">
                <div class="logo">🏦</div>
                <h1>Bank bot 🏛️</h1>
                <p>مرحباً بك في نظام البنك المصرفي المتكامل للديسكورد. قم بتسجيل الدخول للتحكم بأموالك واستعراض إحصائياتك.</p>
                <a href="/auth/discord" class="btn-login">تسجيل الدخول عبر ديسكورد</a>
            </div>
        </body>
        </html>
    `);
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/redirect', passport.authenticate('discord', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect('/dashboard');
});

// صفحة لوحة التحكم الكاملة والمحدثة بالصور والأوامر
app.get('/dashboard', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');

    const user = req.user;
    const avatarURL = user.avatar 
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
        : 'https://cdn.discordapp.com/embed/avatars/0.png';

    res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bank bot - لوحة التحكم</title>
            <style>
                :root {
                    --bg-dark: #111214;
                    --bg-panel: #1e1f22;
                    --bg-card: #2b2d31;
                    --primary-gold: #ffcc00;
                    --discord-blue: #5865F2;
                    --text-muted: #b5bac1;
                }
                body {
                    background-color: var(--bg-dark);
                    color: #fff;
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    min-height: 100vh;
                }
                
                /* لودنج سريع جداً */
                #loader {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: var(--bg-dark);
                    z-index: 9999;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    transition: opacity 0.4s ease, visibility 0.4s;
                }
                .loader-spinner {
                    width: 50px;
                    height: 50px;
                    border: 5px solid var(--bg-card);
                    border-top: 5px solid var(--primary-gold);
                    border-radius: 50%;
                    animation: spin 0.6s linear infinite; /* لودنج سريع جداً */
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* تصميم لوحة التحكم */
                header {
                    background-color: var(--bg-panel);
                    padding: 15px 30px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #2e3035;
                }
                .bot-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .bot-logo {
                    font-size: 28px;
                    background: var(--primary-gold);
                    border-radius: 50%;
                    width: 45px;
                    height: 45px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .user-profile {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .user-avatar {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    border: 2px solid var(--primary-gold);
                }
                .logout-btn {
                    color: #ff4747;
                    text-decoration: none;
                    font-size: 14px;
                    border: 1px solid #ff4747;
                    padding: 6px 12px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                .logout-btn:hover { background: rgba(255,71,71,0.1); }

                .main-container {
                    display: grid;
                    grid-template-columns: 250px 1fr;
                    flex: 1;
                }
                
                /* القائمة الجانبية */
                .sidebar {
                    background-color: var(--bg-panel);
                    padding: 20px;
                    border-left: 1px solid #2e3035;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .tab-btn {
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    text-align: right;
                    padding: 12px 15px;
                    font-size: 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: background 0.2s, color 0.2s;
                }
                .tab-btn:hover, .tab-btn.active {
                    background-color: var(--bg-card);
                    color: #fff;
                    font-weight: bold;
                }
                .tab-btn.active { border-right: 4px solid var(--primary-gold); }

                /* محتوى التبويبات */
                .content { padding: 30px; overflow-y: auto; }
                .tab-content { display: none; }
                .tab-content.active { display: block; }

                /* الكروت والإحصائيات */
                .grid-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background-color: var(--bg-card);
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #3f4248;
                    text-align: center;
                }
                .stat-card h3 { margin: 0 0 10px 0; color: var(--text-muted); font-size: 16px; }
                .stat-card p { margin: 0; font-size: 24px; font-weight: bold; color: var(--primary-gold); }

                /* شبكة الأوامر */
                .commands-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
                    gap: 15px;
                }
                .command-card {
                    background-color: var(--bg-card);
                    border: 1px solid #3f4248;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                    cursor: pointer;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .command-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 4px 12px rgba(255,204,0,0.15);
                    border-color: var(--primary-gold);
                }
                .command-icon { font-size: 24px; margin-bottom: 8px; display: block; }
                .command-name { font-weight: bold; font-size: 15px; color: #fff; }

                /* قائمة الأثرياء (توب) */
                .leaderboard-list {
                    background-color: var(--bg-card);
                    border-radius: 8px;
                    padding: 20px;
                    border: 1px solid #3f4248;
                    max-width: 600px;
                    margin: 0 auto;
                }
                .leaderboard-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    border-bottom: 1px solid #383a40;
                }
                .leaderboard-item:last-child { border-bottom: none; }
                .rank { color: var(--primary-gold); font-weight: bold; }
                .balance { color: #2ecc71; font-weight: bold; }

                /* الأسعار والعقارات */
                .prices-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                .price-card {
                    background-color: var(--bg-card);
                    border: 1px solid #3f4248;
                    border-radius: 8px;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .price-up { color: #2ecc71; }
                .price-down { color: #e74c3c; }
                .price-neutral { color: #95a5a6; }

                /* الألعاب المصغرة التفاعلية */
                .mini-game {
                    background: var(--bg-panel);
                    padding: 20px;
                    border-radius: 10px;
                    border: 1px solid var(--primary-gold);
                    margin-top: 20px;
                }
                .mines-grid {
                    display: grid;
                    grid-template-columns: repeat(5, 45px);
                    gap: 8px;
                    justify-content: center;
                    margin-top: 15px;
                }
                .mine-cell {
                    width: 45px;
                    height: 45px;
                    background: #43b581;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    color: white;
                    font-weight: bold;
                    transition: background 0.1s;
                }
                .mine-cell:hover { background: #3ca374; }

                @media (max-width: 768px) {
                    .main-container { grid-template-columns: 1fr; }
                    .sidebar { flex-direction: row; overflow-x: auto; padding: 10px; }
                    .tab-btn { white-space: nowrap; padding: 8px 12px; font-size: 14px; }
                }
            </style>
        </head>
        <body>

            <!-- شاشة تحميل سريعة جداً -->
            <div id="loader">
                <div class="loader-spinner"></div>
                <h3 style="margin-top: 15px; color: var(--primary-gold);">جاري فتح الخزنة والبنك...</h3>
            </div>

            <!-- الهيدر -->
            <header>
                <div class="bot-info">
                    <div class="bot-logo">🏦</div>
                    <div>
                        <strong style="font-size: 18px; display: block;">Bank bot 🏛️</strong>
                        <span style="font-size: 12px; color: var(--text-muted);">لوحة الحساب المصرفي</span>
                    </div>
                </div>
                <div class="user-profile">
                    <img src="${avatarURL}" class="user-avatar" alt="Avatar">
                    <span style="font-weight: bold;">${user.username}</span>
                    <a href="/auth/logout" class="logout-btn">خروج</a>
                </div>
            </header>

            <!-- محتويات الصفحة -->
            <div class="main-container">
                <!-- القائمة الجانبية -->
                <div class="sidebar">
                    <button class="tab-btn active" onclick="switchTab('commands')">🕹️ الأوامر والألعاب</button>
                    <button class="tab-btn" onclick="switchTab('leaderboard')">🏆 قائمة الأثرياء (توب)</button>
                    <button class="tab-btn" onclick="switchTab('prices')">📈 العقارات والأسعار</button>
                    <button class="tab-btn" onclick="switchTab('mines-simulator')">💣 تجربة لعبة الألغام</button>
                </div>

                <!-- محتوى التبويبات -->
                <div class="content">

                    <!-- تبويب الأوامر -->
                    <div id="commands" class="tab-content active">
                        <div class="grid-stats">
                            <div class="stat-card">
                                <h3>الرصيد المتاح</h3>
                                <p>40.23b $</p>
                            </div>
                            <div class="stat-card">
                                <h3>الذهب المكتسب</h3>
                                <p>3,360 🪙</p>
                            </div>
                            <div class="stat-card">
                                <h3>الحماية النشطة</h3>
                                <p>24 ساعة 🛡️</p>
                            </div>
                        </div>

                        <h2 style="border-bottom: 2px solid var(--bg-card); padding-bottom: 10px; margin-bottom: 20px;">
                            قائمة أوامر البوت الـ 29 الكاملة 📋
                        </h2>
                        <div class="commands-grid">
                            <div class="command-card"><span class="command-icon">🔘</span><span class="command-name">زر</span></div>
                            <div class="command-card"><span class="command-icon">⚔️</span><span class="command-name">تحدي</span></div>
                            <div class="command-card"><span class="command-icon">💥</span><span class="command-name">كراش</span></div>
                            <div class="command-card"><span class="command-icon">🎲</span><span class="command-name">نرد</span></div>
                            <div class="command-card"><span class="command-icon">😜</span><span class="command-name">ايموجي</span></div>
                            <div class="command-card"><span class="command-icon">🎨</span><span class="command-name">الوان</span></div>
                            <div class="command-card"><span class="command-icon">📊</span><span class="command-name">استثمار</span></div>
                            <div class="command-card"><span class="command-icon">🔢</span><span class="command-name">أرقام</span></div>
                            <div class="command-card"><span class="command-icon">🎮</span><span class="command-name">لعبة</span></div>
                            <div class="command-card"><span class="command-icon">🎰</span><span class="command-name">سلوت</span></div>
                            <div class="command-card"><span class="command-icon">📈</span><span class="command-name">تداول</span></div>
                            <div class="command-card"><span class="command-icon">❌</span><span class="command-name">اكس-او</span></div>
                            <div class="command-card"><span class="command-icon">❓</span><span class="command-name">خمن</span></div>
                            <div class="command-card"><span class="command-icon">🎡</span><span class="command-name">حظ</span></div>
                            <div class="command-card"><span class="command-icon">🔤</span><span class="command-name">حرف</span></div>
                            <div class="command-card"><span class="command-icon">🔌</span><span class="command-name">توصيل</span></div>
                            <div class="command-card"><span class="command-icon">♊</span><span class="command-name">تطابق</span></div>
                            <div class="command-card"><span class="command-icon">🍎</span><span class="command-name">فواكه</span></div>
                            <div class="command-card"><span class="command-icon">🎡</span><span class="command-name">روليت</span></div>
                            <div class="command-card"><span class="command-icon">🫣</span><span class="command-name">اختباء</span></div>
                            <div class="command-card"><span class="command-icon">⚡</span><span class="command-name">مخاطرة</span></div>
                            <div class="command-card"><span class="command-icon">🏁</span><span class="command-name">نمط</span></div>
                            <div class="command-card"><span class="command-icon">💣</span><span class="command-name">الغام</span></div>
                            <div class="command-card"><span class="command-icon">🛒</span><span class="command-name">شراء</span></div>
                            <div class="command-card"><span class="command-icon">💰</span><span class="command-name">بيع</span></div>
                            <div class="command-card"><span class="command-icon">💵</span><span class="command-name">بخشيش</span></div>
                            <div class="command-card"><span class="command-icon">🗓️</span><span class="command-name">الراتب</span></div>
                            <div class="command-card"><span class="command-icon">🥷</span><span class="command-name">نهب</span></div>
                            <div class="command-card"><span class="command-icon">📢</span><span class="command-name">المزاد</span></div>
                        </div>
                    </div>

                    <!-- تبويب قائمة الأثرياء (توب) -->
                    <div id="leaderboard" class="tab-content">
                        <h2 style="text-align: center; color: var(--primary-gold);">🏆 قائمة الأثرياء (توب) 🏆</h2>
                        <div class="leaderboard-list">
                            <div class="leaderboard-item">
                                <span><span class="rank">#1</span> @الملك_سليمان</span>
                                <span class="balance">130.00b $</span>
                            </div>
                            <div class="leaderboard-item" style="background-color: rgba(255,204,0,0.05);">
                                <span><span class="rank">#2</span> @${user.username} (أنت)</span>
                                <span class="balance">40.23b $</span>
                            </div>
                            <div class="leaderboard-item">
                                <span><span class="rank">#3</span> @Faisal_777</span>
                                <span class="balance">9.81b $</span>
                            </div>
                            <div class="leaderboard-item">
                                <span><span class="rank">#4</span> @خالد_الأمير</span>
                                <span class="balance">4.66b $</span>
                            </div>
                            <div class="leaderboard-item">
                                <span><span class="rank">#5</span> @عبدالله_سعود</span>
                                <span class="balance">2.70b $</span>
                            </div>
                        </div>
                    </div>

                    <!-- تبويب الأسعار والعقارات -->
                    <div id="prices" class="tab-content">
                        <h2 style="border-bottom: 2px solid var(--bg-card); padding-bottom: 10px; margin-bottom: 20px;">
                            📈 أسعار الأصول والشركات المحدثة
                        </h2>
                        <div class="prices-list">
                            <div class="price-card">
                                <strong>🏰 قصر:</strong>
                                <span class="price-down">▼ 1,094,216 $</span>
                            </div>
                            <div class="price-card">
                                <strong>🍔 مطعم:</strong>
                                <span class="price-down">▼ 2,367,585 $</span>
                            </div>
                            <div class="price-card">
                                <strong>💎 الماس:</strong>
                                <span class="price-up">▲ 1,291,389 $</span>
                            </div>
                            <div class="price-card">
                                <strong>🚢 سفينة:</strong>
                                <span class="price-down">▼ 2,064,849 $</span>
                            </div>
                            <div class="price-card">
                                <strong>🏨 فندق:</strong>
                                <span class="price-down">▼ 1,819,762 $</span>
                            </div>
                            <div class="price-card">
                                <strong>☕ مقهى:</strong>
                                <span class="price-down">▼ 668,810 $</span>
                            </div>
                            <div class="price-card">
                                <strong>🏝️ جزيرة:</strong>
                                <span class="price-down">▼ 3,456,322 $</span>
                            </div>
                            <div class="price-card">
                                <strong>🚀 وكالة ناسا:</strong>
                                <span class="price-neutral">● 3,962,922 $</span>
                            </div>
                        </div>
                    </div>

                    <!-- تجربة لعبة الألغام المصغرة -->
                    <div id="mines-simulator" class="tab-content">
                        <div class="mini-game" style="text-align: center;">
                            <h3>💣 حقل الألغام التفاعلي (تجربة اللعب)</h3>
                            <p style="font-size: 13px; color: var(--text-muted);">انقر على المربعات لتجنب المتفجرات وتجميع الذهب!</p>
                            <p>الخسارة الحالية: <span style="color: #e74c3c;">0 / 3</span> | الذهب المكتسب: <span style="color: var(--primary-gold);" id="gold-counter">0 🪙</span></p>
                            <div class="mines-grid" id="mines-board">
                                <!-- سيتم تعبئة الخلايا برمجياً عبر الـ JS -->
                            </div>
                            <button onclick="resetMinesGame()" style="margin-top: 15px; padding: 8px 16px; background: var(--primary-gold); color: black; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">إعادة اللعب</button>
                        </div>
                    </div>

                </div>
            </div>

            <script>
                // لودنج سريع جداً (إخفاء شاشة التحميل بعد 800 مللي ثانية فقط)
                window.addEventListener('DOMContentLoaded', () => {
                    setTimeout(() => {
                        const loader = document.getElementById('loader');
                        loader.style.opacity = '0';
                        setTimeout(() => {
                            loader.style.visibility = 'hidden';
                        }, 400);
                    }, 800);
                });

                // تفعيل التبديل السريع بين التبويبات
                function switchTab(tabId) {
                    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
                    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
                    
                    document.getElementById(tabId).classList.add('active');
                    event.currentTarget.classList.add('active');
                }

                // محاكاة لعبة الألغام التفاعلية
                let goldEarned = 0;
                function initMines() {
                    const board = document.getElementById('mines-board');
                    board.innerHTML = '';
                    for (let i = 0; i < 25; i++) {
                        const cell = document.createElement('button');
                        cell.className = 'mine-cell';
                        cell.innerText = '?';
                        cell.onclick = function() {
                            if (Math.random() > 0.2) {
                                cell.style.background = '#2ecc71';
                                cell.innerText = '🪙';
                                cell.disabled = true;
                                goldEarned += 10;
                                document.getElementById('gold-counter').innerText = goldEarned + ' 🪙';
                            } else {
                                cell.style.background = '#e74c3c';
                                cell.innerText = '💥';
                                cell.disabled = true;
                                alert('انفجر لغم! حاول مرة أخرى');
                                resetMinesGame();
                            }
                        };
                        board.appendChild(cell);
                    }
                }
                function resetMinesGame() {
                    goldEarned = 0;
                    document.getElementById('gold-counter').innerText = '0 🪙';
                    initMines();
                }
                initMines();
            </script>
        </body>
        </html>
    `);
});

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect('/');
    });
});

client.once('ready', () => {
    console.log(`[BOT] تم تشغيل البوت باسم: ${client.user.tag}`);
});

if (process.env.DISCORD_TOKEN) {
    client.login(process.env.DISCORD_TOKEN).catch(console.error);
}

app.listen(PORT, () => {
    console.log(`[SERVER] السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});