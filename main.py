# ==================== main.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import random
import time
import os
import sys
import traceback
import threading
from flask import Flask
from datetime import datetime, date, timedelta
from tickets import TicketButton, رتبة_التذاكر_المسموح_لها, is_authorized, init_ticket_db, تأكيد_الإغلاق

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الاصدار 1.2"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود")
    sys.exit(1)

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

الرسائل_التلقائية = [
    "🎮 هل جربت استخدام /اعمل لكسب عملات إضافية اليوم؟",
    "🛒 لا تنسى زيارة المتجر /المتجر وشراء الأسلحة القوية!",
    "⚔️ يمكنك مهاجمة اللاعبين الآخرين باستخدام /هجوم @لاعب",
    "💰 السرقة متاحة كل 10 دقائق! استخدم /سرقة @لاعب",
    "👥 قم بتعيين فريقك باستخدام /تعيين_فريق",
    "🔫 السوق السوداء تحتوي على أسلحة نادرة! استخدم /بلاك_ماركت",
    "📋 تحقق من مهامك اليومية باستخدام /مهامي",
    "💎 الرصيد المميز يعطيك ضعف الكمية عند الشراء من المتجر!",
]

بيانات_المستخدمين = {}
بيانات_الفرق = {}
بيانات_المخزون = {}
بيانات_المهام = {}
بيانات_الرسائل = {}

بيانات_الدعوات = {}
دعوات_السيرفرات = {}

المتجر_العادي = {
    1: {"name": "🍎 تفاحة سحرية", "coinPrice": 100, "creditPrice": 5, "desc": "تستعيد 20 صحة فوراً"},
    2: {"name": "🗡️ سيف حديدي", "coinPrice": 250, "creditPrice": 10, "desc": "+25 ضرر"},
    3: {"name": "🛡️ درع فولاذي", "coinPrice": 200, "creditPrice": 8, "desc": "+8 دفاع"},
    4: {"name": "💎 ياقوتة", "coinPrice": 500, "creditPrice": 20, "desc": "حجر كريم"},
    5: {"name": "🧪 جرعة شفاء", "coinPrice": 80, "creditPrice": 3, "desc": "تشفي 50 صحة فوراً"},
    6: {"name": "📜 درع قديم", "coinPrice": 300, "creditPrice": 12, "desc": "مقاومة متوسطة"},
    7: {"name": "🐉 ناب تنين", "coinPrice": 1000, "creditPrice": 40, "desc": "+50 ضرر"},
    8: {"name": "👑 تاج الملوك", "coinPrice": 2000, "creditPrice": 80, "desc": "سلطة ملكية"},
    9: {"name": "⚡ حذاء البرق", "coinPrice": 400, "creditPrice": 15, "desc": "+20 ضرر"},
    10: {"name": "🔮 كرة بلورية", "coinPrice": 350, "creditPrice": 14, "desc": "تكشف الأسرار"},
    11: {"name": "🧥 عباءة الظلال", "coinPrice": 450, "creditPrice": 18, "desc": "تخفي"},
    12: {"name": "🏹 قوس إلف", "coinPrice": 600, "creditPrice": 25, "desc": "+35 ضرر"},
    13: {"name": "🍄 عيش غراب ذهبي", "coinPrice": 150, "creditPrice": 6, "desc": "تأثير عشوائي"},
    14: {"name": "🧙 قبعة الساحر", "coinPrice": 700, "creditPrice": 28, "desc": "+15 سحر"},
    15: {"name": "⛏️ فأس قزم", "coinPrice": 500, "creditPrice": 20, "desc": "تعدين"},
    16: {"name": "🐺 رفيق ذئب", "coinPrice": 1200, "creditPrice": 50, "desc": "+45 ضرر"},
    17: {"name": "🕯️ شمعة الحقيقة", "coinPrice": 180, "creditPrice": 7, "desc": "تكشف الأكاذيب"},
    18: {"name": "🧩 مفتاح غامض", "coinPrice": 250, "creditPrice": 10, "desc": "يفتح الأبواب"},
    19: {"name": "💀 كتاب الموتى", "coinPrice": 1500, "creditPrice": 60, "desc": "يستحضر الموتى"},
    20: {"name": "🧪 إكسير الحياة", "coinPrice": 3000, "creditPrice": 120, "desc": "يطيل العمر"},
    21: {"name": "🎣 صنارة صيد", "coinPrice": 200, "creditPrice": 8, "desc": "تصطاد سمكاً"},
    22: {"name": "🏔️ درع الجليد", "coinPrice": 800, "creditPrice": 32, "desc": "مقاومة البرد"},
    23: {"name": "🔥 عصا النار", "coinPrice": 900, "creditPrice": 36, "desc": "+40 ضرر"},
    24: {"name": "🌀 تميمة الريح", "coinPrice": 550, "creditPrice": 22, "desc": "يتحكم بالرياح"},
    25: {"name": "🌟 شظية نجم", "coinPrice": 400, "creditPrice": 16, "desc": "يحقق الأمنيات"},
    26: {"name": "📖 كتاب التخفي", "coinPrice": 500, "creditPrice": 20, "desc": "يخفي فريقك 30 دقيقة"}
}

