# BACKEND.md — درس‌یار

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — موج A: API خودمان + Postgres محلی

مرتبط: [FRONTEND.md](./FRONTEND.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [FEATURES.md](./FEATURES.md)

## هدف بک

- فرانت فقط HTTP به API خودمان (`apps/api`).
- دیتابیس: PostgreSQL 17 روی ویندوز، `127.0.0.1:5432`، دیتابیس `study_planner`.
- Auth: JWT دسترسی ~۱۵ دقیقه + refresh ~۳۰ روز با چرخش؛ خروج refresh را باطل می‌کند.
- فایل چت (موج E): `uploads/` روی دیسک API، سقف ۲۰ مگ — هنوز پیاده نشده.
- چت فقط بین دانش‌آموز و مشاور متصل — هنوز پیاده نشده.

## مسئولیت بک‌اند

احراز هویت، ذخیرهٔ workspace، قوانین نقش، دعوت‌نامه، محدودیت ویرایش.

**منبع حقیقت نقش در API است** نه در UI.

## بک‌اندهای موجود

| بک | مسیر کد | مخاطب | فعال در مسیر اصلی؟ |
|----|---------|--------|---------------------|
| **API خودمان** | `apps/api` | توسعه و هدف تولید | بله — `npm run dev:app` |
| **Demo API** | `server/test-server.mjs` | تست نقش‌ها با حساب seed | فقط `npm run dev:demo` |
| **Supabase** | `supabase/migrations/...` | منسوخ محصولی | خیر — کلاینت از فرانت حذف شد |

## API خودمان (`apps/api`)

- پورت پیش‌فرض: `8788` روی `127.0.0.1`
- استک: Node + Express + `pg` + `jose`
- env: ریشهٔ ریپو `.env.local` (gitignore)
- migrate: `npm run migrate` → `apps/api/sql/001_init.sql`

### JWT و cookie

| مورد | مقدار |
|------|--------|
| Access | JWT HS256، حدود ۹۰۰ ثانیه، در JSON (`accessToken`)، کلاینت فقط در حافظه نگه می‌دارد |
| Refresh | توکن مات، حدود ۳۰ روز، cookie httpOnly با نام `sp_refresh` |
| Cookie | `Path=/api/auth`، `SameSite=Lax`، `Secure` فقط اگر `COOKIE_SECURE=true` |
| Rotation | هر `POST /api/auth/refresh` توکن قبلی را revoke می‌کند و یکی جدید می‌گذارد |
| Reuse | اگر refresh revoke‌شده دوباره استفاده شود، همهٔ refreshهای همان کاربر باطل می‌شوند |
| Pepper | هش SHA-256 توکن با `JWT_REFRESH_SECRET` در جدول `refresh_tokens` |

در dev، فرانت از پروکسی Vite (همان مبدأ) استفاده می‌کند تا cookie روی HTTP محلی کار کند. فراخوانی cross-origin مستقیم مرورگر به `:8788` برای cookie توصیه نمی‌شود.

### Endpointهای موج A

| متد | مسیر | نقش |
|-----|------|-----|
| GET | `/health` یا `/api/health` | سلامت فرایند |
| POST | `/api/auth/signup` | ثبت‌نام دانش‌آموز → access + cookie |
| POST | `/api/auth/login` | ورود → access + cookie |
| POST | `/api/auth/refresh` | چرخش refresh → access جدید |
| POST | `/api/auth/logout` | باطل کردن refresh + پاک کردن cookie |
| GET | `/api/auth/me` | هویت جاری (Bearer access) |
| GET/PUT | `/api/workspace` | JSON workspace دانش‌آموز |

ثبت‌نام عمومی → همیشه `student`. ساخت مشاور/ادمین در این موج نیست.

### جداول موج A

| جدول | نقش |
|------|-----|
| `users` | ایمیل، هش گذرواژه (scrypt)، نام، نقش |
| `refresh_tokens` | هش refresh، انقضا، revoke، replaced_by |
| `student_workspaces` | سند JSON `data` (AppData) |
| `schema_migrations` | فایل‌های SQL اعمال‌شده |

## Demo API (لوکال، اختیاری)

- پورت پیش‌فرض: `8787` روی loopback
- داده: `.data/test-server.json` (gitignore)
- راه‌اندازی: `npm run test:server` یا `npm run dev:demo`

| ایمیل | گذرواژه | نقش |
|--------|---------|-----|
| `advisor@demo.test` | `advisor123` | مشاور |
| `student@demo.test` | `student123` | دانش‌آموز متصل |
| `solo@demo.test` | `student123` | دانش‌آموز مستقل |

قرارداد endpointهای دمو همان فایل `server/test-server.mjs` است (دعوت، لیست دانش‌آموز، plan مشاور). این‌ها روی API جدید هنوز نیستند.

## مدل دادهٔ مشترک

Workspace = JSON نسخهٔ ۱ (`AppData`). نرمال‌سازی جدولی session/task هنوز نیست.

## env و اسرار

| متغیر | کجا | نکته |
|--------|-----|------|
| `DATABASE_URL` یا `PG*` | API | از `.env.local`؛ مقدار را در چت نگذار |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | API | اگر نباشد، هنگام اجرا در `.env.local` ساخته می‌شود |
| `API_PORT` | API | پیش‌فرض `8788` |
| `CORS_ORIGIN` | API | پیش‌فرض Vite `5174` |
| `VITE_API_URL` | فرانت | خالی = همان مبدأ + پروکسی |
| `VITE_TEST_SERVER_URL` | فرانت | اگر ست باشد مسیر دمو |
| `VITE_SUPABASE_*` | — | مسیر اصلی دیگر نمی‌خواند |

رمز دیتابیس و JWT را commit نکن.

## دستورهای بک

```sh
npm run dev:api      # API با watch
npm run migrate      # SQL migrations
npm run test         # تست واحد password + دود health
npm run test:server  # Demo API قدیمی
```

## بدهی‌های شناخته‌شدهٔ بک

- دعوت، قطع رابطه، CRUD مشاور، org/admin روی API جدید نیستند (موج B/C)
- Demo ≠ API جدید؛ CORS باز و رمز ثابت دمو — فقط لوکال
- بازیابی گذرواژه نیست
- Playwright e2e نیست (فقط دود health)
- پوشهٔ `supabase/` legacy است

## قانون مرزی

بک‌اند **منبع حقیقت نقش و دسترسی** است. فیچر نقش‌محور باید در `apps/api` enforce شود؛ UI فقط کمکی است.
