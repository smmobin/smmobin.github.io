# ARCHITECTURE.md — نمای سیستم درس‌یار

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — پس از موج A

جزئیات لایه‌ها جدا شده‌اند:
- فرانت → [FRONTEND.md](./FRONTEND.md)
- بک → [BACKEND.md](./BACKEND.md)
- فهرست داک‌ها → [docs/README.md](./docs/README.md)
- فهرست فیچر → [FEATURES.md](./FEATURES.md)

## نمای کلی

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (apps/web)  React+Vite  RTL  Capacitor/PWA     │
│  AuthGate → PlannerApp | AdvisorDashboard                │
│  مرز اتصال: cloud.ts  (fetch /api ، بدون @supabase)      │
└───────────────┬─────────────────────┬───────────────────┘
                │                     │
         مهمان: localStorage   حساب: API خودمان
                │                     │
                │         ┌───────────┴───────────┐
                │         ▼                       ▼
                │   apps/api                  Demo (اختیاری)
                │   127.0.0.1:8788            127.0.0.1:8787
                │   Postgres study_planner    server/test-server.mjs
```

## قاعدة انتخاب بک

- پیش‌فرض: API خودمان از طریق پروکسی Vite (`/api` → `:8788`)
- اگر `VITE_TEST_SERVER_URL` ست باشد → فقط Demo
- `@supabase` در مسیر اصلی نیست

## تصمیم معماری: جداسازی ریپو؟

**کد امروز:** یک مخزن؛ مرز پوشه‌ای `apps/web` + `apps/api`.

**دو GitHub جدا:** فقط موج F بعد از پایدار شدن قرارداد API.

## محدودیت‌های سیستم (خلاصه)

1. Workspace = یک JSON blob
2. امنیت نقش باید در API enforce شود؛ UI فقط کمکی است
3. Demo هرگز production نیست
4. مهمان تا موج B در UI می‌ماند
5. جزئیات شکاف‌ها در FEATURES.md
