import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import asyncio
import random
import time
import os
import sys
import threading
from flask import Flask

# ========== خادم ويب لـ Render ==========
تطبيق_ويب = Flask(__name__)

@تطبيق_ويب.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال!"

def تشغيل_الخادم():
    تطبيق_ويب.run(host='0.0.0.0', port=8080)

# ========== التوكن من متغير البيئة ==========
التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ لم يتم تعيين DISCORD_TOKEN في متغيرات البيئة")
    sys.exit(1)

# ========== إعدادات اللعبة ==========
عملات_البداية = 1000
رصيد_البداية = 0
مكافأة_يومية_عملات = 500
مكافأة_يومية_رصيد = 10
مكافأة_ساعية_عملات = 100
الحد_الأدنى_للعمل = 50
الحد_الأقصى_للعمل = 200
الحد_الأقصى_لاسم_الفريق = 20
ثواني_اليوم = 86400
ثواني_الساعة = 3600
صحة_الفريق_البدائية = 100
ضرر_اللكمة = 5

# أضرار الأسلحة (رقم السلعة -> الضرر)
أضرار_الأسلحة = {
    2: 20,   # سيف حديدي
    7: 40,   # ناب تنين
    9: 15,   # حذاء البرق
    12: 25,  # قوس إلف
    16: 35,  # رفيق ذئب
    23: 30,  # عصا النار
}

# ========== قاعدة البيانات ==========
مسار_قاعدة_البيانات = "game_data.db"

async def تشغيل_متزامن(دالة, *args, **kwargs):
    return await asyncio.to_thread(دالة, *args, **kwargs)

def تهيئة_قاعدة_البيانات_متزامن():
    اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
    ك = اتصال.cursor()
    
    # إنشاء الجداول
    ك.execute('''CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 1000,
        credits INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        last_hourly INTEGER DEFAULT 0,
        active_team INTEGER DEFAULT 0
    )''')
    
    ك.execute('''CREATE TABLE IF NOT EXISTS teams (
        user_id TEXT,
        slot INTEGER,
        name TEXT DEFAULT '',
        health INTEGER DEFAULT 100,
        PRIMARY KEY (user_id, slot)
    )''')
    
    ك.execute('''CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id INTEGER,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id)
    )''')
    
    ك.execute('''CREATE TABLE IF NOT EXISTS shop (
        item_id INTEGER PRIMARY KEY,
        name TEXT,
        coin_price INTEGER,
        credit_price INTEGER,
        description TEXT
    )''')
    
    # تعبئة المتجر إذا كان فارغاً
    ك.execute("SELECT COUNT(*) FROM shop")
    if ك.fetchone()[0] == 0:
        العناصر = [
            (1, "🍎 تفاحة سحرية", 100, 5, "تستعيد 20 صحة"),
            (2, "🗡️ سيف حديدي", 250, 10, "+20 ضرر"),
            (3, "🛡️ درع فولاذي", 200, 8, "+8 دفاع"),
            (4, "💎 ياقوتة", 500, 20, "حجر كريم"),
            (5, "🧪 جرعة شفاء", 80, 3, "تشفي 50 صحة"),
            (6, "📜 درع قديم", 300, 12, "مهارة جديدة"),
            (7, "🐉 ناب تنين", 1000, 40, "+40 ضرر"),
            (8, "👑 تاج الملوك", 2000, 80, "سلطة ملكية"),
            (9, "⚡ حذاء البرق", 400, 15, "+15 ضرر"),
            (10, "🔮 كرة بلورية", 350, 14, "تكشف الأسرار"),
            (11, "🧥 عباءة الظلال", 450, 18, "تخفي"),
            (12, "🏹 قوس إلف", 600, 25, "+25 ضرر"),
            (13, "🍄 عيش غراب ذهبي", 150, 6, "تأثير عشوائي"),
            (14, "🧙 قبعة الساحر", 700, 28, "+15 سحر"),
            (15, "⛏️ فأس قزم", 500, 20, "تعدين"),
            (16, "🐺 رفيق ذئب", 1200, 50, "+35 ضرر"),
            (17, "🕯️ شمعة الحقيقة", 180, 7, "تكشف الأكاذيب"),
            (18, "🧩 مفتاح غامض", 250, 10, "يفتح الأبواب"),
            (19, "💀 كتاب الموتى", 1500, 60, "يستحضر الموتى"),
            (20, "🧪 إكسير الحياة", 3000, 120, "يطيل العمر"),
            (21, "🎣 صنارة صيد", 200, 8, "تصطاد سمكاً"),
            (22, "🏔️ درع الجليد", 800, 32, "مقاومة البرد"),
            (23, "🔥 عصا النار", 900, 36, "+30 ضرر"),
            (24, "🌀 تميمة الريح", 550, 22, "يتحكم بالرياح"),
            (25, "🌟 شظية نجم", 400, 16, "يحقق الأمنيات")
        ]
        ك.executemany("INSERT INTO shop VALUES (?,?,?,?,?)", العناصر)
    
    اتصال.commit()
    اتصال.close()

