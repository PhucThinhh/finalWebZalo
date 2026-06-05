import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

let stompClient: Client | null = null;

let roomSubscription: StompSubscription | null = null;
let pinSubscription: StompSubscription | null = null;
let recallSubscription: StompSubscription | null = null;
let deleteSubscription: StompSubscription | null = null;

// Android emulator
const SOCKJS_URL = "http://10.0.2.2:8080/ws";
// Máy thật dùng IP máy tính, ví dụ:
// const SOCKJS_URL = "http://192.168.1.10:8080/ws";

type ConnectParams = {
  userId: string | number;
  roomId: string;
  onMessage: (message: any) => void;

  // Gọi khi có ghim / bỏ ghim tin nhắn
  onPinChanged?: () => void;

  // Gọi khi có thu hồi tin nhắn realtime
  onRecallChanged?: (messageId: string) => void;

  // Gọi khi có xoá tin nhắn realtime
  onDeleteChanged?: (messageId: string) => void;
};

export const connectChatSocket = ({
  userId,
  roomId,
  onMessage,
  onPinChanged,
  onRecallChanged,
  onDeleteChanged,
}: ConnectParams) => {
  if (!userId || !roomId) {
    console.log("connectChatSocket missing data:", { userId, roomId });
    return;
  }

  if (stompClient?.active) {
    disconnectChatSocket();
  }

  stompClient = new Client({
    webSocketFactory: () => new SockJS(`${SOCKJS_URL}?userId=${userId}`),

    reconnectDelay: 5000,

    debug: (str) => {
      console.log("STOMP:", str);
    },

    onConnect: () => {
      console.log("STOMP connected");
      console.log("SUBSCRIBE ROOM:", `/topic/chat/${roomId}`);

      // Tin nhắn mới
      roomSubscription =
        stompClient?.subscribe(`/topic/chat/${roomId}`, (message: IMessage) => {
          try {
            const body = JSON.parse(message.body);
            onMessage(body);
          } catch (error) {
            console.log("parse socket message error:", error);
          }
        }) || null;

      // Ghim / bỏ ghim tin nhắn
      pinSubscription =
        stompClient?.subscribe(`/topic/chat/${roomId}/pin`, (message: IMessage) => {
          console.log("PIN SOCKET RECEIVED:", message.body);

          onPinChanged?.();
        }) || null;

      // Thu hồi tin nhắn
      recallSubscription =
        stompClient?.subscribe(
          `/topic/chat/${roomId}/recall`,
          (message: IMessage) => {
            console.log("RECALL SOCKET RECEIVED:", message.body);

            onRecallChanged?.(message.body);
          }
        ) || null;

      // Xoá tin nhắn
      deleteSubscription =
        stompClient?.subscribe(
          `/topic/chat/${roomId}/delete`,
          (message: IMessage) => {
            console.log("DELETE SOCKET RECEIVED:", message.body);

            onDeleteChanged?.(message.body);
          }
        ) || null;
    },

    onStompError: (frame) => {
      console.log("STOMP error:", frame.headers["message"]);
      console.log("STOMP details:", frame.body);
    },

    onWebSocketClose: (event) => {
      console.log("WebSocket closed:", event);
    },

    onWebSocketError: (event) => {
      console.log("WebSocket error:", event);
    },
  });

  stompClient.activate();
};

export const disconnectChatSocket = () => {
  try {
    roomSubscription?.unsubscribe();
    pinSubscription?.unsubscribe();
    recallSubscription?.unsubscribe();
    deleteSubscription?.unsubscribe();

    roomSubscription = null;
    pinSubscription = null;
    recallSubscription = null;
    deleteSubscription = null;

    stompClient?.deactivate();
    stompClient = null;
  } catch (error) {
    console.log("disconnect socket error:", error);
  }
};

export const sendSocketMessage = (payload: any) => {
  if (!stompClient || !stompClient.connected) {
    console.log("STOMP chưa connected");
    return false;
  }

  stompClient.publish({
    destination: "/app/chat.send",
    body: JSON.stringify(payload),
  });

  return true;
};