import kv from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: 'username kerak' });
  }

  const raw = await kv.hget('users', username);
  if (!raw) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
  }

  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
  user.lastSeen = Date.now();
  await kv.hset('users', { [username]: JSON.stringify(user) });

  return res.status(200).json({ ok: true });
}
