# CLAUDE.md

คำแนะนำสำหรับ Claude Code เมื่อทำงานในโปรเจกต์นี้

## สิ่งนี้คืออะไร

ระบบแผนที่เก็บข้อมูลแปลงที่ดินและต้นไม้ (`ระบบแผนที่ต้นไม้`) เป้าหมายระยะยาวคือใช้ประกอบระบบ carbon credit

**ตอบกลับผู้ใช้เป็นภาษาไทยเสมอ** ไม่ว่าผู้ใช้จะพิมพ์ภาษาอะไรมาก็ตาม (โค้ด/commit message/ชื่อไฟล์ใช้ภาษาอังกฤษได้ตามปกติ)

## สถานะปัจจุบัน

ฝั่ง client ยังเป็นเว็บแอปไฟล์เดียว ไม่มี build step — เขียน HTML/CSS/JS ล้วนในไฟล์เดียว ใช้ [Leaflet.js](https://leafletjs.com/) (โหลดผ่าน CDN พร้อม fallback หลายแหล่ง) แสดงแผนที่แบบ OpenStreetMap **แต่ตั้งแต่ v1.8 มี backend จริงแล้ว** (ก่อนหน้านี้ไม่มี)

- ไฟล์หลัก: `index.html` (เวอร์ชันล่าสุด v1.9)
- `tree-map-system-1.html`: โค้ดคนละเวอร์ชัน/prototype เก่ากว่า (ไม่มีระบบ fallback error handling) ไม่ชัดเจนว่ายังใช้งานอยู่หรือไม่ ถามผู้ใช้ก่อนแก้ไฟล์นี้
- **Backend (v1.8)**: Node.js + Express (`server.js`, `server/app.js`, `server/db.js`) + Postgres (`schema.sql`) — REST API ที่ `/api/plots` และ `/api/trees` (GET ทั้งหมด, `PUT /:id` = upsert, `DELETE /:id`) ลบแปลงจะ cascade ลบต้นไม้ในแปลงนั้นด้วย (FK `ON DELETE CASCADE`) โครงสร้างตารางไม่ใช้ PostGIS ยังเก็บพิกัดเป็น column ธรรมดา/JSONB (ยกไป PostGIS ทีหลังได้ถ้าต้อง query เชิงพื้นที่ซับซ้อนขึ้น)
- **Deploy**:
  - **Render** (`render.yaml` blueprint) — deploy เป็น Web Service เดียวที่ serve ทั้ง `index.html` และ API พร้อม Render Postgres แนบอัตโนมัติผ่าน `DATABASE_URL` นี่คือ deploy target หลักตอนนี้ (ผู้ใช้ต้องเชื่อม GitHub repo กับ Render เอง — Claude สร้างบัญชี/กด deploy ให้ไม่ได้)
  - GitHub Pages จาก branch `main` → https://taro191.github.io/tree-map/ ยังทำงานอยู่แต่เป็น **static เท่านั้น** ไม่มี backend รองรับ ดังนั้น `/api/*` จะ fail และแอปจะโหลดเป็นค่าว่าง (มี error banner แจ้งเตือนอยู่แล้ว) — เก็บไว้เป็น mirror/demo หน้าตาเฉยๆ ไม่ใช่ที่ใช้งานจริงอีกต่อไป
- **เก็บข้อมูล**: ผ่าน REST API ข้างต้น ลง Postgres จริง (`window.storage` shim เดิมถูกถอดออกหมดแล้วตั้งแต่ v1.8)
- **Dev ท้องถิ่น**: `npm install` แล้ว `npm run dev` รันเซิร์ฟเวอร์เดียวกันแต่สลับไปใช้ in-memory store (`scripts/dev-memory-server.js`) ไม่ต้องมี Postgres จริงในเครื่อง เหมาะกับทดสอบเร็วๆ ส่วน `npm test` รัน integration test (`test/api.test.js`) ผ่าน store เดียวกันนี้ด้วย `node --test`

## ฟีเจอร์ที่มีแล้ว

- เพิ่มแปลงที่ดิน (ชื่อ, เจ้าของ, เบอร์ติดต่อ, สีประจำแปลง)
- วาดขอบเขตแปลงบนแผนที่ (คลิกทีละจุด หรือโหมดเดินสำรวจด้วย GPS)
- ปักหมุดต้นไม้ในแปลง พร้อมเลขลำดับอัตโนมัติต่อแปลง (คลิกบนแผนที่ หรือใช้ตำแหน่ง GPS ปัจจุบัน)
- บันทึกชื่อ/สายพันธุ์, ลิงก์รูปภาพ, หมายเหตุต่อต้นไม้
- ดีไซน์แบบ bottom sheet สำหรับมือถือ
- **(v1.5)** ฟิลด์ข้อมูลแปลงเพิ่มเติม: ประเภท/เลขที่เอกสารสิทธิ์, เนื้อที่ (ไร่/งาน/ตารางวา), ที่ตั้ง (อำเภอ/จังหวัด/รหัสไปรษณีย์)
- **(v1.5)** ถ่ายรูปแปลงพร้อมประทับข้อมูลลงรูปอัตโนมัติ (ชื่อเจ้าของ, เอกสารสิทธิ์, เนื้อที่, ที่อยู่, วันเวลา, พิกัด UTM จาก GPS ขณะถ่าย) สไตล์ "GPS Map Camera" — เก็บได้แปลงละ 1 รูป (ถ่ายใหม่จะแทนที่รูปเดิม) แปลงพิกัด lat/lon เป็น UTM ด้วยฟังก์ชันในตัว ไม่พึ่ง library ภายนอก
- **(v1.6)** ถ่าย/อัปโหลดรูปเอกสารที่ดิน (โฉนด/สปก./นส.3 ฯลฯ) แยกจากรูปแปลง — ประทับลายน้ำ "ใช้ประกอบเรื่องคาร์บอนเครดิตเท่านั้น" แบบเอียง 30° กระจายเต็มภาพอัตโนมัติ (กันการนำรูปเอกสารไปใช้นอกวัตถุประสงค์) เก็บได้แปลงละ 1 รูปเช่นกัน
- **(v1.7)** เนื้อที่ไร่จำกัดไม่เกิน 30 ไร่ (validate ทั้ง `max` attribute และตอนกดถัดไป) ปรับช่องเนื้อที่ให้แคบลง (ไร่/งาน/ตร.วา) และเปลี่ยนฟิลด์ที่ตั้งแปลงเป็น: กรอกรหัสไปรษณีย์ 5 หลัก → ระบบค้นหาอำเภอ/จังหวัดที่ตรงกันให้อัตโนมัติ (auto-fill ถ้าเจอที่เดียว, ให้เลือกจาก dropdown ถ้าเจอหลายที่ เช่น กรุงเทพฯ ที่บาง postcode คาบเกี่ยวหลายเขต) — ใช้ข้อมูลจาก [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data) โหลดผ่าน `fetch` จาก raw.githubusercontent.com ตอน focus ช่องรหัสไปรษณีย์ครั้งแรก (ต้องมีอินเทอร์เน็ต, มี fallback ให้กรอกอำเภอ/จังหวัดเองถ้าโหลดไม่สำเร็จ) ฟังก์ชันหลัก: `loadThaiZipIndex()`, `handlePostcodeInput()`
- **(v1.8)** ย้ายจาก `window.storage` shim ไปใช้ backend จริง (Node/Express + Postgres บน Render) — ดูรายละเอียดที่หัวข้อ "Backend / Deploy" ด้านล่าง
- **(v1.9)** ย้ายส่วนรูปแปลง+รูปเอกสารที่ดิน (`renderPlotDetail()`) จากแท็บ "ต้นไม้" ไปแท็บ "แปลงที่ดิน" แทน (แสดงใน `#plot-detail` ต่อจากรายการแปลง) แท็บ "ต้นไม้" เหลือแค่ banner ข้อมูลแปลง + โหมดเพิ่มต้นไม้ ไม่มีรูปภาพอีกต่อไป

## บั๊กที่เคยเจอและแก้แล้ว

**แผนที่ไม่แสดงผลบน Chrome มือถือ (แก้ใน commit `b4b0376`)**: มี CSS selector `#map-wrap` ประกาศซ้ำ 2 ที่ในไฟล์เดียวกัน กฎที่สอง (`flex:1;position:relative;` ซึ่งเป็นเศษซากจาก layout แบบ flex ที่เคยใช้) มาทีหลังจึงเขียนทับกฎแรกที่ถูกต้อง (`position:absolute` เต็มจอ) ทำให้ `#map-wrap`/`#map` ยุบเหลือ 0 ความสูง และปุ่ม GPS (ลูกของ `#map-wrap` ที่ใช้ `position:absolute`) หลุดออกนอกจอ เป็นบั๊ก CSS cascade ล้วนๆ ไม่มี JS exception จึงไม่มี error banner ขึ้นเตือน — ถ้าเจออาการคล้ายกัน (หน้าจอว่างเปล่าแบบไม่มี error เลย) ให้สงสัย CSS selector ซ้ำ/ชนกันก่อนสงสัยว่าโหลด library ไม่สำเร็จ

## Backend / Deploy (v1.8)

- `server.js` = entry point จริงที่รันบน Render (`npm start`) อ่าน `DATABASE_URL` จาก env, รัน `schema.sql` ตอนบูต (retry ~10 ครั้ง เผื่อ Postgres ยังไม่พร้อมตอน deploy พร้อมกัน) แล้วค่อย listen
- `server/db.js` = `createPgStore(connectionString)` คุย Postgres จริงผ่าน `pg` (parameterized query, upsert ด้วย `ON CONFLICT`) แปลง row snake_case ↔ object camelCase ให้ตรงกับ shape เดิมที่ client ใช้อยู่แล้ว (ไม่ต้องแก้ data model ฝั่ง client เยอะตอน migrate)
- `server/app.js` = `createApp(store)` คืน Express app — รับ store แบบ dependency-injected ตั้งใจให้ swap ระหว่าง pg store จริงกับ store อื่นได้ (ใช้ทดสอบโดยไม่ต้องมี Postgres จริง)
- `render.yaml` = Blueprint สร้าง Web Service + Postgres database ให้พร้อมกันตอน deploy (ผู้ใช้กด "New Blueprint" บน Render แล้วเชื่อม repo นี้เอง)
- **Local dev**: `npm run dev` ใช้ in-memory store (`scripts/dev-memory-server.js`, `test/memoryStore.js`) ไม่ต้องมี Postgres ในเครื่อง — เครื่องนี้บังเอิญมี PostgreSQL 18 ติดตั้งจริงด้วย (Windows service `postgresql-x64-18`) เคยใช้ต่อทดสอบแบบเต็มรูปแบบผ่าน `psql`/`server.js` จริงแล้ว (ยืนยัน UTF-8 ภาษาไทย round-trip ถูกต้อง, cascade delete ทำงานถูกต้อง) ถ้าต้องการรันแบบนี้อีกต้องขอรหัสผ่าน `postgres` user จากผู้ใช้ในแชท (อย่าเดา/จำรหัสผ่านไว้ในไฟล์ใดๆ ในโปรเจกต์)
- **Testing**: `npm test` รัน `test/api.test.js` (in-memory, รันได้เสมอ) และ `test/api.pg.test.js` (skip อัตโนมัติถ้าไม่ตั้ง `TEST_DATABASE_URL` — ตั้งไว้เพื่อรันซ้ำกับ Postgres จริงได้ถ้าต้องการความมั่นใจเพิ่ม)

## แผนในอนาคต (คุยไว้ ยังไม่เริ่มทำ)

ผู้ใช้ต้องการขยายเป็นระบบเต็มรูปแบบสำหรับ carbon credit: แอปมือถือสำหรับเจ้าหน้าที่ภาคสนาม (GPS + ชนิดพันธุ์ + สุขภาพต้นไม้ + รูปภาพ + ประวัติการดูแล) และเว็บแดชบอร์ด admin สำหรับตรวจสอบ/ส่งออกข้อมูล

- **Backend**: เดิมคุยกันไว้ว่าจะใช้ Supabase (Postgres + PostGIS) แต่ตอนนี้เปลี่ยนมาใช้ **Render + self-hosted Express/Postgres จริงแล้ว** (v1.8) ยังไม่ได้ใช้ PostGIS (เก็บพิกัดเป็น column ธรรมดา/JSONB) — ถ้าต้อง query เชิงพื้นที่ซับซ้อนขึ้น (เช่น หาแปลงที่ทับซ้อนกัน) ค่อยพิจารณาเพิ่ม extension `postgis` บน Render Postgres ทีหลัง
- Mobile: ยังไม่เริ่ม — แผนเดิมคือ Expo (React Native) พร้อม offline resilience แบบพื้นฐาน (คิว local ผ่าน `expo-sqlite` กันข้อมูลหายตอนอับสัญญาณ ไม่ใช่ offline-first เต็มรูปแบบ เพราะพื้นที่ทำงานปกติมีเน็ต) เมื่อเริ่มทำควรต่อ REST API เดียวกับที่ `index.html` ใช้อยู่ตอนนี้ (`/api/plots`, `/api/trees`) ได้เลย ไม่ต้องเขียน backend ใหม่
- Web admin: ยังไม่เริ่ม — แผนเดิมคือ React + Vite + Tailwind + react-leaflet ต่อ REST API เดียวกัน

ฟีเจอร์ถ่ายรูปแปลง+ประทับข้อมูล (v1.5 ใน `index.html`) ควรย้ายไปทำใน mobile app (Expo) ด้วยเมื่อเริ่มพัฒนาจริง โดยแนวคิดเดิมคือ: ถ่ายรูป → อ่าน GPS ปัจจุบัน → วาด overlay ข้อความ (ชื่อเจ้าของ, เอกสารสิทธิ์, เนื้อที่, ที่อยู่, วันเวลา, พิกัด UTM) ลงบนรูปแบบเดียวกับแอป "GPS Map Camera" — บน mobile ควรใช้ `expo-camera` + `expo-location` แล้ววาด overlay ด้วย `react-native-view-shot` หรือ canvas เทียบเท่า แทนการใช้ `<canvas>` ของเว็บ ฟังก์ชันแปลง lat/lon เป็น UTM ที่เขียนไว้ใน `index.html` (`latLonToUTM`) พอร์ตไปใช้ตรงๆ ได้เลยเพราะเป็น pure JS ไม่พึ่ง DOM/browser API
