-- =============================================
-- 024: PERSON ID UCHUN MARKAZLASHTIRILGAN HISOBLAGICH
-- =============================================
-- Xodim qayerda yaratilishidan qat'i nazar (qo'lda qo'shish, taklifnoma
-- orqali ro'yxatdan o'tish, nomzod ariza topshirishi) barchasi shu YAGONA
-- hisoblagichdan foydalanadi — shuning uchun Person ID hech qachon
-- takrorlanmaydi va hech bir joyda "unutilib" qolmaydi.

CREATE SEQUENCE IF NOT EXISTS employees_person_id_seq;

-- Hisoblagichni mavjud eng katta person_id qiymatidan keyin boshlab qo'yish —
-- shunda yangi avtomatik ID'lar hech qachon avvaldan qo'lda kiritilgan
-- qiymatlar bilan to'qnashmaydi.
SELECT setval(
  'employees_person_id_seq',
  GREATEST(999, COALESCE(
    (SELECT MAX(person_id::int) FROM employees WHERE person_id ~ '^[0-9]+$'),
    0
  ))
);
