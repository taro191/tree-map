# tree-map
แผนที่กับต้นไม้

ระบบแผนที่เก็บข้อมูลแปลงที่ดินและต้นไม้ สำหรับใช้ประกอบระบบ carbon credit

## รันในเครื่อง (dev)

ไม่ต้องมี Postgres ก็รันได้ (ใช้ in-memory store):

```
npm install
npm run dev
```

เปิด http://localhost:8934

## รันกับ Postgres จริง

```
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/tree_map JWT_SECRET=change-me npm start
```

Schema จะถูกสร้างอัตโนมัติตอนเริ่มทำงาน (จาก `schema.sql`)

## หน้า admin (`/admin`)

ต้อง build ก่อนถึงจะใช้งานได้ (dev server ปกติของ root project ไม่ได้ build ให้อัตโนมัติ):

```
npm run build
```

จะได้ `admin/dist` แล้ว Express จะ serve ที่ `/admin` ให้อัตโนมัติ (ทั้ง `npm run dev` และ `npm start`) ถ้าจะแก้โค้ดในโฟลเดอร์ `admin/` บ่อยๆ ให้รัน `npm run dev:admin` แทน (Vite dev server แยก, proxy `/api` ไปที่ `localhost:3000` — ต้องรัน `npm start` คู่กันด้วย)

หน้า `/admin` ต้องสมัครสมาชิก/login ก่อนใช้งาน (เปิดให้สมัครเองได้อิสระ) ส่วน `/api/plots` และ `/api/trees` ที่แอปหลักใช้ **ยังเปิดสาธารณะเหมือนเดิม ไม่มี auth**

## ทดสอบ

```
npm test
```

รัน integration test ด้วย in-memory store เสมอ ถ้าต้องการทดสอบกับ Postgres จริงด้วยให้ตั้ง `TEST_DATABASE_URL` ก่อนรัน:

```
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/tree_map_test npm test
```

## Deploy บน Render

Repo นี้มี `render.yaml` (Blueprint) พร้อมใช้:

1. ไปที่ [Render Dashboard](https://dashboard.render.com/) → New → Blueprint
2. เชื่อมต่อ GitHub repo นี้
3. Render จะสร้าง Web Service + Postgres database ให้อัตโนมัติตาม `render.yaml`

ดูรายละเอียดสถาปัตยกรรมเพิ่มเติมได้ที่ [CLAUDE.md](./CLAUDE.md)
