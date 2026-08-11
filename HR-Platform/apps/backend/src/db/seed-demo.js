import bcrypt from 'bcryptjs';
import { pool, query, getClient, testConnection } from '../config/database.js';
import { createEmployee } from '../modules/employees/employees.service.js';
import { createSchedule } from '../modules/schedules/schedules.service.js';
import { createManualAttendance } from '../modules/attendance/attendance.service.js';
import { createPlan, createAssignment, submitTask, reviewTaskSubmission, getAssignmentById } from '../modules/onboarding/onboarding.service.js';
import { createFineType, createFinePolicy } from '../modules/fines/fines.service.js';

/**
 * Demo data seeder — populates a DEMO-ONLY database with realistic, fully
 * fake business data so the sales/presentation deployment never shows an
 * empty page. Reuses the same service-layer functions the real app uses
 * (createEmployee, createSchedule, createManualAttendance, ...) instead of
 * hand-rolled SQL, so seeded data is always internally consistent with
 * whatever business logic those functions currently implement.
 *
 * DANGER: this script starts by TRUNCATING every business table. It is
 * meant to run ONLY against a dedicated demo DATABASE_URL — never point it
 * at production. Safe to re-run any number of times (that's the point:
 * `npm run seed:demo` always resets the demo to a clean, full state).
 */

const DEMO_ADMIN_EMAIL = 'demo.admin@hr.itlive.uz';
const DEMO_ADMIN_PASSWORD = 'DemoAdmin2026!';
const DEMO_HR_EMAIL = 'demo.hr@hr.itlive.uz';
const DEMO_HR_PASSWORD = 'DemoHR2026!';

// --- Tashkent (UTC+5, no DST) wall-clock time builder, matching the
// convention in shared/utils/timezone.js — hour/minute here are what a
// Tashkent clock would show. ---
function tashkentTime(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[randomBetween(0, arr.length - 1)];
}

async function wipeDemoData() {
  console.log('🧹 Eski demo ma\'lumotlari tozalanmoqda...');
  await query(`
    TRUNCATE TABLE
      onboarding_step_completions, onboarding_assignments, onboarding_step_tasks,
      onboarding_plan_steps, onboarding_plans,
      fine_policy_templates, fine_policies, fine_types,
      attendance_records, device_events,
      work_schedule_days, work_schedule_employees, work_schedules,
      application_history, applications,
      ejm_files, ejm_data,
      invites, devices,
      employees, users
    RESTART IDENTITY CASCADE
  `);
  // Kamera Person ID'lar 1000 dan boshlansin (haqiqiy loyihadagi kabi).
  await query(`SELECT setval('employees_person_id_seq', 1000, false)`);
}