async def تهيئة_قاعدة_البيانات():
    await تشغيل_متزامن(تهيئة_قاعدة_البيانات_متزامن)

async def احصل_على_مستخدم(معرف_المستخدم):
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("SELECT coins, credits, last_daily, last_hourly, active_team FROM users WHERE user_id = ?", (معرف_المستخدم,))
        صف = ك.fetchone()
        if صف is None:
            ك.execute("INSERT INTO users (user_id, coins, credits) VALUES (?, ?, ?)", (معرف_المستخدم, عملات_البداية, رصيد_البداية))
            ك.execute("INSERT OR IGNORE INTO teams (user_id, slot, health) VALUES (?, 0, ?), (?, 1, ?)", 
                      (معرف_المستخدم, صحة_الفريق_البدائية, معرف_المستخدم, صحة_الفريق_البدائية))
            اتصال.commit()
            return {"coins": عملات_البداية, "credits": رصيد_البداية, "last_daily": 0, "last_hourly": 0, "active_team": 0}
        return {"coins": صف[0], "credits": صف[1], "last_daily": صف[2], "last_hourly": صف[3], "active_team": صف[4]}
    return await تشغيل_متزامن(_get)

async def تحديث_مستخدم(معرف_المستخدم, **kwargs):
    def _update():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        for مفتاح, قيمة in kwargs.items():
            ك.execute(f"UPDATE users SET {مفتاح} = ? WHERE user_id = ?", (قيمة, معرف_المستخدم))
        اتصال.commit()
        اتصال.close()
    await تشغيل_متزامن(_update)

async def احصل_على_فريق(معرف_المستخدم, الرقم, مع_الصحة=False):
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        if مع_الصحة:
            ك.execute("SELECT name, health FROM teams WHERE user_id = ? AND slot = ?", (معرف_المستخدم, الرقم))
            صف = ك.fetchone()
            اتصال.close()
            return (صف[0], صف[1]) if صف else ("", صحة_الفريق_البدائية)
        else:
            ك.execute("SELECT name FROM teams WHERE user_id = ? AND slot = ?", (معرف_المستخدم, الرقم))
            صف = ك.fetchone()
            اتصال.close()
            return صف[0] if صف else ""
    return await تشغيل_متزامن(_get)

async def تعيين_فريق(معرف_المستخدم, الرقم, الاسم):
    def _set():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("INSERT OR REPLACE INTO teams (user_id, slot, name, health) VALUES (?, ?, ?, COALESCE((SELECT health FROM teams WHERE user_id=? AND slot=?), ?))",
                  (معرف_المستخدم, الرقم, الاسم, معرف_المستخدم, الرقم, صحة_الفريق_البدائية))
        اتصال.commit()
        اتصال.close()
    await تشغيل_متزامن(_set)

