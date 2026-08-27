# myorg.uz + chamber.uz — Research Findings

> **STATUS: RESEARCH COMPLETE.** chamber.uz API discovered and working.
> myorg.uz is behind Cloudflare + paid — not usable.

---

## 1. myorg.uz — NOT USABLE (Cloudflare + Paid)

### Findings:
- **Cloudflare challenge** (HTTP 403 "Just a moment...") blocks all non-browser requests
- Even with full browser headers, returns 403 — needs JavaScript challenge solving
- Company pages (e.g. `/en/company/uz/806675`) show:
  - Basic info (name, TIN, registration date, status, statutory fund, director, category)
  - Founders (with ownership %)
  - Court case counts (but details hidden)
  - "Part of the data is hidden" — contacts, ratings, licenses, real estate, etc. require **paid subscription**
- **API**: Paid only ("Direct access to data via API" — contact +998 93 828 85 65)
- **Tariffs**: Paid plans, no free tier

### What we can get for free (from page_reader):
- Company name, TIN, registration date, status
- Statutory fund amount
- Enterprise category (Microcompany, Small, etc.)
- Type of taxation
- Founder names + ownership %
- Industry code (OKED) + description
- Statistical codes (SOOGU, SOATO, OKPO)
- Court case statistics (counts only — plaintiff vs defendant, fully/partially satisfied)

### What's hidden (░░░░░░):
- Contacts (phone, email, address details)
- Stability rating
- Tax debt
- Large taxpayer status
- License info
- IT Park residency
- Government procurement participation
- Real estate
- Transport
- Customs data
- Full court case details

### Verdict: NOT WORTH IT. The free data we can get is the same as orginfo.uz already provides.

---

## 2. chamber.uz — USABLE! Free API discovered ✅

### The API:
```
GET https://admin.chamber.uz/api/GetCompanyCriteries/{STIR}
```

**No authentication required.** Returns rich company data including contractor rating.

### Tested with STIR 302678824:

```json
{
  "name": "\"ARTIKUL AZIYA KABEL\" MAS'ULIYATI CHEKLANGAN JAMIYAT QO`SHMA KORXONA",
  "tin": "302678824",
  "criteriaAll": 93,          // Total rating score (out of 100)
  "type": "AA",               // Rating category (AAA, AA, A, BBB, BB, B, CCC, CC, C)
  "taxpayerType": 2,
  "taxpayername": "SDT",      // Tax type (SDT = Large Taxpayer)
  "regionNameUz": "Тошкент шаҳри",
  "regionNameLat": "Toshkent shahri",
  "districtNameUz": "Yangihayot tumani",
  "districtNameLat": "Yangihayot tumani",
  "okedDetail": {
    "code": "24440",
    "name": "MIS ISHLАB CHIQАRISH",
    "name_ru": "ПРОИЗВОДСТВО МЕДИ",
    "section": "C",
    "name_short_ru": "Производство металлургической продукции",
    "employee_limit_mf": 20,
    "employee_limit_lf": 50
  }
}
```

### Rating categories (from /api/main/cat_rating):
| Score | Rating | Category |
|---|---|---|
| 96-100 | AAA | Yuqori (High) |
| 91-95 | AA | Yuqori |
| 86-90 | A | Yuqori |
| 76-85 | BBB | O'rta (Average) |
| 66-75 | BB | O'rta |
| 56-65 | B | O'rta |
| 51-55 | CCC | Qoniqarli (Satisfactory) |
| 36-50 | CC | Qoniqarli |
| 26-35 | C | Qoniqarli |
| 0-25 | D | Quyi (Low) |

### What we get for FREE:
- ✅ Company name (Uz, Ru, Latin)
- ✅ TIN/STIR
- ✅ **Contractor rating score** (0-100) + category (AAA-D)
- ✅ **Taxpayer type** (Large taxpayer status)
- ✅ Region + district (with names in 3 languages)
- ✅ OKED code + industry name (3 languages)
- ✅ Industry section
- ✅ Employee limits (for micro/small business classification)

### Other working endpoints:
- `GET /api/main/cat_rating` — returns rating category definitions
- `GET /api/main/check_inn?inn=XXX` — returns paginated results (empty for 302678824, might work for rated companies)
- `GET /api/search?query=XXX` — searches news articles (not companies)
- `GET /api/rating` — returns rating category definitions

### How the page works:
The chamber.uz contractor-rating page is a Nuxt 3 SPA. When a user enters a STIR:
1. JavaScript calls `GET https://admin.chamber.uz/api/GetCompanyCriteries/{STIR}`
2. The response includes the rating score + category
3. The page displays a rating card with the score, category, and company info

---

## 3. Recommendation: New "Kompaniya ma'lumotlari" tab

### What to build:
A new tab that combines data from multiple free sources:

| Source | What it provides | Cost |
|---|---|---|
| **orginfo.uz** | Company name, TIN, address, director, founders, phone, email, registration date, status, capital, industry codes | Free |
| **chamber.uz** | Contractor rating (0-100 + AAA-D category), taxpayer type, region/district | Free |
| **jadval.sud.uz** | Court cases (from existing integration) | Free |
| **billing.sud.uz** | Court payment bills (from existing integration) | Free |
| **jadval2.sud.uz** | Court hearing schedule (from existing integration) | Free |

### Flow:
1. User enters STIR
2. App fetches from orginfo.uz (company details)
3. App fetches from chamber.uz (contractor rating)
4. App displays a comprehensive company profile:
   - Basic info (name, TIN, address, director, status, registration date)
   - Contractor rating card (score + category + color)
   - Taxpayer type
   - Founders + ownership
   - Industry info
   - Contact info
   - Quick links: "View court cases" / "View bills" / "View hearings"

### Why this is valuable:
- One-stop company verification — no need to visit 5 different sites
- The contractor rating from chamber.uz is normally only available on their website
- Combining orginfo + chamber.uz gives a complete picture of any company
- All data is free — no paid APIs needed

---

## 4. Implementation plan

1. Add `chamber.uz` to CF worker ALLOWED_HOSTS
2. Create `src/lib/chamber.ts` — fetch company rating from chamber.uz API
3. Create `/api/company-info?tin=XXX` — orchestrates orginfo + chamber.uz
4. Add new tab "Kompaniya ma'lumotlari" with the combined view
5. Display rating card, company details, and quick-links to other tabs