async function seedUsers() {
  console.log('👤 Demo foydalanuvchilar yaratilmoqda...');
  const insertQuery = `
    INSERT INTO users (email, password_hash, role, first_name, last_name, is_active)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;
  const adminHash = await bcrypt.hash(DEMO_ADMIN_PASSWORD, 12);
  const adminResult = await query(insertQuery, [DEMO_ADMIN_EMAIL, adminHash, 'SUPER_ADMIN', 'Demo', 'Admin', true]);

  const hrHash = await bcrypt.hash(DEMO_HR_PASSWORD, 12);
  const hrResult = await query(insertQuery, [DEMO_HR_EMAIL, hrHash, 'HR', 'Demo', 'HR Manager', true]);

  return { superAdminId: adminResult.rows[0].id, hrId: hrResult.rows[0].id };
}

const BRANCHES = ["Bosh ofis", "Chilonzor filiali", "Sergeli filiali", "Yunusobod filiali"];
const DEPARTMENTS = ["Sotuv bo'limi", "IT bo'limi", "HR bo'limi", "Buxgalteriya", "Marketing bo'limi"];
const POSITIONS = ['moliya', 'hr', 'sotuv', 'kassir', 'call_operator', 'mentor', 'boshqaruv'];

const MALE_NAMES = [
  'Bekzod Yusupov', 'Sardor Rahimov', 'Otabek Yoldashev', 'Farrux Toshpulatov',
  'Diyor Ergashev', 'Jahongir Nazarov', 'Shavkat G\'ofurov', 'Anvar Qodirov',
  'Sanjar Xolmatov', 'Rustam Berdiyev', 'Ilhom Saidov', 'Doston Abdurahmonov',
  'Aziz Tursunov', 'Bobur Islomov',
];
const FEMALE_NAMES = [
  'Malika Yusupova', "Gulnora Rashidova", 'Zarina Tosheva', 'Kamola Ergasheva',
  'Nilufar Xasanova', 'Sevara Mirzayeva', 'Feruza Nazarova', 'Madina Qodirova',
  'Dilnoza Saidova', 'Shahnoza Rahimova', "Zulfiya G'aniyeva", 'Mohira Yoldasheva',
];

function randomPhone() {
  return `+99890${randomBetween(1000000, 9999999)}`;
}

async function seedEmployees(superAdminId) {
  console.log('👥 Xodimlar yaratilmoqda...');
  const allNames = [...MALE_NAMES, ...FEMALE_NAMES];
  const employees = [];

  for (let i = 0; i < allNames.length; i++) {
    const [firstName, lastName] = allNames[i].split(' ');
    const joinYear = randomBetween(2023, 2026);
    const employee = await createEmployee({
      firstName,
      lastName,
      branch: pick(BRANCHES),
      department: pick(DEPARTMENTS),
      position: pick(POSITIONS),
      joinDate: `${joinYear}-${String(randomBetween(1, 12)).padStart(2, '0')}-${String(randomBetween(1, 28)).padStart(2, '0')}`,
      phone: randomPhone(),
      salaryType: 'Oylik',
      salaryAmount: randomBetween(3, 15) * 1000000,
      status: i < allNames.length - 2 ? 'Faol' : pick(["Ta'tilda", 'Nofaol']),
      experience: randomBetween(0, 8),
    }, superAdminId);
    employees.push(employee.employee);
  }

  return employees;
}

const CANDIDATE_NAMES = [
  'Jasurbek Mamadaliyev', 'Ozoda Rustamova', 'Sherzod Yunusov', 'Nigora Aliyeva',
  'Ravshan Ismoilov', 'Gulbahor Nabiyeva', 'Akmal Qosimov', 'Sabina To\'xtayeva',
  "Bahodir Ne'matov",
];
const CANDIDATE_POSITIONS = ['Sotuv menejeri', 'Frontend dasturchi', 'HR mutaxassisi', 'Buxgalter', 'Marketing mutaxassisi'];

async function seedApplications(hrId) {
  console.log('📋 Nomzodlar (Lead doskasi) yaratilmoqda...');
  // KELDI (3), QOSHILDI (2), SINOV_MUDDATI (2), RAD_ETILDI (2) — SHARTNOMA
  // ustuni allaqachon yuqoridagi ishga qabul qilingan xodimlar bilan to'lgan.
  const statuses = ['KELDI', 'KELDI', 'KELDI', 'QOSHILDI', 'QOSHILDI', 'SINOV_MUDDATI', 'SINOV_MUDDATI', 'RAD_ETILDI', 'RAD_ETILDI'];

  for (let i = 0; i < CANDIDATE_NAMES.length; i++) {
    const [firstName, lastName] = CANDIDATE_NAMES[i].split(' ');
    const empResult = await query(
      `INSERT INTO employees (first_name, last_name, phone, status)
       VALUES ($1, $2, $3, 'Nomzod') RETURNING id`,
      [firstName, lastName, randomPhone()]
    );
    const employeeId = empResult.rows[0].id;

    const appResult = await query(
      `INSERT INTO applications (employee_id, status, position, notes, assigned_to)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [employeeId, statuses[i], pick(CANDIDATE_POSITIONS), "Ariza havola orqali tushgan", hrId]
    );

    await query(
      `INSERT INTO application_history (application_id, changed_by, new_status, comment)
       VALUES ($1, $2, $3, 'Ariza yaratildi')`,
      [appResult.rows[0].id, hrId, statuses[i]]
    );
  }
}

