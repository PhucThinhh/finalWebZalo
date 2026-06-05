import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

let stompClient = null;
let connectionState = "DISCONNECTED";
let connectedUserId = null;

let activeRooms = {};
let pendingRooms = {};
let statusSubscription = null;

// ================= GLOBAL LOGOUT =================
window.addEventListener("storage", (event) => {
  if (event.key === "token" && !event.newValue) {
    disconnectSocket();
  }
});

// ================= CONNECT =================
export const connectSocket = (userId, onReady) => {
  const token = localStorage.getItem("token");
  if (!token || !userId) return;

  // Nếu đã connect đúng user rồi thì không tạo lại
  if (stompClient && String(connectedUserId) === String(userId)) {
    return;
  }

  // Nếu socket cũ là user khác thì ngắt trước
  if (stompClient && String(connectedUserId) !== String(userId)) {
    disconnectSocket();
  }

  connectedUserId = userId;

  stompClient = new Client({
    webSocketFactory: () =>
      new SockJS(`http://localhost:8080/ws?userId=${userId}`),

    reconnectDelay: 5000,

    debug: (str) => console.log("STOMP:", str),

    onConnect: () => {
      console.log("✅ SOCKET CONNECTED:", userId);

      connectionState = "CONNECTED";

      // restore active rooms
      Object.entries(activeRooms).forEach(([roomId, cb]) => {
        internalJoinRoom(
          roomId,
          cb.callback,
          cb.deleteCallback,
          cb.recallCallback,
          cb.backgroundCallback,
          cb.reactionCallback,
          cb.pinCallback,
          cb.pollCallback
        );
      });

      // restore pending rooms
      Object.entries(pendingRooms).forEach(([roomId, cb]) => {
        internalJoinRoom(
          roomId,
          cb.onMessage,
          cb.onDelete,
          cb.onRecall,
          cb.onBackground,
          cb.onReaction,
          cb.onPin,
          cb.onPoll
        );
      });

      pendingRooms = {};

      onReady?.();
    },

    onStompError: (frame) => {
      console.error("❌ STOMP ERROR:", frame);
    },

    onWebSocketClose: () => {
      console.log("🔌 SOCKET CLOSED");
      connectionState = "DISCONNECTED";
    },

    onDisconnect: () => {
      console.log("🔌 SOCKET DISCONNECTED");
      connectionState = "DISCONNECTED";
    },
  });

  stompClient.activate();
};

// ================= INTERNAL JOIN ROOM =================
const internalJoinRoom = (
  roomId,
  onMessage,
  onDelete,
  onRecall,
  onBackground,
  onReaction,
  onPin,
  onPoll
) => {
  if (!stompClient || !roomId) return;

  const existing = activeRooms[roomId];

  if (existing) {
    existing.messageSub?.unsubscribe();
    existing.deleteSub?.unsubscribe();
    existing.recallSub?.unsubscribe();
    existing.backgroundSub?.unsubscribe();
    existing.reactionSub?.unsubscribe();
    existing.pinSub?.unsubscribe();
    existing.pollSub?.unsubscribe();

    delete activeRooms[roomId];
  }

  // ================= MESSAGE =================
  const messageSub = stompClient.subscribe(`/topic/chat/${roomId}`, (msg) => {
    try {
      const data = JSON.parse(msg.body);
      onMessage?.(data);
    } catch (err) {
      console.error("Parse message error:", err);
    }
  });

  // ================= DELETE =================
  const deleteSub = stompClient.subscribe(
    `/topic/chat/${roomId}/delete`,
    (msg) => {
      try {
        const deletedId = msg.body;
        console.log("🗑 DELETE ID:", deletedId);
        onDelete?.(deletedId);
      } catch (err) {
        console.error("Parse delete error:", err);
      }
    }
  );

  // ================= RECALL =================
  const recallSub = stompClient.subscribe(
    `/topic/chat/${roomId}/recall`,
    (msg) => {
      try {
        const recallId = msg.body;
        console.log("♻️ RECALL ID:", recallId);
        onRecall?.(recallId);
      } catch (err) {
        console.error("Parse recall error:", err);
      }
    }
  );

  // ================= BACKGROUND CHANGE =================
  const backgroundSub = stompClient.subscribe(
    `/topic/chat/${roomId}/background`,
    (msg) => {
      try {
        const data = JSON.parse(msg.body || "{}");
        console.log("🖼 BACKGROUND CHANGED:", data);
        onBackground?.(data);
      } catch (err) {
        console.error("Parse background error:", err);
      }
    }
  );

  // ================= REACTION =================
  const reactionSub = stompClient.subscribe(
    `/topic/chat/${roomId}/reaction`,
    (msg) => {
      try {
        const data = JSON.parse(msg.body || "{}");
        console.log("😀 REACTION:", data);
        onReaction?.(data);
      } catch (err) {
        console.error("Parse reaction error:", err);
      }
    }
  );

  // ================= PIN MESSAGE =================
  const pinSub = stompClient.subscribe(`/topic/chat/${roomId}/pin`, (msg) => {
    try {
      const data = JSON.parse(msg.body || "{}");
      console.log("📌 PIN:", data);
      onPin?.(data);
    } catch (err) {
      console.error("Parse pin error:", err);
    }
  });

  // ================= POLL / BÌNH CHỌN =================
  const pollSub = stompClient.subscribe(`/topic/chat/${roomId}/poll`, (msg) => {
    try {
      const data = JSON.parse(msg.body || "{}");
      console.log("📊 POLL:", data);
      onPoll?.(data);
    } catch (err) {
      console.error("Parse poll error:", err);
    }
  });

  activeRooms[roomId] = {
    messageSub,
    deleteSub,
    recallSub,
    backgroundSub,
    reactionSub,
    pinSub,
    pollSub,

    callback: onMessage,
    deleteCallback: onDelete,
    recallCallback: onRecall,
    backgroundCallback: onBackground,
    reactionCallback: onReaction,
    pinCallback: onPin,
    pollCallback: onPoll,
  };

  console.log("📌 Joined room:", roomId);
};

