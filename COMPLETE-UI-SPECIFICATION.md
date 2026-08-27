# Sud Billing Lookup — Complete UI Specification

> **Version: v103** | Framework: Next.js 16 + Tailwind CSS 4 + custom CSS classes
> This document describes EVERY visual element, its position, size, spacing, fonts, colors, and icons.
> Designed for an AI agent to understand and reproduce the exact UI.

---

## 1. Global Layout

```
┌─────────────────────────────────────────────────────┐
│                    HEADER (64px)                     │
│  [Logo] Title..........  [Tor badge] [theme] [link]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│                    TABS BAR (centered)               │
│  [To'lovlar] [Sud ishlari] [Sud majlislari]        │
│  [Barcha majlislar] [Kompaniya]                     │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │              TAB CONTENT                     │    │
│  │         (max-width: 1180px, centered)        │    │
│  │         padding: 0 20px (sm: 0 28px)        │    │
│  │         vertical: py-8 (sm: py-12)          │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
├─────────────────────────────────────────────────────┤
│                    FOOTER (mt-auto)                   │
│  Sud Billing Lookup · billing.sud.uz + my.sud.uz    │
└─────────────────────────────────────────────────────┘
```

### Root wrapper
- `<div className="bg-mesh" />` — fixed full-screen background, solid `var(--bg-base)` (#06080d dark / #f0f4f8 light)
- `<div className="shell">` — `min-h-screen flex flex-col`
- Footer uses `mt-auto` to stick to bottom

### Color system (CSS variables)
| Token | Dark | Light |
|---|---|---|
| `--bg-base` | #06080d | #f0f4f8 |
| `--text-primary` | rgba(255,255,255,0.95) | #0f172a |
| `--text-secondary` | rgba(255,255,255,0.60) | #475569 |
| `--text-muted` | rgba(255,255,255,0.36) | #94a3b8 |
| `--border-color` | rgba(255,255,255,0.08) | rgba(148,163,184,0.25) |
| `--accent` | #38bdf8 | #38bdf8 |
| `--bg-surface` | rgba(255,255,255,0.035) | rgba(255,255,255,0.65) |

### Font
- Primary: Inter (Google Fonts), fallback system-ui
- Mono: JetBrains Mono / Geist Mono
- Body: `font-size: 14px` base, `antialiased`

---

## 2. Header

```
┌──────────────────────────────────────────────────────────┐
│ [█]  Sud To'lovlarini Qidiruv          [● Tor faol] [☀] [↗] │
│      billing.sud.uz kvitansiyalarini...                     │
└──────────────────────────────────────────────────────────┘
```

- `position: sticky; top: 0; z-index: 40`
- Height: **64px**
- Background: `var(--header-bg)` (rgba(6,8,13,0.72)) with `backdrop-filter: blur(18px) saturate(140%)`
- Border-bottom: `1px solid var(--border-faintest)`
- Bottom shimmer line: 1px gradient (cyan→indigo→cyan), animated sweep, **12s** duration, opacity 0.6

### Left: Brand
- `.brand-mark` — 40×40px, border-radius 12px, gradient bg, LayoutGrid icon (20px, cyan #38bdf8)
- `.brand-title` — 15px, font-weight 700, letter-spacing -0.02em, `text-primary`
- `.brand-sub` — 11px, `text-muted`, hidden on mobile (shown sm+)

### Right: Header actions (gap: 10px)
- `.tor-badge` — pill, 32px height, padding 0 14px, green border/bg, pulsing dot + "Tor faol" (or "Tor aniqlanmadi" in amber if inactive)
- `.theme-toggle` — 36×36px circle, Sun/Moon icon (16px), hover: cyan bg
- `.ext-link` — pill, 12px text, "billing.sud.uz" + ExternalLink icon (12px)

---

## 3. Tabs Bar

```
        ┌─────────────────────────────────────────────────────┐
        │ [To'lovlar] [Sud ishlari] [Sud majlislari] [Barcha majlislar] [Kompaniya] │
        └─────────────────────────────────────────────────────┘
```

- Container: `flex justify-center sm:justify-start mb-8`
- `.tabs-bar` — inline-flex, gap 4px, padding 5px, border-radius 999px, bg `var(--bg-surface-ghost)`, border `1px solid var(--border-faintest)`, inset shadow
- `.tab-pill` — absolute positioned sliding indicator, gradient (cyan→indigo), border-radius 999px, transition 0.45s cubic-bezier(0.16,1,0.3,1)

### Each tab button (`.tab-btn`)
- Height: min 42px, padding: 10px 20px
- Font: 13.5px, weight 600, letter-spacing -0.01em
- Color: `text-secondary` (inactive) / white on gradient (active)
- Icon: 18px (Lucide), gap 8px from text
- Border-radius: 999px
- Active state: `.is-active` — text white, cyan glow shadow

### Tab icons
| Tab | Icon |
|---|---|
| To'lovlar | Receipt |
| Sud ishlari | Gavel |
| Sud majlislari | CalendarDays |
| Barcha majlislar | CalendarDays |
| Kompaniya | Building2 |

---

## 4. Card System

### `.bento` (standard card)
- Background: `var(--bg-surface)` with `backdrop-filter: blur(16px) saturate(140%)`
- Border: `1px solid var(--border-color)`
- Border-radius: 20px
- Shadow: `inset 0 1px 0 0 var(--border-faint), 0 4px 24px var(--shadow)`
- Padding: typically `p-5 sm:p-6` (20px / 24px)
- Hover (`.bento-hover`): translateY(-2px), border cyan-tint, deeper shadow

### `.bento-strong` (hero card)
- Background: gradient `rgba(255,255,255,0.045) → rgba(255,255,255,0.02)`
- Border: `1px solid transparent` (iridescent conic gradient border via ::before, animated 8s — **NOTE: removed in v80, replaced with static top-tint gradient**)
- Border-radius: 24px
- Backdrop-filter: blur(24px) saturate(160%)
- Shadow: `inset 0 1px 0 0 var(--border-strong), 0 8px 32px var(--shadow-soft)`
- Padding: `p-8 sm:p-10` (32px / 40px)

### `.bento-grid-4` (feature cards grid)
- Grid: 1 col → 2 cols (md) → 4 cols (xl)
- Gap: 14px

### `.bento-grid-6` (summary cards grid)
- Grid: 2 cols → 3 cols (md) → 6 cols (xl)
- Gap: 12px

---

## 5. Typography Scale

| Class | Size | Weight | Letter-spacing | Usage |
|---|---|---|---|---|
| `.h-display` | clamp(28px, 4.5vw, 44px) | 800 | -0.035em | Hero headings |
| `.h-eyebrow` | 11px | 700 | 0.14em, uppercase | Small label above hero |
| `.h-section` | 13px | 700 | 0.06em, uppercase | Section dividers |
| Body text | 14px | 400-500 | normal | Cards, info rows |
| Small text | 13px | 400-600 | normal | Descriptions |
| Tiny text | 11-12px | 600 | 0.04em, uppercase | Labels in info-rows |
| Mono text | 14-15px | 700 | -0.02em | Case numbers, amounts |

---

## 6. Component Library

### `.input` (text input)
- Height: 48px, padding: 0 18px, border-radius: 999px
- Background: `var(--bg-surface-tint)`
- Border: `1px solid var(--border-color)`
- Focus: cyan border + 4px cyan glow ring
- `.input-mono` — JetBrains Mono, tabular-nums, letter-spacing 0.04em

### `.btn-primary`
- Height: 48px, padding: 0 22px, border-radius: 999px
- Background: solid `#38bdf8` (cyan)
- Color: white
- Font: 14px, weight 700
- Shadow: `0 8px 28px rgba(56,189,248,0.35)`
- Hover: brighter gradient + deeper shadow
- Active: scale(0.97)

### `.btn-ghost`
- Height: 38px, padding: 0 16px, border-radius: 999px
- Background: `var(--bg-surface)` with backdrop-filter
- Border: `1px solid var(--border-color)`
- Hover: brighter bg + subtle cyan glow

### `.btn-icon`
- 32×32px circle, border-radius: 999px
- Background: `var(--bg-surface-tint)`
- Hover: cyan bg + cyan border

### `.korish-btn`
- Height: 28px, padding: 0 12px, border-radius: 999px
- Background: `rgba(56,189,248,0.10)`
- Border: `1px solid rgba(56,189,248,0.25)`
- Color: #38bdf8, font: 12px weight 600

### `.chip` (filter chip)
- Height: 32px, padding: 0 12px, border-radius: 999px
- Background: `var(--bg-surface-ghost)`
- Border: `1px solid var(--border-color)`
- Active (`.is-active`): cyan tint bg + cyan border + cyan text

### `.badge` (status badge)
- Height: 26px, padding: 0 11px, border-radius: 999px
- Font: 11.5px, weight 600
- Color variants: `.b-paid` (emerald), `.b-unpaid` (cyan), `.b-partial` (indigo), `.b-cancelled` (rose), `.b-used` (teal), `.b-mib` (violet), `.b-accent` (light cyan), `.b-neutral` (gray)
- Court type variants: `.b-court-econ` (emerald), `.b-court-civ` (cyan), `.b-court-crim` (rose), `.b-court-adm` (violet)

### `.select-wrap` (dropdown)
- Native `<select>` with custom styling
- Height: 40px, padding: 0 40px 0 16px, border-radius: 999px
- Glass background + backdrop-filter
- Custom arrow (CSS border triangle) on right

### `.info-row` (label + value)
- Background: `var(--bg-surface-faint)`, border-radius: 14px, padding: 12px 14px
- Label: 10.5px uppercase, weight 600, letter-spacing 0.04em, `text-muted`, with 12px icon
- Value: 14px, weight 500, `text-primary`, word-break
- `.value.mono` — JetBrains Mono, tabular-nums

### `.money-cell` (bill card money display)
- Border-radius: 14px, padding: 12px 14px
- Background: gradient `var(--bg-surface-tint) → var(--bg-surface-faint)`
- Label: 10.5px uppercase + 12px icon
- Value: JetBrains Mono, weight 700, 20px+ font size
- Variants: `.is-paid` (emerald tint), `.is-unpaid` (cyan tint), `.is-accent` (cyan tint)

### `.detail-grid` (case detail definition list)
- Grid: 2 columns (1 on mobile)
- `<dl>` with `<dt>` (label, 11px uppercase) and `<dd>` (value, 14px)
- Border lines between rows
- Background: `var(--bg-surface-faint)`, border-radius: 16px

### `.hearing-timeline`
- Vertical timeline, padding-left: 20px
- Vertical line: 2px, `var(--border-color)`
- `.hearing-dot` — 12px circle, cyan, with glow
- `.hearing-content` — flex column, gap 4px

### `.decision-bar`
- Flex row, padding: 12px 14px, border-radius: 14px
- Background: `rgba(56,189,248,0.06)`
- Left border: 3px solid #38bdf8
- `.decision-icon` — 28×28px, cyan bg, 16px icon
- `.decision-text` — flex column, gap 2px

### `.page-btn` (pagination)
- 36×36px circle, border-radius: 999px
- Font: 13px weight 600
- Active: cyan tint

### `.phase-step` (loading timeline)
- Height: 28px, padding: 0 10px, border-radius: 999px
- Font: 11.5px weight 600
- States: default (muted), `.is-current` (cyan tint), `.is-done` (emerald tint)

### `.svg-spin` (loading spinner)
- 28×28px SVG, cyan arc on faint circle
- Animation: `svgSpin 0.7s linear infinite`
- Defined OUTSIDE `@layer` with `!important` to guarantee animation

---

## 7. Tab Content — Detailed Layout

### Tab 1: To'lovlar (Bills)

```
┌─────────────────────────── BENTO-STRONG (hero) ──────────────────────────┐
│                                                                            │
│  O'ZBEKISTON · BILLING.SUD.UZ                        (eyebrow, 11px)       │
│  Kompaniya nomiga                                      (h-display, 32-44px)│
│  chiqarilgan barcha                                                        │
│  to'lovlarni import qiling                                                │
│                                                                            │
│  Kompaniyaning STIR raqamini kiriting...   (14px, text-secondary)         │
│                                                                            │
│  ┌──────────────────────────────────┐  ┌─────────────────────┐            │
│  │ 🔍  STIR raqamini kiriting...    │  │  📋 To'lovlarni qidirish │        │
│  │     (input, 48px, mono)          │  │     (btn-primary, 48px)│          │
│  └──────────────────────────────────┘  └─────────────────────┘            │
│                                                                            │
│  Sinab ko'ring: [302 678 824] [305 543 087] [301 201 019]  (chips)       │
│                                                                            │
│  ── STIR/Kvitansiya toggle ──  (two pills, cyan active)                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

After search:
┌─── BENTO (INN bar) ──────────────────────────────────────────────────────┐
│ [🏢] Kompaniya STIR raqami                    Jami: 5  [🔄 Yangilash]    │
│      302 678 824                              [📋]                       │
└──────────────────────────────────────────────────────────────────────────┘

┌─── H-SECTION: "Xulosa" ──────────────────────────────────────────────────┐
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│ │Jami    │ │To'langan│ │To'lanm.│ │Jami    │ │Jami    │ │Qarzdor.│      │
│ │  5     │ │   3    │ │   2    │ │summa   │ │to'lang.│ │        │      │
│ │(count) │ │(green) │ │(cyan)  │ │(money) │ │(money) │ │(money) │      │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘      │
│ (bento-grid-6, count-up animation, 12px gap)                             │
└──────────────────────────────────────────────────────────────────────────┘

┌─── BENTO (sort/filter bar) ──────────────────────────────────────────────┐
│ Saralash: [▼ Avval yangi]  │  [● To'langan] [● To'lanmagan] [● Davlat   │
│                            │   boji] [● Pochta]         [▼ 10 / sahifa] │
└──────────────────────────────────────────────────────────────────────────┘

┌─── BILL CARD (bento, p-5 sm:p-6) ───────────────────────────────────────┐
│ #1  📋 261753146413  [📋]                              [Iqtisodiy]      │
│     🏢 "O'ZBEKISTON TEMIR YO'LLARI" AJ                 [Davlat boji]     │
│                                                         [To'liq to'langan]│
│                                                                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │Kvitansiya│ │To'langan │ │To'lanm.  │ │Sarflangan│ │Qoldiq    │       │
│ │170 286   │ │170 286   │ │0         │ │170 286   │ │0         │       │
│ │so'm      │ │so'm      │ │so'm      │ │so'm      │ │so'm      │       │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│ (grid-cols-2 sm:grid-cols-5, gap-2.5, money-cell)                       │
│                                                                           │
│ [🏢] Sud                [📅] Berilgan sana    [📜] Amal qilish           │
│      Toshkent...              27 Oct 2023         muddati                │
│      birinchi instansiya                           17 Nov 2023            │
│ (grid-cols-1 sm:grid-cols-3, gap-3, mt-4)                               │
│                                                                           │
│ [📜] Maqsad: Даъво аризаси кўриб чиқиш учун давлат божи                 │
│      Turi: Давлат божи (Государственная пошлина)                         │
│ (mt-4, text-sm)                                                          │
│                                                                           │
│ [▼ Sud tomonidan ishlatilishi (1)]                    (btn-ghost, expand)│
│   ┌─ expand content ────────────────────────────────────────────────┐   │
│   │ № Da'vo ish raqami: 4-1001-2603/42003  [📋] [👁 Ko'rish]       │   │
│   │ ┌──────────────────┬─────────────┬──────────────────┐           │   │
│   │ │ Ish / ariza raqami│ Holati      │ Summasi          │           │   │
│   │ │ 4-1001-2603/42003 │ [Used]     │ 170 286 so'm     │           │   │
│   │ │ [👁 Ko'rish]      │            │                  │           │   │
│   │ └──────────────────┴─────────────┴──────────────────┘           │   │
│   │ (usage-table)                                                    │   │
│   └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

[← 1] [2] [3] [→]  (page-btn, centered, gap-2)
```

### Tab 2: Sud ishlari (Court Cases)

```
┌─── BENTO-STRONG (hero) ──────────────────────────────────────────────────┐
│  O'ZBEKISTON · MY.SUD.UZ                                                 │
│  Sud ishlarini qidiring                                                   │
│  (description)                                                            │
│                                                                           │
│  SUD TURI              QIDIRUV USULI                                      │
│  [▼ Iqtisodiy sudlar]  [▼ STIR bo'yicha]                                 │
│  (grid-cols-2, gap-3, each with label + select-wrap)                     │
│                                                                           │
│  [🔍 9 xonali STIR...]  [🔍 Ishlarni qidirish]                          │
└──────────────────────────────────────────────────────────────────────────┘

Default state: bento-grid-4 with 4 feature cards (FolderOpen, Search, CalendarDays, FileText)

After search:
┌─── BENTO (results bar) ──────────────────────────────────────────────────┐
│ [📁] Topilgan ishlar        [▼ Avval yangi] [▼ Barcha holatlar]         │
│      2 ta sud ishi                                                        │
└──────────────────────────────────────────────────────────────────────────┘

┌─── COURT CASE CARD ──────────────────────────────────────────────────────┐
│ #1  📁 4-1001-2603/42003  [📋]                       [Ish yurituvda]    │
│     📄 Иқтисодий низо                                                      │
│                                                                           │
│ [🏢] Sud              [📅] Ariza berilgan sana                            │
│      Toshkent tumanlararo      27.10.2023                                 │
│ [🏢] Da'vogar         [🏢] Javobgar                                       │
│      "O'ZBEKISTON TEMIR..."       "TRANS LOGISTICS" MChJ                   │
│ (grid-cols-1 sm:grid-cols-2, gap-3, info-rows)                           │
│                                                                           │
│ [🏆] Natija: Тўлиқ қаноатлантирилган     (decision-bar, cyan)            │
│                                                                           │
│ [▼ Tafsilotlarni ko'rish]                            (btn-ghost, expand) │
│   ┌─ detail-panel ────────────────────────────────────────────────────┐  │
│   │  📄 UMUMIY MA'LUMOTLAR                                             │  │
│   │  ┌─────────────────┬──────────────────────────────────────────┐   │  │
│   │  │ Sud             │ Toshkent tumanlararo iqtisodiy sudi     │   │  │
│   │  │ Ish raqami      │ 4-1001-2603/42003                       │   │  │
│   │  │ Ish turi        │ Иқтисодий низо                          │   │  │
│   │  │ Ish holati      │ Ish yurituvda                           │   │  │
│   │  │ Sudya           │ АЛИМАРДАНОВ САРДОР...                   │   │  │
│   │  │ ...             │ ...                                      │   │  │
│   │  └─────────────────┴──────────────────────────────────────────┘   │  │
│   │  (detail-grid, dl/dt/dd)                                          │  │
│   │                                                                    │  │
│   │  📋 BIRINCHI INSTANSIYA · 1 ta majlis, 0 ta hujjat               │  │
│   │  ● 04.04.2026 · 10:30  [Якунланган]                              │  │
│   │  │  Sud zali: —                                                    │  │
│   │  │  Sudya: ИБРАГИМОВА...                                          │  │
│   │  (hearing-timeline)                                               │  │
│   │                                                                    │  │
│   │  [🏆] Qaror: Тўлиқ қаноатлантирилган                             │  │
│   │  Sana: 02.04.2026                                                 │  │
│   │  (decision-bar)                                                   │  │
│   └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│ [Sahifa: 10/sahifa]  [← 1] [2] [→]  (pagination)                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tab 3: Sud majlislari (Upcoming Hearings)

```
┌─── BENTO-STRONG (hero) ──────────────────────────────────────────────────┐
│  O'ZBEKISTON · MY.SUD.UZ                                                 │
│  Rejalashtirilgan sud majlislari                                         │
│  (description)                                                            │
│                                                                           │
│  [STIR input] [Name input] [Saqlash button]                              │
│  (grid-cols-3 on sm)                                                      │
└──────────────────────────────────────────────────────────────────────────┘

┌─── H-SECTION: "Saqlangan kompaniyalar (N)" ──────────────────────────────┐
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│ │ Company A  │ │ Company B  │ │ Company C  │ │ Company D  │             │
│ │ 302 678 824│ │ 305 543 087│ │ 301 201 019│ │            │             │
│ │ [🗑]        │ │ [🗑]        │ │ [🗑]        │ │            │             │
│ │ (selected:  │ │             │ │             │ │            │             │
│ │  ● Tanlangan)│ │            │ │             │ │            │             │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘             │
│ (bento-grid-4, clickable cards)                                          │
└──────────────────────────────────────────────────────────────────────────┘

After clicking a company:
┌─── BENTO (results bar) ──────────────────────────────────────────────────┐
│ [📅] Rejalashtirilgan sud majlislari    [🔄 Yangilash]                  │
│      302 678 824 · 2 ta majlis                                           │
└──────────────────────────────────────────────────────────────────────────┘

┌─── HEARING CARD ─────────────────────────────────────────────────────────┐
│ #1  📁 4-1001-2603/42003  [📋] [👁 Ko'rlish]      [Iqtisodiy sud]      │
│     Иқтисодий низо · Ish yurituvda                                       │
│                                                                           │
│ [📅] Majlis sanasi    [🏢] Sud                                           │
│      15.07.2026 · 10:30    Toshkent...                                   │
│ [⚖] Sudya            [👥] Tomonlar                                      │
│      АЛИМАРДАНОВ...        D: "O'ZBEKISTON..."                           │
│                             J: "TRANS LOGISTICS"                         │
│ (grid-cols-1 sm:grid-cols-2, gap-3, info-rows)                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tab 4: Barcha majlislar (All Hearings — jadval2)

```
┌─── BENTO-STRONG (hero) ──────────────────────────────────────────────────┐
│  O'ZBEKISTON · jadval2.sud.uz                                            │
│  Barcha sud majlislari                                                    │
│  (description: orginfo → court map → jadvalapi)                          │
│                                                                           │
│  [🔍 STIR input]  [▼ 30 kun]  [🔍 Qidirish]                             │
│  (flex row: input + date selector + button)                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─── BENTO (company + court info) ─────────────────────────────────────────┐
│ [🏢] Kompaniya           [🏢] Manzil                                     │
│      "ANDIJONKABEL"           Andijon viloyati, Xonobod...               │
│ [⚖] Sud                                                              │
│      Қўрғонтепа туманлараро суди                                         │
│ ─────────────────────────────────────────────────────────────────────── │
│ Boshqa sudni tanlang:                                                   │
│ [Андижон вилоят суди] [Андижон туманлараро] [Асака] [Бўстон] ...        │
│ (chips, clickable to re-search with different court)                     │
└──────────────────────────────────────────────────────────────────────────┘

┌─── LOADING ──────────────────────────────────────────────────────────────┐
│ [⟳] Kompaniya manzili bo'yicha sud majlislari qidirilmoqda…            │
│     orginfo.uz → sudni aniqlash → jadvalapi.sud.uz (30 kun × 3 sud turi)│
└──────────────────────────────────────────────────────────────────────────┘

┌─── RESULTS BAR ──────────────────────────────────────────────────────────┐
│ 3 ta sud majlisi topildi                    Қўрғонтепа туманлараро суди  │
└──────────────────────────────────────────────────────────────────────────┘

┌─── HEARING CARD ─────────────────────────────────────────────────────────┐
│ #1  📁 2-1701-2505/78930  [📋]    [Da'vogar] [Fuqarolik] [Birinchi ins.]│
│     Никоҳдан ажратиш                                                      │
│                                                                           │
│ [📅] Sana               [⚖] Sudya                                        │
│      09.07.2026 · 10:30     АРАББОЕВ ШЕРЗОДБЕК...                       │
│ [🏢] Da'vogar           [🏢] Javobgar        (highlighted if match)      │
│      USMONOV ELYORBEK...     USMONOVA DILRABOXON...                      │
│ (grid-cols-1 sm:grid-cols-2, gap-3, info-rows)                           │
│ (green border/bg if company is plaintiff, red if defendant)              │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tab 5: Kompaniya (Company Info)

```
┌─── BENTO-STRONG (hero) ──────────────────────────────────────────────────┐
│  O'ZBEKISTON · orginfo.uz + chamber.uz                                   │
│  Kompaniya ma'lumotlari                                                   │
│  (description: orginfo + chamber.uz rating)                              │
│                                                                           │
│  [🔍 STIR input]  [🔍 Ma'lumot olish]                                   │
│  Sinab ko'ring: [302 678 824] [305 543 087] [301 201 019]              │
└──────────────────────────────────────────────────────────────────────────┘

┌─── RATING CARD (bento, prominent) ───────────────────────────────────────┐
│                                                                           │
│                    93 / 100                                               │
│                    (5xl font, bold, emerald color)                       │
│                    [AA]  (badge, emerald)                                │
│                    Yuqori (rating label)                                 │
│                                                                           │
│ [💰] Soliq turi: SDT (Large Taxpayer)                                   │
│ [📍] Hudud: Toshkent shahri, Yangihayot tumani                          │
│ (info-rows, sm:grid-cols-2)                                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─── H-SECTION: "Asosiy ma'lumotlar" ──────────────────────────────────────┐
│ [🏢] Nomi:          "ARTIKUL AZIYA KABEL" MChJ QK                       │
│ [#]  STIR:         302678824  [📋]                                      │
│ [📍] Manzil:       Toshkent sh., Yangihayot tumani...                    │
│ [👤] Direktor:     (director name)                                       │
│ [✓]  Holati:       Hozirda mavjud                                        │
│ [📅] Ro'yxatdan:   08.04.1996                                           │
│ [💰] Ustav fondi:  (capital amount)                                      │
│ [📞] Telefon:      (phone)                                               │
│ [✉]  Email:        (email)                                               │
│ (info-rows, grid-cols-1 sm:grid-cols-2, gap-3)                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─── H-SECTION: "Faoliyat" ────────────────────────────────────────────────┐
│ [🏷] OKED kodi:    24440                                                 │
│ [📄] Faoliyat:     MIS ISHLАB CHIQАRISH                                 │
│ [📐] Bo'lim:       C (Metallurgy)                                        │
│ (info-rows)                                                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─── H-SECTION: "Ta'sischilar" ────────────────────────────────────────────┐
│ ● 100% — Alimov Muxtor Toxirovich                                       │
│ ● 50%  — (founder 2 name)                                               │
│ (list with ownership %)                                                  │
└──────────────────────────────────────────────────────────────────────────┘

┌─── QUICK ACTIONS (bento-grid-4) ─────────────────────────────────────────┐
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │ [⚖]          │ │ [📋]         │ │ [📅]         │ │ [↗]          │    │
│ │ Sud ishlari  │ │ To'lovlar    │ │ Majlislar    │ │ orginfo.uz   │    │
│ │ (btn-ghost)  │ │ (btn-ghost)  │ │ (btn-ghost)  │ │ (ext-link)   │    │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘    │
│ (clicking switches to the respective tab)                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Loading States

### Bills loading (before first bill arrives)
```
┌─── BENTO (border-dashed, loading-pulse) ────────────────────────────────┐
│ [⟳] STIR 302 678 824 qidirilmoqda…                                      │
│     billing.sud.uz saytida Yuridik shaxs bo'limi ochilmoqda.            │
│     3s o'tdi                                                              │
│                                                                           │
│ [Ulanmoqda] — [Kirish tekshirilmoqda] — [To'lovlar qidirilmoqda]       │
│ [—] [Tafsilotlar olinmoqda]                                             │
│ (phase-step timeline, 4 steps)                                           │
│                                                                           │
│ 0 / 5 ta to'lov yuklandi                              0%                │
│ [████████████████████████████] (progress-fill)                           │
└──────────────────────────────────────────────────────────────────────────┘
+ 6 skeleton cards (shimmer animation)
```

### After first bill arrives (progressive loading)
```
┌─── SLIM PROGRESS BAR ────────────────────────────────────────────────────┐
│ [⟳] To'lovlar yuklanmoqda…           3/5 · 12s                          │
│ [████████████░░░░░░░░] (progress-fill, 60%)                             │
└──────────────────────────────────────────────────────────────────────────┘
(bills appear below as they stream in)
```

---

## 9. Icon System

All icons from **Lucide React** (stroke-width: 2, currentColor):

| Icon | Usage |
|---|---|
| LayoutGrid | Brand logo |
| Receipt | Bills tab, bill card header |
| Gavel | Cases tab, court, judge |
| CalendarDays | Hearings tabs, dates |
| Building2 | Company tab, company name, addresses |
| Search | Search inputs |
| Copy | Copy buttons |
| Eye | Ko'rish buttons |
| ChevronDown | Expand/collapse |
| ChevronLeft/Right | Pagination |
| RefreshCw | Refresh buttons |
| Sun/Moon | Theme toggle |
| ExternalLink | External links |
| FolderOpen | Case numbers |
| FileText | Case types, documents |
| Wallet | Money amounts |
| CheckCheck | Paid status |
| Clock | Unpaid status, time |
| ArrowLeftRight | Balance |
| ShieldCheck | Security, captcha |
| Award | Results, decisions |
| Scale | MIB, justice |
| Users | Founders, parties |
| AlertCircle | Errors, warnings |
| Info | Info badges |
| Trash2 | Delete buttons |
| Loader2 | (replaced by SvgSpinner) |

---

## 10. Data Flow — How Tabs Connect

```
                    ┌─────────────────┐
                    │   USER ENTERS   │
                    │   STIR NUMBER   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌──────────────┐ ┌───────────┐ ┌──────────────┐
     │  TAB 1:      │ │  TAB 2:   │ │  TAB 5:      │
     │  To'lovlar   │ │  Sud      │ │  Kompaniya   │
     │              │ │  ishlari  │ │              │
     │  billing.    │ │  my.sud.  │ │  orginfo.uz  │
     │  sud.uz      │ │  uz       │ │  chamber.uz  │
     │              │ │           │ │              │
     │  NDJSON      │ │  jadval.  │ │  Company     │
     │  stream      │ │  sud.uz   │ │  details +   │
     │              │ │           │ │  rating      │
     │  Bills with  │ │  Cases    │ │              │
     │  case nums   │ │  with     │ │  Quick       │
     │  ───────────►│ │  hearings │ │  actions ───►│
     │              │ │  ────────►│ │  to other    │
     │              │ │           │ │  tabs        │
     └──────────────┘ └───────────┘ └──────────────┘
              │              │
              │              │
              ▼              ▼
     ┌──────────────┐ ┌───────────────────┐
     │  TAB 3:      │ │  TAB 4:           │
     │  Sud         │ │  Barcha           │
     │  majlislari  │ │  majlislar        │
     │              │ │                   │
     │  my.sud.uz   │ │  jadval2.sud.uz   │
     │  (upcoming)  │ │  (all past+future)│
     │              │ │                   │
     │  Saved       │ │  orginfo → court  │
     │  companies   │ │  map → jadvalapi  │
     │  → hearings  │ │  → scan dates     │
     │              │ │  → filter by name │
     └──────────────┘ └───────────────────┘
```

### Connection flows:
1. **Bill → Case**: Bill card shows case number → "Ko'rish" button → switches to Tab 2 (Sud ishlari) and auto-searches that case number
2. **Case → Hearings**: Case card expand shows hearing timeline (from case detail API)
3. **Company → Cases**: Company tab "Sud ishlari" quick-action → switches to Tab 2 with STIR pre-filled
4. **Company → Bills**: Company tab "To'lovlar" quick-action → switches to Tab 1 with STIR pre-filled
5. **Company → Hearings**: Company tab "Majlislar" quick-action → switches to Tab 3
6. **Case status → MIB**: Cases with status "Ижро варақа билан" indicate MIB involvement (feature removed in v98, documented in MIB-COMPLETE-WORKFLOW.md)

---

## 11. Responsive Breakpoints

| Breakpoint | Width | Changes |
|---|---|---|
| Mobile | <640px | Single column, tabs scrollable, brand-sub hidden, inputs full width |
| sm | ≥640px | Two-column grids start, brand-sub visible, padding increases |
| md | ≥768px | Feature card grids 2 cols, summary grids 3 cols |
| lg | ≥1024px | No specific changes (uses md/xl) |
| xl | ≥1100px | Feature cards 4 cols, summary cards 6 cols |

### Mobile-specific:
- Tabs bar: `justify-center` (centered on mobile, left-aligned on sm+)
- Money cells: `grid-cols-2` (5 cells wrap to 2+2+1)
- Info rows: `grid-cols-1` (stacked)
- Detail grid: `grid-cols-1` (stacked, border-right removed)
- Form inputs: full width, stacked vertically

---

## 12. Animation System

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| `fadeUp` | 0.5s | cubic-bezier(0.16,1,0.3,1) | Card entrance, staggered 0.06s per card |
| `tabFadeIn` | 0.3s | cubic-bezier(0.16,1,0.3,1) | Tab panel switch |
| `svgSpin` | 0.7s | linear, infinite | Loading spinner |
| `headerSweep` | 12s | linear, infinite | Header bottom line shimmer |
| `shimmer` | 1.6s | linear, infinite | Skeleton cards |
| `glowPulse` | 3s | ease-in-out, infinite | Loading card glow |
| `pulse-dot` | 2s | ease-in-out, infinite | Tor badge green dot |
| `slideDown` | 0.4s | cubic-bezier(0.16,1,0.3,1) | Expand/collapse content |
| `progressFlow` | 2s | linear, infinite | Progress bar gradient flow |
| `count-up` | 0.8s | easeOutCubic | Summary card numbers |

### `prefers-reduced-motion`:
All animations reduced to 0.001ms duration.