async function seedSchedules(employees, superAdminId) {
  console.log("⏰ Ish jadvallari yaratilmoqda...");
  const ids = employees.map((e) => e.id);
  const standard = ids.slice(0, 14);
  const gibrid = ids.slice(14, 19);
  const erkin = ids.slice(19, 22);

  const weekday = { isWorkDay: true, startTime: '09:00', endTime: '18:00', breakStart: '13:00', breakEnd: '14:00' };
  const weekend = { isWorkDay: false, startTime: null, endTime: null, breakStart: null, breakEnd: null };
  const days = [1, 2, 3, 4, 5, 6, 7].map((dayNumber) => ({
    dayNumber,
    ...(dayNumber <= 5 ? weekday : weekend),
  }));

  await createSchedule({
    name: 'Standart ish jadvali',
    type: 'moslashuvchan',
    startDate: '2026-01-05',
    cycleDays: 7,
    countOvertime: true,
    deductBreak: true,
    extendedHours: 2,
    employeeIds: standard,
    days,
  }, superAdminId);

  await createSchedule({
    name: 'Gibrid smena',
    type: 'gibrid',
    startDate: '2026-01-05',
    cycleDays: 7,
    countOvertime: false,
    deductBreak: false,
    extendedHours: 0,
    limitType: 'kunlik',
    limitHours: 8,
    shiftLimitHours: 10,
    employeeIds: gibrid,
    days: [],
  }, superAdminId);

  await createSchedule({
    name: 'Erkin jadval',
    type: 'erkin',
    startDate: '2026-01-05',
    cycleDays: 7,
    countOvertime: false,
    deductBreak: false,
    extendedHours: 0,
    shiftLimitHours: 12,
    employeeIds: erkin,
    days: [],
  }, superAdminId);

  return { standard, gibrid, erkin };
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

async function seedAttendanceHistory(scheduleGroups, hrId) {
  console.log('📅 Davomat tarixi yaratilmoqda (so\'nggi 14 kun)...');
  const allAssigned = [...scheduleGroups.standard, ...scheduleGroups.gibrid, ...scheduleGroups.erkin];
  const shiftLimitGroup = new Set([...scheduleGroups.gibrid, ...scheduleGroups.erkin]);
  const today = new Date();

  for (let d = 14; d >= 1; d--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - d);
    if (!isWeekday(day)) continue;
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const dd = day.getUTCDate();

    for (const employeeId of allAssigned) {
      const isLate = Math.random() < 0.15;
      const startHour = 9 + (isLate ? randomBetween(0, 1) : 0);
      const startMinute = isLate ? randomBetween(1, 45) : randomBetween(0, 0);
      const keldiAt = tashkentTime(y, m, dd, startHour, startMinute);

      await createManualAttendance({
        employeeId,
        type: 'keldi',
        recordedAt: keldiAt,
        notes: null,
        createdBy: hrId,
      });

      const isEarly = Math.random() < 0.1;
      const isOverLimit = shiftLimitGroup.has(employeeId) && Math.random() < 0.2;
      let endHour = isEarly ? randomBetween(15, 17) : 18;
      if (isOverLimit) endHour = startHour + 11; // smena limitidan (10-12 soat) oshadi
      const ketdiAt = tashkentTime(y, m, dd, endHour, randomBetween(0, 59));

      await createManualAttendance({
        employeeId,
        type: 'ketdi',
        recordedAt: ketdiAt,
        notes: null,
        createdBy: hrId,
      });
    }
  }
}

