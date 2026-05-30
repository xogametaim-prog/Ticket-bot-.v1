# ==================== invitetracker.py ====================
import discord
from discord.ext import commands
import aiosqlite
from datetime import datetime

بيانات_الدعوات = {}
دعوات_السيرفرات = {}

async def تحديث_الدعوات(guild):
    try:
        دعوات_السيرفرات[guild.id] = {inv.code: inv.uses for inv in await guild.invites()}
    except:
        pass

def setup_invite_tracker(bot):
    @bot.event
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
                            
                            embed = discord.Embed(
                                title="🎉 New Member!",
                                description=f"Welcome {member.mention} to the server!",
                                color=0x00FF00,
                                timestamp=datetime.now()
                            )
                            embed.add_field(name="👤 Invited by", value=inviter_name, inline=True)
                            embed.add_field(name="📊 Total Invites", value=str(total_invites), inline=True)
                            await channel.send(embed=embed)
            
            دعوات_السيرفرات[member.guild.id] = {inv.code: inv.uses for inv in await member.guild.invites()}
        except Exception as e:
            print(f"Welcome error: {e}")
    
    @bot.event
    async def on_guild_join(guild):
        await تحديث_الدعوات(guild)
    
    return bot

def get_invite_count(user_id):
    return بيانات_الدعوات.get(str(user_id), 0)

def get_all_invites():
    return sorted(بيانات_الدعوات.items(), key=lambda x: x[1], reverse=True)