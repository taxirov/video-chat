import kv from '../../lib/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { username, subscription } = req.body || {};
  if (!username || !subscription) {
    return res.status(400).json({ error: "Ma'lumot yetarli emas" });
  }

  await kv.hset('push_subs', { [username]: JSON.stringify(subscription) });
  return res.status(200).json({ ok: true });
}
