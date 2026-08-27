# jadval2.sud.uz — Court Hearing Schedule Integration

> **STATUS: RESEARCH COMPLETE.** Ready to implement.
> This file documents the complete jadval2.sud.uz system for future integration.

---

## 1. What jadval2.sud.uz is

jadval2.sud.uz is the official court hearing schedule site for ALL Uzbekistan courts.
It shows scheduled hearings (past + future) for every court, organized by:
- **Court type** (4 types): Criminal (jib), Civil (fib), Administrative (mib), Economic (is)
- **Region** (14 regions + Supreme Court)
- **District court** (multiple per region)

Unlike jadval.sud.uz (which only searches by TIN/PINFL), jadval2 lets you browse
**ALL hearings for a specific court on a specific date** — including past dates.

---

## 2. API discovered

The jadval2.sud.uz frontend fetches hearing data from two APIs:

### Primary API: `jadvalapi.sud.uz/vka/{TYPE}/{courtId}/{DDMMYYYY}`
- **TYPE**: `CIVIL` (fib), `ECONOMIC` (is), `CONFLICT` (mib/administrative)
- **courtId**: the button ID from the court selection page (e.g. `andtfsud`)
- **DDMMYYYY**: date in DDMMYYYY format (e.g. `09072026` for July 9, 2026)
- Returns: JSON array of hearing objects
- **Works via CF Workers** (jadvalapi.sud.uz is already in ALLOWED_HOSTS)

### Secondary API: `api2.sud.uz/{courtId}/{DDMMYYYY}`
- Same data, different server (need to add `api2.sud.uz` to CF worker ALLOWED_HOSTS)
- The frontend merges results from both APIs

### Hearing object structure:
```json
{
  "casenumber": "2-1701-2505/78930",
  "hearing_date": "09.07.2026",
  "hearing_time": "10:30",
  "responsible": "АРАББОЕВ ШЕРЗОДБЕК НЕЪМАТУЛЛАЕВИЧ",
  "instance": "Биринчи инстанция",
  "regionid": "25",
  "globalid": "andtfsud",
  "claimkind": "SUIT",
  "claimtype": "CIVIL",
  "category": "Никоҳдан ажратиш",
  "case_id": "347c08c4-...",
  "claiment": "USMONOV ELYORBEK RAFIKJONOVICH",
  "defendant": "USMONOVA DILRABOXON MUXTOR QIZI"
}
```

---

## 3. Court type → API prefix mapping

| Court type | jadval2 path | API prefix | Description |
|---|---|---|---|
| Civil | `/fib/` | `CIVIL` | Фуқаролик ишлари |
| Economic | `/is/` | `ECONOMIC` | Иқтисодий судлар |
| Administrative | `/mib/` | `CONFLICT` | Маъмурий судлар |
| Criminal | `/jib/` | (TBD — needs investigation) | Жиноят ишлари |
| Admin violation | `/mhb/` | (TBD) | Маъмурий ҳуқуқбузарликлар |

---

## 4. Complete court ID map (all regions, civil courts)

This is the **10-ILOVA equivalent** — a static map of court IDs. Each court has:
- `id`: the button ID used in the API (e.g. `andtfsud`)
- `name`: the court name in Uzbek (Cyrillic)
- `region`: which region it belongs to

### Andijon viloyati
| ID | Court name |
|---|---|
| andvilfsud | Андижон вилоят суди |
| andtfsud | Андижон туманлараро суди |
| asaktfsud | Асака туманлараро суди |
| boztfsud | Бўстон туманлараро суди |
| izbsktfsud | Избоскан туманлараро суди |
| kteptfsud | Қўрғонтепа туманлараро суди |
| xojaotfsud | Хўжаобод туманлараро суди |

### Buxoro viloyati
| ID | Court name |
|---|---|
| buxvilfsud | Бухоро вилоят суди |
| buxtfsud | Бухоро туманлараро суди |
| gijdutfsud | Ғиждувон туманлараро суди |
| kogontfsud | Когон туманлараро суди |
| kkultfsud | Қоракўл туманлараро суди |
| peshtfsud | Пешку туманлараро суди |
| romittfsud | Ромитон туманлараро суди |

### Jizzax viloyati
| ID | Court name |
|---|---|
| jizzavilfsud | Жиззах вилоят суди |
| galortfsud | Ғаллаорол туманлараро суди |
| dusttfsud | Дўстлик туманлараро суди |
| jizzatfsud | Жиззах туманлараро суди |
| zarbtfsudr | Зарбдор туманлараро суди |
| paxtakortfsud | Пахтакор туман суди |
| fortfsud | Фориш туман суди |

### Qashqadaryo viloyati
| ID | Court name |
|---|---|
| kashvilfsud | Қашқадарё вилоят суди |
| guzortfsud | Ғузор туманлараро суди |
| karshitfsud | Қарши туманлараро суди |
| kasbtfsud | Касби туманлараро суди |
| kosontfsud | Косон туманлараро суди |
| chrkchitfsud | Чироқчи туман суди |
| shaxrtfsud | Шаҳрисабз туманлараро суди |
| yakbogtfsud | Яккабоғ туманлараро суди |

### Qoraqalpog'iston Respublikasi
| ID | Court name |
|---|---|
| qrfsud | Қорақалпоғистон Республикаси суди |
| amudtfsud | Амударё туман суди |
| bertfsud | Беруний туманлараро суди |
| kungtfsud | Қўнғирот туманлараро суди |
| nuktfsud | Нукус туманлараро суди |
| chimtfsud | Чимбой туман суди |

