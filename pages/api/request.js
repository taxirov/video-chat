import kv from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { from, to } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: "Ma'lumot yetarli emas" });
  }

  const cleanTo = String(to).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanTo === from) {
    return res.status(400).json({ error: "O'zingizga so'rov yubora olmaysiz" });
  }

  const targetRaw = await kv.hget('users', cleanTo);
  if (!targetRaw) {
    return res.status(404).json({ error: 'Bunday username topilmadi' });
  }

  const alreadyContact = await kv.sismember(`contacts:${from}`, cleanTo);
  if (alreadyContact) {
    return res.status(409).json({ error: 'Bu foydalanuvchi allaqachon kontaktingizda' });
  }

  const fromRaw = await kv.hget('users', from);
  const fromUser = typeof fromRaw === 'string' ? JSON.parse(fromRaw) : fromRaw;

  await kv.hset(`requests:${cleanTo}`, {
    [from]: JSON.stringify({ fromName: fromUser?.name || from, sentAt: Date.now() }),
  });

  return res.status(200).json({ ok: true });
}