async def تحديث_صحة_الفريق(معرف_المستخدم, الرقم, صحة_جديدة):
    def _update():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("UPDATE teams SET health = ? WHERE user_id = ? AND slot = ?", (صحة_جديدة, معرف_المستخدم, الرقم))
        اتصال.commit()
        اتصال.close()
    await تشغيل_متزامن(_update)

async def احصل_على_كل_المستخدمين():
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("SELECT user_id, coins FROM users")
        rows = ك.fetchall()
        اتصال.close()
        return rows
    return await تشغيل_متزامن(_get)

async def أضف_إلى_المخزون(معرف_المستخدم, رقم_السلعة, كمية):
    def _add():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?",
                  (معرف_المستخدم, رقم_السلعة, كمية, كمية))
        اتصال.commit()
        اتصال.close()
    await تشغيل_متزامن(_add)

async def احصل_على_المخزون(معرف_المستخدم):
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("SELECT item_id, quantity FROM inventory WHERE user_id = ?", (معرف_المستخدم,))
        rows = ك.fetchall()
        اتصال.close()
        return rows
    return await تشغيل_متزامن(_get)

async def احصل_على_سلعة_من_المتجر(رقم_السلعة):
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop WHERE item_id = ?", (رقم_السلعة,))
        صف = ك.fetchone()
        اتصال.close()
        if صف:
            return {"id": صف[0], "name": صف[1], "coinPrice": صف[2], "creditPrice": صف[3], "desc": صف[4]}
        return None
    return await تشغيل_متزامن(_get)

async def احصل_على_كل_المتجر():
    def _get():
        اتصال = sqlite3.connect(مسار_قاعدة_البيانات)
        ك = اتصال.cursor()
        ك.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop ORDER BY item_id")
        rows = ك.fetchall()
        اتصال.close()
        return [{"id": ص[0], "name": ص[1], "coinPrice": ص[2], "creditPrice": ص[3], "desc": ص[4]} for ص in rows]
    return await تشغيل_متزامن(_get)

async def احصل_على_أفضل_سلاح(معرف_المستخدم):
    المخزون = await احصل_على_المخزون(معرف_المستخدم)
    افضل_ضرر = ضرر_اللكمة
    for رقم_السلعة, كمية in المخزون:
        if كمية > 0 and رقم_السلعة in أضرار_الأسلحة:
            افضل_ضرر = max(افضل_ضرر, أضرار_الأسلحة[رقم_السلعة])
    return افضل_ضرر

# ========== إعداد البوت ==========
الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

# ========== الأوامر ==========
@bot.tree.command(name="مساعدة", description="عرض جميع أوامر البوت")
async def مساعدة(interaction: discord.Interaction):
    تضمين = discord.Embed(title="🤖 قائمة أوامر البوت", color=0x5865F2)
    تضمين.add_field(name="💰 الاقتصاد", value="`/رصيدي`, `/يومي`, `/ساعي`, `/اعمل`, `/الاغنياء`", inline=False)
    تضمين.add_field(name="🛒 المتجر", value="`/المتجر`, `/اشتري`, `/مخزني`", inline=False)
    تضمين.add_field(name="👥 الفرق", value="`/تعيين_فريق`, `/تفعيل_فريق`, `/فرقي`", inline=False)
    تضمين.add_field(name="⚔️ القتال", value="`/هجوم @لاعب` - مهاجمة الفريق النشط للخصم", inline=False)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="رصيدي", description="عرض رصيدك من العملات والرصيد المميز")
async def رصيدي(interaction: discord.Interaction):
    المستخدم = await احصل_على_مستخدم(str(interaction.user.id))
    تضمين = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
    تضمين.add_field(name="🪙 العملات", value=المستخدم["coins"], inline=True)
    تضمين.add_field(name="💎 الرصيد المميز", value=المستخدم["credits"], inline=True)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="يومي", description="احصل على مكافأتك اليومية")
