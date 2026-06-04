# ==================== management.py ====================
import discord
from discord.ext import commands
from discord import app_commands
import aiosqlite
import json
import os
import logging
from datetime import datetime

logger = logging.getLogger('discord_bot')

class EmbedHelper:
    @staticmethod
    def create(title=None, description=None, color=None, fields=None, footer_text=None, image_url=None, thumbnail_url=None, author_name=None, author_icon=None):
        try:
            if color is None: color = 0x3498db
            if isinstance(color, str): color = int(color.replace("#", ""), 16)
            embed = discord.Embed(title=title, description=description, color=color)
            if image_url: embed.set_image(url=image_url)
            if thumbnail_url: embed.set_thumbnail(url=thumbnail_url)
            if author_name: embed.set_author(name=author_name, icon_url=author_icon)
            if fields:
                for f in fields: embed.add_field(name=f.get("name", ""), value=f.get("value", ""), inline=f.get("inline", True))
            if footer_text: embed.set_footer(text=footer_text)
            embed.timestamp = datetime.utcnow()
            return embed
        except Exception as e:
            logger.error(f"❌ EmbedHelper.create: {e}")
            return discord.Embed(description="حدث خطأ.", color=0xFF0000)

    @staticmethod
    async def send(target, title=None, description=None, color=None, fields=None, footer_text=None, image_url=None, thumbnail_url=None, author_name=None, author_icon=None, is_ephemeral=False, view=None):
        try:
            embed = EmbedHelper.create(title=title, description=description, color=color, fields=fields, footer_text=footer_text, image_url=image_url, thumbnail_url=thumbnail_url, author_name=author_name, author_icon=author_icon)
            if hasattr(target, 'response'):
                if target.response.is_done(): await target.followup.send(embed=embed, ephemeral=is_ephemeral, view=view)
                else: await target.response.send_message(embed=embed, ephemeral=is_ephemeral, view=view)
            else: await target.send(embed=embed, view=view)
            return embed
        except Exception as e:
            logger.error(f"❌ EmbedHelper.send: {e}")
            return None

