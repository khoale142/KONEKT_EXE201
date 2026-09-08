import "dotenv/config";
import { pool } from "../src/config/db";

type FaqSeed = {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  priority: number;
};

const FAQ_SEEDS: FaqSeed[] = [
  {
    category: "hours",
    question: "Gio mo cua cua KOHI la khi nao?",
    answer:
      "Da gio mo cua co the khac nhau theo tung chi nhanh. Ban vui long xem trong app/website hoac cho minh ten cua hang de kiem tra gio hoat dong chinh xac nhe.",
    keywords: [
      "gio mo cua",
      "gio dong cua",
      "mo cua may gio",
      "dong cua may gio",
      "bao gio mo cua",
      "bao gio dong cua",
      "gio hoat dong",
      "gio lam viec",
      "gio phuc vu",
      "mo cua hom nay",
      "dong cua hom nay",
      "quan mo may gio",
      "quan dong may gio",
      "open now",
      "close now",
      "working time",
      "opening hours",
      "business hours",
      "working hours",
    ],
    priority: 100,
  },
  {
    category: "address",
    question: "KOHI co chi nhanh o dau?",
    answer:
      "Da ban co the xem danh sach chi nhanh va dia chi trong app/website. Neu ban muon tim cua hang gan nhat, minh co the huong dan theo khu vuc cua ban.",
    keywords: [
      "dia chi",
      "chi nhanh",
      "cua hang o dau",
      "quan o dau",
      "google map",
      "map",
      "chi duong",
      "duong di",
      "store",
      "branch",
      "address",
      "gan nhat",
      "gan day",
      "near me",
      "location",
      "dia diem",
      "vi tri",
      "toa do",
      "tim quan gan nhat",
      "tim cua hang gan nhat",
    ],
    priority: 99,
  },
  {
    category: "contact",
    question: "Thong tin lien he cua KOHI la gi?",
    answer:
      "Da ban co the lien he KOHI qua hotline hoac cac kenh chinh thuc tren app/website. Neu ban can thong tin cua mot chi nhanh cu the, minh co the giup ban tim nhanh hon.",
    keywords: [
      "lien he",
      "hotline",
      "so dien thoai",
      "sdt",
      "facebook",
      "fanpage",
      "instagram",
      "zalo",
      "email",
      "contact",
      "cham soc khach hang",
      "so hotline",
      "phone",
      "phone number",
      "social",
      "fb",
      "messenger",
    ],
    priority: 98,
  },
  {
    category: "delivery",
    question: "KOHI co giao hang khong?",
    answer:
      "Da viec giao hang co the tuy thuoc vao chi nhanh va khu vuc. Ban kiem tra tren app/website de xem cua hang gan ban co ho tro giao hang hay freeship khong nhe.",
    keywords: [
      "ship",
      "giao hang",
      "delivery",
      "freeship",
      "ship tan noi",
      "giao tan noi",
      "co ship khong",
      "co giao hang khong",
      "dat giao hang",
      "giao den nha",
      "ship qua app",
      "delivery app",
      "co freeship khong",
    ],
    priority: 97,
  },
  {
    category: "menu",
    question: "KOHI dang ban nhung mon nao?",
    answer:
      "Da menu KOHI co ca phe, tra, nuoc ep, freeze, do uong khac va cac loai banh. Ban co the xem chi tiet mon va gia trong muc Thuc don tren app/website nhe.",
    keywords: [
      "menu",
      "thuc don",
      "bang gia",
      "gia",
      "gia ca",
      "co mon gi",
      "quan ban gi",
      "co do uong gi",
      "co banh gi",
      "xem menu",
      "xem thuc don",
      "xem bang gia",
      "menu hien tai",
      "full menu",
      "menu quan",
      "price",
      "pricing",
      "danh sach mon",
      "co gi hot",
      "co mon nao",
    ],
    priority: 96,
  },
  {
    category: "points",
    question: "Chuong trinh tich diem cua KOHI nhu the nao?",
    answer:
      "Da KOHI co chuong trinh tich diem cho thanh vien. Ban co the xem diem hien co, voucher va quyen loi trong tai khoan cua minh tren app nhe.",
    keywords: [
      "tich diem",
      "diem tich luy",
      "diem thuong",
      "doi diem",
      "doi qua",
      "membership",
      "member",
      "loyalty",
      "reward",
      "voucher cua toi",
      "kiem tra diem",
      "xem diem",
      "reward points",
      "loyalty points",
      "hoi vien",
      "diem hoi vien",
      "so diem",
      "bao nhieu diem",
      "kiem tra voucher",
      "uu dai hoi vien",
    ],
    priority: 95,
  },
];

async function deactivateDuplicateFaqRows(category: string, keepId: number): Promise<void> {
  await pool.query(
    `
    UPDATE coffee_chain_db.chat_knowledge
    SET is_active = FALSE
    WHERE intent_code = 'faq'
      AND LOWER(COALESCE(category, '')) = LOWER($1)
      AND id <> $2
    `,
    [category, keepId]
  );
}

async function upsertFaqKnowledge(seed: FaqSeed): Promise<void> {
  const existing = await pool.query<{ id: number }>(
    `
    SELECT id
    FROM coffee_chain_db.chat_knowledge
    WHERE intent_code = 'faq'
      AND LOWER(COALESCE(category, '')) = LOWER($1)
    ORDER BY priority DESC, id ASC
    LIMIT 1
    `,
    [seed.category]
  );

  if (existing.rows[0]) {
    const keepId = existing.rows[0].id;
    await pool.query(
      `
      UPDATE coffee_chain_db.chat_knowledge
      SET question = $2,
          answer = $3,
          keywords = $4::text[],
          priority = $5,
          is_active = TRUE
      WHERE id = $1
      `,
      [keepId, seed.question, seed.answer, seed.keywords, seed.priority]
    );
    await deactivateDuplicateFaqRows(seed.category, keepId);
    console.log(`updated faq category=${seed.category}`);
    return;
  }

  const inserted = await pool.query<{ id: number }>(
    `
    INSERT INTO coffee_chain_db.chat_knowledge
      (intent_code, question, answer, keywords, category, priority, is_active)
    VALUES
      ('faq', $1, $2, $3::text[], $4, $5, TRUE)
    RETURNING id
    `,
    [seed.question, seed.answer, seed.keywords, seed.category, seed.priority]
  );
  await deactivateDuplicateFaqRows(seed.category, inserted.rows[0].id);
  console.log(`inserted faq category=${seed.category}`);
}

async function run(): Promise<void> {
  try {
    await pool.query("BEGIN");
    for (const seed of FAQ_SEEDS) {
      await upsertFaqKnowledge(seed);
    }
    await pool.query("COMMIT");
    console.log("chat faq seed completed");
  } catch (error: any) {
    await pool.query("ROLLBACK");
    console.error("chat faq seed failed");
    console.error(error?.message ?? error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void run();
