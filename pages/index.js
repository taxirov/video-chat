import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('gaplashuv_user');
    if (saved) router.replace('/app');
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, username }),
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
      setError('Server bilan bog\'lanib bo\'lmadi');
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
      <p style={styles.subtitle}>Ism va raqamingizni yozing — shu zahoti audio va video qo'ng'iroq qila boshlaysiz.</p>

      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Ism
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aziz Karimov"
            required
          />
        </label>

        <label style={styles.label}>
          Telefon raqam
          <input
            style={{ ...styles.input, fontFamily: 'var(--font-mono)' }}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998 90 123 45 67"
            required
          />
        </label>

        <label style={styles.label}>
          Username
          <input
            style={{ ...styles.input, fontFamily: 'var(--font-mono)' }}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="aziz_k"
            required
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? 'Yuborilmoqda…' : 'Ro\'yxatdan o\'tish'}
        </button>
      </form>

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
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 20px',
    fontFamily: 'var(--font-body)',
    textAlign: 'center',
  },
  ringWrap: {
    position: 'relative',
    width: 96,
    height: 96,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: '50%',
    border: '2px solid var(--accent)',
    animation: 'pulse 1.8s ease-out infinite',
  },
  ringCore: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'var(--accent)',
    color: '#1a1206',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 26,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 40,
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: 'var(--text-dim)',
    maxWidth: 360,
    lineHeight: 1.5,
    margin: '0 0 32px',
  },
  form: {
    width: '100%',
    maxWidth: 340,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    color: 'var(--text-dim)',
    textAlign: 'left',
  },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--surface-2)',
    borderRadius: 10,
    padding: '12px 14px',
    color: 'var(--text)',
    fontSize: 15,
  },
  button: {
    marginTop: 8,
    background: 'var(--accent)',
    color: '#1a1206',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 15,
    padding: '13px 20px',
    borderRadius: 10,
  },
  error: {
    color: 'var(--danger)',
    fontSize: 13,
    margin: 0,
  },
};
