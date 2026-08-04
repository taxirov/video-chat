# Gaplashuv

Ism, telefon raqam va username bilan ro'yxatdan o'tib, boshqa foydalanuvchilarga
brauzer orqali audio/video qo'ng'iroq qilish imkonini beruvchi sodda sayt.

- Ro'yxatdan o'tishda SMS-kod yo'q, lekin endi **parol** talab qilinadi (xavfsiz xesh
  qilingan holda saqlanadi).
- Endi hech kim to'g'ridan-to'g'ri qo'ng'iroq qila olmaydi: avval username orqali
  **kontakt so'rovi** yuboriladi, qarshi tomon uni qabul qilgach, ikkovi bir-biriga
  qo'ng'iroq qila oladigan bo'ladi.
- Telefonda video qo'ng'iroq har doim **to'liq ekranda** ochiladi; kompyuterda
  kichik oyna sifatida boshlanadi, kengaytirish tugmasi (⤢) orqali to'liq
  ekranga o'tkazish mumkin.
- **Push-xabarnoma**: brauzer/ilova ochilib, ruxsat berilgan bo'lsa, qo'ng'iroq
  kelganda tab yoki ilova fonda bo'lsa ham bildirishnoma chiqadi (pastdagi
  "Push-xabarnomalarni sozlash" bo'limiga qarang).
- Qo'ng'iroqlar WebRTC orqali to'g'ridan-to'g'ri brauzerlar orasida boradi
  (ovoz/video serverga saqlanmaydi, faqat kontaktlar ro'yxati va "kim onlayn"
  degan ma'lumot saqlanadi).

## Tarmoq ulanishi (STUN/TURN)

Video/audio qo'ng'iroqlar ikkita qurilma orasida to'g'ridan-to'g'ri (P2P) boradi.
Ba'zi mobil tarmoqlarda (ayniqsa 4G/5G'da) buning uchun oddiy STUN server
yetarli bo'lmaydi — shuning uchun loyihaga bepul **TURN server** (Open Relay
Project) ham qo'shib qo'yilgan. Bu qo'ng'iroqlarning aksariyat tarmoqlarda
ishlashini ta'minlaydi.

**Eslatma**: bu — bepul, umumiy foydalanish uchun TURN server, cheklangan
tezlik/hajmga ega. Agar foydalanuvchilar ko'payib, qo'ng'iroqlar ko'p uzilib
qolsa, buni pullik TURN xizmatiga (masalan [Metered.ca](https://www.metered.ca/tools/openrelay/)
yoki Twilio) almashtirish tavsiya etiladi — bu `pages/app.js` faylidagi
`iceServers` ro'yxatini yangilash orqali qilinadi.

## Push-xabarnomalarni sozlash (VAPID kalitlari)

Qo'ng'iroq kelganda odam ilovani ochib turmasa ham bildirishnoma chiqishi uchun
Vercel loyihangizga quyidagi muhit o'zgaruvchilarini qo'shing (Project →
Settings → Environment Variables):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BMpfNop_ViflxZ0d88uIWJa4CrO9_kco_KWxkSjjhUddn5SszPUhiAH1YV79uREUTnkCxg8h3zUdp4cseYm1dIk
VAPID_PRIVATE_KEY=jJGrdroDJRRoV-yb2kXOAwj7ik8c2XTTZ3FNyZtzEdw
VAPID_SUBJECT=mailto:sizning-emailingiz@example.com
```

(Bu tayyor, ishlaydigan kalit juftligi — o'zingiz uchun boshqasini yaratmoqchi
bo'lsangiz, `npx web-push generate-vapid-keys` buyrug'ini ishlating.)

Qo'shgach, qayta deploy qiling. Saytga kirganingizda brauzer bildirishnoma
ruxsatini so'raydi — "Ruxsat berish" bosilsa, endi tab yopiq/fonda bo'lganda
ham qo'ng'iroq haqida bildirishnoma keladi.

**Muhim cheklov**: bu — brauzer/PWA darajasidagi push, native ilova emas.
Android'da yaxshi ishlaydi (hatto ilova to'liq yopilgan bo'lsa ham, agar u
"Bosh ekranga qo'shilgan" bo'lsa). iPhone'da faqat "Bosh ekranga qo'shilgan"
holatda ishlaydi (Safari orqali to'g'ridan-to'g'ri ochilgan tab'da emas).
Odam telefonini butunlay o'chirib qo'ysa yoki ilovani "majburiy yopsa"
(force-quit), hech qanday texnologiya bildirishnoma yubora olmaydi — bu faqat
haqiqiy operatsion tizim darajasidagi (App Store) ilovalarda hal qilinadi.

## Vercel'ga joylashtirish (bosqichma-bosqich)

1. Ushbu papkani GitHub'ga yuklang (yoki to'g'ridan-to'g'ri Vercel CLI orqali).
2. [vercel.com](https://vercel.com) da hisob oching, "Add New Project" tugmasini
   bosing va shu repository'ni tanlang.
3. Deploy qilishdan oldin **Storage** bo'limidan **Upstash (Redis)** qo'shing:
   - Project → Storage → Browse Storage → Marketplace Database Providers → **Upstash**
   - Yangi Redis ma'zumotlar bazasi yarating va uni shu loyihaga ulang.
   - Bu avtomatik ravishda kerakli muhit o'zgaruvchilarini (`KV_REST_API_URL` /
     `KV_REST_API_TOKEN` yoki `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`)
     qo'shib qo'yadi — kod ikkalasini ham avtomatik tanib oladi.
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

## Ilova sifatida o'rnatish (PWA)

Sayt endi "installable" — ya'ni telefonda ilova kabi o'rnatish mumkin:

- **Android (Chrome)**: saytni oching → menyu (⋮) → "Ilovani o'rnatish" / "Add to Home screen".
- **iPhone (Safari)**: saytni oching → pastdagi ulashish tugmasi → "Add to Home Screen".
- **Kompyuter (Chrome/Edge)**: manzil satrining o'ng tomonidagi o'rnatish belgisini bosing.

O'rnatilgach, telefon ekranida "Gaplashuv" nomli ikonka paydo bo'ladi va u brauzer
panelisiz, xuddi oddiy ilova kabi ochiladi.

**Muhim cheklov**: bu baribir brauzer texnologiyasi (PWA) asosida ishlaydi, App
Store/Google Play ilovasi emas. Ilova yopiq turganda (fonda) qo'ng'iroq signali
kelmaydi — signal faqat ilova/sayt ochiq turgan paytda ishlaydi. To'liq fon
rejimidagi push-xabarnoma bilan ishlaydigan qo'ng'iroq uchun keyinchalik alohida
native mobil ilova (masalan React Native) kerak bo'ladi.

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