// ================= JOIN ROOM =================
export const joinRoom = (
  roomId,
  onMessage,
  onDelete,
  onRecall,
  onBackground,
  onReaction,
  onPin,
  onPoll
) => {
  if (!roomId) return;

  if (!stompClient || connectionState !== "CONNECTED") {
    pendingRooms[roomId] = {
      onMessage,
      onDelete,
      onRecall,
      onBackground,
      onReaction,
      onPin,
      onPoll,
    };
    return;
  }

  internalJoinRoom(
    roomId,
    onMessage,
    onDelete,
    onRecall,
    onBackground,
    onReaction,
    onPin,
    onPoll
  );
};

// ================= LEAVE ROOM =================
export const leaveRoom = (roomId) => {
  if (!roomId) return;

  if (activeRooms[roomId]) {
    activeRooms[roomId].messageSub?.unsubscribe();
    activeRooms[roomId].deleteSub?.unsubscribe();
    activeRooms[roomId].recallSub?.unsubscribe();
    activeRooms[roomId].backgroundSub?.unsubscribe();
    activeRooms[roomId].reactionSub?.unsubscribe();
    activeRooms[roomId].pinSub?.unsubscribe();
    activeRooms[roomId].pollSub?.unsubscribe();

    delete activeRooms[roomId];

    console.log("🚪 Left room:", roomId);
  }

  if (pendingRooms[roomId]) {
    delete pendingRooms[roomId];
  }
};

// ================= SEND MESSAGE =================
export const sendMessageSocket = (message) => {
  const token = localStorage.getItem("token");

  if (!token || connectionState !== "CONNECTED" || !stompClient) {
    console.log("BLOCK SEND - socket not ready");
    return;
  }

  stompClient.publish({
    destination: "/app/chat.send",
    body: JSON.stringify(message),
  });
};

// ================= SUBSCRIBE ONLINE STATUS =================
export const subscribeUserStatus = (callback) => {
  if (!stompClient || connectionState !== "CONNECTED") return null;

  if (statusSubscription) {
    statusSubscription.unsubscribe();
    statusSubscription = null;
  }

  statusSubscription = stompClient.subscribe("/topic/users/status", (msg) => {
    try {
      const data = JSON.parse(msg.body);
      console.log("👤 STATUS:", data);
      callback?.(data);
    } catch (err) {
      console.error("Parse user status error:", err);
    }
  });

  return statusSubscription;
};

// ================= SUBSCRIBE ONLINE LIST =================
export const subscribeOnlineList = (callback) => {
  if (!stompClient || connectionState !== "CONNECTED") return null;

  return stompClient.subscribe("/topic/users/list", (msg) => {
    try {
      const data = JSON.parse(msg.body);
      console.log("👥 ONLINE LIST:", data);
      callback?.(data);
    } catch (err) {
      console.error("Parse online list error:", err);
    }
  });
};

// ================= SUBSCRIBE GROUP UPDATES =================
export const subscribeGroupUpdates = (userId, callback) => {
  if (!stompClient || connectionState !== "CONNECTED" || !userId) return null;

  return stompClient.subscribe(`/topic/group-updates/${userId}`, (msg) => {
    try {
      const data = JSON.parse(msg.body || "{}");
      callback?.(data);
    } catch {
      callback?.({});
    }
  });
};

// ================= SUBSCRIBE CONVERSATION UPDATES =================
export const subscribeConversationUpdates = (userId, callback) => {
  if (!stompClient || connectionState !== "CONNECTED" || !userId) return null;

  return stompClient.subscribe(
    `/topic/conversation-updates/${userId}`,
    (msg) => {
      try {
        const data = JSON.parse(msg.body || "{}");
        console.log("💬 CONVERSATION UPDATE:", data);
        callback?.(data);
      } catch (err) {
        console.error("Parse conversation update error:", err);
      }
    }
  );
};

// ================= DISCONNECT =================
export const disconnectSocket = () => {
  if (statusSubscription) {
    statusSubscription.unsubscribe();
    statusSubscription = null;
  }

  Object.values(activeRooms).forEach((room) => {
    room.messageSub?.unsubscribe();
    room.deleteSub?.unsubscribe();
    room.recallSub?.unsubscribe();
    room.backgroundSub?.unsubscribe();
    room.reactionSub?.unsubscribe();
    room.pinSub?.unsubscribe();
    room.pollSub?.unsubscribe();
  });

  stompClient?.deactivate();

  stompClient = null;
  connectionState = "DISCONNECTED";
  connectedUserId = null;

  activeRooms = {};
  pendingRooms = {};

  console.log("❌ SOCKET DISCONNECTED");
};
export const sendCallSignalSocket = (signal) => {
  const token = localStorage.getItem("token");

  if (!token || connectionState !== "CONNECTED" || !stompClient) {
    console.log("BLOCK CALL SIGNAL - socket not ready");
    return;
  }

  stompClient.publish({
    destination: "/app/call.signal",
    body: JSON.stringify(signal),
  });
};

export const subscribeCallSignal = (userId, callback) => {
  if (!userId) return null;

  if (!stompClient || connectionState !== "CONNECTED") {
    return null;
  }

  return stompClient.subscribe(`/topic/call/user/${userId}`, (msg) => {
    try {
      const data = JSON.parse(msg.body || "{}");
      console.log("📞 CALL SIGNAL:", data);
      callback?.(data);
    } catch (err) {
      console.error("Parse call signal error:", err);
    }
  });
};