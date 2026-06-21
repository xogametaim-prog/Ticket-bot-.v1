// تعريف مصفوفة الأوامر المتاحة للبوت
const commandsList = [
    {
        name: 'help',
        description: 'عرض قائمة المساعدة والأوامر المتاحة مقسمة حسب الصلاحيات.',
    }
    // يمكنك إضافة أوامر جديدة هنا مستقبلاً بهذا الشكل:
    // ,{
    //     name: 'ping',
    //     description: 'فحص سرعة استجابة البوت'
    // }
];

module.exports = commandsList;
