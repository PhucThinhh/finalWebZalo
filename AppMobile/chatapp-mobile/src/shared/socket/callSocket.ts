import { Client, IMessage, StompSubscription } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const SOCKJS_URL = "http://10.0.2.2:8080/ws";

let callClient: Client | null = null;
let roomCallSubscription: StompSubscription | null = null;
let userCallSubscription: StompSubscription | null = null;

type ConnectCallParams = {
  userId: string | number;
  roomId?: string;
  onCallSignal: (signal: any) => void;
};

export const connectCallSocket = ({
  userId,
  roomId,
  onCallSignal,
}: ConnectCallParams) => {
  if (!userId) return;

  if (callClient?.active) {
    disconnectCallSocket();
  }

  callClient = new Client({
    webSocketFactory: () => new SockJS(`${SOCKJS_URL}?userId=${userId}`),
    reconnectDelay: 5000,

    debug: (str) => {
      console.log("CALL STOMP:", str);
    },

    onConnect: () => {
      console.log("CALL SOCKET CONNECTED");

      userCallSubscription =
        callClient?.subscribe(
          `/topic/user/${userId}/call`,
          (message: IMessage) => {
            try {
              const body = JSON.parse(message.body);
              console.log("USER CALL SIGNAL:", body);
              onCallSignal(body);
            } catch (error) {
              console.log("parse user call signal error:", error);
            }
          }
        ) || null;

      if (roomId) {
        roomCallSubscription =
          callClient?.subscribe(
            `/topic/call/${roomId}`,
            (message: IMessage) => {
              try {
                const body = JSON.parse(message.body);
                console.log("ROOM CALL SIGNAL:", body);
                onCallSignal(body);
              } catch (error) {
                console.log("parse room call signal error:", error);
              }
            }
          ) || null;
      }
    },

    onStompError: (frame) => {
      console.log("CALL STOMP error:", frame.headers["message"]);
      console.log("CALL STOMP details:", frame.body);
    },
  });

  callClient.activate();
};

export const disconnectCallSocket = () => {
  try {
    roomCallSubscription?.unsubscribe();
    userCallSubscription?.unsubscribe();

    roomCallSubscription = null;
    userCallSubscription = null;

    callClient?.deactivate();
    callClient = null;
  } catch (error) {
    console.log("disconnect call socket error:", error);
  }
};

export const sendCallSignal = (payload: any) => {
  if (!callClient || !callClient.connected) {
    console.log("CALL SOCKET chưa connected");
    return false;
  }

  callClient.publish({
    destination: "/app/call.signal",
    body: JSON.stringify(payload),
  });

  return true;
};