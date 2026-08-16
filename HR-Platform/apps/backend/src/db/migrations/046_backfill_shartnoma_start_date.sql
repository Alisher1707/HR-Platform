-- =============================================
-- 046: MAVJUD "SHARTNOMA" YOZUVLARINI TOZALASH
-- =============================================
-- Xodimlar bo'limidan qo'lda qo'shilgan xodimlar uchun shartnoma_start_date
-- avval qasddan bo'sh qoldirilardi (bu qatorni avtomatik promotsiya
-- jobidan chetlab o'tish uchun) — natijada ular Lead doskasida abadiy
-- "Shartnoma imzolandi" ustunida qolib ketgan edi. Kod tuzatildi
-- (employees.service.js), endi mavjud "yopiq qolgan" yozuvlarni ham
-- tozalaymiz — shartnoma_start_date'ni allaqachon 1 soatlik muddati
-- o'tgan qilib belgilaymiz, shunda keyingi kron aylanishi (5 daqiqada)
-- ularni avtomatik ravishda xodimga aylantirib, doskadan olib tashlaydi.

UPDATE applications
SET shartnoma_start_date = NOW() - INTERVAL '2 hours'
WHERE status = 'SHARTNOMA' AND shartnoma_start_date IS NULL;
