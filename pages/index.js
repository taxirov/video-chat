import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('gaplashuv_user');
    if (saved) router.replace('/app');
  }, []);

  async function submit(e, endpoint, body) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Xatolik yuz berdi');
        setLoading(false);
        return;
      }
      localStorage.setItem('gaplashuv_user', JSON.stringify(data.user));
      router.push('/app');
    } catch (err) {
      setError("Server bilan bog'lanib bo'lmadi");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.ringWrap} aria-hidden="true">
        <span style={{ ...styles.ring, animationDelay: '0s' }} />
        <span style={{ ...styles.ring, animationDelay: '0.6s' }} />
        <span style={{ ...styles.ring, animationDelay: '1.2s' }} />
        <div style={styles.ringCore}>G</div>
      </div>

      <h1 style={styles.title}>Gaplashuv</h1>
      <p style={styles.subtitle}>
        {mode === 'register'
          ? "Ism, raqam va parol yozing — kontaktlaringiz bilan audio/video gaplasha boshlaysiz."
          : 'Username va parolingizni kiriting.'}
      </p>

      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
          onClick={() => { setMode('register'); setError(''); }}
        >
          Ro'yxatdan o'tish
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
          onClick={() => { setMode('login'); setError(''); }}
        >
          Kirish
        </button>
      </div>

      {mode === 'register' ? (
        <form onSubmit={(e) => submit(e, '/api/register', { name, phone, username, password })} style={styles.form}>
          <label style={styles.label}>
            Ism
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Aziz Karimov" required />
          </label>
          <label style={styles.label}>
            Telefon raqam
            <input style={{ ...styles.input, fontFamily: 'var(--font-mono)' }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 123 45 67" required />
          </label>
          <label style={styles.label}>
            Username
            <input style={{ ...styles.input, fontFamily: 'var(--font-mono)' }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aziz_k" required />
          </label>
          <label style={styles.label}>
            Parol
            <input type="password" style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="kamida 4 ta belgi" required />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Yuborilmoqda…' : "Ro'yxatdan o'tish"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => submit(e, '/api/login', { username, password })} style={styles.form}>
          <label style={styles.label}>
            Username
            <input style={{ ...styles.input, fontFamily: 'var(--font-mono)' }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aziz_k" required />
          </label>
          <label style={styles.label}>
            Parol
            <input type="password" style={styles.input} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="parolingiz" required />
          </label>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </form>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.9; }
          100% { transform: scale(2.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: 'var(--font-body)', textAlign: 'center' },
  ringWrap: { position: 'relative', width: 96, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: { position: 'absolute', width: 72, height: 72, borderRadius: '50%', border: '2px solid var(--accent)', animation: 'pulse 1.8s ease-out infinite' },
  ringCore: { width: 64, height: 64, borderRadius: '50%', background: 'var(--accent)', color: '#1a1206', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 40, margin: '0 0 8px', letterSpacing: '-0.02em' },
  subtitle: { color: 'var(--text-dim)', maxWidth: 360, lineHeight: 1.5, margin: '0 0 24px' },
  tabs: { display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, marginBottom: 20 },
  tab: { background: 'transparent', color: 'var(--text-dim)', fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 8 },
  tabActive: { background: 'var(--surface-2)', color: 'var(--text)' },
  form: { width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-dim)', textAlign: 'left' },
  input: { background: 'var(--surface)', border: '1px solid var(--surface-2)', borderRadius: 10, padding: '12px 14px', color: 'var(--text)', fontSize: 15 },
  button: { marginTop: 8, background: 'var(--accent)', color: '#1a1206', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15, padding: '13px 20px', borderRadius: 10 },
  error: { color: 'var(--danger)', fontSize: 13, margin: 0 },
};
