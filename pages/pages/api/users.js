import kv from '../../lib/kv';

const ONLINE_WINDOW_MS = 25000;

export default async function handler(req, res) {
  const all = (await kv.hgetall('users')) || {};
  const now = Date.now();

  const users = Object.values(all)
    .map((raw) => (typeof raw === 'string' ? JSON.parse(raw) : raw))
    .map((u) => ({
      name: u.name,
      username: u.username,
      online: now - u.lastSeen < ONLINE_WINDOW_MS,
    }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

  return res.status(200).json({ users });
}