async def يومي(interaction: discord.Interaction):
    معرف = str(interaction.user.id)
    المستخدم = await احصل_على_مستخدم(معرف)
    الآن = int(time.time())
    if الآن - المستخدم["last_daily"] < ثواني_اليوم:
        باقي = ثواني_اليوم - (الآن - المستخدم["last_daily"])
        س = باقي // 3600
        د = (باقي % 3600) // 60
        await interaction.response.send_message(f"⏳ انتظر {س} ساعة {د} دقيقة", ephemeral=True)
        return
    await تحديث_مستخدم(معرف, last_daily=الآن, coins=المستخدم["coins"]+مكافأة_يومية_عملات, credits=المستخدم["credits"]+مكافأة_يومية_رصيد)
    await interaction.response.send_message(f"🎁 +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد")

@bot.tree.command(name="ساعي", description="احصل على مكافأة كل ساعة")
async def ساعي(interaction: discord.Interaction):
    معرف = str(interaction.user.id)
    المستخدم = await احصل_على_مستخدم(معرف)
    الآن = int(time.time())
    if الآن - المستخدم["last_hourly"] < ثواني_الساعة:
        باقي = ثواني_الساعة - (الآن - المستخدم["last_hourly"])
        د = باقي // 60
        await interaction.response.send_message(f"⏳ انتظر {د} دقيقة", ephemeral=True)
        return
    await تحديث_مستخدم(معرف, last_hourly=الآن, coins=المستخدم["coins"]+مكافأة_ساعية_عملات)
    await interaction.response.send_message(f"⏲️ +{مكافأة_ساعية_عملات} عملة")

@bot.tree.command(name="اعمل", description="اعمل لكسب عملات إضافية")
async def اعمل(interaction: discord.Interaction):
    كسب = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
    معرف = str(interaction.user.id)
    المستخدم = await احصل_على_مستخدم(معرف)
    await تحديث_مستخدم(معرف, coins=المستخدم["coins"]+كسب)
    await interaction.response.send_message(f"💼 كسبت {كسب} عملة")

@bot.tree.command(name="الاغنياء", description="عرض أغنى 10 لاعبين")
async def الاغنياء(interaction: discord.Interaction):
    rows = await احصل_على_كل_المستخدمين()
    مرتبة = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not مرتبة:
        await interaction.response.send_message("لا يوجد مستخدمون بعد")
        return
    الوصف = ""
    for i, (معرف, عملات) in enumerate(مرتبة):
        المستخدم = await البوت.fetch_user(int(معرف))
        الاسم = المستخدم.display_name if المستخدم else "مجهول"
        الوصف += f"{i+1}. **{الاسم}** — {عملات} 🪙\n"
    تضمين = discord.Embed(title="🏆 قائمة الأغنياء", description=الوصف, color=0xFFD700)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="المتجر", description="عرض المتجر (25 سلعة)")
async def المتجر(interaction: discord.Interaction):
    السلع = await احصل_على_كل_المتجر()
    تضمين = discord.Embed(title="🛒 المتجر", description="اشتري بـ `/اشتري [الرقم] [عملات/رصيد] [الكمية]`\nالرصيد المميز يعطي ضعف الكمية", color=0x3498db)
    for س in السلع[:12]:
        تضمين.add_field(name=f"{س['id']}. {س['name']}", value=f"🪙 {س['coinPrice']} | 💎 {س['creditPrice']}\n{س['desc']}", inline=True)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="اشتري", description="شراء سلعة من المتجر")
