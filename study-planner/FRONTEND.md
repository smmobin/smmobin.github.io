# FRONTEND.md — درس‌یار

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — موج A: `apps/web` + HTTP API  
مرتبط: [BACKEND.md](./BACKEND.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [FEATURES.md](./FEATURES.md)

## مسئولیت فرانت

هر چیزی که کاربر می‌بیند و لمس می‌کند + ذخیره‌سازی مهمان + فراخوانی بک از طریق `cloud.ts`.

**مالکیت کد:** `apps/web/` (`src/`، `public/`، `index.html`، Vite/TS) به‌علاوه Capacitor ریشه (`capacitor.config.ts`، اسکلت `android/`).

## استک

| مورد | مقدار |
|------|--------|
| UI | React 19 + TypeScript |
| باندلر | Vite 8 (پورت dev پیش‌فرض ۵۱۷۴) |
| استایل | `apps/web/src/index.css` (تم تیره، قاب شبیه گوشی، RTL) |
| بک کلاینت | `fetch` به API خودمان؛ **بدون `@supabase` در مسیر اصلی** |
| موبایل | Capacitor 8 · `webDir: apps/web/dist` · `appId` فعلاً `com.example.app` |
| PWA | `apps/web/public/manifest.json` فارسی/RTL |

## نقشهٔ ماژول‌ها

| فایل | مسئولیت فرانت |
|------|----------------|
| `apps/web/src/main.tsx` | mount اپ |
| `apps/web/src/App.tsx` | شِل نقش: AuthGate / PlannerApp / AdvisorDashboard |
| `apps/web/src/features/planner/PlannerApp.tsx` | تب‌ها، تایمر، خانه، برنامه، دروس، بیشتر (شکست موج A) |
| `apps/web/src/AuthGate.tsx` | انتخاب مهمان / دانش‌آموز / مشاور؛ فرم ورود/ثبت‌نام |
| `apps/web/src/AdvisorDashboard.tsx` | UI مشاور (داده هنوز از دمو یا خطای «موج B») |
| `apps/web/src/cloud.ts` | **مرز فرانت↔بک** — HTTP به API یا دمو |
| `apps/web/src/storage.ts` | فقط مهمان: `localStorage` کلید `study-planner-v1` |
| `apps/web/src/types.ts` | قرارداد کلاینت `AppData` v1 |
| `apps/web/src/utils.ts` | تاریخ شمسی، آمار هفته، heatmap، فرمت دقیقه |
| `apps/web/src/Charts.tsx` | Ring / Bar / Donut / Heatmap |
| `apps/web/src/index.css` | ظاهر |

## وضعیت و مسیریابی نقش (سمت کلاینت)

```
authLoading
  → identity.role === 'advisor'  → AdvisorDashboard
  → !identity && !guestMode      → AuthGate
  → وگرنه                       → PlannerApp (مهمان یا دانش‌آموز)
```

قفل UI دانش‌آموز متصل: `readOnly={Boolean(identity?.advisorId)}` روی برنامه و دروس.

## ذخیره‌سازی سمت فرانت

| حالت | کجا | مکانیزم |
|------|-----|----------|
| مهمان | مرورگر | `saveData` / `loadData` فوری |
| حساب API | `apps/api` | access در حافظه؛ refresh در cookie httpOnly؛ workspace با debounce ~۳۵۰ms |
| توکن دمو | مرورگر | `study-planner-demo-token` فقط اگر `VITE_TEST_SERVER_URL` |

Access token در `localStorage` ذخیره نمی‌شود.

## envهای مربوط به فرانت

| متغیر | نقش |
|--------|-----|
| `VITE_API_URL` | اختیاری؛ خالی = همان مبدأ (`/api` از طریق پروکسی Vite به `:8788`) |
| `VITE_TEST_SERVER_URL` | اگر ست باشد → حالت دمو قدیمی؛ ثبت‌نام API خاموش |

`VITE_SUPABASE_*` دیگر در مسیر اصلی خوانده نمی‌شود.

پروکسی dev در `apps/web/vite.config.ts`: `/api` و `/health` → `http://127.0.0.1:8788`.

## دستورهای فرانت

```sh
npm run dev          # فقط Vite — بدون API، مهمان کار می‌کند؛ ورود حساب نیاز به API دارد
npm run dev:app      # Vite + API خودمان
npm run dev:demo     # Vite + Demo API قدیمی روی 8787
npm run build        # tsc + vite build → apps/web/dist/
npm run lint         # oxlint
npm run preview      # پیش‌نمایش dist
```

## بدهی‌های شناخته‌شدهٔ فرانت

- مهمان هنوز در AuthGate است (حذف: موج B)
- `AuthGate`: رندر تکراری `initialError` (F-AUTH-09)
- `PlannerApp.tsx` هنوز بزرگ است؛ فقط از `App.tsx` جدا شده
- Capacitor هنوز برند/آیدی واقعی ندارد (`com.example.app`)
- دانش‌آموز متصل: UI ساخت/حذف تسک و plan قفل است
- `ClockPicker` و `JalaliDatePicker` هنوز portal کامل ندارند
- `streakDays` در `utils.ts` تعریف شده ولی در UI فراخوانی نمی‌شود (کد مرده؛ حذف در موج B)
- پنل مشاور روی API جدید خطا می‌دهد تا موج B/C

## قانون مرزی

فرانت **نباید** منطق امنیت نقش را تنها منبع حقیقت بداند. قفل UI کمکی است؛ حقیقت در `apps/api` است.
