export default async function handler(req, res) {
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;

  const iceServers = [{ urls: 'stun:stun.relay.metered.ca:80' }];

  if (username && credential) {
    iceServers.push(
      { urls: 'turn:global.relay.metered.ca:80', username, credential },
      { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username, credential },
      { urls: 'turn:global.relay.metered.ca:443', username, credential },
      { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username, credential }
    );
  } else {
    // fallback if TURN credentials aren't configured — works on same
    // network only, cross-network calls will fail
    iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
  }

  return res.status(200).json({ iceServers });
}
