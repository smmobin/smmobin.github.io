# FEATURES.md — فهرست قابلیت‌های ثبت‌شده

آخرین به‌روزرسانی: ۱۴۰۴/۰۷/۲۶ (2026-10-18) — پس از موج A (API خودمان)  
قانون: هر قابلیت تأییدشده از روی کد اینجا یک ردیف دارد. وضعیت‌ها: `done` · `partial` · `missing` · `bug`.

تفکیک لایه: **FE** = فرانت · **BE-Demo** · **BE-Cloud** · **Product**

منبع ممیزی: `apps/web/src/*`، `apps/api/*`، `server/test-server.mjs`، `supabase/migrations/...` (legacy)، `scripts/dev-app.mjs`، `capacitor.config.ts`.

---

## ۱) ورود و هویت

| ID | قابلیت | لایه | وضعیت | محل کد / یادداشت |
|----|--------|------|--------|-------------------|
| F-AUTH-01 | صفحهٔ خوش‌آمد و انتخاب مسیر | FE | done | `AuthGate.tsx` — مهمان / دانش‌آموز / مشاور |
| F-AUTH-02 | مهمان محلی بدون حساب | FE | done در کد / حذف در محصول | `guestMode` + `storage.ts` — تصمیم مالک: حذف شود |
| F-AUTH-03 | ورود دانش‌آموز (ایمیل/گذرواژه) | FE + BE-API + BE-Demo | done | `signInAccount` → API خودمان یا دمو |
| F-AUTH-04 | ثبت‌نام دانش‌آموز | FE + BE-API | done | API: `POST /api/auth/signup`. دمو: عمداً ۴۰۰. مسیر Supabase از جریان فعال خارج شد |
| F-AUTH-05 | ورود مشاور | FE + BE-Demo + BE-Cloud | done | نقش باید از قبل `advisor` باشد |
| F-AUTH-06 | ثبت‌نام خودخدمت مشاور | — | missing | مشاور را ادمین سطح۲ یا ادمین کامل می‌سازد؛ خودخدمت باز نیست |
| F-AUTH-07 | خروج از حساب | FE + BE-Demo + BE-Cloud | done | `signOutCloud` |
| F-AUTH-08 | بازیابی گذرواژه | FE + BE | missing | بعد از پایدار شدن API خودمان؛ دیگر به Supabase وابسته نیست |
| F-AUTH-11 | حذف حساب توسط خود کاربر | FE + BE | missing | تصمیم مالک: باشد |
| F-AUTH-12 | قفل نام و تایمر برای دانش‌آموز متصل | FE + BE | missing | امروز نام و تایمر در UI باز است |
| F-AUTH-09 | نمایش خطای auth اولیه | FE | bug | `AuthGate`: `initialError` دوبار رندر می‌شود (خطوط ۷۶–۷۷) |
| F-AUTH-10 | ثبت‌نام با کد دعوت در همان فرم | — | missing | در کد فعلی نیست؛ اتصال پس از ورود در تب «بیشتر» است (`joinAdvisor`) |

## ۲) پلنر دانش‌آموز / مهمان