async function seedOnboarding(employees, hrId) {
  console.log('🚀 Onboarding rejalari yaratilmoqda...');
  const plan1 = await createPlan({
    name: 'Yangi xodim uchun onboarding',
    description: "Kompaniya bilan tanishtirish va boshlang'ich hujjatlar",
    steps: [
      {
        tasks: [
          { type: 'video', title: 'Kompaniya tarixi bilan tanishing', videoUrl: 'dQw4w9WgXcQ', description: "Videoni to'liq ko'ring" },
          { type: 'hujjat', title: 'Ichki tartib-qoidalar', description: "Hujjat bilan tanishib chiqing" },
        ],
      },
      {
        tasks: [
          { type: 'harakat', title: "Ish joyingizni tayyorlang", description: "Kompyuter va boshqa jihozlarni sozlang" },
          { type: 'harakat', title: 'HR bilan tanishuv suhbati', description: "HR bo'limi bilan qisqa suhbat" },
        ],
      },
      {
        tasks: [
          { type: 'video', title: "Xavfsizlik texnikasi", videoUrl: 'dQw4w9WgXcQ', description: "Majburiy video" },
        ],
      },
    ],
  }, hrId);

  const plan2 = await createPlan({
    name: "Sotuv bo'limi onboarding",
    description: "Sotuv jarayonlari va mijozlar bilan ishlash",
    steps: [
      {
        tasks: [
          { type: 'hujjat', title: 'Sotuv skripti', description: "Skript bilan tanishib chiqing" },
          { type: 'harakat', title: 'CRM tizimiga kirish', description: "Login ma'lumotlarini oling" },
        ],
      },
      {
        tasks: [
          { type: 'video', title: 'Mijozlar bilan muloqot', videoUrl: 'dQw4w9WgXcQ', description: "Video darslikni ko'ring" },
          { type: 'harakat', title: 'Birinchi mijoz bilan uchrashuv', description: "Mentor kuzatuvida" },
        ],
      },
    ],
  }, hrId);

  const targets = employees.slice(0, 5);
  const assignments = [];
  for (const emp of targets) {
    const plan = assignments.length < 3 ? plan1 : plan2;
    const assignment = await createAssignment(plan.id, emp.id, hrId);
    assignments.push(assignment);
  }

  // Birinchi biriktirishda: 1 vazifa qabul qilingan, 1 rad etilgan, qolgani kutilmoqda.
  const a0 = assignments[0];
  const fullPlan = await getAssignmentById(a0.id);
  const firstTaskId = fullPlan.steps[0].tasks[0].id;
  const secondTaskId = fullPlan.steps[0].tasks[1].id;

  await submitTask(a0.publicToken, firstTaskId, { type: 'text', text: 'Video ko\'rib chiqdim, hammasi tushunarli bo\'ldi.' });
  await reviewTaskSubmission(a0.id, firstTaskId, 'approved', hrId, 'Yaxshi ishlagansiz!');

  await submitTask(a0.publicToken, secondTaskId, { type: 'link', link: 'https://example.com/hujjat-tasdiqlash' });
  await reviewTaskSubmission(a0.id, secondTaskId, 'rejected', hrId, "Havola ishlamayapti, qaytadan yuboring");

  if (assignments[1]) {
    const a1 = assignments[1];
    const fullPlan1 = await getAssignmentById(a1.id);
    const taskId = fullPlan1.steps[0].tasks[0].id;
    await submitTask(a1.publicToken, taskId, { type: 'text', text: "Tayyor, ko'rib chiqishingizni kutaman." });
    // Ataylab ko'rib chiqilmagan holatda qoldiriladi — "Kutilmoqda" holatini ko'rsatish uchun.
  }
}

async function seedFines(hrId) {
  console.log('⚠️  Jarima turlari va siyosatlari yaratilmoqda...');
  const warning = await createFineType('Ogohlantirish', hrId);
  const fine50 = await createFineType("Jarima - 50 000 so'm", hrId);
  const fine100 = await createFineType("Jarima - 100 000 so'm", hrId);
  const dismissal = await createFineType("Ishdan bo'shatish", hrId);

  await createFinePolicy({
    name: 'Sotuvchilar va operatorlar',
    enabled: true,
    templates: [
      { violationType: 'kech_kelish', timeLimit: '00:15', amount: 50000, fineTypeId: fine50.id },
      { violationType: 'erta_ketish', timeLimit: '00:10', amount: 30000, fineTypeId: fine50.id },
      { violationType: 'kelmagan_kun', timeLimit: '', amount: 0, fineTypeId: warning.id },
    ],
  }, hrId);

  await createFinePolicy({
    name: 'Ofis xodimlari',
    enabled: true,
    templates: [
      { violationType: 'kech_kelish', timeLimit: '00:20', amount: 0, fineTypeId: warning.id },
      { violationType: 'kelmagan_kun', timeLimit: '', amount: 100000, fineTypeId: fine100.id },
    ],
  }, hrId);
}

async function main() {
  console.log("🌱 Demo ma'lumotlari to'ldirilmoqda...\n");
  try {
    await testConnection();
    await wipeDemoData();

    const { superAdminId, hrId } = await seedUsers();
    const employees = await seedEmployees(superAdminId);
    await seedApplications(hrId);
    const scheduleGroups = await seedSchedules(employees, superAdminId);
    await seedAttendanceHistory(scheduleGroups, hrId);
    await seedOnboarding(employees, hrId);
    await seedFines(hrId);

    console.log('\n✅ Demo ma\'lumotlari muvaffaqiyatli yaratildi!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Admin Email: ', DEMO_ADMIN_EMAIL);
    console.log('🔑 Admin Pass:  ', DEMO_ADMIN_PASSWORD);
    console.log('📧 HR Email:    ', DEMO_HR_EMAIL);
    console.log('🔑 HR Pass:     ', DEMO_HR_PASSWORD);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Demo seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
