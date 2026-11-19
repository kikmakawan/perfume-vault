# 🫧 Perfume Vault 2.1

แอปตู้น้ำหอมส่วนตัว (PWA): ติดตั้งลงมือถือได้ ใช้ได้แม้ออฟไลน์ ซิงค์กับ Google Sheet และมีผู้ช่วย AI (Gemini)

## ✨ ฟีเจอร์
- **ใช้ได้แม้ไม่มีเน็ต:** ข้อมูลเก็บในเครื่อง (IndexedDB) แก้ไขได้ตลอด แล้วซิงค์ขึ้น Sheet เมื่อออนไลน์
- **📸 เพิ่มขวดไม่ต้องพิมพ์:** ถ่ายรูปขวดแล้ว AI กรอกให้ ถอดรหัส Batch code และนับ PAO หลังแกะขวด
- **📔 สมุดบันทึกการฉีด:** ฉีดวันนี้ 1 แตะ ปฏิทินสี streak ต้นทุนต่อครั้ง % ที่เหลือ และเตือนขวดที่ถูกลืม
- **🧠 AI:** เลือกน้ำหอมตามอากาศจริง แชทกับตู้ Layering หา Dupe และช่วยคิดก่อนซื้อ
- **🎀 สนุก & แชร์:** ชั้นวางขวด DNA กลิ่น Wrapped รายปี การ์ด IG Story เหรียญรางวัล Wishlist ราคาเป้าหมาย งบรายเดือน และ Pastel Night (โหมดมืด)

## 🚀 ติดตั้ง

### 1) หลังบ้าน: Google Apps Script
1. เปิดโปรเจกต์ Apps Script เดิม แล้ววางโค้ดจาก `apps-script/Code.gs` แทน `Code.gs` เดิม
   (ไฟล์ `Index.html`, `CSS.html`, `JS.html` เดิมลบทิ้งได้ เพราะหน้าเว็บย้ายมาอยู่บน GitHub แล้ว)
2. ⚙️ Project Settings → Script Properties ตรวจว่ามี `GEMINI_API_KEY`
3. เลือกฟังก์ชัน `setupToken` แล้วกด ▶ Run จากนั้นคัดลอกรหัสจาก Execution log
4. Deploy → **New deployment** → ⚙️ เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - คัดลอก URL ที่ลงท้ายด้วย `/exec`
5. (ไม่บังคับ) รัน `testPull` เพื่อเช็คว่าอ่านชีตได้ ครั้งแรกระบบจะเพิ่มคอลัมน์ `UID`, `UpdatedAt`, `OpenedDate`, `FillLevel`, `Tags` และชีต `WearLog` ให้เอง ข้อมูลเดิมไม่หาย

> ทำไมต้อง "Anyone"? เพราะแอปบน GitHub ต้องเรียก API ได้โดยตรง แต่ทุกคำขอต้องแนบ `APP_TOKEN` ที่ตรงกัน คนที่ไม่มีรหัสจึงอ่านหรือแก้ข้อมูลไม่ได้ ส่วน Gemini API key ยังอยู่ใน Apps Script ไม่ถูกส่งออกไปที่หน้าเว็บ

### 2) หน้าเว็บ: GitHub Pages
1. Push ไฟล์ทั้งหมดใน repo นี้ขึ้น GitHub
2. Settings → Pages → Source: **Deploy from a branch** → `main` / `(root)` → Save
3. รอ 1-2 นาที จะได้ลิงก์แบบ `https://<username>.github.io/<repo>/`

### 3) เปิดแอปครั้งแรก (วิธีง่าย: ลิงก์เดียว)
หลัง Deploy แล้ว ให้รัน `setupToken` อีกครั้ง ใน log จะมี **ลิงก์เชื่อมต่อ** ส่งลิงก์นี้เข้าไลน์ตัวเอง แล้วกดเปิดบนมือถือ แอปจะเชื่อมกับชีตให้เองทันที

### 3.1) หรือเชื่อมเอง
1. เปิดลิงก์บนมือถือ
   - iPhone: Safari → แชร์ → **เพิ่มไปยังหน้าจอโฮม**
   - Android: Chrome → ⋮ → **ติดตั้งแอป**
2. เปิดแอปจากไอคอน → AI & อื่นๆ → ⚙️ ตั้งค่า → วาง URL `/exec` และ `APP_TOKEN` → **ทดสอบ & บันทึก**
3. ข้อมูลเดิมจากชีตจะถูกดึงมาเอง 🎉

## 🔄 อัปเดตเวอร์ชัน
แก้ไฟล์แล้วเปลี่ยน `VERSION` ใน `sw.js` ทุกครั้ง แอปจะขึ้นแถบ "มีเวอร์ชันใหม่" ให้กดอัปเดต

## 🗂️ โครงสร้าง
```
index.html  manifest.webmanifest  sw.js  css/app.css  icons/
js/  app.js nav.js util.js db.js api.js store.js sync.js analytics.js charts.js share.js weather.js
js/views/  home vault detail form diary more ai wishlist insights settings
apps-script/Code.gs   ← วางใน Google Apps Script
```