| ID | قابلیت | لایه | وضعیت | محل کد / یادداشت |
|----|--------|------|--------|-------------------|
| F-NAV-01 | ناوبری ۵ تب | FE | done | خانه / برنامه / تایمر / دروس / بیشتر — `PlannerApp` |
| F-HOME-01 | آمار امروز و هفته | FE | done | `Home` |
| F-HOME-02 | حلقهٔ هدف هفتگی و ریتم امروز | FE | done | `Ring` |
| F-HOME-03 | نمودار میله‌ای هفته | FE | done | `BarWeek` |
| F-HOME-04 | دونات سهم دروس | FE | done | `Donut` |
| F-HOME-05 | heatmap چهار هفته | FE | done | `Heatmap` + `heatmapDays` |
| F-HOME-06 | تسک‌های امروز + تیک | FE | done | حتی برای متصل |
| F-HOME-07 | ثبت سریع دقیقه (+۲۵) | FE | done | `onQuickLog` |
| F-HOME-08 | CTA شروع تایمر | FE | done | |
| F-PLAN-01 | مشاهدهٔ برنامه | FE | done | فیلتر بر اساس روز/تاریخ |
| F-PLAN-02 | افزودن/حذف بلوک برنامه | FE | done | برای متصل: `readOnly` — فرم و حذف مخفی |
| F-PLAN-03 | تسک‌ها در تب برنامه | FE + BE | done برای تیک متصل | تصمیم محصول: مشاور بسازد؛ دانش‌آموز فقط تیک. UI مشاور هنوز فرم تسک ندارد |
| F-PLAN-04 | نماهای روزانه / هفتگی / ماهانه | FE | done | `PlanView` — `view: daily\|weekly\|monthly` + `jalaliMonthGrid` |
| F-PLAN-05 | بلوک تکرارشوندهٔ هفتگی vs تاریخ‌دار | FE | done | هفتگی بدون `date`؛ روزانه/ماهانه با `date` |
| F-TIMER-01 | تایمر focus / break | FE | done | `TimerView` |
| F-TIMER-02 | تنظیم مدت focus/break | FE | done | کلیک روی حلقه → `ClockTimeDialog` |
| F-TIMER-03 | ذخیرهٔ جلسه پس از پایان focus | FE | done | → `sessions` |
| F-TIMER-04 | پیشنهاد مدت focus از بلوک برنامه | FE | done | `subjectPartMinutes` |
| F-SUB-01 | فهرست دروس + پیشرفت هدف هفته | FE | done | `SubjectsView` |
| F-SUB-02 | افزودن/حذف درس + ویرایش هدف درس | FE | done | متصل: readOnly |
| F-SUB-03 | ثبت دستی جلسه | FE | done | تاریخ شمسی + مدت + یادداشت؛ ویرایش/حذف جلسهٔ قبلی **نیست** |
| F-SUB-04 | آرشیو درس (`archived`) | FE + BE | done | از پنل مشاور؛ در UI دانش‌آموز فیلتر می‌شود |
| F-MORE-01 | ویرایش نام و هدف هفتگی | FE | done | هدف برای متصل قفل و «تعیین‌شده توسط مشاور» |
| F-MORE-02 | خروجی JSON | FE | done | همهٔ نقش‌های پلنر |
| F-MORE-03 | ورود JSON | FE | done | برای متصل مخفی |
| F-MORE-04 | پاک کردن جلسات دوره | FE | done | برای متصل مخفی |
| F-DATE-01 | تاریخ و هفتهٔ شمسی | FE | done | `utils.ts` |
| F-UI-01 | انتخابگر ساعت/مدت/تاریخ شمسی | FE | done | `ClockPicker`، `ClockTimeDialog`، `DurationField`، `JalaliDatePicker`، `ScheduleTimeField` |
| F-UI-02 | Portal دیالوگ ساعت | FE | partial | `ClockTimeDialog` و ساعت مشاور با `createPortal`؛ `ClockPicker` و `JalaliDatePicker` هنوز داخل درخت والد (ریسک stacking با backdrop) |
| F-SESS-01 | ویرایش/حذف جلسهٔ ثبت‌شده | FE | missing | تصمیم: لازم است |
| F-TASK-01 | اولویت تسک (high/normal/low) | — | missing | تصمیم: لازم است |
| F-TASK-02 | فیلتر تسک (روز/باز/انجام/عقب‌افتاده) | — | missing | تصمیم: لازم است |
| F-REP-01 | گزارش ۳۰ روزه / سطح بر اساس دقیقه | Product | missing | امتیاز = دقیقهٔ ۳۰ روز؛ سطوح نوپا تا پایدار طبق STATUS.md |
| F-REP-02 | پیشنهاد جبرانی عقب‌ماندگی | — | missing | تصمیم: لازم است |
| F-TIMER-05 | ذخیرهٔ دقیقه اگر تمرکز قطع شود | FE | missing | امروز فقط پایان کامل ذخیره می‌شود |

## ۳) رابطهٔ مشاور ↔ دانش‌آموز