class Management(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.db_path = "bots_database.db"
        self.قائمة_الأنواع_ar = ["ألعاب", "إدارة", "موسيقى", "دعم", "اقتصاد", "ترحيب", "سوشيال", "حماية", "تعليم", "متجر"]
        self.قائمة_الأنواع_en = ["Games", "Management", "Music", "Support", "Economy", "Welcome", "Social", "Security", "Education", "Shop"]

    async def init_db(self):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute('''CREATE TABLE IF NOT EXISTS all_bots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_name TEXT NOT NULL,
                bot_category TEXT NOT NULL,
                description_ar TEXT,
                description_en TEXT,
                invite_link TEXT,
                keywords TEXT
            )''')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_keywords ON all_bots(keywords)')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_category ON all_bots(bot_category)')
            await db.execute('CREATE INDEX IF NOT EXISTS idx_name ON all_bots(bot_name)')
            await db.commit()
        logger.info("✅ تم تهيئة قاعدة بيانات البوتات")

    async def import_bots_from_json(self, filepath="bots_data.json"):
        if not os.path.exists(filepath):
            logger.warning(f"⚠️ ملف {filepath} غير موجود، تخطي الاستيراد")
            return
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("SELECT COUNT(*) FROM all_bots")
            count = (await cursor.fetchone())[0]
            if count > 0:
                logger.info(f"📊 قاعدة البيانات تحتوي بالفعل على {count} بوت")
                return
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            bots = data if isinstance(data, list) else data.get("bots", [])
            for bot in bots:
                await db.execute(
                    "INSERT INTO all_bots (bot_name, bot_category, description_ar, description_en, invite_link, keywords) VALUES (?, ?, ?, ?, ?, ?)",
                    (bot.get("name", ""), bot.get("category", ""), bot.get("desc_ar", ""), bot.get("desc_en", ""), bot.get("link", ""), bot.get("keywords", ""))
                )
            await db.commit()
            logger.info(f"✅ تم استيراد {len(bots)} بوت إلى قاعدة البيانات")

    async def search_bots(self, query, limit=10):
        async with aiosqlite.connect(self.db_path) as db:
            like_query = f"%{query}%"
            cursor = await db.execute(
                "SELECT bot_name, bot_category, description_ar, description_en, invite_link FROM all_bots WHERE bot_name LIKE ? OR keywords LIKE ? OR bot_category LIKE ? OR description_ar LIKE ? OR description_en LIKE ? LIMIT ?",
                (like_query, like_query, like_query, like_query, like_query, limit)
            )
            return await cursor.fetchall()

    @commands.Cog.listener()
    async def on_ready(self):
        await self.init_db()
        await self.import_bots_from_json()
        logger.info("✅ Management جاهز (مستشار البوتات بقاعدة بيانات)")

    @commands.Cog.listener()
    async def on_message(self, message):
        if message.author.bot or not message.guild: return
        msg = message.content.strip()
        if any(phrase in msg for phrase in ["أبي بوت", "بدي بوت", "ابغى بوت", "بوت اقتراح", "اقترح بوت", "search bot", "find bot"]):
            embed = EmbedHelper.create(
                title="🤖 Bot Advisor | مستشار البوتات",
                description=f"أهلاً {message.author.mention}!\nيمكنك استخدام أمر **/search_bot** والبحث عن أي بوت.\n\nHello! Use **/search_bot** to find any bot.",
                color=0x9B59B6,
                fields=[
                    {"name": "📂 فئات | Categories", "value": ", ".join(self.قائمة_الأنواع_ar[:6]) + "\n" + ", ".join(self.قائمة_الأنواع_en[:6]), "inline": False}
                ],
                footer_text="اكتب اسم البوت أو نوعه • Type bot name or category"
            )
            await message.reply(embed=embed, mention_author=False)

    @app_commands.command(name="search_bot", description="البحث عن بوت | Search for a bot")
    @app_commands.describe(
        query="اسم البوت أو نوعه | Bot name or category",
        language="اللغة | Language (اختياري | Optional)"
    )
    @app_commands.choices(language=[
        app_commands.Choice(name="العربية", value="ar"),
        app_commands.Choice(name="English", value="en")
    ])
    async def search_bot(self, interaction: discord.Interaction, query: str, language: str = None):
        await interaction.response.defer()
        try:
            results = await self.search_bots(query.strip())
            if not results:
                if language == "en":
                    title = f"❌ No results for: {query}"
                    desc = f"Sorry, no bots found matching '{query}'.\nTry another search term!"
                else:
                    title = f"❌ لا توجد نتائج عن: {query}"
                    desc = f"عذراً، لم أجد بوتات تطابق '{query}'.\nجرب كلمة بحث أخرى!"
                await interaction.followup.send(embed=EmbedHelper.create(title=title, description=desc, color=0xFF0000))
                return

            if language == "en":
                title = f"🔍 Search results for: {query}"
                desc = f"Found **{len(results)}** bots matching your search:"
            else:
                title = f"🔍 نتائج البحث عن: {query}"
                desc = f"تم العثور على **{len(results)}** بوتات تطابق بحثك:"

            fields = []
            for i, (name, cat, desc_ar, desc_en, link) in enumerate(results, 1):
                if language == "en":
                    bot_desc = desc_en or desc_ar or "No description available"
                else:
                    bot_desc = desc_ar or desc_en or "لا يوجد وصف متوفر"
                fields.append({
                    "name": f"{i}. {name}",
                    "value": f"📂 {cat}\n{bot_desc[:150]}\n[🔗 Invite | دعوة]({link or '#'})",
                    "inline": False
                })

            embed = EmbedHelper.create(title=title, description=desc, color=0x9B59B6, fields=fields, footer_text="Bot Advisor • مستشار البوتات")
            await interaction.followup.send(embed=embed)
        except Exception as e:
            logger.error(f"❌ search_bot: {e}")
            await interaction.followup.send(embed=EmbedHelper.create(description="❌ حدث خطأ داخلي! | Internal error!", color=0xFF0000))

    @app_commands.command(name="help", description="المساعدة | Help")
    async def help_command(self, interaction: discord.Interaction):
        embed = EmbedHelper.create(
            title="📚 المساعدة | Help",
            description="بوت مستشار البوتات الذكي | Bot Advisor",
            color=0x3498db,
            fields=[
                {"name": "🔍 بحث | Search", "value": "`/search_bot` - ابحث عن أي بوت | Find any bot", "inline": False},
                {"name": "💬 شات | Chat", "value": "اكتب 'أبي بوت' أو 'find bot'", "inline": False},
                {"name": "🌐 لغة | Language", "value": "اختر العربية أو English في أمر البحث", "inline": False}
            ],
            footer_text="Bot Advisor • شغال 24 ساعة | Online 24/7"
        )
        await interaction.response.send_message(embed=embed, ephemeral=True)

async def setup(bot):
    await bot.add_cog(Management(bot))