# ==================== shop_data.py ====================
import discord
from discord.ext import commands
from discord import app_commands
import random
import time
from datetime import date, timedelta

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

def get_best_weapon(user_id):
    inv = get_inventory(user_id)
    best = ضرر_اللكمة_الأساسي
    for item_id, qty in inv:
        if qty > 0 and item_id in أضرار_الأسلحة:
            best = max(best, أضرار_الأسلحة[item_id])
        elif 1 <= item_id <= 50 and qty > 0:
            best = max(best, 15 + (item_id * 2))
    return best

def get_available_weapons(user_id):
    inv = get_inventory(user_id)
    weapons = []
    for item_id, qty in inv:
        if qty > 0:
            if item_id in أضرار_الأسلحة:
                name, damage = أضرار_الأسلحة[item_id], أضرار_الأسلحة[item_id]
                weapons.append({"id": item_id, "name": المتجر_العادي[item_id]["name"], "damage": damage})
            elif 1 <= item_id <= 50:
                item = السوق_السوداء_سلع.get(item_id)
                if item:
                    weapons.append({"id": item_id, "name": item["name"], "damage": 15 + (item_id * 2)})
    return weapons

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

def advance_mission_progress(user_id, mission_type):
    mission = get_mission(user_id)
    now = int(time.time())
    if now - mission["last_reset"] > 3 * ثواني_اليوم:
        missions = ["اعمل 5 مرات", "اهاجم 3 لاعبين", "اجمع 500 عملة", "اشترِ سلاحاً", "اسرق لاعباً", "استخدم تخفي"]
        selected = random.sample(missions, 3)
        mission["m1"], mission["m2"], mission["m3"] = selected[0], selected[1], selected[2]
        mission["p1"], mission["p2"], mission["p3"] = 0, 0, 0
        mission["c1"], mission["c2"], mission["c3"] = 0, 0, 0
        mission["last_reset"] = now
    
    for i in range(1, 4):
        if mission_type in mission[f"m{i}"] and mission[f"c{i}"] == 0:
            mission[f"p{i}"] += 1