### Navoiy viloyati
| ID | Court name |
|---|---|
| navvilfsud | Навоий вилоят суди |
| zartfsud | Зарафшон туманлараро суди |
| navtfsud | Кармана туманлараро суди |
| navbxtfsud | Навбаҳор туманлараро суди |
| uchkutfsud | Учқудуқ туман суди |
| xatirchitfsud | Хатирчи туман суди |

### Namangan viloyati
| ID | Court name |
|---|---|
| namvilfsud | Наманган вилоят суди |
| namtfsud | Наманган туманлараро суди |
| uchkurtfsud | Учқўрғон туманлараро суди |
| chusttfsud | Чуст туманлараро суди |
| yankurtfsud | Янгиқўрғон туманлараро суди |

### Samarqand viloyati
| ID | Court name |
|---|---|
| samvilfsud | Самарқанд вилоят суди |
| jombtfsud | Жомбой туманлараро суди |
| ishtixtfsud | Иштихон туманлараро суди |
| kkurgtfsud | Каттақўрғон туманлараро суди |
| nurobtfsud | Нуробод туман суди |
| payartfsud | Пайариқ туманлараро суди |
| pstdargtfsud | Пастдарғом туман суди |
| samtfsud | Самарқанд шаҳар суди |
| tayloktfsud | Тайлоқ туманлараро суди |
| urguttfsud | Ургут туман суди |

### Sirdaryo viloyati
| ID | Court name |
|---|---|
| sirdvilfsud | Сирдарё вилоят суди |
| boyovtfsud | Боёвут туманлараро суди |
| gulistfsud | Гулистон туманлараро суди |
| okolttfsud | Оқолтин туманлараро суди |
| sirdtfsud | Сирдарё туманлараро суди |

### Surxondaryo viloyati
| ID | Court name |
|---|---|
| surxvilfsud | Сурхондарё вилоят суди |
| boystfsud | Бойсун туман суди |
| denovtfsud | Денов туманлараро суди |
| kumkgtfsud | Қумқўрғон туманлараро суди |
| sariostfsud | Сариосиё туманлараро суди |
| termtfsud | Термиз туманлараро суди |
| sherobtfsud | Шеробод туманлараро суди |

### Toshkent viloyati
| ID | Court name |
|---|---|
| toshvilfsud | Тошкент вилоят суди |
| bekobtfsud | Бекобод туманлараро суди |
| zangtfsud | Зангиота туманлараро суди |
| kuychtfsud | Қуйичирчиқ туманлараро суди |
| oxantfsud | Оҳангарон туманлараро суди |
| urtchtfsud | Ўртачирчиқ туманлараро суди |
| chichtfsud | Чирчиқ туманлараро суди |
| yukchtfsud | Юқоричирчиқ туманлараро суди |
| yangiyultgsud | Янгийўл туманлараро суди |

### Toshkent shahar
| ID | Court name |
|---|---|
| toshfsud | Тошкент шаҳар суди |
| mulugtfsud | Мирзо Улуғбек туманлараро суди |
| mirtfsud | Миробод туманлараро суди |
| uchttfsud | Учтепа туманлараро суди |
| shayxtfsud | Шайхонтоҳур туманлараро суди |
| yakkatfsud | Яккасарой туманлараро суди |

### Farg'ona viloyati
| ID | Court name |
|---|---|
| fargvilfsud | Фарғона вилоят суди |
| kokantfsud | Қўқон туманлараро суди |
| margiltfsud | Марғилон туманлараро суди |
| rishtontfsud | Риштон туманлараро суди |
| suxtfsud | Сўх туман суди |
| uzbektfsud | Ўзбекистон туманлараро суди |
| fargtfsud | Фарғона туманлараро суди |

### Xorazm viloyati
| ID | Court name |
|---|---|
| xorzvilfsud | Хоразм вилоят суди |
| bogottfsud | Боғот туманлараро суди |
| urgatfsud | Урганч туманлараро суди |
| shovtfsud | Шовот туманлараро суди |

---

## 5. Integration workflow

### The user's idea:
1. User enters a company STIR
2. App looks up the company name + address from orginfo.uz
3. App parses the address to determine the **region** and **district**
4. App looks up the correct **court** from the static court map (10-ILOVA)
5. App fetches ALL hearings for that court on ALL dates (past + future) from jadvalapi.sud.uz
6. App filters the hearings where the company name appears as **plaintiff OR defendant**
7. App displays the results in the Sud majlislari tab

### Advantages over current approach:
- **Current**: jadval.sud.uz only searches by TIN for economic + civil courts. Criminal + administrative courts can't be searched by TIN.
- **New**: jadval2.sud.uz lets us search ALL court types by browsing the court's full schedule. We can find hearings where the company is mentioned even in courts that don't support TIN search.
- **Past dates**: jadval2.sud.uz supports looking back in time (just change the date parameter).

### What's needed:
1. **orginfo.uz address parsing** — extend the existing orginfo integration to extract the address, parse region + district from it
2. **Court jurisdiction map** — the static court ID map above (no need to call lex.uz every time)
3. **Date range scanning** — fetch hearings for a date range (e.g. last 6 months + next 3 months) by looping through dates
4. **Company name matching** — filter hearings where `claiment` or `defendant` contains the company name

### API call pattern:
```
GET https://jadvalapi.sud.uz/vka/CIVIL/{courtId}/{DDMMYYYY}
→ Returns JSON array of hearings for that court on that date
→ Filter by company name in claiment/defendant fields
```

---

## 6. CF Worker

`jadval2.sud.uz` was added to ALLOWED_HOSTS in cloudflare-worker/proxy.js.
`jadvalapi.sud.uz` was already in ALLOWED_HOSTS.
`api2.sud.uz` needs to be added to ALLOWED_HOSTS (secondary API).

**User needs to redeploy CF workers** with the updated proxy.js that includes `jadval2.sud.uz`.
