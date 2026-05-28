import sys
import os
import traceback

print("🚀 [1] بدء تشغيل البوت...")

try:
    print("🚀 [2] محاولة استيراد المكتبات...")
    import discord
    from discord.ext import commands
    import threading
    from flask import Flask
    
    print("✅ [3] تم استيراد جميع المكتبات بنجاح")

except Exception as e:
    print(f"❌ خطأ في استيراد المكتبات: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("🚀 [4] جاري إعداد خادم Flask...")
    app = Flask(__name__)

    @app.route('/')
    def home():
        return "Bot is running!"

    def run_flask():
        print("🔥 [Flask] خادم الويب يبدأ على منفذ 8080")
        app.run(host='0.0.0.0', port=8080)

    print("✅ [5] تم إعداد Flask")

except Exception as e:
    print(f"❌ خطأ في إعداد Flask: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("🚀 [6] جاري قراءة التوكن...")
    TOKEN = os.getenv("DISCORD_TOKEN")
    
    if TOKEN is None:
        print("❌ [7] DISCORD_TOKEN غير موجود في متغيرات البيئة!")
        print("    تأكد من إضافته في Render Environment Variables")
        sys.exit(1)
    
    print(f"✅ [8] تم قراءة التوكن (طوله: {len(TOKEN)} حرف)")

except Exception as e:
    print(f"❌ خطأ في قراءة التوكن: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("🚀 [9] جاري إعداد البوت...")
    intents = discord.Intents.default()
    intents.message_content = True
    intents.members = True
    
    bot = commands.Bot(command_prefix="!", intents=intents)
    print("✅ [10] تم إعداد البوت")

except Exception as e:
    print(f"❌ خطأ في إعداد البوت: {e}")
    traceback.print_exc()
    sys.exit(1)

# ========== أوامر البوت ==========
@bot.event
async def on_ready():
    print(f"✅🎉 البوت دخل باسم: {bot.user}")
    print(f"✅🎉 معرف البوت: {bot.user.id}")
    print(f"✅🎉 عدد السيرفرات: {len(bot.guilds)}")

@bot.command()
async def ping(ctx):
    await ctx.send(f"🏓 بونق! {round(bot.latency * 1000)}ms")

# ========== التشغيل الرئيسي ==========
try:
    print("🚀 [11] بدء تشغيل خادم Flask في الخلفية...")
    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    print("✅ [12] خادم Flask يعمل في الخلفية")

except Exception as e:
    print(f"❌ خطأ في تشغيل Flask: {e}")
    traceback.print_exc()
    sys.exit(1)

try:
    print("🚀 [13] محاولة تشغيل البوت على Discord...")
    print("    (إذا توقف هنا، المشكلة في التوكن أو اتصال Discord)")
    bot.run(TOKEN)
    
except discord.LoginFailure as e:
    print(f"❌❌❌ فشل تسجيل الدخول إلى Discord: {e}")
    print("    تأكد من أن التوكن صحيح ولم ينته صلاحيته")
    traceback.print_exc()
    sys.exit(1)

except Exception as e:
    print(f"❌❌❌ خطأ غير متوقع أثناء تشغيل البوت: {e}")
    traceback.print_exc()
    sys.exit(1)