| ID | قابلیت | لایه | وضعیت | محل کد / یادداشت |
|----|--------|------|--------|-------------------|
| F-ADV-01 | پنل مشاور جدا | FE | done | `AdvisorDashboard.tsx` |
| F-ADV-02 | ساخت کد دعوت | FE + BE-Demo + BE-Cloud | done | ۷ روز، یک‌بارمصرف |
| F-ADV-03 | کپی کد دعوت | FE | done | clipboard |
| F-ADV-04 | پذیرش کد توسط دانش‌آموز | FE + BE-Demo + BE-Cloud | done | تب بیشتر → `joinAdvisor` / RPC `claim_advisor_invite` / `POST /api/advisor/join` |
| F-ADV-05 | یک مشاور فعال per student | BE-Demo + BE-Cloud | done | unique index جزئی / چک دمو |
| F-ADV-06 | لیست دانش‌آموزان مشاور | FE + BE-Demo + BE-Cloud | done | |
| F-ADV-07 | آمار مطالعهٔ هفته در پنل | FE | done | `minutesThisWeek` روی sessions |
| F-ADV-08 | افزودن بلوک برنامه برای دانش‌آموز | FE + BE-Demo + BE-Cloud | done | `saveAdvisorPlan`؛ **حذف تک‌بلوک در UI مشاور نیست** |
| F-ADV-09 | افزودن درس از پنل مشاور | FE + BE | done | picker با ساخت درس جدید |
| F-ADV-10 | آرشیو/حذف درس از برنامه | FE + BE | done | `archiveSubject`؛ سوابق جلسه حفظ |
| F-ADV-11 | قفل plan/subjects برای دانش‌آموز متصل | FE + BE-Demo + BE-Cloud | done | UI `readOnly` + trigger/RPC ابر + ادغام محدود دمو |
| F-ADV-12 | ذخیرهٔ پیشرفت متصل (جلسه/تایمر/تیک) | FE + BE-Demo + BE-Cloud | done | `saveStudentWorkspace(..., advisorManaged=true)` |
| F-ADV-13 | قطع/پایان رابطه | BE-Cloud schema only | missing | تصمیم: هر دو طرف بتوانند؛ داده بماند و قفل باز شود. API/UI نیست |
| F-ADV-14 | ایمیل دانش‌آموز در لیست مشاور | FE + BE-Demo / BE-Cloud | partial | تصمیم محصول: مشاور ایمیل نبیند (فقط نام). دمو امروز ایمیل می‌فرستد |
| F-ADV-15 | بازخورد مشاور / وضعیت تأیید برنامه | — | missing | تصمیم: یادداشت + تأیید/نیاز به بازبینی |
| F-ADV-16 | شاخص سرعت/وضعیت دانش‌آموز در پنل | — | missing | تصمیم: لازم است |
| F-ADV-17 | CRUD کامل بلوک برنامه توسط مشاور | FE | partial | امروز فقط افزودن؛ بک می‌تواند plan کامل بنویسد |
| F-ADV-18 | جلسهٔ تاریخ‌دار از پنل مشاور | FE | missing | پنل مشاور فقط `day` هفتگی می‌نویسد |
| F-ADV-19 | ساخت تسک توسط مشاور | FE + BE | missing | — |

## ۴) داده و همگام‌سازی

| ID | قابلیت | لایه | وضعیت | محل کد / یادداشت |
|----|--------|------|--------|-------------------|
| F-DATA-01 | مدل AppData v1 | FE + BE | done | JSON واحد در workspace |
| F-DATA-02 | seed نمونه برای مهمان | FE | done | `defaultData()` |
| F-DATA-03 | انتقال دادهٔ مهمان به حساب | FE | partial / منسوخ محصولی | مهمان حذف می‌شود |
| F-DATA-04 | همگام debounce ابری | FE | done | ~۳۵۰ms در `PlannerApp` |
| F-DATA-05 | صف آفلاین / حل تعارض | — | missing | تصمیم: صف آفلاین واقعی |
| F-DATA-06 | نسخهٔ schema migration کلاینت | — | partial | فقط `version: 1` |
| F-DATA-07 | انتخاب بک: API vs دمو | FE | done | پیش‌فرض API خودمان؛ `VITE_TEST_SERVER_URL` مسیر دمو قدیمی |

## ۵) زیرساخت و کیفیت

| ID | قابلیت | لایه | وضعیت | محل کد / یادداشت |
|----|--------|------|--------|-------------------|
| F-INF-01 | اسکریپت dev همزمان فرانت+دمو | Product | done | `npm run dev:demo` → `scripts/dev-demo.mjs` |
| F-INF-02 | build تایپ‌اسکریپت | FE | done | `npm run build` |
| F-INF-03 | lint | FE | done | oxlint |
| F-INF-04 | تست خودکار + CI | — | missing | تصمیم: CI کامل |
| F-INF-05 | Capacitor Android اسکلت | FE | partial | `capacitor.config.ts`: `appId: com.example.app`؛ پوشهٔ `android/` موجود |
| F-INF-06 | PWA manifest | FE | partial | manifest هست؛ نصب‌پذیری غنی هنوز missing |
| F-INF-07 | داک محصول/معماری/roadmap | Product | done | ببین `docs/README.md` |
| F-INF-08 | README بدون تکرار / لینک داک | Product | done | پایه انجام شده؛ جزئیات دمو هنوز در README هست (عمدی برای onboarding) |
| F-INF-09 | migration ابر واحد | BE-Cloud | done در کد / منسوخ محصولی | تصمیم مالک: Supabase کاملاً حذف شود؛ Postgres + API خودمان |
| F-INF-10 | API خودمان به‌جای کلاینت مستقیم ابر | BE | partial | `apps/api`: health/auth/workspace؛ JWT+refresh. مشاور/org/چت هنوز نیست |
| F-INF-11 | شکستن `App.tsx` به فایل‌های فیچر | FE | partial | شِل در `App.tsx`؛ پلنر در `features/planner/PlannerApp.tsx` |
| F-INF-12 | Playwright e2e + تست واحد | Product | partial | واحد password + دود health در `apps/api`؛ Playwright هنوز missing |

