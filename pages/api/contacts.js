import kv from '../../lib/kv';

const ONLINE_WINDOW_MS = 25000;

export default async function handler(req, res) {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: 'username kerak' });
  }

  const contactUsernames = (await kv.smembers(`contacts:${username}`)) || [];
  const now = Date.now();
  const contacts = [];

  for (const cUsername of contactUsernames) {
    const raw = await kv.hget('users', cUsername);
    if (!raw) continue;
    const u = typeof raw === 'string' ? JSON.parse(raw) : raw;
    contacts.push({
      name: u.name,
      username: u.username,
      online: now - u.lastSeen < ONLINE_WINDOW_MS,
    });
  }

  contacts.sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  return res.status(200).json({ contacts });
}
