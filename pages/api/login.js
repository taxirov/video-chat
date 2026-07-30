import kv from '../../lib/kv';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username va parol kiritilishi shart' });
  }

  const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  const raw = await kv.hget('users', cleanUsername);

  if (!raw) {
    return res.status(404).json({ error: "Bunday username topilmadi. Avval ro'yxatdan o'ting." });
  }

  const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const ok = await bcrypt.compare(String(password), user.passwordHash || '');

  if (!ok) {
    return res.status(401).json({ error: "Parol noto'g'ri" });
  }

  return res.status(200).json({ user: { name: user.name, username: user.username } });
}
