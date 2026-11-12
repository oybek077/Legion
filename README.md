# Legion

Brauzerda ishlaydigan original real vaqtli strategiya (RTS) o'yini. Izometrik xarita, baza qurish,
ruda yig'ish, qo'shin tayyorlash va kompyuter raqibga qarshi jang. Hech qanday kutubxona yoki
yig'ish bosqichi yo'q — toza HTML/CSS/JavaScript va Canvas.

## Ishga tushirish

`index.html` faylini brauzerda oching. Yoki lokal server orqali:

```bash
python3 -m http.server 8000
```

So'ng `http://localhost:8000` manziliga kiring.

## O'yin

- **Binolar:** qo'mondonlik markazi, elektr stansiya, ruda zavodi, kazarma, harbiy zavod, radar, mudofaa minorasi, texnologiya markazi
- **Birliklar:** otuvchi, raketachi, ruda yig'uvchi, razvedka mashinasi, tank, artilleriya, og'ir tank
- Energiya balansi, texnologiya daraxti, urush tumani, mini-xarita, 3 qiyinlik darajasi
- Har o'yinda tasodifiy, simmetrik xarita

## Boshqaruv

| Amal | Tugma |
| --- | --- |
| Tanlash / ramka bilan tanlash | Sichqoncha chap tugmasi |
| Yurish, hujum, ruda yig'ish, yig'ilish nuqtasi | O'ng tugma |
| Hujum bilan yurish / to'xtash | `A` / `S` |
| Kamera | Strelkalar yoki ekran chetlari |
| Bazaga qaytish | `H` |
| Guruh saqlash / chaqirish | `Ctrl+1…9` / `1…9` |
| Panel bo'limlari | `Q` `W` `E` |
| Buyurtmani bekor qilish | Paneldagi o'ng tugma |
| Binoni sotish / pauza | `Del` / `P` |

## Tuzilishi

- `js/data.js` — bino va birliklar ma'lumotlari
- `js/map.js` — xarita generatsiyasi va A* yo'l topish
- `js/sim.js` — simulyatsiya: harakat, jang, iqtisod, ishlab chiqarish
- `js/ai.js` — kompyuter raqib
- `js/render.js` — izometrik chizish
- `js/ui.js` — boshqaruv, yon panel, ovoz, asosiy sikl
