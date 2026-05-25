require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function run() {
  // создадим/найдём owner_teacher_id: если есть teacher/admin — возьмём первого, иначе оставим null
  const owner = await pool.query(
    `SELECT id FROM users WHERE role IN ('teacher','admin') ORDER BY created_at ASC LIMIT 1`
  );
  const ownerTeacherId = owner.rows[0]?.id || null;

  const courses = [
    {
      level: "A1",
      title: "Elementary",
      uiTitle: "УРОВЕНЬ A1.\nELEMENTARY",
      uiVariant: "peach"
    },
    {
      level: "A2",
      title: "Pre-Intermediate",
      uiTitle: "УРОВЕНЬ A2.\nPRE-INTERMEDIATE",
      uiVariant: "lavender"
    },
    {
      level: "B1",
      title: "Intermediate",
      uiTitle: "УРОВЕНЬ B1.\nINTERMEDIATE",
      uiVariant: "sand"
    },
    {
      level: "",
      title: "Английский, основанный на реальных событиях",
      uiTitle: "АНГЛИЙСКИЙ, ОСНОВАННЫЙ\nНА РЕАЛЬНЫХ СОБЫТИЯХ",
      uiVariant: "purple"
    },
    {
      level: "",
      title: "Артикли",
      uiTitle: "АРТИКЛИ",
      uiVariant: "pink"
    },
    {
      level: "",
      title: "Тренинг по памяти",
      uiTitle: "ТРЕНИНГ\nПО ПАМЯТИ",
      uiVariant: "green"
    }
  ];

  for (const c of courses) {
    // чтобы не плодить дубли — upsert по title+level
    await pool.query(
      `
      INSERT INTO courses(title, description, level, owner_teacher_id, is_published, ui_variant, ui_title)
      VALUES ($1, $2, NULLIF($3,''), $4, true, $5, $6)
      ON CONFLICT (id) DO NOTHING
      `,
      [
        c.title,
        "Добавлено автоматически (seed).",
        c.level,
        ownerTeacherId,
        c.uiVariant,
        c.uiTitle
      ]
    );
  }

  console.log("Seed: курсы добавлены (если не было ошибок).");
  await pool.end();
}

run().catch(async (e) => {
  console.error(e);
  try { await pool.end(); } catch {}
  process.exit(1);
});