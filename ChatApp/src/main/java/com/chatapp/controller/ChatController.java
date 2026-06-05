package com.chatapp.controller;

import com.chatapp.dto.SendMessageDTO;
import com.chatapp.entity.Message;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.AIService;
import com.chatapp.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final AIService aiService;

    // =========================
    // SEND MESSAGE SOCKET
    // =========================
    @MessageMapping("/chat.send")
    public void send(SendMessageDTO dto) {
        Message message = chatService.sendMessage(dto);

        if (message == null) {
            return;
        }
    }

    // =========================
    // GET MESSAGES
    // =========================
    @GetMapping("/messages/{roomId}")
    public List<Message> getMessages(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return chatService.getMessages(roomId, userId);
    }

    // =========================
    // GET PINNED MESSAGES
    // =========================
    @GetMapping("/messages/{roomId}/pinned")
    public List<Message> getPinnedMessages(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return chatService.getPinnedMessages(roomId, userId);
    }

    // =========================
    // PIN MESSAGE
    // =========================
    @PutMapping("/message/pin/{id}")
    public Message pinMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return chatService.pinMessage(id, userId);
    }

    // =========================
    // UNPIN MESSAGE
    // =========================
    @PutMapping("/message/unpin/{id}")
    public Message unpinMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return chatService.unpinMessage(id, userId);
    }

    // =========================
    // DELETE FOR ME
    // =========================
    @DeleteMapping("/message/{id}")
    public void deleteMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        chatService.deleteForMe(id, userId);
    }

    // =========================
    // RECALL MESSAGE
    // =========================
    @PutMapping("/message/recall/{id}")
    public void recallMessage(@PathVariable String id) {
        chatService.recallMessage(id);
    }

    // =========================
    // DELETE CONVERSATION FOR ME
    // =========================
    @DeleteMapping("/conversation/{roomId}")
    public void deleteConversation(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        chatService.deleteConversationForMe(roomId, userId);
    }
}