@app_commands.choices(العملة=[
    app_commands.Choice(name="عملات", value="coins"),
    app_commands.Choice(name="رصيد مميز", value="credits")
])
async def اشتري(interaction: discord.Interaction, رقم_السلعة: int, العملة: str, الكمية: int = 1):
    if الكمية < 1:
        الكمية = 1
    السلعة = await احصل_على_سلعة_من_المتجر(رقم_السلعة)
    if not السلعة:
        await interaction.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    معرف = str(interaction.user.id)
    المستخدم = await احصل_على_مستخدم(معرف)
    if العملة == "coins":
        السعر = السلعة["coinPrice"]
        المضاعف = 1
    else:
        السعر = السلعة["creditPrice"]
        المضاعف = 2
    التكلفة = السعر * الكمية
    if العملة == "coins":
        if المستخدم["coins"] < التكلفة:
            await interaction.response.send_message(f"❌ تحتاج {التكلفة} عملة", ephemeral=True)
            return
        await تحديث_مستخدم(معرف, coins=المستخدم["coins"] - التكلفة)
    else:
        if المستخدم["credits"] < التكلفة:
            await interaction.response.send_message(f"❌ تحتاج {التكلفة} رصيد", ephemeral=True)
            return
        await تحديث_مستخدم(معرف, credits=المستخدم["credits"] - التكلفة)
    المستلم = الكمية * المضاعف
    await أضف_إلى_المخزون(معرف, رقم_السلعة, المستلم)
    await interaction.response.send_message(f"✅ اشتريت {المستلم} × {السلعة['name']}")

@bot.tree.command(name="مخزني", description="عرض العناصر التي تمتلكها")
async def مخزني(interaction: discord.Interaction):
    معرف = str(interaction.user.id)
    المخزون = await احصل_على_المخزون(معرف)
    if not المخزون:
        await interaction.response.send_message("📦 مخزونك فارغ", ephemeral=True)
        return
    الوصف = ""
    for رقم_السلعة, كمية in المخزون[:10]:
        السلعة = await احصل_على_سلعة_من_المتجر(رقم_السلعة)
        if السلعة:
            الوصف += f"• {السلعة['name']} x{كمية}\n"
    تضمين = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=الوصف, color=0x2ecc71)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="تعيين_فريق", description="تعيين اسم لأحد فريقيك")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1),
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تعيين_فريق(interaction: discord.Interaction, الرقم: int, الاسم: str):
    if len(الاسم) > الحد_الأقصى_لاسم_الفريق:
        الاسم = الاسم[:الحد_الأقصى_لاسم_الفريق]
    معرف = str(interaction.user.id)
    await تعيين_فريق(معرف, الرقم-1, الاسم)
    await interaction.response.send_message(f"✅ تم تسمية الفريق {الرقم} → {الاسم}")

@bot.tree.command(name="تفعيل_فريق", description="تبديل الفريق النشط")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1),
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تفعيل_فريق(interaction: discord.Interaction, الرقم: int):
    معرف = str(interaction.user.id)
    await تحديث_مستخدم(معرف, active_team=الرقم-1)
    اسم_الفريق = await احصل_على_فريق(معرف, الرقم-1) or "بدون اسم"
    await interaction.response.send_message(f"🔁 تم تفعيل الفريق {الرقم} ({اسم_الفريق})")

@bot.tree.command(name="فرقي", description="عرض فرقك والفريق النشط")
async def فرقي(interaction: discord.Interaction):
    معرف = str(interaction.user.id)
    اسم1, صحة1 = await احصل_على_فريق(معرف, 0, مع_الصحة=True)
    اسم2, صحة2 = await احصل_على_فريق(معرف, 1, مع_الصحة=True)
    المستخدم = await احصل_على_مستخدم(معرف)
    تضمين = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
    تضمين.add_field(name="الفريق الأول", value=f"الاسم: {اسم1 or 'غير محدد'}\n❤️ الصحة: {صحة1}", inline=False)
    تضمين.add_field(name="الفريق الثاني", value=f"الاسم: {اسم2 or 'غير محدد'}\n❤️ الصحة: {صحة2}", inline=False)
    تضمين.add_field(name="الفريق النشط", value=f"الفريق {المستخدم['active_team']+1}", inline=False)
    await interaction.response.send_message(embed=تضمين)

