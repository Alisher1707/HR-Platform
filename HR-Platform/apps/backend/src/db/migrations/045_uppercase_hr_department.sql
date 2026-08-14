-- =============================================
-- 045: "HR" BO'LIM/LAVOZIM NOMINI KATTA HARFDA TO'G'IRLASH
-- =============================================
-- "Xodim qo'shish" formasidagi Bo'lim/Lavozim tanlovida "HR" varianti
-- xato ravishda kichik harfda ("hr") saqlanardi (faqat ko'rsatilgan
-- yorlig'i katta edi). Bu xodimlar ro'yxatida, davomat va boshqa barcha
-- joyda "hr" bo'lib chiqib qolardi. Mavjud yozuvlarni to'g'irlaydi;
-- forma o'zi ham alohida tuzatildi (EmployeeForm.jsx), shuning uchun
-- yangi xodimlarda bu takrorlanmaydi.

UPDATE employees SET department = 'HR' WHERE lower(department) = 'hr';
UPDATE employees SET position = 'HR' WHERE lower(position) = 'hr';
