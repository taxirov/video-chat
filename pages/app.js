import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [addUsername, setAddUsername] = useState('');
  const [addMsg, setAddMsg] = useState('');

  const [status, setStatus] = useState('connecting'); // connecting | ready | calling | incoming | in-call
  const [callType, setCallType] = useState('audio');
  const [peerName, setPeerName] = useState('');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('gaplashuv_user');
    if (!saved) {
      router.replace('/');
      return;
    }
    setMe(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (!me) return;
    async function beat() {
      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: me.username }),
      });
    }
    async function loadContacts() {
      const res = await fetch(`/api/contacts?username=${me.username}`);
      const data = await res.json();
      setContacts(data.contacts || []);
    }
    async function loadRequests() {
      const res = await fetch(`/api/requests?username=${me.username}`);
      const data = await res.json();
      setRequests(data.requests || []);
    }
    beat();
    loadContacts();
    loadRequests();
    const beatInterval = setInterval(beat, 10000);
    const pollInterval = setInterval(() => {
      loadContacts();
      loadRequests();
    }, 5000);
    return () => {
      clearInterval(beatInterval);
      clearInterval(pollInterval);
    };
  }, [me]);

  useEffect(() => {
    if (!me) return;
    let peer;
    import('peerjs').then(({ default: Peer }) => {
      peer = new Peer(`gaplashuv-${me.username}`);
      peerRef.current = peer;
      peer.on('open', () => setStatus('ready'));
      peer.on('error', (err) =>
        setError(err.type === 'peer-unavailable' ? 'Bu foydalanuvchi hozir onlayn emas' : err.message)
      );
      peer.on('call', (incomingCall) => {
        setPeerName(incomingCall.metadata?.fromName || incomingCall.peer);
        setCallType(incomingCall.metadata?.type || 'audio');
        setStatus('incoming');
        activeCallRef.current = incomingCall;
      });
    });
    return () => {
      peer && peer.destroy();
      stopLocalStream();
    };
  }, [me]);

  function stopLocalStream() {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }

  async function getStream(video) {
    return navigator.mediaDevices.getUserMedia({ audio: true, video });
  }

  async function startCall(username, name, type) {
    setError('');
    try {
      const stream = await getStream(type === 'video');
      localStreamRef.current = stream;
      if (type === 'video' && localVideoRef.current) localVideoRef.current.srcObject = stream;
      setPeerName(name);
      setCallType(type);
      setStatus('calling');
      const call = peerRef.current.call(`gaplashuv-${username}`, stream, { metadata: { fromName: me.name, type } });
      activeCallRef.current = call;
      call.on('stream', (remoteStream) => {
        attachRemoteStream(remoteStream, type);
        setStatus('in-call');
      });
      call.on('close', endCall);
      call.on('error', () => { setError('Qo\'ng\'iroqda xatolik yuz berdi'); endCall(); });
    } catch (err) {
      setError('Mikrofon/kameraga ruxsat berilmadi');
    }
  }

  async function acceptCall() {
    setError('');
    try {
      const stream = await getStream(callType === 'video');
      localStreamRef.current = stream;
      if (callType === 'video' && localVideoRef.current) localVideoRef.current.srcObject = stream;
      const call = activeCallRef.current;
      call.answer(stream);
      call.on('stream', (remoteStream) => {
        attachRemoteStream(remoteStream, callType);
        setStatus('in-call');
      });
      call.on('close', endCall);
    } catch (err) {
      setError('Mikrofon/kameraga ruxsat berilmadi');
      declineCall();
    }
  }

  function declineCall() {
    activeCallRef.current && activeCallRef.current.close();
    activeCallRef.current = null;
    setStatus('ready');
  }

  function attachRemoteStream(stream, type) {
    if (type === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    else if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
  }

  function endCall() {
    activeCallRef.current && activeCallRef.current.close();
    activeCallRef.current = null;
    stopLocalStream();
    setStatus('ready');
    setMuted(false);
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  }

  async function sendRequest(e) {
    e.preventDefault();
    setAddMsg('');
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: me.username, to: addUsername }),
    });
    const data = await res.json();
    if (!res.ok) {
      setAddMsg(data.error);
    } else {
      setAddMsg("So'rov yuborildi ✓");
      setAddUsername('');
    }
  }

  async function respond(fromUsername, action) {
    await fetch('/api/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: me.username, from: fromUsername, action }),
    });
    setRequests((r) => r.filter((req) => req.fromUsername !== fromUsername));
    if (action === 'accept') {
      const res = await fetch(`/api/contacts?username=${me.username}`);
      const data = await res.json();
      setContacts(data.contacts || []);
    }
  }

  function logout() {
    localStorage.removeItem('gaplashuv_user');
    router.push('/');
  }

  if (!me) return null;

  const inCallOverlay = ['calling', 'incoming', 'in-call'].includes(status);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.hi}>{me.name}</div>
          <div style={styles.username}>@{me.username}</div>
        </div>
        <button style={styles.logout} onClick={logout}>Chiqish</button>
      </header>

      {error && <p style={styles.error}>{error}</p>}

      <form onSubmit={sendRequest} style={styles.addForm}>
        <input
          style={styles.addInput}
          value={addUsername}
          onChange={(e) => setAddUsername(e.target.value)}
          placeholder="username kiriting"
        />
        <button type="submit" style={styles.addBtn}>So'rov yuborish</button>
      </form>
      {addMsg && <p style={styles.addMsg}>{addMsg}</p>}

      {requests.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Kelgan so'rovlar</h2>
          <ul style={styles.list}>
            {requests.map((r) => (
              <li key={r.fromUsername} style={styles.item}>
                <div style={styles.itemLeft}>
                  <div>
                    <div style={styles.itemName}>{r.fromName}</div>
                    <div style={styles.itemUsername}>@{r.fromUsername}</div>
                  </div>
                </div>
                <div style={styles.itemActions}>
                  <button style={styles.acceptSmall} onClick={() => respond(r.fromUsername, 'accept')}>Qabul</button>
                  <button style={styles.declineSmall} onClick={() => respond(r.fromUsername, 'decline')}>Rad</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 style={styles.sectionTitle}>Kontaktlar</h2>

      {contacts.length === 0 && (
        <p style={styles.empty}>Hali kontaktingiz yo'q. Yuqoridan username kiritib so'rov yuboring.</p>
      )}

      <ul style={styles.list}>
        {contacts.map((u) => (
          <li key={u.username} style={styles.item}>
            <div style={styles.itemLeft}>
              <span style={{ ...styles.dot, background: u.online ? 'var(--teal)' : 'var(--surface-2)' }} />
              <div>
                <div style={styles.itemName}>{u.name}</div>
                <div style={styles.itemUsername}>@{u.username} · {u.online ? 'onlayn' : 'oflayn'}</div>
              </div>
            </div>
            <div style={styles.itemActions}>
              <button
                style={{ ...styles.callBtn, opacity: u.online && status === 'ready' ? 1 : 0.4 }}
                disabled={!u.online || status !== 'ready'}
                onClick={() => startCall(u.username, u.name, 'audio')}
                title="Audio qo'ng'iroq"
              >📞</button>
              <button
                style={{ ...styles.callBtn, opacity: u.online && status === 'ready' ? 1 : 0.4 }}
                disabled={!u.online || status !== 'ready'}
                onClick={() => startCall(u.username, u.name, 'video')}
                title="Video qo'ng'iroq"
              >🎥</button>
            </div>
          </li>
        ))}
      </ul>

      {inCallOverlay && (
        <div style={styles.overlay}>
          <div style={styles.overlayName}>{peerName}</div>
          <div style={styles.overlayState}>
            {status === 'calling' && 'Chaqirilmoqda…'}
            {status === 'incoming' && `${callType === 'video' ? 'Video' : 'Audio'} qo'ng'iroq`}
            {status === 'in-call' && 'Suhbat davom etmoqda'}
          </div>

          {callType === 'video' && (
            <div style={styles.videoGrid}>
              <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
              <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
            </div>
          )}
          <audio ref={remoteAudioRef} autoPlay />

          <div style={styles.overlayActions}>
            {status === 'incoming' && (
              <>
                <button style={styles.acceptBtn} onClick={acceptCall}>Qabul qilish</button>
                <button style={styles.declineBtn} onClick={declineCall}>Rad etish</button>
              </>
            )}
            {(status === 'calling' || status === 'in-call') && (
              <>
                {status === 'in-call' && (
                  <button style={styles.muteBtn} onClick={toggleMute}>{muted ? 'Ovozni yoqish' : 'Ovozsiz'}</button>
                )}
                <button style={styles.declineBtn} onClick={endCall}>Tugatish</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', padding: '24px 20px 60px', maxWidth: 480, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  hi: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 },
  username: { color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13 },
  logout: { background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--surface-2)', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  error: { color: 'var(--danger)', fontSize: 13, marginBottom: 12 },
  addForm: { display: 'flex', gap: 8, marginBottom: 6 },
  addInput: { flex: 1, background: 'var(--surface)', border: '1px solid var(--surface-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 14 },
  addBtn: { background: 'var(--accent)', color: '#1a1206', fontWeight: 600, borderRadius: 10, padding: '10px 14px', fontSize: 13, whiteSpace: 'nowrap' },
  addMsg: { color: 'var(--teal)', fontSize: 13, margin: '0 0 20px' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', margin: '24px 0 12px' },
  empty: { color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  item: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', borderRadius: 12, padding: '12px 14px' },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  dot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  itemName: { fontWeight: 600, fontSize: 15 },
  itemUsername: { color: 'var(--text-dim)', fontSize: 12, fontFamily: 'var(--font-mono)' },
  itemActions: { display: 'flex', gap: 8 },
  callBtn: { background: 'var(--surface-2)', borderRadius: 10, width: 40, height: 40, fontSize: 17 },
  acceptSmall: { background: 'var(--teal)', color: '#08201a', fontWeight: 600, borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  declineSmall: { background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(16,21,28,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, zIndex: 10 },
  overlayName: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 },
  overlayState: { color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 },
  videoGrid: { position: 'relative', width: '100%', maxWidth: 420 },
  remoteVideo: { width: '100%', borderRadius: 14, background: '#000', aspectRatio: '4 / 3', objectFit: 'cover' },
  localVideo: { position: 'absolute', bottom: 12, right: 12, width: '30%', borderRadius: 10, background: '#000', objectFit: 'cover' },
  overlayActions: { display: 'flex', gap: 12, marginTop: 16 },
  acceptBtn: { background: 'var(--teal)', color: '#08201a', fontWeight: 600, borderRadius: 10, padding: '12px 22px' },
  declineBtn: { background: 'var(--danger)', color: '#2a0d0c', fontWeight: 600, borderRadius: 10, padding: '12px 22px' },
  muteBtn: { background: 'var(--surface-2)', color: 'var(--text)', borderRadius: 10, padding: '12px 22px' },
};
