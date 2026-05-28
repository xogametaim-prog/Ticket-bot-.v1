import discord
from discord.ext import commands
from discord import app_commands
from database import احصل_على_مستخدم, تحديث_مستخدم, احصل_على_فريق, تعيين_فريق
from config import الحد_الأقصى_لاسم_الفريق

class الفرق(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @app_commands.command(name="تعيين_فريق", description="تسمية فريقك")
    @app_commands.choices(الرقم=[
        app_commands.Choice(name="الفريق الأول", value=1),
        app_commands.Choice(name="الفريق الثاني", value=2)
    ])
    async def تعيين_فريق(self, interaction: discord.Interaction, الرقم: int, الاسم: str):
        if len(الاسم) > الحد_الأقصى_لاسم_الفريق:
            الاسم = الاسم[:الحد_الأقصى_لاسم_الفريق]
        uid = str(interaction.user.id)
        await تعيين_فريق(uid, الرقم-1, الاسم)
        await interaction.response.send_message(f"✅ تم تسمية الفريق {الرقم} → {الاسم}")

    @app_commands.command(name="تفعيل_فريق", description="تفعيل فريق")
    @app_commands.choices(الرقم=[
        app_commands.Choice(name="الفريق الأول", value=1),
        app_commands.Choice(name="الفريق الثاني", value=2)
    ])
    async def تفعيل_فريق(self, interaction: discord.Interaction, الرقم: int):
        uid = str(interaction.user.id)
        await تحديث_مستخدم(uid, active_team=الرقم-1)
        الاسم = await احصل_على_فريق(uid, الرقم-1) or "بدون اسم"
        await interaction.response.send_message(f"🔁 تم تفعيل الفريق {الرقم} ({الاسم})")

    @app_commands.command(name="فرقي", description="عرض فرقك")
    async def فرقي(self, interaction: discord.Interaction):
        uid = str(interaction.user.id)
        فريق1 = await احصل_على_فريق(uid, 0) or "غير محدد"
        فريق2 = await احصل_على_فريق(uid, 1) or "غير محدد"
        بيانات = await احصل_على_مستخدم(uid)
        تضمين = discord.Embed(title=f"فرق {interaction.user.display_name}", color=0x9b59b6)
        تضمين.add_field(name="الفريق الأول", value=فريق1, inline=False)
        تضمين.add_field(name="الفريق الثاني", value=فريق2, inline=False)
        تضمين.add_field(name="الفريق النشط", value=f"الفريق {بيانات['active_team']+1}", inline=False)
        await interaction.response.send_message(embed=تضمين)

async def setup(bot):
    await bot.add_cog(الفرق(bot))