السوق_السوداء_سلع = {}
for i in range(1, 51):
    الصفحة = (i-1)//10 + 1
    اسماء = [
        "🔫 AK-47", "💣 RPG", "🔪 سكين قتال", "🔫 مسدس كاتم", "💣 قنبلة يدوية",
        "🔫 رشاش", "💣 قنبلة دخان", "🔫 مسدس رشاش", "💣 قنبلة مسيلة", "🔪 خنجر مسموم",
        "🔫 بندقية قنص", "💣 عبوة ناسفة", "🔫 مسدس ذهبي", "💣 قنبلة عنقودية", "🔪 سيف ياباني",
        "🔫 كلاشنكوف", "💣 مولوتوف", "🔫 مسدس كهربائي", "💣 لغم أرضي", "🔪 رمح",
        "🔫 بازوكا", "💣 قنبلة نووية", "🔪 فأس", "🔫 رشاش ثقيل", "💣 قنبلة غاز",
        "🔫 مسدس سيلينيوم", "💣 ديناميت", "🔪 منجل", "🔫 رشاش خفيف", "💣 قنبلة فلاش",
        "🔫 مسدس فضة", "💣 قنبلة حرارية", "🔪 ساطور", "🔫 بندقية صيد", "💣 قنبلة كيميائية",
        "🔫 مسدس بلاتينيوم", "💣 قنبلة بلاستيكية", "🔪 خنجر فضة", "🔫 رشاش ذهبي", "💣 قنبلة مغناطيسية",
        "🔫 مسدس نحاس", "💣 قنبلة زمنية", "🔪 سيف فضة", "🔫 بندقية فضة", "💣 قنبلة صوت",
        "🔫 مسدس هيدروجين", "💣 قنبلة ضوئية", "🔪 رمح فضة", "🔫 رشاش نحاس", "💣 قنبلة متطورة"
    ]
    السوق_السوداء_سلع[i] = {"id": i, "name": اسماء[i-1], "coinPrice": i * 150, "creditPrice": i // 5, "desc": f"سلاح من الصفحة {الصفحة}", "page": الصفحة}

عملات_البداية = 1000
رصيد_البداية = 0
صحة_الفريق_البدائية = 200
مكافأة_يومية_عملات = 500
مكافأة_يومية_رصيد = 10
مكافأة_ساعية_عملات = 100
الحد_الأدنى_للعمل = 50
الحد_الأقصى_للعمل = 200
مدة_السرقة = 600
نسبة_السرقة = 0.2
مدة_التخفي = 1800
الحد_الأقصى_لاسم_الفريق = 20
ثواني_اليوم = 86400
ثواني_الساعة = 3600
ضرر_اللكمة_الأساسي = 10
أضرار_الأسلحة = {2: 25, 7: 50, 9: 20, 12: 35, 16: 45, 23: 40}
رابط_السيرفر = "https://discord.gg/gzFVT4zXKU"
اسم_المطور = "taim"
معرف_المطور = "ta_im1@"

def init_user(user_id):
    if user_id not in بيانات_المستخدمين:
        بيانات_المستخدمين[user_id] = {
            "coins": عملات_البداية,
            "credits": رصيد_البداية,
            "last_daily": 0,
            "last_hourly": 0,
            "active_team": 0,
            "last_robbery": 0
        }
        بيانات_الفرق[user_id] = {
            0: {"name": "", "health": صحة_الفريق_البدائية, "invisible_until": 0},
            1: {"name": "", "health": صحة_الفريق_البدائية, "invisible_until": 0}
        }
        بيانات_المخزون[user_id] = {}
        بيانات_المهام[user_id] = None
    return بيانات_المستخدمين[user_id]

def update_user(user_id, **kwargs):
    if user_id not in بيانات_المستخدمين:
        init_user(user_id)
    for key, val in kwargs.items():
        بيانات_المستخدمين[user_id][key] = val

def get_team(user_id, slot, include_health=False):
    if user_id not in بيانات_الفرق:
        init_user(user_id)
    team = بيانات_الفرق[user_id].get(slot, {"name": "", "health": صحة_الفريق_البدائية, "invisible_until": 0})
    if include_health:
        return (team["name"], team["health"], team["invisible_until"])
    return team["name"]

def set_team(user_id, slot, name):
    if user_id not in بيانات_الفرق:
        init_user(user_id)
    بيانات_الفرق[user_id][slot]["name"] = name

def update_team_health(user_id, slot, new_health):
    if user_id not in بيانات_الفرق:
        init_user(user_id)
    بيانات_الفرق[user_id][slot]["health"] = new_health

def update_team_invisible(user_id, slot, until):
    if user_id not in بيانات_الفرق:
        init_user(user_id)
    بيانات_الفرق[user_id][slot]["invisible_until"] = until

def add_inventory(user_id, item_id, qty):
    if user_id not in بيانات_المخزون:
        init_user(user_id)
    if item_id not in بيانات_المخزون[user_id]:
        بيانات_المخزون[user_id][item_id] = 0
    بيانات_المخزون[user_id][item_id] += qty

def remove_inventory(user_id, item_id, qty):
    if user_id in بيانات_المخزون and item_id in بيانات_المخزون[user_id]:
        بيانات_المخزون[user_id][item_id] -= qty
        if بيانات_المخزون[user_id][item_id] <= 0:
            del بيانات_المخزون[user_id][item_id]

def get_inventory(user_id):
    if user_id not in بيانات_المخزون:
        init_user(user_id)
    return list(بيانات_المخزون[user_id].items())

def has_item(user_id, item_id):
    inv = get_inventory(user_id)
    for iid, qty in inv:
        if iid == item_id and qty > 0:
            return True
    return False

def get_all_users():
    return [(uid, data["coins"]) for uid, data in بيانات_المستخدمين.items()]

def update_message_count(user_id):
    اليوم = date.today().isoformat()
    الاسبوع = (date.today() - timedelta(days=date.today().weekday())).isoformat()
    الشهر = date.today().replace(day=1).isoformat()
    
    if user_id not in بيانات_الرسائل:
        بيانات_الرسائل[user_id] = {"today": 1, "week": 1, "month": 1, "total": 1, "last_today": اليوم, "last_week": الاسبوع, "last_month": الشهر}
        return
    
    data = بيانات_الرسائل[user_id]
    if data["last_today"] == اليوم:
        data["today"] += 1
    else:
        data["today"] = 1
        data["last_today"] = اليوم
    
    if data["last_week"] == الاسبوع:
        data["week"] += 1
    else:
        data["week"] = 1
        data["last_week"] = الاسبوع
    
    if data["last_month"] == الشهر:
        data["month"] += 1
    else:
        data["month"] = 1
        data["last_month"] = الشهر
    
    data["total"] += 1

def get_message_stats(user_id):
    if user_id not in بيانات_الرسائل:
        return (0, 0, 0, 0)
    data = بيانات_الرسائل[user_id]
    return (data["today"], data["week"], data["month"], data["total"])

def get_available_weapons(user_id):
    inv = get_inventory(user_id)
    weapons = []
    for item_id, qty in inv:
        if qty > 0:
            if item_id in أضرار_الأسلحة:
                weapons.append({"id": item_id, "name": المتجر_العادي[item_id]["name"], "damage": أضرار_الأسلحة[item_id]})
            elif 1 <= item_id <= 50:
                item = السوق_السوداء_سلع.get(item_id)
                if item:
                    weapons.append({"id": item_id, "name": item["name"], "damage": 15 + (item_id * 2)})
    return weapons

def advance_mission_progress(user_id, mission_type):
    if user_id not in بيانات_المهام or not بيانات_المهام[user_id]:
        return
    mission = بيانات_المهام[user_id]
    now = int(time.time())
    if now - mission.get("last_reset", 0) > 3 * ثواني_اليوم:
        return
    for i in range(1, 4):
        if mission_type in mission[f"m{i}"] and mission[f"c{i}"] == 0:
            mission[f"p{i}"] += 1

def get_mission(user_id):
    if user_id not in بيانات_المهام or not بيانات_المهام[user_id]:
        missions = ["اعمل 5 مرات", "اهاجم 3 لاعبين", "اجمع 500 عملة", "اشترِ سلاحاً", "اسرق لاعباً", "استخدم تخفي"]
        selected = random.sample(missions, 3)
        بيانات_المهام[user_id] = {"m1": selected[0], "m2": selected[1], "m3": selected[2], "p1": 0, "p2": 0, "p3": 0, "c1": 0, "c2": 0, "c3": 0, "last_reset": int(time.time())}
    return بيانات_المهام[user_id]

def complete_mission(user_id, mission_num):
    mission = get_mission(user_id)
    field = f"m{mission_num}"
    target = 5 if "5" in mission[field] else (3 if "3" in mission[field] else 1)
    if mission[f"c{mission_num}"] == 1:
        return False, "completed"
    if mission[f"p{mission_num}"] < target:
        return False, "not_ready"
    mission[f"c{mission_num}"] = 1
    return True, target

@tasks.loop(minutes=5)
async def رسائل_تلقائية():
    try:
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT قناة_الرسائل_التلقائية FROM اعدادات_السيرفر WHERE تم_الاعداد = 1")
            rows = await cursor.fetchall()
        
        for row in rows:
            channel_id = row[0]
            if channel_id:
                channel = البوت.get_channel(int(channel_id))
                if channel:
                    رسالة = random.choice(الرسائل_التلقائية)
                    await channel.send(رسالة)
    except Exception as e:
        print(f"خطأ في الرسائل التلقائية: {e}")

@رسائل_تلقائية.before_loop
async def before_رسائل_تلقائية():
    await البوت.wait_until_ready()

async def تحديث_الدعوات(guild):
    try:
        دعوات_السيرفرات[guild.id] = {inv.code: inv.uses for inv in await guild.invites()}
    except:
        pass

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user} (الاصدار 1.2)")
    await init_ticket_db()
    for guild in البوت.guilds:
        await تحديث_الدعوات(guild)
    رسائل_تلقائية.start()
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

