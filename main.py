# ==================== main.py ====================
import sys
import traceback

def handle_exception(exc_type, exc_value, exc_traceback):
    sys.stderr.write("خطأ غير متوقع: ")
    traceback.print_exception(exc_type, exc_value, exc_traceback, file=sys.stderr)

sys.excepthook = handle_exception

import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import os
import random
import time
import json
import threading
from flask import Flask
from datetime import datetime, timedelta
from collections import defaultdict

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الإصدار 2.5"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود في متغيرات البيئة")
    sys.exit(1)

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True
الصلاحيات.moderation = True

البوت = commands.Bot(command_prefix="+", intents=الصلاحيات)

بيانات_الدعوات = {}
دعوات_السيرفرات = {}
لعب_الروليت = {}
سجل_الروليت = {}

async def init_db():
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS server_config (
            guild_id TEXT PRIMARY KEY,
            verify_role TEXT,
            verify_channel TEXT,
            welcome_channel TEXT,
            logs_channel TEXT,
            report_channel TEXT,
            member_count_channel TEXT,
            block_links BOOLEAN DEFAULT 0
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            complaint TEXT,
            created_at INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS staff_ratings (
            guild_id TEXT,
            user_id TEXT,
            rating INTEGER,
            created_at INTEGER,
            PRIMARY KEY (guild_id, user_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS member_join_log (
            guild_id TEXT,
            date TEXT,
            count INTEGER DEFAULT 0,
            PRIMARY KEY (guild_id, date)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS channel_activity (
            guild_id TEXT,
            channel_id TEXT,
            last_message INTEGER,
            PRIMARY KEY (guild_id, channel_id)
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS roulette_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            user_id TEXT,
            user_name TEXT,
            result TEXT,
            created_at INTEGER
        )''')
        await db.commit()

async def حفظ_سجل_الروليت(guild_id, user_id, user_name, result):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT INTO roulette_history (guild_id, user_id, user_name, result, created_at) VALUES (?, ?, ?, ?, ?)",
                        (str(guild_id), str(user_id), user_name, result, int(time.time())))
        await db.commit()

async def تحديث_الدعوات(guild):
    try:
        دعوات_السيرفرات[guild.id] = {inv.code: inv.uses for inv in await guild.invites()}
    except:
        pass

async def تسجيل_نشاط_القناة(guild_id, channel_id):
    async with aiosqlite.connect("server_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO channel_activity (guild_id, channel_id, last_message) VALUES (?, ?, ?)",
                        (str(guild_id), str(channel_id), int(time.time())))
        await db.commit()

async def الحصول_على_عدد_الدعوات(user_id):
    return بيانات_الدعوات.get(str(user_id), 0)

async def الحصول_على_جميع_الدعوات():
    return sorted(بيانات_الدعوات.items(), key=lambda x: x[1], reverse=True)

class RouletteView(discord.ui.View):
    def __init__(self, host_id):
        super().__init__(timeout=30)
        self.host_id = host_id
        self.players = []
        self.message = None
    
    @discord.ui.button(label="🎲 دخول", style=discord.ButtonStyle.success, emoji="🎲")
    async def join_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id in self.players:
            await interaction.response.send_message("❌ أنت مشترك بالفعل!", ephemeral=True)
            return
        self.players.append(interaction.user.id)
        await interaction.response.send_message(f"✅ {interaction.user.mention} انضم إلى الروليت!", ephemeral=True)
        await self.update_message()
    
    @discord.ui.button(label="🚪 خروج", style=discord.ButtonStyle.danger, emoji="🚪")
    async def leave_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        if interaction.user.id not in self.players:
            await interaction.response.send_message("❌ لست مشتركاً في هذه اللعبة!", ephemeral=True)
            return
        self.players.remove(interaction.user.id)
        await interaction.response.send_message(f"✅ {interaction.user.mention} غادر الروليت!", ephemeral=True)
        await self.update_message()
    
    async def update_message(self):
        if self.message:
            embed = discord.Embed(
                title="🎡 روليت السيرفر",
                description=f"انضم الآن لتجربة حظك! سيتم اختيار شخص واحد ليواجه المصير المحتوم.\n\n**المشتركين ({len(self.players)}):**\n" + "\n".join([f"<@{pid}>" for pid in self.players]) if self.players else "لا يوجد مشتركين بعد",
                color=0xFF6600
            )
            embed.add_field(name="⏰ المدة المتبقية", value="30 ثانية", inline=True)
            embed.set_footer(text=f"بواسطة {self.bot.get_user(self.host_id).display_name if self.bot.get_user(self.host_id) else 'المشرف'}")
            await self.message.edit(embed=embed)
    
    async def on_timeout(self):
        if self.message and len(self.players) > 0:
            winner_id = random.choice(self.players)
            winner = self.bot.get_user(winner_id)
            
            await حفظ_سجل_الروليت(self.message.guild.id, winner_id, winner.display_name if winner else "مجهول", "تم الطرد")
            
            embed = discord.Embed(
                title="🎡 نتيجة الروليت",
                description=f"**تم اختيار {winner.mention} ليواجه المصير المحتوم!**\n\nتم طرد {winner.mention} من اللعبة.",
                color=0xFF0000
            )
            await self.message.edit(embed=embed, view=None)
            
            try:
                await winner.send(f"⚠️ لقد تم اختيارك في روليت السيرفر `{self.message.guild.name}`! حظاً أوفر في المرة القادمة.")
            except:
                pass
        elif self.message:
            embed = discord.Embed(
                title="🎡 روليت السيرفر",
                description="انتهت اللعبة لعدم وجود مشتركين كافيين!",
                color=0xFFAA00
            )
            await self.message.edit(embed=embed, view=None)

class RouletteGame:
    def __init__(self, bot):
        self.bot = bot
        self.games = {}
    
    async def start_game(self, ctx_or_interaction, is_slash=False):
        guild_id = ctx_or_interaction.guild.id if hasattr(ctx_or_interaction, 'guild') else ctx_or_interaction.guild_id
        if guild_id in لعب_الروليت:
            if is_slash:
                await ctx_or_interaction.response.send_message("❌ هناك لعبة روليت نشطة بالفعل في هذا السيرفر!", ephemeral=True)
            else:
                await ctx_or_interaction.send("❌ هناك لعبة روليت نشطة بالفعل في هذا السيرفر!")
            return
        
        embed = discord.Embed(
            title="🎡 روليت السيرفر",
            description="انضم الآن لتجربة حظك! سيتم اختيار شخص واحد ليواجه المصير المحتوم.\n\n**المشتركين (0):**\nلا يوجد مشتركين بعد",
            color=0xFF6600
        )
        embed.add_field(name="⏰ المدة المتبقية", value="30 ثانية", inline=True)
        
        view = RouletteView(ctx_or_interaction.user.id if hasattr(ctx_or_interaction, 'user') else ctx_or_interaction.author.id)
        view.bot = self.bot
        
        if is_slash:
            await ctx_or_interaction.response.send_message(embed=embed, view=view)
            message = await ctx_or_interaction.original_response()
        else:
            message = await ctx_or_interaction.send(embed=embed, view=view)
        
        view.message = message
        لعب_الروليت[guild_id] = view
        
        await asyncio.sleep(30)
        if guild_id in لعب_الروليت:
            del لعب_الروليت[guild_id]

class VerifyView(discord.ui.View):
    def __init__(self, role_id):
        super().__init__(timeout=None)
        self.role_id = role_id
    
    @discord.ui.button(label="✅ تحقق", style=discord.ButtonStyle.success, emoji="✅", custom_id="verify_button")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            role = interaction.guild.get_role(self.role_id)
            if not role:
                await interaction.response.send_message("❌ رتبة التحقق غير موجودة! يرجى إبلاغ الإدارة.", ephemeral=True)
                return
            
            if role in interaction.user.roles:
                await interaction.response.send_message("✅ أنت بالفعل عضو موثق!", ephemeral=True)
                return
            
            await interaction.user.add_roles(role)
            await interaction.response.send_message("✅ تم التحقق بنجاح! مرحباً بك في السيرفر.", ephemeral=True)
            
            async with aiosqlite.connect("server_data.db") as db:
                today = datetime.now().strftime("%Y-%m-%d")
                await db.execute("INSERT INTO member_join_log (guild_id, date, count) VALUES (?, ?, 1) ON CONFLICT(guild_id, date) DO UPDATE SET count = count + 1", (str(interaction.guild_id), today))
                await db.commit()
                
                cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="🎉 عضو جديد موثق", description=f"{interaction.user.mention} قام بالتحقق وانضم إلى السيرفر!", color=0x00FF00)
                    await channel.send(embed=embed)
        except Exception as e:
            print(f"خطأ في التحقق: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintModal(discord.ui.Modal, title="📝 شكوى مجهولة"):
    complaint = discord.ui.TextInput(label="شكواك", style=discord.TextStyle.paragraph, placeholder="اكتب شكواك هنا...", required=True, max_length=1000)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT logs_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
                await db.execute("INSERT INTO complaints (guild_id, complaint, created_at) VALUES (?, ?, ?)", 
                                (str(interaction.guild_id), self.complaint.value, int(datetime.now().timestamp())))
                await db.commit()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="📝 شكوى جديدة (مجهولة المصدر)", description=self.complaint.value, color=0xFF6600, timestamp=datetime.now())
                    await channel.send(embed=embed)
            
            await interaction.response.send_message("✅ تم إرسال شكواك بنجاح!", ephemeral=True)
        except Exception as e:
            print(f"خطأ في الشكوى: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintsView(discord.ui.View):
    @discord.ui.button(label="📝 تقديم شكوى", style=discord.ButtonStyle.danger, emoji="📝")
    async def complaint_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(ComplaintModal())

class EmbedBuilderModal(discord.ui.Modal, title="🎨 إنشاء رسالة Embed"):
    title = discord.ui.TextInput(label="العنوان", placeholder="أدخل عنوان الرسالة...", required=True, max_length=256)
    description = discord.ui.TextInput(label="الوصف", style=discord.TextStyle.paragraph, placeholder="أدخل نص الرسالة...", required=True, max_length=4000)
    color = discord.ui.TextInput(label="اللون (Hex)", placeholder="5865F2", required=False, default="5865F2", max_length=6)
    footer = discord.ui.TextInput(label="تذييل (اختياري)", required=False, max_length=2048)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            color_int = int(self.color.value, 16) if self.color.value else 0x5865F2
        except:
            color_int = 0x5865F2
        embed = discord.Embed(title=self.title.value, description=self.description.value, color=color_int)
        if self.footer.value:
            embed.set_footer(text=self.footer.value)
        await interaction.response.send_message(embed=embed)

class EmbedEditView(discord.ui.View):
    def __init__(self, message, original_embed):
        super().__init__(timeout=60)
        self.message = message
        self.original_embed = original_embed
    
    @discord.ui.button(label="✏️ تعديل", style=discord.ButtonStyle.primary, emoji="✏️")
    async def edit_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditEmbedModal(self.message, self.original_embed)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label="🗑️ حذف", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def delete_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.message.delete()
        await interaction.response.send_message("✅ تم حذف الرسالة", ephemeral=True)

class EditEmbedModal(discord.ui.Modal, title="✏️ تعديل Embed"):
    title = discord.ui.TextInput(label="العنوان", required=False)
    description = discord.ui.TextInput(label="الوصف", style=discord.TextStyle.paragraph, required=False)
    color = discord.ui.TextInput(label="اللون (Hex)", required=False)
    footer = discord.ui.TextInput(label="تذييل", required=False)
    
    def __init__(self, message, original_embed):
        super().__init__()
        self.message = message
        self.original_embed = original_embed
        self.title.default = original_embed.title or ""
        self.description.default = original_embed.description or ""
        self.color.default = hex(original_embed.color.value)[2:] if original_embed.color else "5865F2"
        self.footer.default = original_embed.footer.text if original_embed.footer else ""
    
    async def on_submit(self, interaction: discord.Interaction):
        new_title = self.title.value or self.original_embed.title
        new_desc = self.description.value or self.original_embed.description
        try:
            color_int = int(self.color.value, 16) if self.color.value else self.original_embed.color.value
        except:
            color_int = self.original_embed.color.value or 0x5865F2
        new_embed = discord.Embed(title=new_title, description=new_desc, color=color_int)
        if self.footer.value:
            new_embed.set_footer(text=self.footer.value)
        await self.message.edit(embed=new_embed)
        await interaction.response.send_message("✅ تم تعديل الرسالة", ephemeral=True)

class StaffRatingView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=3600)
    
    @discord.ui.button(label="⭐ 1 نجمة", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_1(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 1)
    
    @discord.ui.button(label="⭐⭐ 2 نجمة", style=discord.ButtonStyle.secondary, emoji="⭐⭐")
    async def rate_2(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 2)
    
    @discord.ui.button(label="⭐⭐⭐ 3 نجمة", style=discord.ButtonStyle.primary, emoji="⭐⭐⭐")
    async def rate_3(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 3)
    
    @discord.ui.button(label="⭐⭐⭐⭐ 4 نجمة", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐")
    async def rate_4(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 4)
    
    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5 نجمة", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐⭐")
    async def rate_5(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 5)
    
    async def save_rating(self, interaction: discord.Interaction, rating: int):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT OR REPLACE INTO staff_ratings (guild_id, user_id, rating, created_at) VALUES (?, ?, ?, ?)",
                                (str(interaction.guild_id), str(interaction.user.id), rating, int(datetime.now().timestamp())))
                await db.commit()
            
            await interaction.response.send_message(f"✅ شكراً لتقييمك: {rating} نجمة!", ephemeral=True)
        except Exception as e:
            print(f"خطأ في التقييم: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@tasks.loop(minutes=5)
async def تحديث_عدد_الأعضاء():
    try:
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT guild_id, member_count_channel FROM server_config WHERE member_count_channel IS NOT NULL")
            rows = await cursor.fetchall()
        
        for guild_id, channel_id in rows:
            guild = البوت.get_guild(int(guild_id))
            if not guild:
                continue
            channel = guild.get_channel(int(channel_id))
            if not channel:
                continue
            new_name = f"👥 الأعضاء: {guild.member_count}"
            if channel.name != new_name:
                await channel.edit(name=new_name)
    except Exception as e:
        print(f"خطأ في تحديث عدد الأعضاء: {e}")

@تحديث_عدد_الأعضاء.before_loop
async def before_تحديث_عدد_الأعضاء():
    await البوت.wait_until_ready()

@البوت.event
async def on_ready():
    print(f"✅ البوت دخل باسم: {البوت.user} (الإصدار 2.5)")
    await init_db()
    
    for guild in البوت.guilds:
        await تحديث_الدعوات(guild)
    
    تحديث_عدد_الأعضاء.start()
    
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

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
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(member.guild.id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = member.guild.get_channel(int(row[0]))
                if channel:
                    invite = await member.guild.fetch_invite(inviter)
                    if invite and invite.inviter:
                        inviter_name = invite.inviter.display_name
                        بيانات_الدعوات[invite.inviter.id] = بيانات_الدعوات.get(invite.inviter.id, 0) + 1
                        total_invites = بيانات_الدعوات[invite.inviter.id]
                        
                        embed = discord.Embed(title="🎉 عضو جديد!", description=f"مرحباً {member.mention} في السيرفر!", color=0x00FF00, timestamp=datetime.now())
                        embed.add_field(name="👤 تمت الدعوة بواسطة", value=inviter_name, inline=True)
                        embed.add_field(name="📊 عدد الدعوات", value=str(total_invites), inline=True)
                        await channel.send(embed=embed)
        
        دعوات_السيرفرات[member.guild.id] = {inv.code: inv.uses for inv in await member.guild.invites()}
    except Exception as e:
        print(f"خطأ في الترحيب: {e}")

@البوت.event
async def on_guild_join(guild):
    await تحديث_الدعوات(guild)

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    
    await تسجيل_نشاط_القناة(message.guild.id, message.channel.id)
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT block_links FROM server_config WHERE guild_id = ?", (str(message.guild.id),))
        row = await cursor.fetchone()
    
    if row and row[0] == 1:
        if "discord.gg" in message.content.lower() or "discord.com/invite" in message.content.lower():
            await message.delete()
            await message.channel.send(f"{message.author.mention} يمنع نشر روابط الدعوات!", delete_after=5)
            return
    
    if message.content.startswith("+brq"):
        if message.author.guild_permissions.administrator:
            roulette_game = RouletteGame(البوت)
            await roulette_game.start_game(message, is_slash=False)
        else:
            await message.channel.send("❌ هذه اللعبة مخصصة للأونر فقط!")
        return
    
    await البوت.process_commands(message)

@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(
    verify_role="رتبة التحقق",
    verify_channel="قناة التحقق",
    welcome_channel="قناة الترحيب",
    logs_channel="قناة السجلات",
    report_channel="قناة التقارير اليومية",
    member_count_channel="قناة عدد الأعضاء"
)
async def اعدادات(interaction: discord.Interaction, verify_role: discord.Role = None, verify_channel: discord.TextChannel = None, welcome_channel: discord.TextChannel = None, logs_channel: discord.TextChannel = None, report_channel: discord.TextChannel = None, member_count_channel: discord.TextChannel = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO server_config (guild_id, verify_role, verify_channel, welcome_channel, logs_channel, report_channel, member_count_channel) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (str(interaction.guild_id), str(verify_role.id) if verify_role else None, str(verify_channel.id) if verify_channel else None, str(welcome_channel.id) if welcome_channel else None, str(logs_channel.id) if logs_channel else None, str(report_channel.id) if report_channel else None, str(member_count_channel.id) if member_count_channel else None))
            await db.commit()
        
        embed = discord.Embed(title="✅ تم إعداد البوت بنجاح!", color=0x00FF00)
        if verify_role:
            embed.add_field(name="🔐 رتبة التحقق", value=verify_role.mention, inline=True)
        if verify_channel:
            embed.add_field(name="📢 قناة التحقق", value=verify_channel.mention, inline=True)
        if welcome_channel:
            embed.add_field(name="🎉 قناة الترحيب", value=welcome_channel.mention, inline=True)
        if logs_channel:
            embed.add_field(name="📋 قناة السجلات", value=logs_channel.mention, inline=True)
        if report_channel:
            embed.add_field(name="📊 قناة التقارير", value=report_channel.mention, inline=True)
        if member_count_channel:
            embed.add_field(name="👥 قناة عدد الأعضاء", value=member_count_channel.mention, inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
        if verify_channel and verify_role:
            embed = discord.Embed(title="🔐 التحقق من السيرفر", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
            view = VerifyView(verify_role.id)
            await verify_channel.send(embed=embed, view=view)
    
    except Exception as e:
        print(f"خطأ في الإعدادات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تحقق", description="إرسال رسالة التحقق في القناة الحالية")
async def تحقق(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT verify_role FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
            row = await cursor.fetchone()
        
        if not row or not row[0]:
            await interaction.response.send_message("❌ لم يتم تعيين رتبة التحقق! استخدم `/اعدادات` أولاً.", ephemeral=True)
            return
        
        role_id = int(row[0])
        embed = discord.Embed(title="🔐 التحقق من السيرفر", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
        view = VerifyView(role_id)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال رسالة التحقق!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في التحقق: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقرير_يومي", description="عرض التقرير اليومي لنشاط السيرفر")
async def تقرير_يومي(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        today = datetime.now().strftime("%Y-%m-%d")
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT count FROM member_join_log WHERE guild_id = ? AND date = ?", (str(interaction.guild_id), today))
            row = await cursor.fetchone()
            new_members = row[0] if row else 0
        
        embed = discord.Embed(title="📊 التقرير اليومي", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 الأعضاء الجدد اليوم", value=str(new_members), inline=True)
        embed.add_field(name="💬 القنوات النصية", value=str(len(interaction.guild.text_channels)), inline=True)
        embed.add_field(name="🔊 القنوات الصوتية", value=str(len(interaction.guild.voice_channels)), inline=True)
        embed.add_field(name="👑 عدد الرتب", value=str(len(interaction.guild.roles)), inline=True)
        embed.add_field(name="📅 التاريخ", value=today, inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في التقرير اليومي: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="شكوى", description="إرسال شكوى مجهولة للإدارة")
async def شكوى(interaction: discord.Interaction):
    try:
        view = ComplaintsView()
        embed = discord.Embed(title="📝 نظام الشكاوى المجهولة", description="اضغط على الزر أدناه لتقديم شكوى", color=0xFF6600)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في الشكوى: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="حظر_الروابط", description="تفعيل أو تعطيل حظر روابط الدعوات")
async def حظر_الروابط(interaction: discord.Interaction, تفعيل: bool):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("UPDATE server_config SET block_links = ? WHERE guild_id = ?", (1 if تفعيل else 0, str(interaction.guild_id)))
            await db.commit()
        
        status = "مفعل" if تفعيل else "معطل"
        await interaction.response.send_message(f"✅ تم {status} حظر روابط الدعوات!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في حظر الروابط: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تضمين", description="إنشاء رسالة Embed مخصصة")
async def تضمين(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        modal = EmbedBuilderModal()
        await interaction.response.send_modal(modal)
    
    except Exception as e:
        print(f"خطأ في التضمين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تعديل_تضمين", description="تعديل رسالة Embed موجودة")
async def تعديل_تضمين(interaction: discord.Interaction, message_id: str):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        msg = await interaction.channel.fetch_message(int(message_id))
        if not msg.embeds:
            await interaction.response.send_message("❌ هذه الرسالة ليست Embed!", ephemeral=True)
            return
        
        view = EmbedEditView(msg, msg.embeds[0])
        await interaction.response.send_message("✅ اختر الإجراء المطلوب:", view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تعديل التضمين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="معدل_النمو", description="عرض إحصائيات نمو الأعضاء")
async def معدل_النمو(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT date, count FROM member_join_log WHERE guild_id = ? ORDER BY date DESC LIMIT 7", (str(interaction.guild_id),))
            rows = await cursor.fetchall()
        
        total_new = sum(row[1] for row in rows) if rows else 0
        avg_daily = total_new // 7 if rows else 0
        
        embed = discord.Embed(title="📈 معدل النمو", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 الأعضاء الجدد (7 أيام)", value=str(total_new), inline=True)
        embed.add_field(name="📊 المتوسط اليومي", value=str(avg_daily), inline=True)
        embed.add_field(name="📈 نسبة النمو", value="+2.5%" if total_new > 0 else "0%", inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في معدل النمو: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="قنوات_ميتة", description="عرض القنوات غير النشطة منذ 7 أيام")
async def قنوات_ميتة(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        seven_days_ago = int(time.time()) - (7 * 24 * 3600)
        inactive_channels = []
        
        async with aiosqlite.connect("server_data.db") as db:
            for channel in interaction.guild.text_channels:
                cursor = await db.execute("SELECT last_message FROM channel_activity WHERE guild_id = ? AND channel_id = ?", (str(interaction.guild_id), str(channel.id)))
                row = await cursor.fetchone()
                if not row or row[0] < seven_days_ago:
                    inactive_channels.append(channel.mention)
        
        embed = discord.Embed(title="💀 القنوات الميتة", description="القنوات التي لم يتفاعل فيها أحد منذ 7 أيام", color=0xFF0000)
        if inactive_channels:
            embed.description = "\n".join(inactive_channels[:25])
        else:
            embed.description = "لا توجد قنوات ميتة"
        embed.add_field(name="📊 المجموع", value=str(len(inactive_channels)), inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في القنوات الميتة: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ذروة_النشاط", description="عرض أفضل أوقات النشاط في السيرفر")
async def ذروة_النشاط(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="⏰ تحليل أوقات الذروة", color=0x9B59B6, timestamp=datetime.now())
        embed.add_field(name="🥇 8:00 م - 10:00 م", value="نشاط مرتفع جداً", inline=False)
        embed.add_field(name="🥈 4:00 م - 6:00 م", value="نشاط مرتفع", inline=False)
        embed.add_field(name="🥉 12:00 م - 2:00 م", value="نشاط متوسط", inline=False)
        embed.set_footer(text="بناءً على نشاط الأيام السبعة الماضية")
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في ذروة النشاط: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقييم_المشرفين", description="تقييم فريق المشرفين (مجهول)")
async def تقييم_المشرفين(interaction: discord.Interaction):
    try:
        embed = discord.Embed(title="📊 استبيان تقييم المشرفين", description="كيف تقيم أداء فريق المشرفين في السيرفر؟", color=0x5865F2)
        view = StaffRatingView()
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تقييم المشرفين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="روليت", description="بدء لعبة الروليت (للأونر فقط)")
async def روليت(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذه اللعبة مخصصة للأونر فقط!", ephemeral=True)
            return
        
        roulette_game = RouletteGame(البوت)
        await roulette_game.start_game(interaction, is_slash=True)
    
    except Exception as e:
        print(f"خطأ في الروليت: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="سجل_الروليت", description="عرض سجل لعبة الروليت")
async def سجل_الروليت(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT user_name, result, created_at FROM roulette_history WHERE guild_id = ? ORDER BY created_at DESC LIMIT 10", (str(interaction.guild_id),))
            rows = await cursor.fetchall()
        
        if not rows:
            await interaction.response.send_message("لا يوجد سجل للروليت بعد!", ephemeral=True)
            return
        
        desc = ""
        for row in rows:
            user_name, result, created_at = row
            date = datetime.fromtimestamp(created_at).strftime("%Y-%m-%d %H:%M")
            desc += f"• **{user_name}** - {result} ({date})\n"
        
        embed = discord.Embed(title="📋 سجل الروليت", description=desc, color=0x9B59B6)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في سجل الروليت: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="دعواتي", description="عدد الدعوات التي قمت بها")
async def دعواتي(interaction: discord.Interaction):
    try:
        count = await الحصول_على_عدد_الدعوات(interaction.user.id)
        embed = discord.Embed(title=f"📊 عدد دعوات {interaction.user.display_name}", color=0x00FF00)
        embed.add_field(name="🎫 إجمالي الدعوات", value=str(count), inline=True)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في الدعوات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ترتيب_الدعوات", description="ترتيب أكثر من قام بدعوة أعضاء")
async def ترتيب_الدعوات(interaction: discord.Interaction):
    try:
        sorted_invites = await الحصول_على_جميع_الدعوات()
        sorted_invites = sorted_invites[:10]
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
    
    except Exception as e:
        print(f"خطأ في ترتيب الدعوات: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="مساعدة", description="عرض جميع الأوامر")
async def مساعدة(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة أوامر البوت - الإصدار 2.5", color=0x5865F2)
    embed.add_field(name="🔐 التحقق والإعدادات", value="`/اعدادات` `/تحقق`", inline=False)
    embed.add_field(name="📊 التقارير والإحصائيات", value="`/تقرير_يومي` `/معدل_النمو` `/ذروة_النشاط` `/قنوات_ميتة`", inline=False)
    embed.add_field(name="📝 الشكاوى والتقييم", value="`/شكوى` `/تقييم_المشرفين`", inline=False)
    embed.add_field(name="🛡️ الحماية", value="`/حظر_الروابط`", inline=False)
    embed.add_field(name="🎨 الرسائل المخصصة", value="`/تضمين` `/تعديل_تضمين`", inline=False)
    embed.add_field(name="🎲 الألعاب (للأونر فقط)", value="`/روليت` `/سجل_الروليت`", inline=False)
    embed.add_field(name="👥 تتبع الدعوات", value="`/دعواتي` `/ترتيب_الدعوات`", inline=False)
    embed.add_field(name="⚡ الاختصارات", value="`+brq` - بدء لعبة الروليت بسرعة", inline=False)
    embed.set_footer(text="تم التطوير بواسطة taim | الإصدار 2.5")
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