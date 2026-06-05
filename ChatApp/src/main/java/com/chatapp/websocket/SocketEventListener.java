package com.chatapp.websocket;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;

import java.security.Principal;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class SocketEventListener {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // userId -> danh sách sessionId đang online
    private final Map<String, Set<String>> userSessions = new ConcurrentHashMap<>();

    public Set<String> getOnlineUserIds() {
        return userSessions.keySet();
    }

    // ================= CONNECT =================
    @EventListener
    public void handleConnect(SessionConnectedEvent event) {

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        String sessionId = accessor.getSessionId();

        boolean wasOffline = !userSessions.containsKey(userId);

        userSessions
                .computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet())
                .add(sessionId);

        if (wasOffline) {
            messagingTemplate.convertAndSend(
                    "/topic/users/status",
                    Map.of(
                            "userId", userId,
                            "status", "ONLINE"
                    )
            );
        }

        sendOnlineList();

        System.out.println("🟢 ONLINE: " + userId + " | sessions=" + userSessions.get(userId).size());
    }

    // ================= DISCONNECT =================
    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        Principal principal = accessor.getUser();
        if (principal == null) return;

        String userId = principal.getName();
        String sessionId = accessor.getSessionId();

        Set<String> sessions = userSessions.getOrDefault(userId, Collections.emptySet());

        if (!sessions.isEmpty()) {
            sessions.remove(sessionId);
        }

        boolean isReallyOffline = sessions.isEmpty();

        if (isReallyOffline) {
            userSessions.remove(userId);

            messagingTemplate.convertAndSend(
                    "/topic/users/status",
                    Map.of(
                            "userId", userId,
                            "status", "OFFLINE"
                    )
            );

            System.out.println("🔴 OFFLINE: " + userId);
        } else {
            System.out.println("🟡 SESSION CLOSED BUT USER STILL ONLINE: " + userId
                    + " | sessions=" + sessions.size());
        }

        sendOnlineList();
    }

    // Khi client subscribe list, gửi lại list hiện tại
    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());

        String destination = accessor.getDestination();

        if ("/topic/users/list".equals(destination)) {
            sendOnlineList();
        }
    }

    private void sendOnlineList() {
        messagingTemplate.convertAndSend(
                "/topic/users/list",
                getOnlineUserIds()
        );
    }
}
