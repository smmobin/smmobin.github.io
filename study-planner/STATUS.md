# STATUS.md — وضعیت فعلی درس‌یار

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — جداسازی branchهای خارجی از این ریپو  
نقش این فایل: عکس فوری برای شروع هر جلسهٔ محصول/پروژه.

## خلاصهٔ یک‌خطی

**موج A روی `main` این ریپو است.** مشاور روی API هنوز `advisorNotReady`؛ مهمان مانده. **صف: موج B.** پرامپت: `docs/PROMPTS.md`.

## جداسازی پروژه‌ها (انجام شد)

Branchهای `cursor/personal-site-prototype` و `cursor/advisor-guidance` از ریپوی `study-planner` حذف شدند (محتوا به `main` منتقل شد).

| پروژه | پوشهٔ محلی | GitHub |
|--------|------------|--------|
| درس‌یار (اصلی) | `D:\VibeCoding\Cursor\study-planner` | https://github.com/smmobin/study-planner (`main`) |
| سایت شخصی | `D:\VibeCoding\Cursor\personal-site-prototype` | https://github.com/smmobin/personal-site-prototype (private) |

اسنپ‌شات `advisor-guidance`: پوشهٔ محلی حذف شد. روی GitHub به `_DELETED-advisor-guidance` تغییر نام + آرشیو شد (حذف فیزیکی نیاز به password sudo حساب GitHub دارد؛ توکن فعلی `delete_repo` ندارد). محتوا همه روی `study-planner` است.

## وضعیت این لحظه (برای مالک)

| لایه | وضعیت |
|------|--------|
| داک محصول/فیچر/تصمیم‌ها | غنی؛ با کد موج A هم‌تراز شد |
| فرانت | `apps/web` — بدون `@supabase` در مسیر اصلی |
| API خودمان | `apps/api` روی `127.0.0.1:8788` |
| Postgres `study_planner` | migrate `001_init` اعمال شد |
| JWT access + refresh rotation | پیاده شد |
| مهمان / سازمان / چت / پوش | مهمان موقتاً مانده؛ بقیه در کد نیست |
| دو ریپوی FE/BE | انجام نشده — موج F |

### مرز اجرا (موج A)

- `apps/api` — Express + Postgres + JWT
- `apps/web` — React/Vite؛ `cloud.ts` فقط `fetch` به `/api` (پروکسی Vite) یا دمو قدیمی
- دمو `server/test-server.mjs` با `npm run dev:demo` هنوز هست
- پوشهٔ `supabase/` در ریپو مانده ولی مسیر فعال فرانت به آن وصل نیست

### مهمان (عمدی)

حذف کامل مهمان **موج B** است. در موج A مسیر مهمان محلی نگه داشته شد تا بدون حساب هم بتوان UI را دید.

## چه چیزی در کد امروز کار می‌کند (واقعیت)

- [x] `GET /health` و `GET /api/health`
- [x] ثبت‌نام/ورود دانش‌آموز، `me`، `refresh` (cookie httpOnly + rotation)، `logout`
- [x] `GET/PUT /api/workspace` JSON برای دانش‌آموز لاگین‌شده
- [x] فرانت: login/signup/me از API؛ access token فقط در حافظه
- [x] تست: واحد password + دود health (`npm test`)
- [x] شروع شکستن `App.tsx` → `apps/web/src/App.tsx` + `features/planner/PlannerApp.tsx`
- [x] پلنر RTL و مهمان localStorage (مثل قبل)
- [ ] سازمان/ادمین، چت، پوش، PWA غنی
- [ ] حذف مهمان و دعوت/قطع رابطه (موج B)
- [ ] CRUD کامل مشاور روی API جدید

## کارهای باز اولویت‌دار

1. **الان:** موج B — حذف مهمان، ثبت‌نام واحد + کد دعوت اختیاری، قطع رابطه، تسک مشاور
2. موج C: سازمان/ادمین
3. موج D: عمق مطالعه / گزارش ۳۰روزه / سطح
4. موج E: PWA → چت+فایل → پوش
5. دو ریپوی جدا: فقط موج F

## نقش‌ها — هدف محصول در برابر کد

| نقش | در کد امروز | هدف تصمیم‌گرفته |
|-----|-------------|------------------|
| مهمان | هست (موقتاً) | حذف در موج B |
| دانش‌آموز مستقل | ثبت‌نام/ورود API | همان فرم؛ کد دعوت خالی در موج B |
| دانش‌آموز متصل | فقط مسیر دمو قدیمی | کد اختیاری هنگام ثبت‌نام + بعداً |
| مشاور | پنل هست؛ API جدید endpoint ندارد | ساخته‌شده توسط ادمین سطح۲/کامل |
| ادمین سطح۲ / کامل | نیست | موج C |

## زیرساخت (پیاده شد)

- Postgres: سرویس `postgresql-x64-17`، دیتابیس `study_planner`، کاربر `study_planner`، `127.0.0.1:5432`
- اتصال و JWT secrets در `.env.local` (gitignore با `*.local`). رمز را در گیت/چت نگذار.
- Access JWT حدود ۱۵ دقیقه در حافظهٔ کلاینت
- Refresh حدود ۳۰ روز، httpOnly cookie با نام `sp_refresh`، `Path=/api/auth`، `SameSite=Lax`، rotation هنگام `/api/auth/refresh`؛ reuse توکن باطل‌شده همهٔ نشست‌های همان کاربر را می‌بندد
- در dev، Vite روی پورت ۵۱۷۴ مسیر `/api` و `/health` را به `127.0.0.1:8788` پروکسی می‌کند تا cookie همان‌مبدأ بماند
- استریک اضافه نشد

## پرامپت و قواعد کاری

- پرامپت موج B: [`docs/PROMPTS.md`](docs/PROMPTS.md)
- قاعدهٔ Cursor: `.cursor/rules/study-planner-pm.mdc`
- **GitHub:** بعد از هر تغییر ماهوی، commit + push فقط برای `study-planner/` (بدون `.env.local`) — درخواست مالک ۱۴۰۴/۰۷/۲۶

## یادداشت جلسهٔ بعد

موج A تیک خورده. موج B را با پرامپت داخل `docs/PROMPTS.md` در چت Agent اجرا کن.
