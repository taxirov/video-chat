import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Mic, MicOff, Video, VideoOff, SwitchCamera, PhoneOff, Phone, Maximize2, Minimize2 } from 'lucide-react';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

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
  const [cameraOn, setCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState('user');
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(false); // desktop-only manual toggle
  const [remoteMicOff, setRemoteMicOff] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [error, setError] = useState('');

  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const activeCallRef = useRef(null);
  const dataConnRef = useRef(null);
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
    setIsMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768);
  }, []);

  // presence + contacts/requests polling
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

  // persistent Peer connection for incoming calls
  useEffect(() => {
    if (!me) return;
    let peer;
    let reconnectTimer;

    async function setupPeer() {
      const { default: Peer } = await import('peerjs');

      let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      try {
        const res = await fetch('/api/ice-servers');
        const data = await res.json();
        if (data.iceServers?.length) iceServers = data.iceServers;
      } catch (e) {
        // fall back to STUN-only above
      }

      peer = new Peer(`gaplashuv-${me.username}`, { config: { iceServers } });
      peerRef.current = peer;

      peer.on('open', () => {
        setStatus('ready');
        setError('');
      });

      peer.on('disconnected', () => {
        // socket dropped (screen locked, tab backgrounded, network switch) —
        // the Peer object is still alive, just needs to reconnect
        setStatus('connecting');
        reconnectTimer = setTimeout(() => {
          if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.reconnect();
          }
        }, 1500);
      });

      peer.on('close', () => setStatus('connecting'));

      peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          setError('Bu foydalanuvchi hozir onlayn emas');
        } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
          // transient — 'disconnected' handler above will retry; no need to alarm the user
          setStatus('connecting');
        } else {
          setError(err.message);
        }
      });

      peer.on('call', (incomingCall) => {
        setPeerName(incomingCall.metadata?.fromName || incomingCall.peer);
        setCallType(incomingCall.metadata?.type || 'audio');
        setStatus('incoming');
        activeCallRef.current = incomingCall;
      });

      peer.on('connection', (conn) => {
        dataConnRef.current = conn;
        attachDataHandlers(conn);
      });
    }

    setupPeer();

    // when the phone screen turns back on / app returns to foreground,
    // check whether we need to reconnect right away instead of waiting
    function handleVisibility() {
      if (document.visibilityState === 'visible' && peerRef.current && peerRef.current.disconnected && !peerRef.current.destroyed) {
        peerRef.current.reconnect();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(reconnectTimer);
      peer && peer.destroy();
      stopLocalStream();
    };
  }, [me]);

  // ask for notification permission + subscribe for push, so calls can
  // reach the person even when this tab isn't focused
  useEffect(() => {
    if (!me) return;
    async function subscribePush() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
          });
        }
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: me.username, subscription: sub }),
        });
      } catch (err) {
        // push not supported / permission denied — calling still works while the app is open
      }
    }
    subscribePush();
  }, [me]);

  // fix: the local preview <video> only exists in the DOM once the call
  // overlay is mounted (status !== 'ready'), so assign the stream here,
  // after render, instead of at the moment getUserMedia resolves.
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && callType === 'video' && cameraOn) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [status, cameraOn, callType]);

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

      const conn = peerRef.current.connect(`gaplashuv-${username}`);
      dataConnRef.current = conn;
      attachDataHandlers(conn);

      // best-effort push notification in case the other side's tab isn't open
      fetch('/api/notify-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: username, fromName: me.name, type }),
      }).catch(() => {});
    } catch (err) {
      setError('Mikrofon/kameraga ruxsat berilmadi');
    }
  }

  async function acceptCall() {
    setError('');
    try {
      const stream = await getStream(callType === 'video');
      localStreamRef.current = stream;
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
    dataConnRef.current?.open && dataConnRef.current.send({ type: 'hangup' });
    activeCallRef.current && activeCallRef.current.close();
    activeCallRef.current = null;
    setStatus('ready');
  }

  function attachDataHandlers(conn) {
    conn.on('data', (data) => {
      if (!data || typeof data !== 'object') return;
      if (data.type === 'hangup') endCall(true);
      else if (data.type === 'mic') setRemoteMicOff(!!data.off);
      else if (data.type === 'camera') setRemoteCameraOff(!!data.off);
    });
    conn.on('close', () => {
      dataConnRef.current = null;
    });
  }

  function attachRemoteStream(stream, type) {
    if (type === 'video' && remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
    else if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
  }

  function endCall(skipSignal) {
    if (!skipSignal && dataConnRef.current?.open) {
      dataConnRef.current.send({ type: 'hangup' });
    }
    activeCallRef.current && activeCallRef.current.close();
    activeCallRef.current = null;
    if (dataConnRef.current) {
      const conn = dataConnRef.current;
      dataConnRef.current = null;
      setTimeout(() => conn.close(), 200);
    }
    stopLocalStream();
    setStatus('ready');
    setMuted(false);
    setCameraOn(true);
    setFacingMode('user');
    setExpanded(false);
    setRemoteMicOff(false);
    setRemoteCameraOff(false);
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
      dataConnRef.current?.open && dataConnRef.current.send({ type: 'mic', off: !track.enabled });
    }
  }

  function toggleCamera() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraOn(track.enabled);
      dataConnRef.current?.open && dataConnRef.current.send({ type: 'camera', off: !track.enabled });
    }
  }

  async function switchCamera() {
    if (!localStreamRef.current || callType !== 'video') return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: { exact: nextFacing } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      const pc = activeCallRef.current?.peerConnection;
      const sender = pc?.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);

      localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
      const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
      const combined = new MediaStream([newVideoTrack, ...(oldAudioTrack ? [oldAudioTrack] : [])]);
      localStreamRef.current = combined;
      if (localVideoRef.current) localVideoRef.current.srcObject = combined;
      setFacingMode(nextFacing);
      newStream.getAudioTracks().forEach((t) => t.stop());
    } catch (err) {
      setError("Kamera almashtirilmadi — qurilmada faqat bitta kamera bo'lishi mumkin");
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
    if (!res.ok) setAddMsg(data.error);
    else {
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
  const isVideoFull = callType === 'video' && (isMobile || expanded);

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
      {status === 'connecting' && <p style={styles.reconnecting}>Ulanmoqda…</p>}

      <form onSubmit={sendRequest} style={styles.addForm}>
        <input style={styles.addInput} value={addUsername} onChange={(e) => setAddUsername(e.target.value)} placeholder="username kiriting" />
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
              <button style={{ ...styles.callBtn, opacity: u.online && status === 'ready' ? 1 : 0.4 }} disabled={!u.online || status !== 'ready'} onClick={() => startCall(u.username, u.name, 'audio')} title="Audio qo'ng'iroq">📞</button>
              <button style={{ ...styles.callBtn, opacity: u.online && status === 'ready' ? 1 : 0.4 }} disabled={!u.online || status !== 'ready'} onClick={() => startCall(u.username, u.name, 'video')} title="Video qo'ng'iroq">🎥</button>
            </div>
          </li>
        ))}
      </ul>

      {inCallOverlay && (
        <div style={{ ...styles.overlay, background: isVideoFull ? '#000' : 'rgba(16,21,28,0.97)' }}>
          {callType === 'video' && !isMobile && status === 'in-call' && (
            <button style={{ ...styles.iconBtnSmall, position: 'absolute', top: 16, right: 16, zIndex: 3 }} onClick={() => setExpanded((v) => !v)} title="Kattalashtirish">
              {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}

          {isVideoFull ? (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline style={styles.fullRemoteVideo} />
              {remoteCameraOff && status === 'in-call' && (
                <div style={styles.remoteCameraOffOverlay}>
                  <VideoOff size={28} color="rgba(255,255,255,0.6)" />
                  <span>{peerName} kamerasini o'chirdi</span>
                </div>
              )}
              {cameraOn ? (
                <video ref={localVideoRef} autoPlay playsInline muted style={styles.fullLocalVideo} />
              ) : (
                <div style={styles.fullLocalVideoOff}><VideoOff size={20} color="var(--text-dim)" /></div>
              )}
              <div style={styles.fullTopBar}>
                <div style={styles.overlayName}>
                  {peerName} {remoteMicOff && <MicOff size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />}
                </div>
                <div style={styles.overlayStateFull}>
                  {status === 'calling' && 'Chaqirilmoqda…'}
                  {status === 'incoming' && `${callType === 'video' ? 'Video' : 'Audio'} qo'ng'iroq`}
                  {status === 'in-call' && 'Suhbat davom etmoqda'}
                </div>
              </div>
              <div style={styles.fullBottomBar}>{renderControls()}</div>
            </>
          ) : (
            <>
              <div style={styles.overlayName}>
                {peerName} {remoteMicOff && <MicOff size={16} style={{ verticalAlign: 'middle', marginLeft: 6 }} />}
              </div>
              <div style={styles.overlayState}>
                {status === 'calling' && 'Chaqirilmoqda…'}
                {status === 'incoming' && `${callType === 'video' ? 'Video' : 'Audio'} qo'ng'iroq`}
                {status === 'in-call' && 'Suhbat davom etmoqda'}
              </div>
              {callType === 'video' && (
                <div style={styles.videoGrid}>
                  <video ref={remoteVideoRef} autoPlay playsInline style={styles.remoteVideo} />
                  {remoteCameraOff && status === 'in-call' && (
                    <div style={styles.remoteCameraOffOverlaySmall}>
                      <VideoOff size={22} color="rgba(255,255,255,0.6)" />
                      <span>Kamera o'chirilgan</span>
                    </div>
                  )}
                  {cameraOn ? (
                    <video ref={localVideoRef} autoPlay playsInline muted style={styles.localVideo} />
                  ) : (
                    <div style={styles.localVideoOff}><VideoOff size={18} color="var(--text-dim)" /></div>
                  )}
                </div>
              )}
              <div style={styles.overlayActions}>{renderControls()}</div>
            </>
          )}
          <audio ref={remoteAudioRef} autoPlay />
        </div>
      )}
    </div>
  );

  function renderControls() {
    return (
      <>
        {status === 'incoming' && (
          <>
            <button style={styles.acceptCircle} onClick={acceptCall} title="Qabul qilish"><Phone size={22} /></button>
            <button style={styles.declineCircle} onClick={declineCall} title="Rad etish"><PhoneOff size={22} /></button>
          </>
        )}
        {(status === 'calling' || status === 'in-call') && (
          <>
            {status === 'in-call' && (
              <>
                <button style={muted ? styles.iconBtnOff : styles.iconBtn} onClick={toggleMute} title={muted ? 'Ovozni yoqish' : 'Ovozsiz'}>
                  {muted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
                {callType === 'video' && (
                  <>
                    <button style={!cameraOn ? styles.iconBtnOff : styles.iconBtn} onClick={toggleCamera} title={cameraOn ? 'Kamerani o\'chirish' : 'Kamerani yoqish'}>
                      {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                    <button style={styles.iconBtn} onClick={switchCamera} title="Kamerani almashtirish">
                      <SwitchCamera size={20} />
                    </button>
                  </>
                )}
              </>
            )}
            <button style={styles.declineCircle} onClick={endCall} title="Tugatish"><PhoneOff size={22} /></button>
          </>
        )}
      </>
    );
  }
}

const styles = {
  page: { minHeight: '100vh', padding: '24px 20px 60px', maxWidth: 480, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  hi: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22 },
  username: { color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 13 },
  logout: { background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--surface-2)', borderRadius: 8, padding: '8px 12px', fontSize: 13 },
  error: { color: 'var(--danger)', fontSize: 13, marginBottom: 12 },
  reconnecting: { color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 },
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

  overlay: { position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, zIndex: 10 },
  overlayName: { fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#fff' },
  overlayState: { color: 'var(--text-dim)', fontSize: 14, marginBottom: 8 },
  overlayStateFull: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },

  videoGrid: { position: 'relative', width: '100%', maxWidth: 420 },
  remoteVideo: { width: '100%', borderRadius: 14, background: '#000', aspectRatio: '4 / 3', objectFit: 'cover' },
  localVideo: { position: 'absolute', bottom: 12, right: 12, width: '30%', borderRadius: 10, background: '#000', objectFit: 'cover' },
  localVideoOff: { position: 'absolute', bottom: 12, right: 12, width: '30%', aspectRatio: '4 / 3', borderRadius: 10, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  remoteCameraOffOverlaySmall: {
    position: 'absolute', inset: 0, borderRadius: 14, background: 'rgba(0,0,0,0.55)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
    color: 'rgba(255,255,255,0.75)', fontSize: 13,
  },

  fullRemoteVideo: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  fullLocalVideo: { position: 'absolute', top: 70, right: 16, width: 96, height: 128, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)', zIndex: 2 },
  fullLocalVideoOff: { position: 'absolute', top: 70, right: 16, width: 96, height: 128, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  fullTopBar: { position: 'absolute', top: 0, left: 0, right: 0, padding: '20px 20px 40px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)', zIndex: 1 },
  fullBottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: '40px 20px 28px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', display: 'flex', gap: 16, justifyContent: 'center', zIndex: 1 },
  remoteCameraOffOverlay: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
    color: 'rgba(255,255,255,0.75)', fontSize: 14, zIndex: 1,
  },

  overlayActions: { display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  iconBtn: { width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnOff: { width: 52, height: 52, borderRadius: '50%', background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  iconBtnSmall: { width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  acceptCircle: { width: 56, height: 56, borderRadius: '50%', background: 'var(--teal)', color: '#08201a', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  declineCircle: { width: 56, height: 56, borderRadius: '50%', background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
