import kv from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { name, phone, username } = req.body || {};

  if (!name || !phone || !username) {
    return res.status(400).json({ error: 'Ism, telefon raqam va username kiritilishi shart' });
  }

  const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Username kamida 3 ta harf/raqamdan iborat bo\'lsin (faqat lotin harflari, raqam, pastki chiziq)' });
  }

  const existing = await kv.hget('users', cleanUsername);
  if (existing) {
    return res.status(409).json({ error: 'Bu username allaqachon band, boshqasini tanlang' });
  }

  const user = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    username: cleanUsername,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };

  await kv.hset('users', { [cleanUsername]: JSON.stringify(user) });

  return res.status(200).json({ user: { name: user.name, username: user.username } });
}
