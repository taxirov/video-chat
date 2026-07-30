import kv from '../../lib/kv';

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'username kerak' });
  }

  const all = (await kv.hgetall(`requests:${username}`)) || {};
  const requests = Object.entries(all)
    .map(([fromUsername, raw]) => {
      const r = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return { fromUsername, fromName: r.fromName, sentAt: r.sentAt };
    })
    .sort((a, b) => b.sentAt - a.sentAt);

  return res.status(200).json({ requests });
}
