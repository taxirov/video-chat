import kv from '../../lib/kv';
import webpush from '../../lib/push';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST' });
  }

  const { to, fromName, type } = req.body || {};
  if (!to || !fromName) {
    return res.status(400).json({ error: "Ma'lumot yetarli emas" });
  }

  const raw = await kv.hget('push_subs', to);
  if (!raw) {
    // No subscription saved for this user — nothing to do, not an error.
    return res.status(200).json({ ok: true, sent: false });
  }

  const subscription = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const payload = JSON.stringify({
    title: `${fromName} qo'ng'iroq qilmoqda`,
    body: type === 'video' ? "Video qo'ng'iroq" : "Audio qo'ng'iroq",
    url: '/app',
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return res.status(200).json({ ok: true, sent: true });
  } catch (err) {
    // Subscription expired or invalid — clean it up.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await kv.hdel('push_subs', to);
    }
    return res.status(200).json({ ok: true, sent: false });
  }
}