## ۶) سازمان، ادمین، چت، پوش (تصمیم محصول — در کد نیست)

| ID | قابلیت | لایه | وضعیت | یادداشت |
|----|--------|------|--------|---------|
| F-ORG-01 | جدول سازمان/شرکت | BE-Cloud | missing | یک مشاور = یک شرکت |
| F-ORG-02 | نقش ادمین کامل | Product | missing | بوت‌استرپ ایمیل مالک؛ رمز در گیت نیست |
| F-ORG-03 | نقش ادمین سطح۲ (مدیر شرکت) | Product | missing | فقط ادمین کامل می‌سازد |
| F-ORG-04 | ساخت مشاور توسط سطح۲ یا کامل | Product | missing | — |
| F-ORG-05 | برند «درس‌یار · نام شرکت» | FE | missing | برای همهٔ کاربران آن سازمان |
| F-ORG-06 | پنل ادمین مسیر جدا | FE | missing | `/admin` |
| F-CHAT-01 | چت یک‌به‌یک متن + فایل | FE + BE | missing | فقط دانش‌آموز↔مشاور متصل؛ ادمین شرکت نمی‌بیند؛ فایل تا ۲۰ مگ |
| F-ORG-07 | دانش‌آموز مستقل بدون سازمان | Product | missing | تا وصل شدن به مشاور، org ندارد |
| F-PUSH-01 | پوش رویدادها | FE + BE | missing | بعد از PWA؛ چت، تغییر برنامه، بازخورد، یادآوری بلوک |
| F-AUTH-10 | کد دعوت اختیاری هنگام ثبت‌نام | FE + BE | missing | خالی=مستقل؛ غلط=مسدود |

## ۷) صریحاً خارج از محدوده

| ID | موضوع | وضعیت |
|----|--------|--------|
| X-STREAK | استریک / عادت مطالعه | خارج — `streakDays` باید از کد حذف شود |
| X-SOCIAL | شبکه اجتماعی | خارج — چت یک‌به‌یک جدا است (F-CHAT-01) |
| X-MULTI-ADV | چند مشاور همزمان برای یک دانش‌آموز | خارج |
| X-ANDROID-STORE | انتشار فروشگاه Android | خارج — فقط اسکلت |
| X-EMAIL-VERIFY | تأیید ایمیل اجباری | خارج برای نسخهٔ جاری |

---

## ماتریس شکاف FE ↔ BE (خلاصهٔ ممیزی)

### در UI هست / رفتار FE دارد ولی بک ناقص یا ناهم‌تراز

| موضوع | FE | BE | اولویت |
|--------|----|----|--------|
| ایمیل دانش‌آموز در لیست مشاور | رندر `email` | دمو OK؛ Cloud خالی می‌ماند | P1 |
| پایان رابطه (`ended`) | ندارد | schema Cloud دارد؛ API/UI ندارد | تصمیم: هر دو طرف؛ موج ۱ |
| Portal کامل pickers | بخشی portal شده | — (فقط FE) | P2 UX |

### در بک هست ولی UI ندارد / ناقص است

| موضوع | BE | FE | اولویت |
|--------|----|----|--------|
| `status: ended` روی `advisor_students` | Cloud schema | بدون دکمه/جریان | تصمیم محصولی |
| ثبت‌نام دانش‌آموز در دمو | endpoint رد می‌کند | UI ثبت‌نام در حالت دمو نشان داده نمی‌شود (`accountSignupEnabled=false`) — هم‌تراز | — |
| حذف تک‌بلوک برنامه توسط مشاور | `save_advisor_plan` می‌تواند plan کامل بازنویسی کند | UI فقط افزودن دارد | P2 موج ۴ |

### عمداً هم‌تراز (شکاف نیست)

- دانش‌آموز متصل: ساخت/حذف plan و subject در UI قفل؛ BE هم اجازه نمی‌دهد.
- دانش‌آموز متصل: ساخت تسک جدید در UI قفل؛ BE فقط `done` ادغام می‌کند.

---

## نحوهٔ به‌روزرسانی

1. فیچر جدید فقط وقتی از روی کد یا تصمیم محصولی تأیید شد، ردیف می‌گیرد.  
2. شکاف FE↔BE با وضعیت `partial` یا `bug` علامت بخورد.  
3. در شروع جلسهٔ ممیزی فیچر، این فایل را با کد diff کنید — حدس نزنید.
