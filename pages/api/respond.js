import kv from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { username, from, action } = req.body || {};
  if (!username || !from || !action) {
    return res.status(400).json({ error: "Ma'lumot yetarli emas" });
  }

  await kv.hdel(`requests:${username}`, from);

  if (action === 'accept') {
    await kv.sadd(`contacts:${username}`, from);
    await kv.sadd(`contacts:${from}`, username);
  }

  return res.status(200).json({ ok: true });
}
