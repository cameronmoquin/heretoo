/**
 * useVideoCall — peer-to-peer WebRTC over Supabase Realtime signaling.
 *
 * Mesh topology — every peer holds an RTCPeerConnection to every other
 * peer. Up to ~6 fits comfortably; we cap at 4 in the UI to leave
 * headroom. Beyond that we'd need an SFU (LiveKit, mediasoup); not
 * shipped in v1.
 *
 * Signaling protocol (broadcast over Supabase channel `call:{id}`):
 *   - { kind: 'join', from }
 *   - { kind: 'offer', from, to, sdp }
 *   - { kind: 'answer', from, to, sdp }
 *   - { kind: 'ice', from, to, candidate }
 *   - { kind: 'leave', from }
 *
 * Each message is targeted at a specific peer via `to`. The `from`
 * field is the sender's profile_id; we trust auth here because the
 * Realtime channel is RLS-gated by the participants table.
 *
 * Native: getUserMedia + RTCPeerConnection are web-only in this
 * codebase. The hook returns dummies on native.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface RemotePeer {
  userId: string;
  stream: MediaStream | null;
}

interface UseVideoCallReturn {
  localStream: MediaStream | null;
  remotePeers: RemotePeer[];
  micEnabled: boolean;
  cameraEnabled: boolean;
  toggleMic: () => void;
  toggleCamera: () => void;
  leave: () => Promise<void>;
  error: string | null;
}

export function useVideoCall(callId: string | null): UseVideoCallReturn {
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemotePeer[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Long-lived refs so unmount cleanup can reach them.
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;
    if (!callId || !userId) return;

    let cancelled = false;
    let unmounted = false;

    (async () => {
      // 1. Local media — camera + mic.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (e: any) {
        setError(e?.message ?? 'Could not access camera or microphone.');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);

      // 2. Mark joined in DB.
      try {
        await supabase
          .from('video_call_participants')
          .upsert(
            { call_id: callId, user_id: userId, joined_at: new Date().toISOString(), left_at: null } as any,
            { onConflict: 'call_id,user_id' },
          );
      } catch {}

      // 3. Open the Realtime signaling channel.
      const channel = supabase.channel(`call:${callId}`, {
        config: { broadcast: { self: false } },
      });
      channelRef.current = channel;

      const send = (payload: any) => {
        channel.send({ type: 'broadcast', event: 'sig', payload });
      };

      channel
        .on('broadcast', { event: 'sig' }, async ({ payload }: any) => {
          if (unmounted) return;
          const m = payload as any;
          if (!m?.from || m.from === userId) return;
          // Filter messages targeted at others
          if (m.to && m.to !== userId) return;

          if (m.kind === 'join') {
            // A new peer joined — we initiate the offer (rule: peer
            // with the smaller userId initiates, ties broken by string
            // compare. Symmetric so both sides agree on direction).
            if (userId < m.from) {
              await ensureOfferTo(m.from);
            }
          } else if (m.kind === 'offer') {
            await handleOffer(m.from, m.sdp);
          } else if (m.kind === 'answer') {
            await handleAnswer(m.from, m.sdp);
          } else if (m.kind === 'ice') {
            await handleIce(m.from, m.candidate);
          } else if (m.kind === 'leave') {
            removePeer(m.from);
          }
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED') {
            send({ kind: 'join', from: userId });
          }
        });

      // ── Per-peer setup helpers ────────────────────────────────

      const ensureOfferTo = async (peerId: string) => {
        if (peersRef.current.has(peerId)) return;
        const pc = newPeer(peerId);
        // Add local tracks
        for (const t of stream.getTracks()) pc.addTrack(t, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ kind: 'offer', from: userId, to: peerId, sdp: offer });
      };

      const handleOffer = async (peerId: string, sdp: any) => {
        let pc = peersRef.current.get(peerId);
        if (!pc) {
          pc = newPeer(peerId);
          for (const t of stream.getTracks()) pc.addTrack(t, stream);
        }
        await pc.setRemoteDescription(sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ kind: 'answer', from: userId, to: peerId, sdp: answer });
      };

      const handleAnswer = async (peerId: string, sdp: any) => {
        const pc = peersRef.current.get(peerId);
        if (!pc) return;
        await pc.setRemoteDescription(sdp);
      };

      const handleIce = async (peerId: string, candidate: any) => {
        const pc = peersRef.current.get(peerId);
        if (!pc || !candidate) return;
        try { await pc.addIceCandidate(candidate); } catch {}
      };

      const newPeer = (peerId: string): RTCPeerConnection => {
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        peersRef.current.set(peerId, pc);

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            send({ kind: 'ice', from: userId, to: peerId, candidate: e.candidate });
          }
        };
        pc.ontrack = (e) => {
          // Replace or insert the remote stream for this peer.
          const remote = e.streams[0] ?? new MediaStream([e.track]);
          setRemotePeers((prev) => {
            const idx = prev.findIndex((p) => p.userId === peerId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { userId: peerId, stream: remote };
              return next;
            }
            return [...prev, { userId: peerId, stream: remote }];
          });
        };
        pc.onconnectionstatechange = () => {
          if (
            pc.connectionState === 'failed'
            || pc.connectionState === 'closed'
            || pc.connectionState === 'disconnected'
          ) {
            removePeer(peerId);
          }
        };
        return pc;
      };

      const removePeer = (peerId: string) => {
        const pc = peersRef.current.get(peerId);
        if (pc) {
          try { pc.close(); } catch {}
          peersRef.current.delete(peerId);
        }
        setRemotePeers((prev) => prev.filter((p) => p.userId !== peerId));
      };
    })();

    return () => {
      cancelled = true;
      unmounted = true;
      // Send leave signal.
      try {
        channelRef.current?.send({
          type: 'broadcast',
          event: 'sig',
          payload: { kind: 'leave', from: userId },
        });
      } catch {}
      // Tear down peer connections.
      peersRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peersRef.current.clear();
      // Stop local tracks.
      const ls = localStreamRef.current;
      if (ls) ls.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setRemotePeers([]);
      // Remove the channel.
      try { if (channelRef.current) supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
      // Stamp left_at in DB.
      if (callId && userId) {
        supabase
          .from('video_call_participants')
          .update({ left_at: new Date().toISOString() } as any)
          .eq('call_id', callId)
          .eq('user_id', userId)
          .then(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, userId]);

  const toggleMic = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const audio = ls.getAudioTracks()[0];
    if (!audio) return;
    audio.enabled = !audio.enabled;
    setMicEnabled(audio.enabled);
  };

  const toggleCamera = () => {
    const ls = localStreamRef.current;
    if (!ls) return;
    const video = ls.getVideoTracks()[0];
    if (!video) return;
    video.enabled = !video.enabled;
    setCameraEnabled(video.enabled);
  };

  const leave = async () => {
    // Triggering the cleanup is enough — it sends 'leave' and closes
    // peers. We rely on the parent route to actually unmount.
  };

  return { localStream, remotePeers, micEnabled, cameraEnabled, toggleMic, toggleCamera, leave, error };
}
