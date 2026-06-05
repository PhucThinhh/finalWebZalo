import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { sendCallSignalSocket } from "../socket/socket";

const ICE_SERVERS = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return "0 phút 0 giây";

  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;

  if (minutes <= 0) return `${remainSeconds} giây`;

  return `${minutes} phút ${remainSeconds} giây`;
};

function useGroupCall({
  roomId,
  currentUserId,
  user,
  selectedGroup,
  onGroupCallMessage,
}) {
  const [incomingGroupCall, setIncomingGroupCall] = useState(null);
  const [groupCallStatus, setGroupCallStatus] = useState("IDLE");
  // IDLE, RINGING, IN_CALL

  const [groupCallMediaType, setGroupCallMediaType] = useState("AUDIO");
  const [groupCallSeconds, setGroupCallSeconds] = useState(0);

  const [isGroupMicMuted, setIsGroupMicMuted] = useState(false);
  const [isGroupCameraOn, setIsGroupCameraOn] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [remoteStreams, setRemoteStreams] = useState({});

  const callIdRef = useRef(null);
  const callStartedAtRef = useRef(null);

  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());

  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);

  useEffect(() => {
    if (groupCallStatus !== "IN_CALL") return;

    const timer = setInterval(() => {
      setGroupCallSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [groupCallStatus]);

  const groupCallTimeText = (() => {
    const minutes = Math.floor(groupCallSeconds / 60);
    const seconds = groupCallSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  })();

  const getCurrentDuration = useCallback(() => {
    if (!callStartedAtRef.current) return 0;

    return Math.max(
      0,
      Math.floor((Date.now() - callStartedAtRef.current) / 1000)
    );
  }, []);

  const addParticipant = useCallback((participant) => {
    if (!participant?.userId) return;

    setParticipants((prev) => {
      const existed = prev.some(
        (item) => Number(item.userId) === Number(participant.userId)
      );

      if (existed) {
        return prev.map((item) =>
          Number(item.userId) === Number(participant.userId)
            ? {
                ...item,
                ...participant,
              }
            : item
        );
      }

      return [...prev, participant];
    });
  }, []);

  const removeParticipant = useCallback((userId) => {
    if (!userId) return;

    setParticipants((prev) =>
      prev.filter((item) => Number(item.userId) !== Number(userId))
    );

    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    const peer = peersRef.current.get(Number(userId));
    peer?.close?.();
    peersRef.current.delete(Number(userId));
  }, []);

  const getLocalMediaStream = async (mediaType = "AUDIO") => {
    if (localStreamRef.current) return localStreamRef.current;

    const needVideo = mediaType === "VIDEO";

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: needVideo,
    });

    localStreamRef.current = stream;

    if (needVideo && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    setIsGroupCameraOn(needVideo);

    return stream;
  };

  const cleanupGroupCall = useCallback(() => {
    peersRef.current.forEach((peer) => {
      try {
        peer.close();
      } catch {
        // ignore
      }
    });

    peersRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    callIdRef.current = null;
    callStartedAtRef.current = null;

    setIncomingGroupCall(null);
    setGroupCallStatus("IDLE");
    setGroupCallMediaType("AUDIO");
    setGroupCallSeconds(0);
    setIsGroupMicMuted(false);
    setIsGroupCameraOn(false);
    setParticipants([]);
    setRemoteStreams({});
  }, []);

  const flushPendingCandidates = async (peerUserId) => {
    const userId = Number(peerUserId);
    const peer = peersRef.current.get(userId);
    const list = pendingCandidatesRef.current.get(userId) || [];

    if (!peer || !peer.remoteDescription || list.length === 0) return;

    pendingCandidatesRef.current.set(userId, []);

    for (const candidate of list) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Group add ICE lỗi:", error);
      }
    }
  };

  const addIceCandidateSafely = async (peerUserId, candidate) => {
    if (!candidate) return;

    const userId = Number(peerUserId);
    const peer = peersRef.current.get(userId);

    if (!peer || !peer.remoteDescription) {
      const oldList = pendingCandidatesRef.current.get(userId) || [];
      pendingCandidatesRef.current.set(userId, [...oldList, candidate]);
      return;
    }

    try {
      await peer.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error("Group add ICE candidate lỗi:", error);
    }
  };

  const createPeerConnection = useCallback(
    (peerUserId, mediaType = "AUDIO") => {
      const targetUserId = Number(peerUserId);

      if (!roomId || !currentUserId || !targetUserId) return null;

      const existed = peersRef.current.get(targetUserId);
      if (existed) return existed;

      const peer = new RTCPeerConnection(ICE_SERVERS);

      peer.onicecandidate = (event) => {
        if (!event.candidate) return;

        sendCallSignalSocket({
          type: "GROUP_CALL_ICE",
          callId: callIdRef.current,
          roomId,
          callerId: Number(currentUserId),
          receiverId: targetUserId,
          payload: {
            mediaType,
            candidate: event.candidate,
          },
        });
      };

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;

        setRemoteStreams((prev) => ({
          ...prev,
          [targetUserId]: stream,
        }));
      };

      peer.onconnectionstatechange = () => {
        console.log("GROUP WEBRTC STATE:", targetUserId, peer.connectionState);

        if (
          peer.connectionState === "disconnected" ||
          peer.connectionState === "failed" ||
          peer.connectionState === "closed"
        ) {
          removeParticipant(targetUserId);
        }
      };

      peersRef.current.set(targetUserId, peer);
      return peer;
    },
    [roomId, currentUserId, removeParticipant]
  );

  const createOfferToUser = useCallback(
    async (targetUserId, mediaType = groupCallMediaType) => {
      if (!targetUserId || Number(targetUserId) === Number(currentUserId)) {
        return;
      }

      const peer = createPeerConnection(targetUserId, mediaType);
      if (!peer) return;

      const localStream = await getLocalMediaStream(mediaType);

      localStream.getTracks().forEach((track) => {
        const alreadyAdded = peer
          .getSenders()
          .some((sender) => sender.track?.id === track.id);

        if (!alreadyAdded) {
          peer.addTrack(track, localStream);
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      sendCallSignalSocket({
        type: "GROUP_CALL_OFFER",
        callId: callIdRef.current,
        roomId,
        callerId: Number(currentUserId),
        receiverId: Number(targetUserId),
        callerName: user?.username || "Người dùng",
        callerAvatar: user?.avatar || null,
        payload: {
          mediaType,
          sdp: offer,
        },
      });
    },
    [roomId, currentUserId, user, groupCallMediaType, createPeerConnection]
  );

  const startGroupCall = useCallback(
    async (mediaType = "AUDIO") => {
      if (!roomId || !currentUserId || !selectedGroup?.id) return;

      if (groupCallStatus !== "IDLE") {
        toast.info("Bạn đang trong cuộc gọi nhóm");
        return;
      }

      try {
        const newCallId = `group_call_${selectedGroup.id}_${Date.now()}`;

        callIdRef.current = newCallId;
        callStartedAtRef.current = Date.now();

        setGroupCallMediaType(mediaType);
        setGroupCallSeconds(0);
        setGroupCallStatus("IN_CALL");

        await getLocalMediaStream(mediaType);

        addParticipant({
          userId: Number(currentUserId),
          username: user?.username || "Bạn",
          avatar: user?.avatar || null,
          isMe: true,
        });

        sendCallSignalSocket({
          type: "GROUP_CALL_START",
          callId: newCallId,
          roomId,
          callerId: Number(currentUserId),
          callerName: user?.username || "Người dùng",
          callerAvatar: user?.avatar || null,
          payload: {
            groupId: selectedGroup.id,
            groupName: selectedGroup.name,
            mediaType,
          },
        });

        onGroupCallMessage?.({
          status: "STARTED",
          mediaType,
          callId: newCallId,
          groupId: selectedGroup.id,
          groupName: selectedGroup.name,
        });
      } catch (error) {
        console.error("Start group call lỗi:", error);
        toast.error(
          mediaType === "VIDEO"
            ? "Không thể bắt đầu gọi video nhóm. Kiểm tra camera/micro."
            : "Không thể bắt đầu gọi thoại nhóm. Kiểm tra micro."
        );
        cleanupGroupCall();
      }
    },
    [
      roomId,
      currentUserId,
      selectedGroup,
      user,
      groupCallStatus,
      addParticipant,
      cleanupGroupCall,
      onGroupCallMessage,
    ]
  );

  const startGroupAudioCall = useCallback(() => {
    startGroupCall("AUDIO");
  }, [startGroupCall]);

  const startGroupVideoCall = useCallback(() => {
    startGroupCall("VIDEO");
  }, [startGroupCall]);

  const acceptGroupCall = useCallback(async () => {
    if (!incomingGroupCall || !roomId || !currentUserId) return;

    try {
      const mediaType = incomingGroupCall.payload?.mediaType || "AUDIO";

      callIdRef.current = incomingGroupCall.callId;
      callStartedAtRef.current = Date.now();

      setGroupCallMediaType(mediaType);
      setGroupCallSeconds(0);
      setGroupCallStatus("IN_CALL");

      await getLocalMediaStream(mediaType);

      addParticipant({
        userId: Number(currentUserId),
        username: user?.username || "Bạn",
        avatar: user?.avatar || null,
        isMe: true,
      });

      addParticipant({
        userId: Number(incomingGroupCall.callerId),
        username: incomingGroupCall.callerName || "Người gọi",
        avatar: incomingGroupCall.callerAvatar || null,
      });

      sendCallSignalSocket({
        type: "GROUP_CALL_JOIN",
        callId: incomingGroupCall.callId,
        roomId,
        callerId: Number(currentUserId),
        callerName: user?.username || "Người dùng",
        callerAvatar: user?.avatar || null,
        payload: {
          mediaType,
        },
      });

      setIncomingGroupCall(null);
    } catch (error) {
      console.error("Accept group call lỗi:", error);
      toast.error("Không thể tham gia cuộc gọi nhóm");
      cleanupGroupCall();
    }
  }, [
    incomingGroupCall,
    roomId,
    currentUserId,
    user,
    addParticipant,
    cleanupGroupCall,
  ]);

  const rejectGroupCall = useCallback(() => {
    setIncomingGroupCall(null);
    setGroupCallStatus("IDLE");
  }, []);

  const endGroupCall = useCallback(() => {
    if (!roomId || !currentUserId) {
      cleanupGroupCall();
      return;
    }

    const durationSeconds = getCurrentDuration();
    const mediaType = groupCallMediaType;

    sendCallSignalSocket({
      type: "GROUP_CALL_END",
      callId: callIdRef.current,
      roomId,
      callerId: Number(currentUserId),
      payload: {
        mediaType,
      },
    });

    onGroupCallMessage?.({
      status: "ENDED",
      mediaType,
      durationSeconds,
      durationText: formatDuration(durationSeconds),
    });

    cleanupGroupCall();
  }, [
    roomId,
    currentUserId,
    groupCallMediaType,
    getCurrentDuration,
    onGroupCallMessage,
    cleanupGroupCall,
  ]);

  const leaveGroupCall = useCallback(() => {
    if (!roomId || !currentUserId) {
      cleanupGroupCall();
      return;
    }

    sendCallSignalSocket({
      type: "GROUP_CALL_LEAVE",
      callId: callIdRef.current,
      roomId,
      callerId: Number(currentUserId),
      callerName: user?.username || "Người dùng",
      payload: {
        mediaType: groupCallMediaType,
      },
    });

    cleanupGroupCall();
  }, [roomId, currentUserId, user, groupCallMediaType, cleanupGroupCall]);

  const toggleGroupMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;

    const nextMuted = !isGroupMicMuted;

    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });

    setIsGroupMicMuted(nextMuted);
  }, [isGroupMicMuted]);

  const toggleGroupCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTracks = stream.getVideoTracks();

    if (videoTracks.length === 0) {
      toast.info("Cuộc gọi nhóm hiện tại không có camera");
      return;
    }

    const nextCameraOn = !isGroupCameraOn;

    videoTracks.forEach((track) => {
      track.enabled = nextCameraOn;
    });

    setIsGroupCameraOn(nextCameraOn);
  }, [isGroupCameraOn]);

  const handleGroupCallSignal = useCallback(
    async (signal) => {
      if (!signal?.type) return;

      const senderId = Number(signal.callerId);
      const receiverId = signal.receiverId ? Number(signal.receiverId) : null;

      if (senderId === Number(currentUserId)) return;

      if (receiverId && receiverId !== Number(currentUserId)) return;

      if (!String(signal.type).startsWith("GROUP_CALL_")) return;

      if (signal.type === "GROUP_CALL_START") {
        if (groupCallStatus !== "IDLE") return;

        setIncomingGroupCall(signal);
        setGroupCallMediaType(signal.payload?.mediaType || "AUDIO");
        setGroupCallStatus("RINGING");
        return;
      }

      if (signal.type === "GROUP_CALL_JOIN") {
        if (groupCallStatus !== "IN_CALL") return;

        const joinUserId = Number(signal.callerId);
        const mediaType = signal.payload?.mediaType || groupCallMediaType;

        addParticipant({
          userId: joinUserId,
          username: signal.callerName || `User ${joinUserId}`,
          avatar: signal.callerAvatar || null,
        });

        await createOfferToUser(joinUserId, mediaType);
        return;
      }

      if (signal.type === "GROUP_CALL_OFFER") {
        const mediaType = signal.payload?.mediaType || "AUDIO";
        const offer = signal.payload?.sdp;

        if (!offer) return;

        if (groupCallStatus !== "IN_CALL") {
          callIdRef.current = signal.callId;
          callStartedAtRef.current = Date.now();
          setGroupCallMediaType(mediaType);
          setGroupCallStatus("IN_CALL");
          await getLocalMediaStream(mediaType);
        }

        addParticipant({
          userId: Number(signal.callerId),
          username: signal.callerName || `User ${signal.callerId}`,
          avatar: signal.callerAvatar || null,
        });

        const peer = createPeerConnection(signal.callerId, mediaType);
        if (!peer) return;

        const localStream = await getLocalMediaStream(mediaType);

        localStream.getTracks().forEach((track) => {
          const alreadyAdded = peer
            .getSenders()
            .some((sender) => sender.track?.id === track.id);

          if (!alreadyAdded) {
            peer.addTrack(track, localStream);
          }
        });

        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingCandidates(signal.callerId);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);

        sendCallSignalSocket({
          type: "GROUP_CALL_ANSWER",
          callId: signal.callId,
          roomId,
          callerId: Number(currentUserId),
          receiverId: Number(signal.callerId),
          callerName: user?.username || "Người dùng",
          callerAvatar: user?.avatar || null,
          payload: {
            mediaType,
            sdp: answer,
          },
        });

        return;
      }

      if (signal.type === "GROUP_CALL_ANSWER") {
        const answer = signal.payload?.sdp;
        const peerUserId = Number(signal.callerId);

        if (!answer) return;

        const peer = peersRef.current.get(peerUserId);
        if (!peer) return;

        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        await flushPendingCandidates(peerUserId);

        addParticipant({
          userId: peerUserId,
          username: signal.callerName || `User ${peerUserId}`,
          avatar: signal.callerAvatar || null,
        });

        return;
      }

      if (signal.type === "GROUP_CALL_ICE") {
        await addIceCandidateSafely(signal.callerId, signal.payload?.candidate);
        return;
      }

      if (signal.type === "GROUP_CALL_LEAVE") {
        removeParticipant(signal.callerId);
        toast.info(`${signal.callerName || "Một thành viên"} đã rời cuộc gọi`);
        return;
      }

      if (signal.type === "GROUP_CALL_END") {
        toast.info("Cuộc gọi nhóm đã kết thúc");
        cleanupGroupCall();
      }
    },
    [
      currentUserId,
      roomId,
      user,
      groupCallStatus,
      groupCallMediaType,
      addParticipant,
      createOfferToUser,
      createPeerConnection,
      removeParticipant,
      cleanupGroupCall,
    ]
  );

  const joinExistingGroupCall = useCallback(
    async (callInfo) => {
      if (!callInfo?.callId || !roomId || !currentUserId) return;

      if (groupCallStatus === "IN_CALL") {
        toast.info("Bạn đang trong cuộc gọi nhóm");
        return;
      }

      try {
        const mediaType = callInfo.mediaType || "AUDIO";

        callIdRef.current = callInfo.callId;
        callStartedAtRef.current = Date.now();

        setGroupCallMediaType(mediaType);
        setGroupCallSeconds(0);
        setGroupCallStatus("IN_CALL");

        await getLocalMediaStream(mediaType);

        addParticipant({
          userId: Number(currentUserId),
          username: user?.username || "Bạn",
          avatar: user?.avatar || null,
          isMe: true,
        });

        sendCallSignalSocket({
          type: "GROUP_CALL_JOIN",
          callId: callInfo.callId,
          roomId,
          callerId: Number(currentUserId),
          callerName: user?.username || "Người dùng",
          callerAvatar: user?.avatar || null,
          payload: {
            mediaType,
          },
        });

        toast.success("Đã tham gia cuộc gọi nhóm");
      } catch (error) {
        console.error("Join existing group call lỗi:", error);
        toast.error("Không thể tham gia cuộc gọi nhóm");
        cleanupGroupCall();
      }
    },
    [
      roomId,
      currentUserId,
      user,
      groupCallStatus,
      addParticipant,
      cleanupGroupCall,
    ]
  );

  return {
    incomingGroupCall,
    groupCallStatus,
    groupCallMediaType,
    groupCallTimeText,

    participants,
    remoteStreams,

    localVideoRef,

    isGroupMicMuted,
    isGroupCameraOn,

    startGroupAudioCall,
    startGroupVideoCall,
    acceptGroupCall,
    rejectGroupCall,
    endGroupCall,
    leaveGroupCall,

    toggleGroupMic,
    toggleGroupCamera,

    handleGroupCallSignal,
    joinExistingGroupCall,
  };
}

export default useGroupCall;