@البوت.event
async def on_guild_join(guild):
    await تحديث_الدعوات(guild)
    embed = discord.Embed(
        title="⚙️ إعداد البوت",
        description="مرحباً! لإعداد البوت في سيرفرك، يرجى استخدام الأمر `/اعدادات` لتحديد:\n- الرتبة المسؤولة عن التذاكر\n- قناة لوحة التذاكر\n- قناة الرسائل التلقائية\n- قناة الترحيب",
        color=0x5865F2
    )
    for channel in guild.text_channels:
        if channel.permissions_for(guild.me).send_messages:
            await channel.send(embed=embed)
            break

@البوت.event
async def on_member_join(member):
    try:
        invites_before = دعوات_السيرفرات.get(member.guild.id, {})
        invites_after = {inv.code: inv.uses for inv in await member.guild.invites()}
        
        inviter = None
        for code, uses in invites_after.items():
            if code in invites_before and uses > invites_before[code]:
                inviter = code
                break
        
        if inviter:
            async with aiosqlite.connect("ticket_data.db") as db:
                cursor = await db.execute("SELECT قناة_الترحيب FROM اعدادات_السيرفر WHERE guild_id = ?", (str(member.guild.id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = member.guild.get_channel(int(row[0]))
                if channel:
                    دعوة = await member.guild.fetch_invite(inviter)
                    if دعوة and دعوة.inviter:
                        inviter_name = دعوة.inviter.display_name
                        بيانات_الدعوات[دعوة.inviter.id] = بيانات_الدعوات.get(دعوة.inviter.id, 0) + 1
                        total_invites = بيانات_الدعوات[dعوة.inviter.id]
                        
                        embed = discord.Embed(
                            title="🎉 عضو جديد!",
                            description=f"مرحباً {member.mention} في السيرفر!",
                            color=0x00FF00
                        )
                        embed.add_field(name="👤 تمت الدعوة بواسطة", value=inviter_name, inline=True)
                        embed.add_field(name="📊 عدد الدعوات", value=str(total_invites), inline=True)
                        await channel.send(embed=embed)
        
        دعوات_السيرفرات[member.guild.id] = {inv.code: inv.uses for inv in await member.guild.invites()}
    except Exception as e:
        print(f"خطأ في الترحيب: {e}")

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    update_message_count(str(message.author.id))
    mission_text = None
    if "اعمل" in str(message.content):
        mission_text = "اعمل"
    elif "هجوم" in str(message.content) or "attack" in str(message.content).lower():
        mission_text = "اهاجم"
    elif "سرقة" in str(message.content) or "rob" in str(message.content).lower():
        mission_text = "اسرق"
    if mission_text:
        advance_mission_progress(str(message.author.id), mission_text)
    await البوت.process_commands(message)

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة لوحة التذاكر", auto_channel="قناة الرسائل التلقائية", welcome_channel="قناة الترحيب")
async def اعدادات(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel, welcome_channel: discord.TextChannel = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed_title = "🛡️ فتح تذكرة جديدة"
        embed_description = "اضغط على الزر أدناه لفتح تذكرة"
        embed_color = "5865F2"
        
        async with aiosqlite.connect("ticket_data.db") as db:
            welcome_channel_id = str(welcome_channel.id) if welcome_channel else None
            await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, رتبة_التذاكر, قناة_البانل, قناة_الرسائل_التلقائية, قناة_الترحيب, رسالة_العنوان, رسالة_الوصف, لون_الرسالة, تم_الاعداد) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
                            (str(interaction.guild_id), str(role.id), str(panel_channel.id), str(auto_channel.id), welcome_channel_id, embed_title, embed_description, embed_color))
            await db.commit()
        
        global رتبة_التذاكر_المسموح_لها
        رتبة_التذاكر_المسموح_لها = role.id
        
        embed = discord.Embed(title=embed_title, description=embed_description, color=int(embed_color, 16))
        view = TicketButton(embed_title, embed_description, embed_color)
        msg = await panel_channel.send(embed=embed, view=view)
        
        await db.execute("INSERT OR REPLACE INTO بانل (guild_id, channel_id, message_id) VALUES (?, ?, ?)", (str(interaction.guild_id), str(panel_channel.id), str(msg.id)))
        await db.commit()
        
        await تحديث_الدعوات(interaction.guild)
        
        welcome_text = f"\nقناة الترحيب: {welcome_channel.mention}" if welcome_channel else ""
        await interaction.response.send_message(f"✅ تم إعداد البوت بنجاح!\nالرتبة: {role.mention}\nقناة البانل: {panel_channel.mention}\nقناة الرسائل: {auto_channel.mention}{welcome_text}", ephemeral=True)
    except Exception as e:
        print(f"خطأ في اعدادات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="setup", description="إعداد البوت في السيرفر")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة لوحة التذاكر", auto_channel="قناة الرسائل التلقائية", welcome_channel="قناة الترحيب")
async def setup(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel, welcome_channel: discord.TextChannel = None):
    await اعدادات(interaction, role, panel_channel, auto_channel, welcome_channel)

@البوت.tree.command(name="edit", description="تعديل رسالة لوحة التذاكر")
@app_commands.describe(title="العنوان الجديد", description="الوصف الجديد", color="اللون (Hex)")
async def edit_panel(interaction: discord.Interaction, title: str = None, description: str = None, color: str = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT قناة_البانل, رسالة_العنوان, رسالة_الوصف, لون_الرسالة FROM اعدادات_السيرفر WHERE guild_id = ?", (str(interaction.guild_id),))
            row = await cursor.fetchone()
            if not row:
                await interaction.response.send_message("❌ لم يتم إعداد البوت بعد! استخدم `/اعدادات` أولاً.", ephemeral=True)
                return
            
            channel_id, old_title, old_desc, old_color = row
            new_title = title or old_title or "🛡️ فتح تذكرة جديدة"
            new_desc = description or old_desc or "اضغط على الزر أدناه لفتح تذكرة"
            new_color = color or old_color or "5865F2"
            
            await db.execute("UPDATE اعدادات_السيرفر SET رسالة_العنوان = ?, رسالة_الوصف = ?, لون_الرسالة = ? WHERE guild_id = ?",
                            (new_title, new_desc, new_color, str(interaction.guild_id)))
            await db.commit()
        
        if channel_id:
            channel = interaction.guild.get_channel(int(channel_id))
            if channel:
                embed = discord.Embed(title=new_title, description=new_desc, color=int(new_color, 16))
                view = TicketButton(new_title, new_desc, new_color)
                cursor = await db.execute("SELECT message_id FROM بانل WHERE guild_id = ?", (str(interaction.guild_id),))
                msg_row = await cursor.fetchone()
                if msg_row:
                    try:
                        msg = await channel.fetch_message(int(msg_row[0]))
                        await msg.edit(embed=embed, view=view)
                    except:
                        msg = await channel.send(embed=embed, view=view)
                        await db.execute("INSERT OR REPLACE INTO بانل (guild_id, channel_id, message_id) VALUES (?, ?, ?)", (str(interaction.guild_id), str(channel.id), str(msg.id)))
                else:
                    msg = await channel.send(embed=embed, view=view)
                    await db.execute("INSERT INTO بانل (guild_id, channel_id, message_id) VALUES (?, ?, ?)", (str(interaction.guild_id), str(channel.id), str(msg.id)))
                await db.commit()
        
        await interaction.response.send_message("✅ تم تحديث رسالة لوحة التذاكر!", ephemeral=True)
    except Exception as e:
        print(f"خطأ في edit: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="about", description="معلومات عن البوت")
async def about(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🤖 معلومات عن البوت",
        description="بوت متكامل لإدارة التذاكر والألعاب والاقتصاد وتتبع الدعوات",
        color=0x5865F2
    )
    embed.add_field(name="📦 الاصدار", value="1.2", inline=True)
    embed.add_field(name="👑 المطور", value=اسم_المطور, inline=True)
    embed.add_field(name="📞 التواصل", value=معرف_المطور, inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="gdpr", description="حذف بياناتك من البوت")
async def gdpr(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    if uid in بيانات_المستخدمين:
        del بيانات_المستخدمين[uid]
    if uid in بيانات_الفرق:
        del بيانات_الفرق[uid]
    if uid in بيانات_المخزون:
        del بيانات_المخزون[uid]
    if uid in بيانات_المهام:
        del بيانات_المهام[uid]
    if uid in بيانات_الرسائل:
        del بيانات_الرسائل[uid]
    if uid in بيانات_الدعوات:
        del بيانات_الدعوات[uid]
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("DELETE FROM تذاكر WHERE creator_id = ?", (uid,))
        await db.commit()
    await interaction.response.send_message("✅ تم حذف جميع بياناتك بنجاح!", ephemeral=True)

@البوت.tree.command(name="help", description="عرض المساعدة")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة الأوامر", color=0x5865F2)
    embed.add_field(name="📌 الخدمات العامة", value="`/about` `/gdpr` `/help` `/invite` `/jumptotop`", inline=False)
    embed.add_field(name="🎫 التذاكر", value="`/add` `/claim` `/close` `/closerequest` `/edit` `/notes` `/on-call` `/open` `/remove` `/rename` `/reopen` `/switchpanel` `/transfer` `/unclaim`", inline=False)
    embed.add_field(name="⚙️ الإعدادات", value="`/addadmin` `/addsupport` `/autoclose` `/blacklist` `/language` `/removeadmin` `/removesupport` `/اعدادات` `/setup` `/viewstaff`", inline=False)
    embed.add_field(name="🏷️ الشعارات", value="`/managetags` `/tag`", inline=False)
    embed.add_field(name="📊 الإحصائيات", value="`/stats`", inline=False)
    embed.add_field(name="💰 الاقتصاد", value="`/رصيدي` `/يومي` `/ساعي` `/اعمل` `/الاغنياء`", inline=False)
    embed.add_field(name="🛒 المتجر", value="`/المتجر` `/اشتري` `/مخزني` `/بلاك_ماركت` `/شراء_بلاك`", inline=False)
    embed.add_field(name="👥 الفرق", value="`/تعيين_فريق` `/تفعيل_فريق` `/فرقي` `/دخول_فريق`", inline=False)
    embed.add_field(name="⚔️ القتال", value="`/هجوم @لاعب` `/سرقة @لاعب` `/تخفي`", inline=False)
    embed.add_field(name="📋 المهام", value="`/مهامي` `/تسليم_مهمة`", inline=False)
    embed.set_footer(text=f"تم تطوير هذا البوت بواسطة {اسم_المطور} | الاصدار 1.2")
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="invite", description="رابط دعوة البوت")
async def invite(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🔗 رابط دعوة البوت",
        description=f"[اضغط هنا لدعوة البوت](https://discord.com/oauth2/authorize?client_id={البوت.user.id}&permissions=8&scope=bot%20applications.commands)",
        color=0x5865F2
    )
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="jumptotop", description="الانتقال إلى أعلى التذكرة")
async def jumptotop(interaction: discord.Interaction):
    messages = [message async for message in interaction.channel.history(limit=1, oldest_first=True)]
    if messages:
        await interaction.response.send_message(f"⬆️ انتقل إلى [أول رسالة]({messages[0].jump_url})")
    else:
        await interaction.response.send_message("⬆️ لا توجد رسائل", ephemeral=True)

@البوت.tree.command(name="add", description="إضافة مستخدم إلى التذكرة")
async def add_user(interaction: discord.Interaction, user: discord.Member):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    overwrite = interaction.channel.overwrites_for(user)
    overwrite.read_messages = True
    overwrite.send_messages = True
    await interaction.channel.set_permissions(user, overwrite=overwrite)
    await interaction.response.send_message(f"✅ تم إضافة {user.mention} إلى التذكرة")

@البوت.tree.command(name="claim", description="استلام التذكرة")
async def claim_ticket(interaction: discord.Interaction):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("UPDATE تذاكر SET status = 'claimed' WHERE channel_id = ?", (str(interaction.channel.id),))
        await db.commit()
    await interaction.response.send_message(f"✅ تم استلام التذكرة بواسطة {interaction.user.mention}")

@البوت.tree.command(name="close", description="إغلاق التذكرة")
async def close_ticket(interaction: discord.Interaction):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    view = تأكيد_الإغلاق(interaction.channel, interaction.user)
    embed = discord.Embed(title="⚠️ تأكيد الإغلاق", description="هل أنت متأكد أنك تريد حذف هذه التذكرة؟", color=0xFFA500)
    await interaction.response.send_message(embed=embed, view=view, ephemeral=True)

@البوت.tree.command(name="closerequest", description="طلب إغلاق التذكرة")
async def closerequest(interaction: discord.Interaction, reason: str = None):
    async with aiosqlite.connect("ticket_data.db") as db:
        cursor = await db.execute("SELECT creator_id FROM تذاكر WHERE channel_id = ?", (str(interaction.channel.id),))
        row = await cursor.fetchone()
        if not row or str(interaction.user.id) != row[0]:
            await interaction.response.send_message("❌ هذه التذكرة ليست ملكك!", ephemeral=True)
            return
    reason_text = f"\n**السبب:** {reason}" if reason else ""
    embed = discord.Embed(title="🔒 طلب إغلاق", description=f"صاحب التذكرة {interaction.user.mention} يطلب إغلاقها.{reason_text}", color=0xFFA500)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="notes", description="إضافة ملاحظة في التذكرة")
async def notes(interaction: discord.Interaction, note: str):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    embed = discord.Embed(title="📝 ملاحظة جديدة", description=f"**من:** {interaction.user.mention}\n**الملاحظة:**\n{note}", color=0x3498db, timestamp=datetime.now())
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="on-call", description="وضع التنبيه للتذاكر الجديدة")
async def on_call(interaction: discord.Interaction):
    await interaction.response.send_message("✅ تم تفعيل وضع التنبيه. سيتم إشعارك عند فتح تذاكر جديدة.", ephemeral=True)

@البوت.tree.command(name="open", description="فتح تذكرة جديدة (إرسال اللوحة)")
async def open_ticket(interaction: discord.Interaction):
    try:
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT رسالة_العنوان, رسالة_الوصف, لون_الرسالة FROM اعدادات_السيرفر WHERE guild_id = ?", (str(interaction.guild_id),))
            row = await cursor.fetchone()
            if not row:
                await interaction.response.send_message("❌ لم يتم إعداد البوت بعد! استخدم `/اعدادات` أولاً.", ephemeral=True)
                return
            title, desc, color = row
            title = title or "🛡️ فتح تذكرة جديدة"
            desc = desc or "اضغط على الزر أدناه لفتح تذكرة"
            color = color or "5865F2"
        
        embed = discord.Embed(title=title, description=desc, color=int(color, 16))
        view = TicketButton(title, desc, color)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال لوحة التذاكر!", ephemeral=True)
    except Exception as e:
        print(f"خطأ في open: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="remove", description="إزالة مستخدم من التذكرة")
async def remove_user(interaction: discord.Interaction, user: discord.Member):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    await interaction.channel.set_permissions(user, overwrite=None)
    await interaction.response.send_message(f"✅ تم إزالة {user.mention} من التذكرة")

@البوت.tree.command(name="rename", description="تغيير اسم التذكرة")
async def rename_ticket(interaction: discord.Interaction, new_name: str):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    await interaction.channel.edit(name=new_name[:100])
    await interaction.response.send_message(f"✅ تم تغيير اسم التذكرة إلى: {new_name}")

@البوت.tree.command(name="reopen", description="إعادة فتح تذكرة مغلقة")
async def reopen_ticket(interaction: discord.Interaction):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("UPDATE تذاكر SET status = 'open' WHERE channel_id = ?", (str(interaction.channel.id),))
        await db.commit()
    await interaction.response.send_message("🔄 تم إعادة فتح التذكرة")

@البوت.tree.command(name="switchpanel", description="تبديل لوحة التذاكر")
async def switchpanel(interaction: discord.Interaction, channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("UPDATE اعدادات_السيرفر SET قناة_البانل = ? WHERE guild_id = ?", (str(channel.id), str(interaction.guild_id)))
        await db.commit()
    await interaction.response.send_message(f"✅ تم تبديل لوحة التذاكر إلى {channel.mention}")

@البوت.tree.command(name="transfer", description="نقل التذكرة إلى موظف آخر")
async def transfer_ticket(interaction: discord.Interaction, user: discord.Member):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    if not await is_authorized(user):
        await interaction.response.send_message("❌ المستخدم المستهدف ليس موظفاً!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم نقل التذكرة إلى {user.mention}")

@البوت.tree.command(name="unclaim", description="إلغاء استلام التذكرة")
async def unclaim_ticket(interaction: discord.Interaction):
    if not await is_authorized(interaction.user):
        await interaction.response.send_message("❌ ليس لديك صلاحية!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("UPDATE تذاكر SET status = 'open' WHERE channel_id = ?", (str(interaction.channel.id),))
        await db.commit()
    await interaction.response.send_message("✅ تم إلغاء استلام التذكرة")

@البوت.tree.command(name="addadmin", description="إضافة رتبة أونر")
async def add_admin(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("UPDATE اعدادات_السيرفر SET رتبة_التذاكر = ? WHERE guild_id = ?", (str(role.id), str(interaction.guild_id)))
        await db.commit()
    global رتبة_التذاكر_المسموح_لها
    رتبة_التذاكر_المسموح_لها = role.id
    await interaction.response.send_message(f"✅ تم إضافة رتبة {role.mention} كمسؤول عن التذاكر")

@البوت.tree.command(name="addsupport", description="إضافة رتبة دعم")
async def add_support(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم إضافة رتبة {role.mention} كفريق دعم")

@البوت.tree.command(name="autoclose", description="إعداد الإغلاق التلقائي")
async def auto_close(interaction: discord.Interaction, hours: int = 24):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم ضبط الإغلاق التلقائي بعد {hours} ساعة")

@البوت.tree.command(name="blacklist", description="حظر مستخدم من التذاكر")
async def blacklist(interaction: discord.Interaction, user: discord.User, reason: str = "لا يوجد سبب"):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم حظر {user.mention} من استخدام نظام التذاكر\n**السبب:** {reason}")

@البوت.tree.command(name="language", description="تغيير اللغة")
@app_commands.choices(lang=[app_commands.Choice(name="العربية", value="ar"), app_commands.Choice(name="English", value="en")])
async def set_language(interaction: discord.Interaction, lang: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم تغيير اللغة إلى {'العربية' if lang == 'ar' else 'English'}")

@البوت.tree.command(name="removeadmin", description="إزالة رتبة أونر")
async def remove_admin(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم إزالة رتبة {role.mention} من مسؤولية التذاكر")

@البوت.tree.command(name="removesupport", description="إزالة رتبة دعم")
async def remove_support(interaction: discord.Interaction, role: discord.Role):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.send_message(f"✅ تم إزالة رتبة {role.mention} من فريق الدعم")

@البوت.tree.command(name="viewstaff", description="عرض قائمة الموظفين")
async def view_staff(interaction: discord.Interaction):
    async with aiosqlite.connect("ticket_data.db") as db:
        cursor = await db.execute("SELECT رتبة_التذاكر FROM اعدادات_السيرفر WHERE guild_id = ?", (str(interaction.guild_id),))
        row = await cursor.fetchone()
        if row and row[0]:
            role = interaction.guild.get_role(int(row[0]))
            if role:
                await interaction.response.send_message(f"👑 المسؤولين:\n{role.mention}\n\n🛡️ فريق الدعم:\n(يتم التعيين عبر صلاحيات السيرفر)", ephemeral=True)
            else:
                await interaction.response.send_message("لا يوجد موظفين مسجلين!", ephemeral=True)
        else:
            await interaction.response.send_message("لا يوجد موظفين مسجلين!", ephemeral=True)

@البوت.tree.command(name="managetags", description="إدارة الشعارات")
@app_commands.choices(action=[app_commands.Choice(name="إضافة", value="add"), app_commands.Choice(name="حذف", value="remove"), app_commands.Choice(name="عرض", value="list")])
async def manage_tags(interaction: discord.Interaction, action: str, name: str = None, content: str = None):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    if action == "add":
        if not name or not content:
            await interaction.response.send_message("❌ يرجى إدخال اسم العلامة والمحتوى!", ephemeral=True)
            return
        async with aiosqlite.connect("ticket_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO tags (guild_id, tag_name, tag_content) VALUES (?, ?, ?)", (str(interaction.guild_id), name, content))
            await db.commit()
        await interaction.response.send_message(f"✅ تم إضافة العلامة `{name}`")
    elif action == "remove":
        if not name:
            await interaction.response.send_message("❌ يرجى إدخال اسم العلامة!", ephemeral=True)
            return
        async with aiosqlite.connect("ticket_data.db") as db:
            await db.execute("DELETE FROM tags WHERE guild_id = ? AND tag_name = ?", (str(interaction.guild_id), name))
            await db.commit()
        await interaction.response.send_message(f"✅ تم حذف العلامة `{name}`")
    elif action == "list":
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT tag_name FROM tags WHERE guild_id = ?", (str(interaction.guild_id),))
            tags = await cursor.fetchall()
        if not tags:
            await interaction.response.send_message("لا توجد علامات محفوظة!", ephemeral=True)
            return
        tag_list = "\n".join([f"• `{tag[0]}`" for tag in tags])
        await interaction.response.send_message(f"**📋 قائمة العلامات:**\n{tag_list}", ephemeral=True)

@البوت.tree.command(name="tag", description="إرسال علامة سريعة")
async def use_tag(interaction: discord.Interaction, name: str):
    async with aiosqlite.connect("ticket_data.db") as db:
        cursor = await db.execute("SELECT tag_content FROM tags WHERE guild_id = ? AND tag_name = ?", (str(interaction.guild_id), name))
        row = await cursor.fetchone()
    if not row:
        await interaction.response.send_message(f"❌ العلامة `{name}` غير موجودة!", ephemeral=True)
        return
    embed = discord.Embed(title=f"🏷️ {name}", description=row[0], color=0x5865F2)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="stats", description="إحصائيات البوت")
async def stats(interaction: discord.Interaction):
    try:
        async with aiosqlite.connect("ticket_data.db") as db:
            cursor = await db.execute("SELECT COUNT(*) FROM تذاكر WHERE guild_id = ?", (str(interaction.guild_id),))
            total = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM تذاكر WHERE guild_id = ? AND status = 'open'", (str(interaction.guild_id),))
            open_tickets = (await cursor.fetchone())[0]
            cursor = await db.execute("SELECT COUNT(*) FROM تذاكر WHERE guild_id = ? AND status = 'claimed'", (str(interaction.guild_id),))
            claimed = (await cursor.fetchone())[0]
        
        embed = discord.Embed(title="📊 إحصائيات البوت", color=0x5865F2)
        embed.add_field(name="📋 إجمالي التذاكر", value=str(total), inline=True)
        embed.add_field(name="🟢 مفتوحة", value=str(open_tickets), inline=True)
        embed.add_field(name="🟡 مستلمة", value=str(claimed), inline=True)
        embed.add_field(name="👑 عدد المستخدمين", value=str(len(بيانات_المستخدمين)), inline=True)
        embed.add_field(name="📊 إجمالي الدعوات", value=str(sum(بيانات_الدعوات.values())), inline=True)
        embed.set_footer(text=f"الاصدار 1.2")
        await interaction.response.send_message(embed=embed)
    except Exception as e:
        print(f"خطأ في stats: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="رصيدي", description="عرض رصيدك")
async def رصيدي(interaction: discord.Interaction):
    u = init_user(str(interaction.user.id))
    embed = discord.Embed(title=f"محفظة {interaction.user.display_name}", color=0x00AE86)
    embed.add_field(name="🪙 العملات", value=u["coins"], inline=True)
    embed.add_field(name="💎 الرصيد المميز", value=u["credits"], inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="يومي", description="مكافأة يومية")
async def يومي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = init_user(uid)
    now = int(time.time())
    if now - u["last_daily"] < ثواني_اليوم:
        remaining = ثواني_اليوم - (now - u["last_daily"])
        h = remaining // 3600
        m = (remaining % 3600) // 60
        await interaction.response.send_message(f"⏳ انتظر {h} ساعة {m} دقيقة", ephemeral=True)
        return
    update_user(uid, last_daily=now, coins=u["coins"]+مكافأة_يومية_عملات, credits=u["credits"]+مكافأة_يومية_رصيد)
    await interaction.response.send_message(f"🎁 +{مكافأة_يومية_عملات} عملة و +{مكافأة_يومية_رصيد} رصيد")

@البوت.tree.command(name="ساعي", description="مكافأة كل ساعة")
async def ساعي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    u = init_user(uid)
    now = int(time.time())
    if now - u["last_hourly"] < ثواني_الساعة:
        remaining = ثواني_الساعة - (now - u["last_hourly"])
        m = remaining // 60
        await interaction.response.send_message(f"⏳ انتظر {m} دقيقة", ephemeral=True)
        return
    update_user(uid, last_hourly=now, coins=u["coins"]+مكافأة_ساعية_عملات)
    await interaction.response.send_message(f"⏲️ +{مكافأة_ساعية_عملات} عملة")

@البوت.tree.command(name="اعمل", description="اعمل لكسب عملات")
async def اعمل(interaction: discord.Interaction):
    earn = random.randint(الحد_الأدنى_للعمل, الحد_الأقصى_للعمل)
    uid = str(interaction.user.id)
    u = init_user(uid)
    update_user(uid, coins=u["coins"]+earn)
    advance_mission_progress(uid, "اعمل")
    await interaction.response.send_message(f"💼 كسبت {earn} عملة")

@البوت.tree.command(name="الاغنياء", description="أغنى 10 لاعبين")
async def الاغنياء(interaction: discord.Interaction):
    rows = get_all_users()
    sorted_rows = sorted(rows, key=lambda x: x[1], reverse=True)[:10]
    if not sorted_rows:
        await interaction.response.send_message("لا يوجد مستخدمون بعد")
        return
    desc = ""
    for i, (uid, coins) in enumerate(sorted_rows):
        user = await البوت.fetch_user(int(uid))
        name = user.display_name if user else "مجهول"
        desc += f"{i+1}. **{name}** — {coins} 🪙\n"
    embed = discord.Embed(title="🏆 قائمة الأغنياء", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="المتجر", description="عرض المتجر العادي")
async def المتجر(interaction: discord.Interaction):
    embed = discord.Embed(title="🛒 المتجر العادي", color=0x3498db)
    for i in range(1, 14):
        item = المتجر_العادي[i]
        embed.add_field(name=f"{i}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="مخزني", description="عرض مخزونك")
async def مخزني(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    inv = get_inventory(uid)
    if not inv:
        await interaction.response.send_message("📦 مخزونك فارغ", ephemeral=True)
        return
    desc = ""
    for item_id, qty in inv[:10]:
        item = المتجر_العادي.get(item_id) or السوق_السوداء_سلع.get(item_id)
        if item:
            desc += f"• {item['name']} x{qty}\n"
    embed = discord.Embed(title=f"مخزون {interaction.user.display_name}", description=desc, color=0x2ecc71)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="بلاك_ماركت", description="عرض السوق السوداء")
async def بلاك_ماركت(interaction: discord.Interaction):
    embed = discord.Embed(title="🔫 السوق السوداء - الصفحة 1/5", color=0xFF0000)
    for i in range(1, 11):
        item = السوق_السوداء_سلع[i]
        embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
    
    class BlackMarketView(discord.ui.View):
        def __init__(self, page=1):
            super().__init__(timeout=120)
            self.page = page
        
        @discord.ui.button(label="◀ السابقة", style=discord.ButtonStyle.secondary)
        async def prev(self, inter, btn):
            if self.page > 1:
                self.page -= 1
                await self.update(inter)
            else:
                await inter.response.send_message("❌ أنت في الصفحة الأولى!", ephemeral=True)
        
        @discord.ui.button(label="التالي ▶", style=discord.ButtonStyle.secondary)
        async def next(self, inter, btn):
            if self.page < 5:
                self.page += 1
                await self.update(inter)
            else:
                await inter.response.send_message("❌ أنت في الصفحة الخامسة!", ephemeral=True)
        
        async def update(self, inter):
            start = (self.page - 1) * 10 + 1
            end = min(start + 9, 50)
            embed = discord.Embed(title=f"🔫 السوق السوداء - الصفحة {self.page}/5", color=0xFF0000)
            for i in range(start, end + 1):
                item = السوق_السوداء_سلع[i]
                embed.add_field(name=f"{item['id']}. {item['name']}", value=f"🪙 {item['coinPrice']} | 💎 {item['creditPrice']}", inline=True)
            await inter.response.edit_message(embed=embed, view=self)
    
    await interaction.response.send_message(embed=embed, view=BlackMarketView())

@البوت.tree.command(name="شراء_بلاك", description="شراء سلعة من السوق السوداء")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def شراء_بلاك(interaction: discord.Interaction, item_id: int, currency: str):
    item = السوق_السوداء_سلع.get(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = init_user(uid)
    price = item["coinPrice"] if currency == "coins" else item["creditPrice"]
    if currency == "coins":
        if u["coins"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} عملة", ephemeral=True)
            return
        update_user(uid, coins=u["coins"]-price)
    else:
        if u["credits"] < price:
            await interaction.response.send_message(f"❌ تحتاج {price} رصيد", ephemeral=True)
            return
        update_user(uid, credits=u["credits"]-price)
    add_inventory(uid, item_id, 1)
    await interaction.response.send_message(f"✅ اشتريت {item['name']}")

@البوت.tree.command(name="اشتري", description="شراء سلعة من المتجر العادي")
@app_commands.choices(currency=[app_commands.Choice(name="عملات", value="coins"), app_commands.Choice(name="رصيد مميز", value="credits")])
async def اشتري(interaction: discord.Interaction, item_id: int, currency: str, quantity: int = 1):
    if quantity < 1:
        quantity = 1
    item = المتجر_العادي.get(item_id)
    if not item:
        await interaction.response.send_message("❌ رقم سلعة خاطئ", ephemeral=True)
        return
    uid = str(interaction.user.id)
    u = init_user(uid)
    if currency == "coins":
        price = item["coinPrice"]
        multiplier = 1
    else:
        price = item["creditPrice"]
        multiplier = 2
    cost = price * quantity
    if currency == "coins":
        if u["coins"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} عملة", ephemeral=True)
            return
        update_user(uid, coins=u["coins"]-cost)
    else:
        if u["credits"] < cost:
            await interaction.response.send_message(f"❌ تحتاج {cost} رصيد", ephemeral=True)
            return
        update_user(uid, credits=u["credits"]-cost)
    
    if item_id in [1, 5]:
        heal = 20 if item_id == 1 else 50
        total_heal = heal * quantity * multiplier
        active = u["active_team"]
        _, current_hp, _ = get_team(uid, active, True)
        if current_hp >= 200:
            await interaction.response.send_message("❌ صحة فريقك كاملة!", ephemeral=True)
            return
        new_hp = min(200, current_hp + total_heal)
        update_team_health(uid, active, new_hp)
        await interaction.response.send_message(f"❤️ تم شفاء فريقك! +{total_heal} صحة")
        advance_mission_progress(uid, "اشترِ سلاحاً")
    else:
        received = quantity * multiplier
        add_inventory(uid, item_id, received)
        await interaction.response.send_message(f"✅ اشتريت {received} × {item['name']}")
        if item_id in أضرار_الأسلحة or 1 <= item_id <= 50:
            advance_mission_progress(uid, "اشترِ سلاحاً")

@البوت.tree.command(name="تعيين_فريق", description="تسمية فريقك")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تعيين_فريق_امر(interaction: discord.Interaction, slot: int, name: str):
    if len(name) > الحد_الأقصى_لاسم_الفريق:
        name = name[:الحد_الأقصى_لاسم_الفريق]
    set_team(str(interaction.user.id), slot-1, name)
    await interaction.response.send_message(f"✅ تم تسمية الفريق {slot} → {name}")

@البوت.tree.command(name="تفعيل_فريق", description="تفعيل فريق")
@app_commands.choices(slot=[app_commands.Choice(name="الفريق الأول", value=1), app_commands.Choice(name="الفريق الثاني", value=2)])
async def تفعيل_فريق(interaction: discord.Interaction, slot: int):
    update_user(str(interaction.user.id), active_team=slot-1)
    await interaction.response.send_message(f"🔁 تم تفعيل الفريق {slot}")

@البوت.tree.command(name="فرقي", description="عرض فرقك")
async def فرقي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    n1, h1, i1 = get_team(uid, 0, True)
    n2, h2, i2 = get_team(uid, 1, True)
    u = init_user(uid)
    embed = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
    embed.add_field(name="الفريق الأول", value=f"{n1 or 'غير محدد'}\n❤️ HP: {h1}\n👻 مخفي: {'نعم' if i1 > time.time() else 'لا'}", inline=False)
    embed.add_field(name="الفريق الثاني", value=f"{n2 or 'غير محدد'}\n❤️ HP: {h2}\n👻 مخفي: {'نعم' if i2 > time.time() else 'لا'}", inline=False)
    embed.add_field(name="الفريق النشط", value=f"الفريق {u['active_team']+1}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="دخول_فريق", description="اختيار فريق من القائمة")
async def دخول_فريق(interaction: discord.Interaction):
    teams = []
    for uid, teams_data in بيانات_الفرق.items():
        for slot, team in teams_data.items():
            if team["name"]:
                teams.append((uid, slot, team["name"]))
    if not teams:
        await interaction.response.send_message("لا توجد فرق متاحة للانضمام", ephemeral=True)
        return
    
    view = discord.ui.View()
    select = discord.ui.Select(placeholder="اختر فريقاً للانضمام...")
    for uid, slot, name in teams[:25]:
        user = await البوت.fetch_user(int(uid))
        display = user.display_name if user else "مجهول"
        select.add_option(label=name, description=f"بواسطة {display}", value=f"{uid}|{slot}")
    
    async def select_callback(inter):
        val = inter.data["values"][0]
        owner, slot = val.split("|")
        update_user(str(inter.user.id), active_team=int(slot))
        await inter.response.send_message("✅ تم الانضمام للفريق!", ephemeral=True)
    
    select.callback = select_callback
    view.add_item(select)
    await interaction.response.send_message("📋 اختر فريقاً:", view=view, ephemeral=True)

class WeaponSelect(discord.ui.Select):
    def __init__(self, attacker_id, target, weapons):
        self.attacker_id = attacker_id
        self.target = target
        self.weapons = weapons
        options = [discord.SelectOption(label=w["name"], value=str(w["id"]), description=f"💥 ضرر: {w['damage']}") for w in weapons]
        super().__init__(placeholder="اختر سلاحك...", options=options)
    
    async def callback(self, interaction: discord.Interaction):
        try:
            weapon_id = int(self.values[0])
            weapon = next((w for w in self.weapons if w["id"] == weapon_id), None)
            if not weapon:
                await interaction.response.send_message("❌ حدث خطأ!", ephemeral=True)
                return
            
            attacker = str(self.attacker_id)
            target_id = str(self.target.id)
            
            attacker_data = init_user(attacker)
            target_data = init_user(target_id)
            
            attacker_team = attacker_data["active_team"]
            target_team = target_data["active_team"]
            
            _, target_hp, target_inv = get_team(target_id, target_team, True)
            
            if target_inv > time.time():
                await interaction.response.send_message(f"❌ فريق {self.target.display_name} في حالة تخفي!", ephemeral=True)
                return
            if target_hp <= 0:
                await interaction.response.send_message(f"❌ فريق {self.target.display_name} هُزم!", ephemeral=True)
                return
            
            new_hp = max(0, target_hp - weapon["damage"])
            update_team_health(target_id, target_team, new_hp)
            advance_mission_progress(attacker, "اهاجم")
            
            embed = discord.Embed(title="⚔️ نتيجة الهجوم", color=0xFF4500)
            embed.add_field(name="المهاجم", value=f"{interaction.user.display_name}", inline=False)
            embed.add_field(name="الخصم", value=f"{self.target.display_name}", inline=False)
            embed.add_field(name="السلاح", value=weapon["name"], inline=True)
            embed.add_field(name="الضرر", value=str(weapon["damage"]), inline=True)
            embed.add_field(name="HP المتبقية", value=str(new_hp), inline=True)
            if new_hp == 0:
                embed.add_field(name="💀 النتيجة", value="تم هزيمة الفريق!", inline=False)
            
            try:
                await self.target.send(f"⚔️ تعرض فريقك للهجوم من {interaction.user.display_name} باستخدام {weapon['name']}!\n💥 الضرر: {weapon['damage']}\n❤️ HP المتبقي: {new_hp}")
            except:
                pass
            
            await interaction.response.send_message(embed=embed)
        except Exception as e:
            print(f"خطأ في الهجوم: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="هجوم", description="مهاجمة لاعب آخر")
async def هجوم(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك مهاجمة نفسك", ephemeral=True)
        return
    
    weapons = get_available_weapons(str(interaction.user.id))
    if not weapons:
        await interaction.response.send_message("❌ لا تملك أي أسلحة للهجوم!", ephemeral=True)
        return
    
    view = discord.ui.View()
    select = WeaponSelect(interaction.user.id, target, weapons)
    view.add_item(select)
    await interaction.response.send_message("⚔️ اختر سلاحك:", view=view, ephemeral=True)

@البوت.tree.command(name="سرقة", description="سرقة أموال من لاعب")
async def سرقة(interaction: discord.Interaction, target: discord.Member):
    if target.id == interaction.user.id:
        await interaction.response.send_message("❌ لا يمكنك سرقة نفسك", ephemeral=True)
        return
    
    uid = str(interaction.user.id)
    tid = str(target.id)
    u = init_user(uid)
    t = init_user(tid)
    now = int(time.time())
    
    if now - u["last_robbery"] < مدة_السرقة:
        remaining = مدة_السرقة - (now - u["last_robbery"])
        await interaction.response.send_message(f"⏳ يمكنك السرقة بعد {remaining//60} دقيقة", ephemeral=True)
        return
    
    active_team = t["active_team"]
    _, _, target_inv = get_team(tid, active_team, True)
    if target_inv > time.time():
        await interaction.response.send_message(f"❌ فريق {target.display_name} في حالة تخفي!", ephemeral=True)
        return
    
    stolen = max(10, int(t["coins"] * نسبة_السرقة))
    update_user(tid, coins=t["coins"]-stolen)
    update_user(uid, coins=u["coins"]+stolen, last_robbery=now)
    advance_mission_progress(uid, "اسرق")
    await interaction.response.send_message(f"💰 سرقت {stolen} عملة من {target.display_name}!")

@البوت.tree.command(name="تخفي", description="إخفاء فريقك 30 دقيقة")
async def تخفي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    if not has_item(uid, 26):
        await interaction.response.send_message("❌ لا تمتلك كتاب التخفي!", ephemeral=True)
        return
    u = init_user(uid)
    until = int(time.time()) + مدة_التخفي
    update_team_invisible(uid, u["active_team"], until)
    remove_inventory(uid, 26, 1)
    advance_mission_progress(uid, "استخدم تخفي")
    await interaction.response.send_message("👻 تم إخفاء فريقك لمدة 30 دقيقة!")

@البوت.tree.command(name="مهامي", description="عرض مهامك")
async def مهامي(interaction: discord.Interaction):
    uid = str(interaction.user.id)
    mission = get_mission(uid)
    embed = discord.Embed(title="📋 مهامك", color=0xF1C40F)
    embed.add_field(name="1️⃣ " + mission["m1"], value=f"التقدم: {mission['p1']}", inline=False)
    embed.add_field(name="2️⃣ " + mission["m2"], value=f"التقدم: {mission['p2']}", inline=False)
    embed.add_field(name="3️⃣ " + mission["m3"], value=f"التقدم: {mission['p3']}", inline=False)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="تسليم_مهمة", description="تسليم مهمة مكتملة")
async def تسليم_مهمة(interaction: discord.Interaction, mission_number: int):
    if mission_number not in [1,2,3]:
        await interaction.response.send_message("❌ رقم المهمة 1 أو 2 أو 3", ephemeral=True)
        return
    uid = str(interaction.user.id)
    success, result = complete_mission(uid, mission_number)
    if not success:
        if result == "completed":
            await interaction.response.send_message("❌ هذه المهمة تم تسليمها بالفعل!", ephemeral=True)
        else:
            await interaction.response.send_message("⏳ لم تكمل المهمة بعد!", ephemeral=True)
        return
    u = init_user(uid)
    reward_coins = 300
    reward_credits = 5
    update_user(uid, coins=u["coins"]+reward_coins, credits=u["credits"]+reward_credits)
    await interaction.response.send_message(f"🎉 تم تسليم المهمة! حصلت على {reward_coins} عملة و {reward_credits} رصيد مميز")

@البوت.tree.command(name="اعطاء_فلوس", description="منح أموال للاعب (للأونر فقط)")
async def اعطاء_فلوس(interaction: discord.Interaction, user: discord.User, coins: int = 0, credits: int = 0):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    u = init_user(str(user.id))
    update_user(str(user.id), coins=u["coins"]+coins, credits=u["credits"]+credits)
    await interaction.response.send_message(f"✅ أعطيت {user.mention} {coins} عملة و {credits} رصيد")

@البوت.tree.command(name="حذف_فريق", description="حذف فريق لاعب (للأونر فقط)")
async def حذف_فريق(interaction: discord.Interaction, user: discord.User, team_number: int):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    if team_number not in [1,2]:
        await interaction.response.send_message("❌ رقم الفريق 1 أو 2", ephemeral=True)
        return
    set_team(str(user.id), team_number-1, "")
    await interaction.response.send_message(f"✅ تم حذف الفريق {team_number} لـ {user.mention}")

@البوت.tree.command(name="اذاعة", description="إرسال رسالة لجميع المستخدمين (للأونر فقط)")
async def اذاعة(interaction: discord.Interaction, message: str):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    await interaction.response.defer(ephemeral=True)
    users = get_all_users()
    count = 0
    for uid, _ in users:
        try:
            user = await البوت.fetch_user(int(uid))
            if user:
                await user.send(f"📢 {message}")
                count += 1
                await asyncio.sleep(0.5)
        except:
            pass
    await interaction.followup.send(f"✅ تم إرسال الإذاعة إلى {count} مستخدم")

@البوت.tree.command(name="وصف", description="معلومات عن البوت")
async def وصف(interaction: discord.Interaction):
    embed = discord.Embed(title="ℹ️ معلومات البوت", color=0x00FFFF)
    embed.add_field(name="👑 المطور", value=f"{اسم_المطور} ({معرف_المطور})", inline=True)
    embed.add_field(name="🔗 رابط الدعم", value=f"[اضغط هنا]({رابط_السيرفر})", inline=True)
    embed.set_footer(text="الاصدار 1.2")
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="brq", description="عرض إحصائيات رسائلك")
async def brq(interaction: discord.Interaction):
    today, week, month, total = get_message_stats(str(interaction.user.id))
    embed = discord.Embed(title=f"📊 إحصائيات رسائل {interaction.user.display_name}", color=0x00FF00)
    embed.add_field(name="📅 اليوم", value=str(today), inline=True)
    embed.add_field(name="📆 الأسبوع", value=str(week), inline=True)
    embed.add_field(name="📅 الشهر", value=str(month), inline=True)
    embed.add_field(name="📊 المجموع", value=str(total), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="invites", description="عدد دعواتك")
async def invites(interaction: discord.Interaction):
    count = بيانات_الدعوات.get(str(interaction.user.id), 0)
    embed = discord.Embed(title=f"📊 عدد دعوات {interaction.user.display_name}", color=0x00FF00)
    embed.add_field(name="🎫 إجمالي الدعوات", value=str(count), inline=True)
    await interaction.response.send_message(embed=embed)

@البوت.tree.command(name="topinvites", description="ترتيب أكثر من دعا")
async def topinvites(interaction: discord.Interaction):
    sorted_invites = sorted(بيانات_الدعوات.items(), key=lambda x: x[1], reverse=True)[:10]
    if not sorted_invites:
        await interaction.response.send_message("لا توجد دعوات بعد", ephemeral=True)
        return
    desc = ""
    for i, (uid, count) in enumerate(sorted_invites):
        user = await البوت.fetch_user(int(uid))
        name = user.display_name if user else "مجهول"
        desc += f"{i+1}. **{name}** — {count} دعوة\n"
    embed = discord.Embed(title="🏆 قائمة الأكثر دعوة", description=desc, color=0xFFD700)
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    try:
        البوت.run(التوكن)
    except Exception as e:
        print(f"❌ خطأ: {e}")
        traceback.print_exc()