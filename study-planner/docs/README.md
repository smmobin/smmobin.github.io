# فهرست مستندات درس‌یار

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — پس از موج A

مستندات از **کد** جدا هستند. مخزن یک monorepo است: `apps/web` + `apps/api`.

## نقشهٔ خواندن

| فایل | مخاطب | محتوا |
|------|--------|--------|
| [PRODUCT.md](../PRODUCT.md) | محصول | چشم‌انداز، نقش‌ها، جریان‌ها، خارج از محدوده |
| [FEATURES.md](../FEATURES.md) | محصول + مهندسی | فهرست ثبت‌شدهٔ قابلیت‌ها (منبع حقیقت فیچر) |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | مهندسی | نمای سیستم + لینک به فرانت/بک |
| [FRONTEND.md](../FRONTEND.md) | فرانت | UI، state، `apps/web`، Capacitor |
| [BACKEND.md](../BACKEND.md) | بک‌اند | API خودمان، JWT، Demo، Postgres |
| [ROADMAP.md](../ROADMAP.md) | محصول/پروژه | موج‌های اولویت‌دار |
| [STATUS.md](../STATUS.md) | هر جلسه | عکس فوری وضعیت و کارهای باز |
| [PROMPTS.md](./PROMPTS.md) | مالک | پرامپت کپی‌پیست — **اجباری** |
| [README.md](../README.md) | توسعه‌دهنده | راه‌اندازی سریع |
| [supabase/README.md](../supabase/README.md) | legacy | مسیر قدیمی ابر — دیگر فعال نیست |

## مرز فرانت / بک

```
فرانت (apps/web)                 بک (apps/api)
─────────────────                ────────────────
apps/web/src                     apps/api (Postgres + JWT)
capacitor / android / PWA        server/test-server.mjs  ← دمو اختیاری
localStorage مهمان               supabase/               ← legacy
cloud.ts = لایهٔ اتصال  →       HTTP /api
```

**تصمیم فعلی:** دو GitHub جدا نه. موج بعدی: B در ROADMAP.
