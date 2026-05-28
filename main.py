import discord
from discord.ext import commands
from discord import app_commands
import sqlite3
import asyncio
import random
import time
import os
import logging
import sys

# ========== إعدادات التسجيل ==========
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# ========== التوكن من متغير البيئة ==========
TOKEN = os.getenv("DISCORD_TOKEN")
if TOKEN is None:
    raise ValueError("❌ DISCORD_TOKEN environment variable not set.")

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

# ========== قاعدة البيانات (sqlite3) ==========
مسار_قاعدة_البيانات = "game_data.db"

async def تنفيذ_متزامن(func, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)

def _تهيئة_قاعدة_البيانات():
    conn = sqlite3.connect(مسار_قاعدة_البيانات)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        coins INTEGER DEFAULT 1000,
        credits INTEGER DEFAULT 0,
        last_daily INTEGER DEFAULT 0,
        last_hourly INTEGER DEFAULT 0,
        active_team INTEGER DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS teams (
        user_id TEXT,
        slot INTEGER,
        name TEXT DEFAULT '',
        PRIMARY KEY (user_id, slot)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS inventory (
        user_id TEXT,
        item_id INTEGER,
        quantity INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, item_id)
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS shop (
        item_id INTEGER PRIMARY KEY,
        name TEXT,
        coin_price INTEGER,
        credit_price INTEGER,
        description TEXT
    )''')
    c.execute("SELECT COUNT(*) FROM shop")
    if c.fetchone()[0] == 0:
        العناصر = [
            (1, "🍎 تفاحة سحرية", 100, 5, "تستعيد 20 صحة"),
            (2, "🗡️ سيف حديدي", 250, 10, "+10 هجوم"),
            (3, "🛡️ درع فولاذي", 200, 8, "+8 دفاع"),
            (4, "💎 ياقوتة", 500, 20, "حجر كريم"),
            (5, "🧪 جرعة شفاء", 80, 3, "تشفى 50 صحة"),
            (6, "📜 درع قديم", 300, 12, "مهارة جديدة"),
            (7, "🐉 ناب تنين", 1000, 40, "أسلحة أسطورية"),
            (8, "👑 تاج الملوك", 2000, 80, "سلطة ملكية"),
            (9, "⚡ حذاء البرق", 400, 15, "+10 سرعة"),
            (10, "🔮 كرة بلورية", 350, 14, "تكشف الأسرار"),
            (11, "🧥 عباءة الظلال", 450, 18, "تخفي"),
            (12, "🏹 قوس إلف", 600, 25, "هجوم بعيد"),
            (13, "🍄 عيش غراب ذهبي", 150, 6, "تأثير عشوائي"),
            (14, "🧙 قبعة الساحر", 700, 28, "+15 سحر"),
            (15, "⛏️ فأس قزم", 500, 20, "تعدين"),
            (16, "🐺 رفيق ذئب", 1200, 50, "مرافق قتالي"),
            (17, "🕯️ شمعة الحقيقة", 180, 7, "كشف الأكاذيب"),
            (18, "🧩 مفتاح غامض", 250, 10, "فتح أبواب سرية"),
            (19, "💀 كتاب الموتى", 1500, 60, "استحضار"),
            (20, "🧪 إكسير الحياة", 3000, 120, "زيادة العمر"),
            (21, "🎣 صنارة صيد", 200, 8, "صيد السمك"),
            (22, "🏔️ درع الجليد", 800, 32, "مقاومة البرد"),
            (23, "🔥 عصا النار", 900, 36, "كرات نارية"),
            (24, "🌀 تميمة الريح", 550, 22, "تحكم بالرياح"),
            (25, "🌟 شظية نجم", 400, 16, "أمنيات")
        ]
        c.executemany("INSERT INTO shop VALUES (?,?,?,?,?)", العناصر)
    conn.commit()
    conn.close()

async def تهيئة_قاعدة_البيانات():
    await تنفيذ_متزامن(_تهيئة_قاعدة_البيانات)

async def احصل_على_مستخدم(user_id):
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT coins, credits, last_daily, last_hourly, active_team FROM users WHERE user_id = ?", (user_id,))
        row = c.fetchone()
        if row is None:
            c.execute("INSERT INTO users (user_id, coins, credits) VALUES (?, ?, ?)", (user_id, عملات_البداية, رصيد_البداية))
            c.execute("INSERT OR IGNORE INTO teams (user_id, slot) VALUES (?,0), (?,1)", (user_id, user_id))
            conn.commit()
            return {"coins": عملات_البداية, "credits": رصيد_البداية, "last_daily": 0, "last_hourly": 0, "active_team": 0}
        return {"coins": row[0], "credits": row[1], "last_daily": row[2], "last_hourly": row[3], "active_team": row[4]}
    return await تنفيذ_متزامن(_get)

async def تحديث_مستخدم(user_id, **kwargs):
    def _update():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        for key, val in kwargs.items():
            c.execute(f"UPDATE users SET {key} = ? WHERE user_id = ?", (val, user_id))
        conn.commit()
        conn.close()
    await تنفيذ_متزامن(_update)

async def احصل_على_فريق(user_id, slot):
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT name FROM teams WHERE user_id = ? AND slot = ?", (user_id, slot))
        row = c.fetchone()
        conn.close()
        return row[0] if row else ""
    return await تنفيذ_متزامن(_get)

async def تعيين_فريق(user_id, slot, name):
    def _set():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO teams (user_id, slot, name) VALUES (?, ?, ?)", (user_id, slot, name))
        conn.commit()
        conn.close()
    await تنفيذ_متزامن(_set)

async def احصل_على_كل_المستخدمين_للترتيب():
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT user_id, coins FROM users")
        rows = c.fetchall()
        conn.close()
        return rows
    return await تنفيذ_متزامن(_get)

async def أضف_إلى_المخزون(user_id, item_id, qty):
    def _add():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + ?",
                  (user_id, item_id, qty, qty))
        conn.commit()
        conn.close()
    await تنفيذ_متزامن(_add)

async def احصل_على_المخزون(user_id):
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT item_id, quantity FROM inventory WHERE user_id = ?", (user_id,))
        rows = c.fetchall()
        conn.close()
        return rows
    return await تنفيذ_متزامن(_get)

async def احصل_على_سلعة_من_المتجر(item_id):
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop WHERE item_id = ?", (item_id,))
        row = c.fetchone()
        conn.close()
        if row:
            return {"id": row[0], "name": row[1], "coinPrice": row[2], "creditPrice": row[3], "desc": row[4]}
        return None
    return await تنفيذ_متزامن(_get)

async def احصل_على_كل_سلع_المتجر():
    def _get():
        conn = sqlite3.connect(مسار_قاعدة_البيانات)
        c = conn.cursor()
        c.execute("SELECT item_id, name, coin_price, credit_price, description FROM shop ORDER BY item_id")
        rows = c.fetchall()
        conn.close()
        return [{"id": r[0], "name": r[1], "coinPrice": r[2], "creditPrice": r[3], "desc": r[4]} for r in rows]
    return await تنفيذ_متزامن(_get)

# ========== إعداد البوت ==========
الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

# ========== أوامر الاقتصاد ==========
@bot.tree.command(name="رصيدي", description="عرض رصيدك")
async def رصيدي(interaction: discord.Interaction):
    بيانات = await احصل_على_مستخدم(str(interaction.user.id))
    embed = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
    embed.add_field(name="🪙 العملات", value=بيانات["coins"], inline=True)
    embed.add_field(name="💎 الرصيد المميز", value=بيانات["credits"], inline=True)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="يومي", description="مكافأة يومية")
async def يومي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    بيانات = await احصل_على_مستخدم(uid)
    الآن = int(time.time())
    if الآن - بيانات["last_daily"] < ثواني_اليوم:
        باقي = ثواني_اليوم - (الآن - بيانات["last_daily"])
        س = باقي // 3600
        د = (باقي % 3600) // 60
        await interaction.response.send_message(f"⏳ انتظر {س} ساعة {د} دقيقة", ephemeral=True)
        return
    await تحديث_مستخدم(uid, last_daily=الآن, coins=بيانات["coins"]+مكافأة_يومية_عملات, credits=بيانات["credits"]+مكافأة_يومية_رصيد)
    await interaction.response.send_message(f"🎁 +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد")

@bot.tree.command(name="ساعي", description="مكافأة كل ساعة")
async def ساعي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    بيانات = await احصل_على_مستخدم(uid)
    الآن = int(time.time())
    if الآن - بيانات["last_hourly"] < ثواني_الساعة:
        باقي = ثواني_الساعة - (الآن - بيانات["last_hourly"])
        د = باقي // 60
        await interaction.response.send_message(f"⏳ انتظر {د} دقيقة", ephemeral=True)
        return
    await تحديث_مستخدم(uid, last_hourly=الآن, coins=بيانات["coins"]+مكافأة_ساعية_عملات)
    await interaction.response.send_message(f"⏲️ +{مكافأة_ساعية_عملات} عملة")

@bot.tree.command(name="اعمل", description="اعمل لكسب عملات")
async def اعمل(interaction: discord.Interaction):
    earnings = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
    uid = str(interaction.user.id)
    بيانات = await احصل_على_مستخدم(uid)
    await تحديث_مستخدم(uid, coins=بيانات["coins"]+earnings)
    await interaction.response.send_message(f"💼 كسبت {earnings} عملة")

@bot.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
async def الاغنياء(interaction: discord.Interaction):
    rows = await احصل_على_كل_المستخدمين_للترتيب()
    مرتبة = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not مرتبة:
        await interaction.response.send_message("لا يوجد مستخدمون")
        return
    الوصف = ""
    for i, (uid, عملات) in enumerate(مرتبة):
        المستخدم = await البوت.fetch_user(int(uid))
        الاسم = المستخدم.display_name if المستخدم else "مجهول"
        الوصف += f"{i+1}. **{الاسم}** — {عملات} 🪙\n"
    embed = discord.Embed(title="🏆 قائمة الأغنياء", description=الوصف, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="المتجر", description="عرض 25 سلعة")
async def المتجر(interaction: discord.Interaction):
    السلع = await احصل_على_كل_سلع_المتجر()
    embed = discord.Embed(title="🛒 المتجر", description="اشتري بـ /اشتري [الرقم] [عملات/رصيد] [الكمية]\nالرصيد المميز يعطي ضعف الكمية", color=0x3498db)
    for س in السلع[:10]:  # عرض أول 10 عشان ما يطول
        embed.add_field(name=f"{س['id']}. {س['name']}", value=f"🪙 {س['coinPrice']} | 💎 {س['creditPrice']}\n{س['desc']}", inline=True)
    await interaction.response.send_message(embed=embed)

@bot.tree.command(name="اشتري", description="شراء سلعة")
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
    uid = str(interaction.user.id)
    بيانات = await احصل_على_مستخدم(uid)
    if العملة == "coins":
        السعر = السلعة["coinPrice"]
        المضاعف = 1
    else:
        السعر = السلعة["creditPrice"]
        المضاعف = 2
    التكلفة = السعر * الكمية
    if العملة == "coins":
        if بيانات["coins"] < التكلفة:
            await interaction.response.send_message(f"❌ تحتاج {التكلفة} عملة", ephemeral=True)
            return
        await تحديث_مستخدم(uid, coins=بيانات["coins"] - التكلفة)
    else:
        if بيانات["credits"] < التكلفة:
            await interaction.response.send_message(f"❌ تحتاج {التكلفة} رصيد", ephemeral=True)
            return
        await تحديث_مستخدم(uid, credits=بيانات["credits"] - التكلفة)
    await أضف_إلى_المخزون(uid, رقم_السلعة, الكمية * المضاعف)
    await interaction.response.send_message(f"✅ اشتريت {الكمية * المضاعف} × {السلعة['name']}")

@bot.tree.command(name="مخزني", description="عرض مخزونك")
async def مخزني(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    المخزون = await احصل_على_المخزون(uid)
    if not المخزون:
        await interaction.response.send_message("📦 مخزونك فارغ", ephemeral=True)
        return
    الوصف = ""
    for item_id, كمية in المخزون[:10]:
        السلعة = await احصل_على_سلعة_من_المتجر(item_id)
        if السلعة:
            الوصف += f"• {السلعة['name']} x{كمية}\n"
    embed = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=الوصف, color=0x2ecc71)
    await interaction.response.send_message(embed=embed)

# ========== أوامر الفرق ==========
@bot.tree.command(name="تعيين_فريق", description="تسمية فريقك")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1),
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تعيين_فريق(interaction: discord.Interaction, الرقم: int, الاسم: str):
    if len(الاسم) > الحد_الأقصى_لاسم_الفريق:
        الاسم = الاسم[:الحد_الأقصى_لاسم_الفريق]
    uid = str(interaction.user.id)
    await تعيين_فريق(uid, الرقم-1, الاسم)
    await interaction.response.send_message(f"✅ تم تسمية الفريق {الرقم} → {الاسم}")

@bot.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
@app_commands.choices(الرقم=[
    app_commands.Choice(name="الفريق الأول", value=1),
    app_commands.Choice(name="الفريق الثاني", value=2)
])
async def تفعيل_فريق(interaction: discord.Interaction, الرقم: int):
    uid = str(interaction.user.id)
    await تحديث_مستخدم(uid, active_team=الرقم-1)
    الاسم = await احصل_على_فريق(uid, الرقم-1) or "بدون اسم"
    await interaction.response.send_message(f"🔁 تم تفعيل الفريق {الرقم} ({الاسم})")

@bot.tree.command(name="فرقي", description="عرض فرقك")
async def فرقي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    فريق1 = await احصل_على_فريق(uid, 0) or "غير محدد"
    فريق2 = await احصل_على_فريق(uid, 1) or "غير محدد"
    بيانات = await احصل_على_مستخدم(uid)
    embed = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
    embed.add_field(name="الفريق الأول", value=فريق1, inline=False)
    embed.add_field(name="الفريق الثاني", value=فريق2, inline=False)
    embed.add_field(name="الفريق النشط", value=f"الفريق {بيانات['active_team']+1}", inline=False)
    await interaction.response.send_message(embed=embed)

# ========== تشغيل البوت ==========
@bot.event
async def on_ready():
    print(f"✅ البوت دخل باسم {bot.user}")
    await bot.tree.sync()
    print("✅ تم مزامنة جميع الأوامر")

async def الرئيسي():
    await تهيئة_قاعدة_البيانات()
    await bot.start(TOKEN)

if __name__ == "__main__":
    try:
        asyncio.run(الرئيسي())
    except discord.LoginFailure:
        print("❌ فشل تسجيل الدخول. تأكد من DISCORD_TOKEN")
    except Exception as e:
        print(f"❌ خطأ: {e}")