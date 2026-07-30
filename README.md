# Gaplashuv

Ism, telefon raqam va username bilan ro'yxatdan o'tib, boshqa foydalanuvchilarga
brauzer orqali audio/video qo'ng'iroq qilish imkonini beruvchi sodda sayt.

- Ro'yxatdan o'tishda SMS-kod yo'q — faqat ism, telefon, username.
- Qo'ng'iroqlar WebRTC orqali to'g'ridan-to'g'ri brauzerlar orasida boradi
  (ovoz/video serverga saqlanmaydi, faqat "kim onlayn" degan ro'yxat saqlanadi).

## Vercel'ga joylashtirish (bosqichma-bosqich)

1. Ushbu papkani GitHub'ga yuklang (yoki to'g'ridan-to'g'ri Vercel CLI orqali).
2. [vercel.com](https://vercel.com) da hisob oching, "Add New Project" tugmasini
   bosing va shu repository'ni tanlang.
3. Deploy qilishdan oldin **Storage** bo'limidan **KV** (Upstash Redis) qo'shing:
   - Project → Storage → Create Database → KV
   - Yaratilgach, uni shu loyihaga ulang ("Connect Project").
   - Bu avtomatik ravishda `KV_REST_API_URL` va `KV_REST_API_TOKEN`
     muhit o'zgaruvchilarini qo'shib qo'yadi.
4. "Deploy" tugmasini bosing. Bir necha daqiqada saytingiz tayyor bo'ladi.
5. Saytga kirib, ism-familiya, telefon va username bilan ro'yxatdan o'ting.
   Boshqa odam ham shu havolaga kirib ro'yxatdan o'tsa, ikkovingiz bir-biringizga
   qo'ng'iroq qila olasiz.

## Lokal ishga tushirish

```bash
npm install
cp .env.example .env.local   # KV ma'lumotlarini Vercel dashboard'dan nusxalab qo'ying
npm run dev
```

## Muhim eslatmalar

- **Brauzer ruxsati**: qo'ng'iroq qilish uchun brauzer mikrofon/kameraga ruxsat
  so'raydi — foydalanuvchi ruxsat berishi kerak.
- **HTTPS talab qilinadi**: WebRTC faqat HTTPS orqali ishlaydi. Vercel avtomatik
  HTTPS beradi, shuning uchun bu muammo bo'lmaydi.
- **Signalizatsiya**: qo'ng'iroqlarni ulash uchun PeerJS'ning bepul ommaviy
  broker serveridan (`0.peerjs.com`) foydalanilmoqda. Bu kichik va o'rta
  miqyosdagi foydalanish uchun yetarli; juda katta foydalanuvchi bazasi uchun
  keyinchalik o'zingizning PeerServer'ingizni ko'tarish tavsiya etiladi.
- **Onlayn holati**: foydalanuvchi shu sahifani ochiq turgan payt "onlayn"
  hisoblanadi (har 10 soniyada signal yuboriladi, 25 soniya javobsiz qolsa —
  "oflayn" bo'lib qoladi).
- **Xavfsizlik**: bu sodda/demo darajadagi loyiha — parol yo'q, faqat
  username orqali "kirish". Haqiqiy foydalanuvchilar uchun keyinroq parol
  yoki SMS-tasdiqlash qo'shish tavsiya qilinadi.
