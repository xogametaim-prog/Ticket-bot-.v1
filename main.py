# ==================== main.py (الجزء المعدل - أوامر الاعدادات والتحرير) ====================
# أضف هذه الوظائف الجديدة أو استبدل الأوامر الموجودة بالقسم التالي

# في بداية الملف بعد التعريفات، تأكد من وجود هذه الدالة المساعدة
async def init_ticket_db():
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute('''CREATE TABLE IF NOT EXISTS اعدادات_السيرفر (
            guild_id TEXT PRIMARY KEY,
            رتبة_التذاكر TEXT,
            قناة_البانل TEXT,
            قناة_الرسائل_التلقائية TEXT,
            رسالة_العنوان TEXT,
            رسالة_الوصف TEXT,
            لون_الرسالة TEXT,
            تم_الاعداد BOOLEAN DEFAULT 0
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS تذاكر (
            channel_id TEXT PRIMARY KEY,
            guild_id TEXT,
            creator_id TEXT,
            creator_name TEXT,
            status TEXT,
            created_at INTEGER
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS بانل (
            guild_id TEXT PRIMARY KEY,
            channel_id TEXT,
            message_id TEXT
        )''')
        await db.execute('''CREATE TABLE IF NOT EXISTS tags (
            guild_id TEXT,
            tag_name TEXT,
            tag_content TEXT,
            PRIMARY KEY (guild_id, tag_name)
        )''')
        await db.commit()

# استبدل أمر /اعدادات بهذا الكود
@البوت.tree.command(name="اعدادات", description="إعداد البوت في السيرفر")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة لوحة التذاكر", auto_channel="قناة الرسائل التلقائية")
async def اعدادات(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ هذا الأمر مخصص للأونر فقط!", ephemeral=True)
        return
    
    embed_title = "🛡️ فتح تذكرة جديدة"
    embed_description = "اضغط على الزر أدناه لفتح تذكرة وسيقوم فريق الدعم بالتواصل معك قريباً."
    embed_color = "5865F2"
    
    async with aiosqlite.connect("ticket_data.db") as db:
        await db.execute("INSERT OR REPLACE INTO اعدادات_السيرفر (guild_id, رتبة_التذاكر, قناة_البانل, قناة_الرسائل_التلقائية, رسالة_العنوان, رسالة_الوصف, لون_الرسالة, تم_الاعداد) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
                        (str(interaction.guild_id), str(role.id), str(panel_channel.id), str(auto_channel.id), embed_title, embed_description, embed_color))
        await db.commit()
    
    global رتبة_التذاكر_المسموح_لها
    رتبة_التذاكر_المسموح_لها = role.id
    
    from tickets import TicketButton
    embed = discord.Embed(title=embed_title, description=embed_description, color=int(embed_color, 16))
    view = TicketButton(embed_title, embed_description, embed_color)
    msg = await panel_channel.send(embed=embed, view=view)
    
    await db.execute("INSERT OR REPLACE INTO بانل (guild_id, channel_id, message_id) VALUES (?, ?, ?)", (str(interaction.guild_id), str(panel_channel.id), str(msg.id)))
    await db.commit()
    
    await interaction.response.send_message(f"✅ تم إعداد البوت بنجاح!\nالرتبة: {role.mention}\nقناة البانل: {panel_channel.mention}\nقناة الرسائل: {auto_channel.mention}", ephemeral=True)

# استبدل أمر /edit بهذا الكود
@البوت.tree.command(name="edit", description="تعديل رسالة لوحة التذاكر")
@app_commands.describe(title="العنوان الجديد", description="الوصف الجديد", color="اللون (Hex)")
async def edit_panel(interaction: discord.Interaction, title: str = None, description: str = None, color: str = None):
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
        new_title = title if title is not None else (old_title or "🛡️ فتح تذكرة جديدة")
        new_desc = description if description is not None else (old_desc or "اضغط على الزر أدناه لفتح تذكرة")
        new_color = color if color is not None else (old_color or "5865F2")
        
        await db.execute("UPDATE اعدادات_السيرفر SET رسالة_العنوان = ?, رسالة_الوصف = ?, لون_الرسالة = ? WHERE guild_id = ?",
                        (new_title, new_desc, new_color, str(interaction.guild_id)))
        await db.commit()
        
        if not channel_id:
            await interaction.response.send_message("❌ لا توجد قناة بانل مسجلة!", ephemeral=True)
            return
        
        channel = interaction.guild.get_channel(int(channel_id))
        if not channel:
            await interaction.response.send_message("❌ قناة البانل غير موجودة!", ephemeral=True)
            return
        
        from tickets import TicketButton
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
            await db.execute("INSERT OR REPLACE INTO بانل (guild_id, channel_id, message_id) VALUES (?, ?, ?)", (str(interaction.guild_id), str(channel.id), str(msg.id)))
        
        await db.commit()
    
    await interaction.response.send_message("✅ تم تحديث رسالة لوحة التذاكر بنجاح!", ephemeral=True)

# تأكد أيضاً من وجود هذا الأمر (إذا كان مفقوداً) لأنه يستخدمه البوت
@البوت.tree.command(name="setup", description="إعداد البوت (طريقة بديلة)")
@app_commands.describe(role="الرتبة المسؤولة عن التذاكر", panel_channel="قناة لوحة التذاكر", auto_channel="قناة الرسائل التلقائية")
async def setup(interaction: discord.Interaction, role: discord.Role, panel_channel: discord.TextChannel, auto_channel: discord.TextChannel):
    await اعدادات(interaction, role, panel_channel, auto_channel)