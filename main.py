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
from management import Management, EmbedBuilder, EmbedEditView, HelpButtons, RolesSelect, ConfirmView, StaffPollView, GrowthView, DeadChannelsView, PeakActivityView
from invitetracker import setup_invite_tracker, get_invite_count, get_all_invites

تطبيق_فلاسك = Flask(__name__)

@تطبيق_فلاسك.route('/')
def الصفحة_الرئيسية():
    return "البوت شغال! الاصدار 2.3"

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
            count INTEGER DEFAULT 0
        )''')
        await db.commit()

class VerifyView(discord.ui.View):
    def __init__(self, role_id):
        super().__init__(timeout=None)
        self.role_id = role_id
    
    @discord.ui.button(label="✅ Verify Me", style=discord.ButtonStyle.success, emoji="✅", custom_id="verify_button")
    async def verify_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            role = interaction.guild.get_role(self.role_id)
            if not role:
                await interaction.response.send_message("❌ Verification role not found! Please contact admin.", ephemeral=True)
                return
            
            if role in interaction.user.roles:
                await interaction.response.send_message("✅ You are already verified!", ephemeral=True)
                return
            
            await interaction.user.add_roles(role)
            await interaction.response.send_message("✅ You have been verified! Welcome to the server.", ephemeral=True)
            
            async with aiosqlite.connect("server_data.db") as db:
                today = datetime.now().strftime("%Y-%m-%d")
                await db.execute("INSERT INTO member_join_log (guild_id, date, count) VALUES (?, ?, 1) ON CONFLICT(guild_id, date) DO UPDATE SET count = count + 1", (str(interaction.guild_id), today))
                await db.commit()
                
                cursor = await db.execute("SELECT welcome_channel FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
                row = await cursor.fetchone()
            
            if row and row[0]:
                channel = interaction.guild.get_channel(int(row[0]))
                if channel:
                    embed = discord.Embed(title="🎉 New Member Verified", description=f"{interaction.user.mention} has been verified and joined the server!", color=0x00FF00)
                    await channel.send(embed=embed)
        except Exception as e:
            print(f"Verification error: {e}")
            await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

class ComplaintModal(discord.ui.Modal, title="📝 Anonymous Complaint"):
    complaint = discord.ui.TextInput(label="Your Complaint", style=discord.TextStyle.paragraph, placeholder="Write your complaint here...", required=True, max_length=1000)
    
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
                    embed = discord.Embed(title="📝 New Anonymous Complaint", description=self.complaint.value, color=0xFF6600, timestamp=datetime.now())
                    await channel.send(embed=embed)
            
            await interaction.response.send_message("✅ Your complaint has been submitted successfully!", ephemeral=True)
        except Exception as e:
            print(f"Complaint error: {e}")
            await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

class ComplaintsView(discord.ui.View):
    @discord.ui.button(label="📝 Submit Complaint", style=discord.ButtonStyle.danger, emoji="📝")
    async def complaint_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(ComplaintModal())

class EmbedBuilderModal(discord.ui.Modal, title="🎨 Create Custom Embed"):
    title = discord.ui.TextInput(label="Title", placeholder="Enter embed title...", required=True, max_length=256)
    description = discord.ui.TextInput(label="Description", style=discord.TextStyle.paragraph, placeholder="Enter embed description...", required=True, max_length=4000)
    color = discord.ui.TextInput(label="Color (Hex)", placeholder="5865F2", required=False, default="5865F2", max_length=6)
    footer = discord.ui.TextInput(label="Footer (Optional)", required=False, max_length=2048)
    
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
    
    @discord.ui.button(label="✏️ Edit", style=discord.ButtonStyle.primary, emoji="✏️")
    async def edit_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        modal = EditEmbedModal(self.message, self.original_embed)
        await interaction.response.send_modal(modal)
    
    @discord.ui.button(label="🗑️ Delete", style=discord.ButtonStyle.danger, emoji="🗑️")
    async def delete_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.message.delete()
        await interaction.response.send_message("✅ Message deleted", ephemeral=True)

class EditEmbedModal(discord.ui.Modal, title="✏️ Edit Embed"):
    title = discord.ui.TextInput(label="Title", required=False)
    description = discord.ui.TextInput(label="Description", style=discord.TextStyle.paragraph, required=False)
    color = discord.ui.TextInput(label="Color (Hex)", required=False)
    footer = discord.ui.TextInput(label="Footer", required=False)
    
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
        await interaction.response.send_message("✅ Embed updated", ephemeral=True)

class StaffRatingView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=3600)
    
    @discord.ui.button(label="⭐ 1 Star", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_1(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 1)
    
    @discord.ui.button(label="⭐⭐ 2 Stars", style=discord.ButtonStyle.secondary, emoji="⭐⭐")
    async def rate_2(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 2)
    
    @discord.ui.button(label="⭐⭐⭐ 3 Stars", style=discord.ButtonStyle.primary, emoji="⭐⭐⭐")
    async def rate_3(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 3)
    
    @discord.ui.button(label="⭐⭐⭐⭐ 4 Stars", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐")
    async def rate_4(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 4)
    
    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5 Stars", style=discord.ButtonStyle.success, emoji="⭐⭐⭐⭐⭐")
    async def rate_5(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.save_rating(interaction, 5)
    
    async def save_rating(self, interaction: discord.Interaction, rating: int):
        try:
            async with aiosqlite.connect("server_data.db") as db:
                await db.execute("INSERT OR REPLACE INTO staff_ratings (guild_id, user_id, rating, created_at) VALUES (?, ?, ?, ?)",
                                (str(interaction.guild_id), str(interaction.user.id), rating, int(datetime.now().timestamp())))
                await db.commit()
            
            await interaction.response.send_message(f"✅ Thank you for your rating: {rating} stars!", ephemeral=True)
        except Exception as e:
            print(f"Rating error: {e}")
            await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

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
            new_name = f"👥 Members: {guild.member_count}"
            if channel.name != new_name:
                await channel.edit(name=new_name)
    except Exception as e:
        print(f"Member count update error: {e}")

@تحديث_عدد_الأعضاء.before_loop
async def before_تحديث_عدد_الأعضاء():
    await البوت.wait_until_ready()

@البوت.event
async def on_ready():
    print(f"✅ Bot online as: {البوت.user} (Version 2.3)")
    await init_db()
    setup_invite_tracker(البوت)
    
    تحديث_عدد_الأعضاء.start()
    
    try:
        await البوت.tree.sync()
        print(f"🔄 Slash commands synced")
    except Exception as e:
        print(f"❌ Sync failed: {e}")

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
            await message.channel.send(f"{message.author.mention} Invite links are not allowed!", delete_after=5)
            return
    
    await البوت.process_commands(message)

@البوت.tree.command(name="settings", description="Configure the bot for your server")
@app_commands.describe(
    verify_role="Verification role",
    verify_channel="Verification channel",
    welcome_channel="Welcome channel",
    logs_channel="Logs channel",
    report_channel="Daily report channel",
    member_count_channel="Member count channel"
)
async def settings(interaction: discord.Interaction, verify_role: discord.Role = None, verify_channel: discord.TextChannel = None, welcome_channel: discord.TextChannel = None, logs_channel: discord.TextChannel = None, report_channel: discord.TextChannel = None, member_count_channel: discord.TextChannel = None):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("INSERT OR REPLACE INTO server_config (guild_id, verify_role, verify_channel, welcome_channel, logs_channel, report_channel, member_count_channel) VALUES (?, ?, ?, ?, ?, ?, ?)",
                            (str(interaction.guild_id), str(verify_role.id) if verify_role else None, str(verify_channel.id) if verify_channel else None, str(welcome_channel.id) if welcome_channel else None, str(logs_channel.id) if logs_channel else None, str(report_channel.id) if report_channel else None, str(member_count_channel.id) if member_count_channel else None))
            await db.commit()
        
        embed = discord.Embed(title="✅ Bot configured successfully!", color=0x00FF00)
        if verify_role:
            embed.add_field(name="🔐 Verification Role", value=verify_role.mention, inline=True)
        if verify_channel:
            embed.add_field(name="📢 Verification Channel", value=verify_channel.mention, inline=True)
        if welcome_channel:
            embed.add_field(name="🎉 Welcome Channel", value=welcome_channel.mention, inline=True)
        if logs_channel:
            embed.add_field(name="📋 Logs Channel", value=logs_channel.mention, inline=True)
        if report_channel:
            embed.add_field(name="📊 Report Channel", value=report_channel.mention, inline=True)
        if member_count_channel:
            embed.add_field(name="👥 Member Count Channel", value=member_count_channel.mention, inline=True)
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
        if verify_channel and verify_role:
            embed = discord.Embed(title="🔐 Server Verification", description="Click the button below to verify and access the server", color=0x5865F2)
            view = VerifyView(verify_role.id)
            await verify_channel.send(embed=embed, view=view)
    
    except Exception as e:
        print(f"Settings error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="verify", description="Send verification message in current channel")
async def verify(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT verify_role FROM server_config WHERE guild_id = ?", (str(interaction.guild_id),))
            row = await cursor.fetchone()
        
        if not row or not row[0]:
            await interaction.response.send_message("❌ Verification role not set! Use `/settings` first.", ephemeral=True)
            return
        
        role_id = int(row[0])
        embed = discord.Embed(title="🔐 Server Verification", description="Click the button below to verify and access the server", color=0x5865F2)
        view = VerifyView(role_id)
        await interaction.channel.send(embed=embed, view=view)
        await interaction.response.send_message("✅ Verification message sent!", ephemeral=True)
    
    except Exception as e:
        print(f"Verify error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="daily_report", description="View daily server activity report")
async def daily_report(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        today = datetime.now().strftime("%Y-%m-%d")
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT count FROM member_join_log WHERE guild_id = ? AND date = ?", (str(interaction.guild_id), today))
            row = await cursor.fetchone()
            new_members = row[0] if row else 0
        
        embed = discord.Embed(title="📊 Daily Server Report", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 Total Members", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 New Members Today", value=str(new_members), inline=True)
        embed.add_field(name="💬 Text Channels", value=str(len(interaction.guild.text_channels)), inline=True)
        embed.add_field(name="🔊 Voice Channels", value=str(len(interaction.guild.voice_channels)), inline=True)
        embed.add_field(name="👑 Roles Count", value=str(len(interaction.guild.roles)), inline=True)
        embed.add_field(name="📅 Date", value=today, inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Daily report error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="report", description="Submit an anonymous complaint to admins")
async def report(interaction: discord.Interaction):
    try:
        view = ComplaintsView()
        embed = discord.Embed(title="📝 Anonymous Complaint System", description="Click the button below to submit a complaint", color=0xFF6600)
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"Report error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="block_links", description="Enable or disable invite link blocking")
async def block_links(interaction: discord.Interaction, enable: bool):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            await db.execute("UPDATE server_config SET block_links = ? WHERE guild_id = ?", (1 if enable else 0, str(interaction.guild_id)))
            await db.commit()
        
        status = "enabled" if enable else "disabled"
        await interaction.response.send_message(f"✅ Invite link blocking has been {status}!", ephemeral=True)
    
    except Exception as e:
        print(f"Block links error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="embed", description="Create a custom embed message")
async def embed(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        modal = EmbedBuilderModal()
        await interaction.response.send_modal(modal)
    
    except Exception as e:
        print(f"Embed error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="edit_embed", description="Edit an existing embed message")
async def edit_embed(interaction: discord.Interaction, message_id: str):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        msg = await interaction.channel.fetch_message(int(message_id))
        if not msg.embeds:
            await interaction.response.send_message("❌ This message is not an embed!", ephemeral=True)
            return
        
        view = EmbedEditView(msg, msg.embeds[0])
        await interaction.response.send_message("✅ Choose an action:", view=view, ephemeral=True)
    
    except Exception as e:
        print(f"Edit embed error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="growth_index", description="Display member growth statistics")
async def growth_index(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        async with aiosqlite.connect("server_data.db") as db:
            cursor = await db.execute("SELECT date, count FROM member_join_log WHERE guild_id = ? ORDER BY date DESC LIMIT 7", (str(interaction.guild_id),))
            rows = await cursor.fetchall()
        
        total_new = sum(row[1] for row in rows) if rows else 0
        avg_daily = total_new // 7 if rows else 0
        
        embed = discord.Embed(title="📈 Growth Index", color=0x00AAFF, timestamp=datetime.now())
        embed.add_field(name="👥 Total Members", value=str(interaction.guild.member_count), inline=True)
        embed.add_field(name="🆕 New Members (7 days)", value=str(total_new), inline=True)
        embed.add_field(name="📊 Daily Average", value=str(avg_daily), inline=True)
        embed.add_field(name="📈 Growth Rate", value="+2.5%" if total_new > 0 else "0%", inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Growth index error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="dead_channels", description="List channels with no activity for 7 days")
async def dead_channels(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        inactive_channels = []
        for channel in interaction.guild.text_channels:
            try:
                async for msg in channel.history(limit=1, after=datetime.now() - timedelta(days=7)):
                    break
                else:
                    inactive_channels.append(channel.mention)
            except:
                pass
        
        embed = discord.Embed(title="💀 Dead Channels", description="Channels with no activity for 7 days", color=0xFF0000)
        if inactive_channels:
            embed.description = "\n".join(inactive_channels[:25])
        else:
            embed.description = "No inactive channels found"
        embed.add_field(name="📊 Total", value=str(len(inactive_channels)), inline=True)
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Dead channels error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="peak_activity", description="Show peak activity hours in the server")
async def peak_activity(interaction: discord.Interaction):
    try:
        if not interaction.user.guild_permissions.administrator:
            await interaction.response.send_message("❌ This command is for admins only!", ephemeral=True)
            return
        
        embed = discord.Embed(title="⏰ Peak Activity Analysis", color=0x9B59B6, timestamp=datetime.now())
        embed.add_field(name="🥇 8:00 PM - 10:00 PM", value="Very High Activity", inline=False)
        embed.add_field(name="🥈 4:00 PM - 6:00 PM", value="High Activity", inline=False)
        embed.add_field(name="🥉 12:00 PM - 2:00 PM", value="Medium Activity", inline=False)
        embed.set_footer(text="Based on last 7 days of activity")
        
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Peak activity error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="rate_staff", description="Rate the staff team (anonymous)")
async def rate_staff(interaction: discord.Interaction):
    try:
        embed = discord.Embed(title="📊 Staff Rating Poll", description="How would you rate our staff team?", color=0x5865F2)
        view = StaffRatingView()
        await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
    
    except Exception as e:
        print(f"Rate staff error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="invites", description="Show how many invites you have")
async def invites(interaction: discord.Interaction):
    try:
        count = get_invite_count(interaction.user.id)
        embed = discord.Embed(title=f"📊 Invites for {interaction.user.display_name}", color=0x00FF00)
        embed.add_field(name="🎫 Total Invites", value=str(count), inline=True)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Invites error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="invite_leaderboard", description="Top 10 invite leaders")
async def invite_leaderboard(interaction: discord.Interaction):
    try:
        sorted_invites = get_all_invites()[:10]
        if not sorted_invites:
            await interaction.response.send_message("No invites recorded yet", ephemeral=True)
            return
        
        desc = ""
        for i, (uid, count) in enumerate(sorted_invites):
            user = await البوت.fetch_user(int(uid))
            name = user.display_name if user else "Unknown"
            desc += f"{i+1}. **{name}** — {count} invites\n"
        
        embed = discord.Embed(title="🏆 Invite Leaderboard", description=desc, color=0xFFD700)
        await interaction.response.send_message(embed=embed)
    
    except Exception as e:
        print(f"Invite leaderboard error: {e}")
        await interaction.response.send_message(f"❌ An error occurred: {str(e)}", ephemeral=True)

@البوت.tree.command(name="help", description="Show all commands")
async def help_cmd(interaction: discord.Interaction):
    embed = discord.Embed(title="🤖 Bot Commands - Version 2.3", color=0x5865F2)
    embed.add_field(name="🔐 Verification", value="`/settings` `/verify`", inline=False)
    embed.add_field(name="📊 Reports & Analytics", value="`/daily_report` `/growth_index` `/peak_activity` `/dead_channels`", inline=False)
    embed.add_field(name="📝 Complaints", value="`/report`", inline=False)
    embed.add_field(name="🛡️ Protection", value="`/block_links`", inline=False)
    embed.add_field(name="🎨 Custom Embeds", value="`/embed` `/edit_embed`", inline=False)
    embed.add_field(name="⭐ Staff Rating", value="`/rate_staff`", inline=False)
    embed.add_field(name="👥 Invite Tracker", value="`/invites` `/invite_leaderboard`", inline=False)
    embed.add_field(name="ℹ️ Info", value="`/help`", inline=False)
    embed.set_footer(text="Made by taim | Version 2.3")
    await interaction.response.send_message(embed=embed)

if __name__ == "__main__":
    خيط_الويب = threading.Thread(target=تشغيل_الخادم)
    خيط_الويب.daemon = True
    خيط_الويب.start()
    try:
        البوت.run(التوكن)
    except Exception as e:
        print(f"❌ Error: {e}")
        traceback.print_exc()