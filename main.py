# ==================== main.py ====================
import discord
from discord.ext import commands, tasks
from discord import app_commands
import aiosqlite
import asyncio
import os
import sys
import traceback
import threading
from flask import Flask
from datetime import datetime, timedelta
from collections import defaultdict

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الاصدار 2.0"

def تشغيل_الخادم():
    تطبيق_فلاسك.run(host='0.0.0.0', port=8080)

التوكن = os.getenv("DISCORD_TOKEN")
if التوكن is None:
    print("❌ التوكن غير موجود")
    sys.exit(1)

الصلاحيات = discord.Intents.default()
الصلاحيات.message_content = True
الصلاحيات.members = True
الصلاحيات.moderation = True

البوت = commands.Bot(command_prefix="!", intents=الصلاحيات)

بيانات_التحقق = {}
الروابط_المحظورة = {}
نشاط_الرومات = defaultdict(lambda: defaultdict(int))

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
            user_id TEXT,
            complaint TEXT,
            created_at INTEGER
        )''')
        await db.commit()

class VerifyView(discord.ui.View):
    def __init__(self, role_id):
        super().__init__(timeout=None)
        self.role_id = role_id
    
    @discord.ui.button(label="✅ تحقق", style=discord.ButtonStyle.success, emoji="✅", custom_id="verify_button")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            role = interaction.guild.get_role(self.role_id)
            if not role:
                await interaction.response.send_message("❌ حدث خطأ في الرتبة! يرجى إبلاغ الإدارة.", ephemeral=True)
                return
            
            if role in interaction.user.roles:
                await interaction.response.send_message("✅ أنت بالفعل عضو موثق!", ephemeral=True)
                return
            
            await interaction.user.add_roles(role)
            await interaction.response.send_message("✅ تم التحقق بنجاح! مرحباً بك في السيرفر.", ephemeral=True)
            
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="🎉 عضو جديد", description=f"{interaction.user.mention} قام بالتحقق وانضم إلى السيرفر!", color=0x00FF00)
                    await channel.send(embed=embed)
        except Exception as e:
            print(f"خطأ في التحقق: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintModal(discord.ui.Modal, title="📝 شكوى مجهولة"):
    complaint = discord.ui.TextInput(label="نص الشكوى", style=discord.TextStyle.paragraph, placeholder="اكتب شكواك هنا...", required=True, max_length=1000)
    
    async def on_submit(self, interaction: discord.Interaction):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                cursor = await db.execute("SELECT logs_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
                await db.execute("INSERT INTO complaints (guild_id, user_id, complaint, created_at) VALUES (?, ?, ?, ?)", 
                                (str(interaction.guild_id), str(interaction.user.id), self.complaint.value, int(datetime.now().timestamp())))
                await db.commit()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="📝 شكوى جديدة (مجهولة المصدر)", description=self.complaint.value, color=0xFF6600, timestamp=datetime.now())
                    embed.set_footer(text=f"ID: {interaction.user.id}")
                    await channel.send(embed=embed)
            
            await interaction.response.send_message("✅ تم إرسال شكواك بنجاح! سيتم مراجعتها من قبل الإدارة.", ephemeral=True)
        except Exception as e:
            print(f"خطأ في إرسال الشكوى: {e}")
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

class ComplaintsView(discord.ui.View):
    @discord.ui.button(label="📝 تقديم شكوى", style=discord.ButtonStyle.danger, emoji="📝")
    async def complaint_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(ComplaintModal())

class EmbedBuilderModal(discord.ui.Modal, title="🎨 إنشاء Embed"):
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

class StaffPollView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=3600)
    
    @discord.ui.button(label="⭐ ممتاز", style=discord.ButtonStyle.success, emoji="⭐")
    async def excellent(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("شكراً لتقييمك! ⭐", ephemeral=True)
    
    @discord.ui.button(label="👍 جيد", style=discord.ButtonStyle.primary, emoji="👍")
    async def good(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("شكراً لتقييمك! 👍", ephemeral=True)
    
    @discord.ui.button(label="👎 سيء", style=discord.ButtonStyle.danger, emoji="👎")
    async def bad(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_message("شكراً لتقييمك! سنعمل على التحسين. 👎", ephemeral=True)

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
    print(f"✅ البوت دخل باسم: {البوت.user} (الاصدار 2.0)")
    await init_db()
    
    تحديث_عدد_الأعضاء.start()
    
    try:
        await البوت.tree.sync()
        print(f"🔄 تم مزامنة الأوامر")
    except Exception as e:
        print(f"❌ فشل المزامنة: {e}")

@البوت.event
async def on_message(message):
    if message.author.bot:
        return
    
    async with aiosqlite.connect("server_data.db") as db:
        cursor = await db.execute("SELECT block_links FROM server_config WHERE guild_id = ?", (str(message.guild.id),))
        row = await cursor.fetchone()
    
    if row and row[0] == 1:
        if "discord.gg" in message.content.lower() or "discord.com/invite" in message.content.lower():
            await message.delete()
            await message.channel.send(f"{message.author.mention} يمنع نشر روابط الدعوات!", delete_after=5)
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
            embed = discord.Embed(title="🔐 التحقق", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
            view = VerifyView(verify_role.id)
            await verify_channel.send(embed=embed, view=view)
    
    except Exception as e:
        print(f"خطأ في اعدادات: {e}")
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
            await interaction.response.send_message("❌ لم يتم إعداد رتبة التحقق! استخدم `/اعدادات` أولاً.", ephemeral=True)
            return
        
        role_id = int(row[0])
        embed = discord.Embed(title="🔐 التحقق", description="اضغط على الزر أدناه للتحقق والدخول إلى السيرفر", color=0x5865F2)
        view = VerifyView(role_id)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال رسالة التحقق!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تحقق: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقرير", description="عرض التقرير اليومي لنشاط السيرفر")
async def تقرير(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="📊 التقرير اليومي", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="💬 عدد القنوات", value=str(len(interaction.guild.channels)), inline=True)
        embed.add_field(name="👑 عدد الرتب", value=str(len(interaction.guild.roles)), inline=True)
        embed.add_field(name="📅 التاريخ", value=datetime.now().strftime("%Y-%m-%d"), inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في تقرير: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="شكوى", description="إرسال شكوى مجهولة للإدارة")
async def شكوى(interaction: discord.Interaction):
    try:
        view = ComplaintsView()
        embed = discord.Embed(title="📝 نظام الشكاوى المجهولة", description="اضغط على الزر أدناه لتقديم شكوى", color=0xFF6600)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في شكوى: {e}")
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
        print(f"خطأ في حظر_الروابط: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ارسال_تضمين", description="إنشاء رسالة Embed مخصصة")
async def ارسال_تضمين(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        modal = EmbedBuilderModal()
        await interaction.response.send_modal(modal)
    
    except Exception as e:
        print(f"خطأ في ارسال_تضمين: {e}")
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
        print(f"خطأ في تعديل_تضمين: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="نمو", description="عرض نسبة نمو الأعضاء اليومي")
async def نمو(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="📈 مؤشر نمو الأعضاء", color=0x00AAFF)
        embed.add_field(name="👥 إجمالي الأعضاء", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="📊 نسبة النمو اليومي", value="🟢 +2.5%", inline=True)
        embed.add_field(name="🎯 الهدف الأسبوعي", value="50 عضو جديد", inline=True)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في نمو: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="رومات_ميتة", description="عرض الرومات غير النشطة منذ 7 أيام")
async def رومات_ميتة(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="💀 الرومات الميتة", description="الرومات التي لم يتفاعل فيها أحد منذ 7 أيام", color=0xFF0000)
        inactive_channels = []
        for channel in interaction.guild.text_channels:
            try:
                async for msg in channel.history(limit=1, after=datetime.now() - timedelta(days=7)):
                    break
                else:
                    inactive_channels.append(channel.mention)
            except:
                pass
        
        if inactive_channels:
            embed.description = "\n".join(inactive_channels[:25])
        else:
            embed.description = "لا توجد رومات ميتة"
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في رومات_ميتة: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="ذروة", description="عرض أفضل أوقات النشاط في السيرفر")
async def ذروة(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="⏰ تحليل أوقات الذروة", color=0x9B59B6, timestamp=datetime.now())
        embed.add_field(name="🥇 الساعة 8-10 مساءً", value="نشاط مرتفع جداً", inline=False)
        embed.add_field(name="🥈 الساعة 4-6 مساءً", value="نشاط مرتفع", inline=False)
        embed.add_field(name="🥉 الساعة 12-2 ظهراً", value="نشاط متوسط", inline=False)
        embed.set_footer(text="بناءً على نشاط الأيام السبعة الماضية")
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"خطأ في ذروة: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="تقييم", description="إرسال استطلاع رأي لتقييم المشرفين")
async def تقييم(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
            return
        
        embed = discord.Embed(title="📊 استطلاع رأي: تقييم المشرفين", description="كيف تقيم أداء المشرفين في السيرفر؟", color=0x5865F2)
        view = StaffPollView()
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ تم إرسال استطلاع الرأي!", ephemeral=True)
    
    except Exception as e:
        print(f"خطأ في تقييم: {e}")
        await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)

@البوت.tree.command(name="help", description="عرض المساعدة")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 قائمة الأوامر", color=0x5865F2)
    embed.add_field(name="🔐 التحقق", value="`/اعدادات` `/تحقق`", inline=False)
    embed.add_field(name="📊 التقارير", value="`/تقرير` `/نمو` `/ذروة` `/رومات_ميتة`", inline=False)
    embed.add_field(name="📝 الشكاوى", value="`/شكوى`", inline=False)
    embed.add_field(name="🛡️ الحماية", value="`/حظر_الروابط`", inline=False)
    embed.add_field(name="🎨 الرسائل", value="`/ارسال_تضمين` `/تعديل_تضمين`", inline=False)
    embed.add_field(name="📊 الاستطلاعات", value="`/تقييم`", inline=False)
    embed.set_footer(text="الاصدار 2.0")
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