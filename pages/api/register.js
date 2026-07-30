import kv from '../../lib/kv';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { name, phone, username, password } = req.body || {};

  if (!name || !phone || !username || !password) {
    return res.status(400).json({ error: 'Ism, telefon, username va parol kiritilishi shart' });
  }

  if (String(password).length < 4) {
    return res.status(400).json({ error: "Parol kamida 4 ta belgidan iborat bo'lsin" });
  }

  const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3) {
    return res.status(400).json({
      error: "Username kamida 3 ta harf/raqamdan iborat bo'lsin (faqat lotin harflari, raqam, pastki chiziq)",
    });
  }

  const existing = await kv.hget('users', cleanUsername);
  if (existing) {
    return res.status(409).json({ error: "Bu username allaqachon band, boshqasini tanlang" });
  }

  const passwordHash = await bcrypt.hash(String(password), 10);

  const user = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    username: cleanUsername,
    passwordHash,
    createdAt: Date.now(),
    lastSeen: Date.now(),
  };

  await kv.hset('users', { [cleanUsername]: JSON.stringify(user) });

  return res.status(200).json({ user: { name: user.name, username: user.username } });
}
