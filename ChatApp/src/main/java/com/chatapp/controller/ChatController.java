package com.chatapp.controller;

import com.chatapp.dto.AiSuggestionRequest;
import com.chatapp.dto.AiAssistantRequest;
import com.chatapp.dto.MessageResponseDTO;
import com.chatapp.dto.PrivateConversationDTO;
import com.chatapp.dto.ReactionEventDTO;
import com.chatapp.dto.SendMessageDTO;
import com.chatapp.dto.UpdateNicknameRequest;
import com.chatapp.entity.BackgroundScope;
import com.chatapp.entity.ConversationNickname;
import com.chatapp.entity.Message;
import com.chatapp.service.AIService;
import com.chatapp.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final AIService aiService;

    // =========================
    // SEND MESSAGE (SOCKET)
    // =========================
    @MessageMapping("/chat.send")
    public void send(SendMessageDTO dto) {

        Message message = chatService.sendMessage(dto);

        if (message == null) {
            return; // STOP nếu bị block
        }
    }

    // =========================
    // GET MESSAGES
    // =========================
    @GetMapping("/messages/{roomId}")
    public List<MessageResponseDTO> getMessages(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.getMessages(roomId, userId);
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
    public void recallMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        chatService.recallMessage(id, userId);
    }

    // =========================
    // REACT MESSAGE
    // =========================
    @PostMapping("/message/{id}/reaction")
    public ReactionEventDTO reactMessage(
            @PathVariable String id,
            @RequestParam String emoji,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.reactMessage(id, userId, emoji);
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

    @PostMapping("/read/{roomId}")
    public void markAsRead(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        chatService.markAsRead(roomId, userId);
    }

    @GetMapping("/unread/{roomId}")
    public long getUnreadCount(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.getUnreadCount(roomId, userId);
    }

    @GetMapping("/private-conversations")
    public List<PrivateConversationDTO> getPrivateConversations(
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.getPrivateConversations(userId);
    }

    @PutMapping("/background/{roomId}")
    public String updateBackground(
            @PathVariable String roomId,
            @RequestParam String background,
            @RequestParam(defaultValue = "PERSONAL") BackgroundScope scope,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.updateConversationBackground(
                roomId,
                userId,
                background,
                scope
        );
    }

    @GetMapping("/background/{roomId}")
    public String getBackground(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.getConversationBackground(roomId, userId);
    }

    @DeleteMapping("/message/{id}/reaction")
    public ReactionEventDTO clearMyReactions(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.clearMyReactions(id, userId);
    }

    // =========================
    // UPDATE PRIVATE NICKNAME
    // =========================
    @PostMapping("/nickname/update")
    public ConversationNickname updateNickname(
            @RequestBody UpdateNicknameRequest request,
            Principal principal
    ) {
        Long ownerUserId = Long.parseLong(principal.getName());

        return chatService.updatePrivateNickname(
                request.getRoomId(),
                ownerUserId,
                request.getTargetUserId(),
                request.getNickname()
        );
    }

    // =========================
    // GET PRIVATE NICKNAME
    // =========================
    @GetMapping("/nickname")
    public Map<String, Object> getNickname(
            @RequestParam String roomId,
            @RequestParam Long targetUserId,
            Principal principal
    ) {
        Long ownerUserId = Long.parseLong(principal.getName());

        String nickname = chatService.getPrivateNickname(
                roomId,
                ownerUserId,
                targetUserId
        );

        return Map.of("nickname", nickname);
    }

    @PutMapping("/message/{id}/pin")
    public MessageResponseDTO pinMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.pinMessage(id, userId);
    }

    @PutMapping("/message/{id}/unpin")
    public MessageResponseDTO unpinMessage(
            @PathVariable String id,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.unpinMessage(id, userId);
    }

    @GetMapping("/pinned/{roomId}")
    public List<MessageResponseDTO> getPinnedMessages(
            @PathVariable String roomId,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());

        return chatService.getPinnedMessages(roomId, userId);
    }

    @PostMapping("/ai/suggestions")
    public Map<String, Object> suggestMessages(
            @Valid @RequestBody AiSuggestionRequest request,
            Principal principal
    ) {
        Long.parseLong(principal.getName());

        return Map.of("suggestions", aiService.suggestMessageRewrites(request.getMessage()));
    }

    @PostMapping("/ai/assistant")
    public Map<String, Object> askAssistant(
            @Valid @RequestBody AiAssistantRequest request,
            Principal principal
    ) {
        Long.parseLong(principal.getName());

        return Map.of(
                "answer",
                aiService.answerWithContext(request.getQuestion(), request.getContext())
        );
    }
}