@bot.tree.command(name="هجوم", description="مهاجمة الفريق النشط لشخص آخر")
async def هجوم(interaction: discord.Interaction, الخصم: discord.Member):
    معرف_المهاجم = str(interaction.user.id)
    معرف_الخصم = str(الخصم.id)

    if معرف_المهاجم == معرف_الخصم:
        await interaction.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
        return

    # بيانات المهاجم
    بيانات_المهاجم = await احصل_على_مستخدم(معرف_المهاجم)
    رقم_فريق_المهاجم = بيانات_المهاجم["active_team"]
    اسم_فريق_المهاجم, _ = await احصل_على_فريق(معرف_المهاجم, رقم_فريق_المهاجم, مع_الصحة=True)

    # بيانات الخصم
    بيانات_الخصم = await احصل_على_مستخدم(معرف_الخصم)
    رقم_فريق_الخصم = بيانات_الخصم["active_team"]
    اسم_فريق_الخصم, صحة_فريق_الخصم = await احصل_على_فريق(معرف_الخصم, رقم_فريق_الخصم, مع_الصحة=True)

    if صحة_فريق_الخصم <= 0:
        await interaction.response.send_message(f"❌ فريق {الخصم.display_name} قد هُزم بالفعل!", ephemeral=True)
        return

    # حساب الضرر
    الضرر = await احصل_على_أفضل_سلاح(معرف_المهاجم)
    الصحة_الجديدة = max(0, صحة_فريق_الخصم - الضرر)

    # تحديث صحة فريق الخصم
    await تحديث_صحة_الفريق(معرف_الخصم, رقم_فريق_الخصم, الصحة_الجديدة)

    # إرسال إشعار للخصم
    try:
        await الخصم.send(f"⚔️ **فريقك `{اسم_فريق_الخصم}` تعرض للهجوم من {interaction.user.display_name}!**\n💥 الضرر: {الضرر}\n❤️ الصحة المتبقية: {الصحة_الجديدة}")
    except:
        pass

    # الرد على المهاجم
    تضمين = discord.Embed(title="⚔️ نتيجة الهجوم", color=0xFF4500)
    تضمين.add_field(name="المهاجم", value=f"{interaction.user.display_name} (فريق: {اسم_فريق_المهاجم})", inline=False)
    تضمين.add_field(name="الخصم", value=f"{الخصم.display_name} (فريق: {اسم_فريق_الخصم})", inline=False)
    تضمين.add_field(name="الضرر", value=str(الضرر), inline=True)
    تضمين.add_field(name="الصحة المتبقية", value=str(الصحة_الجديدة), inline=True)
    if الصحة_الجديدة == 0:
        تضمين.add_field(name="💀 النتيجة", value="تم هزيمة الفريق!", inline=False)
    await interaction.response.send_message(embed=تضمين)

# ========== تشغيل البوت ==========
@bot.event
async def on_ready():
    print(f"✅ البوت دخل باسم {bot.user}")
    await bot.tree.sync()
    print("✅ تم مزامنة جميع الأوامر")

async def الرئيسي():
    print("🚀 جاري تشغيل البوت...")
    await تهيئة_قاعدة_البيانات()
    print("✅ قاعدة البيانات جاهزة")
    
    # تشغيل خادم Flask في الخلفية
    خيط_فلاسك = threading.Thread(target=تشغيل_الخادم, daemon=True)
    خيط_فلاسك.start()
    print("✅ خادم الويب شغال على منفذ 8080")
    
    await البوت.start(التوكن)

if __name__ == "__main__":
    try:
        asyncio.run(الرئيسي())
    except discord.LoginFailure:
        print("❌ فشل تسجيل الدخول. تأكد من DISCORD_TOKEN")
    except KeyboardInterrupt:
        print("⏹️ تم إيقاف البوت")
    except Exception as e:
        print(f"❌ خطأ: {e}")