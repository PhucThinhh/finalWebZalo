package com.chatapp.service;

import com.chatapp.dto.SendMessageDTO;
import com.chatapp.entity.ConversationState;
import com.chatapp.entity.Message;
import com.chatapp.repository.ConversationStateRepository;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final MessageRepository messageRepository;
    private final ConversationService conversationService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationStateRepository conversationRepository;
    private final BlockedService blockedService;
    private final GroupMemberRepository memberRepo;
    private final AIService aiService;

    // =========================
    // SEND MESSAGE
    // =========================
    public Message sendMessage(SendMessageDTO dto) {

        if (dto == null) {
            throw new RuntimeException("Dữ liệu tin nhắn không hợp lệ");
        }

        if (dto.getSenderId() == null) {
            throw new RuntimeException("Thiếu senderId");
        }

        if (dto.getRoomId() == null || dto.getRoomId().isBlank()) {
            throw new RuntimeException("Thiếu roomId");
        }

        String roomId;
        String groupId = null;

        boolean isGroupMessage =
                Boolean.TRUE.equals(dto.getIsGroup())
                        || dto.getGroupId() != null
                        || isGroupRoomId(dto.getRoomId());

        if (isGroupMessage) {

            groupId = resolveGroupId(dto);

            if (groupId == null || groupId.isBlank()) {
                throw new RuntimeException("Thiếu groupId");
            }

            roomId = groupId;

            boolean isMember = memberRepo
                    .existsByGroupIdAndUserId(groupId, dto.getSenderId());

            if (!isMember) {
                throw new RuntimeException("Bạn không thuộc nhóm");
            }

        } else {

            if (dto.getReceiverId() == null) {
                throw new RuntimeException("Thiếu receiverId");
            }

            if (blockedService.isEitherBlocked(dto.getSenderId(), dto.getReceiverId())) {
                System.out.println("🚫 BLOCKED MESSAGE");
                return null;
            }

            roomId = generateRoomId(dto.getSenderId(), dto.getReceiverId());
        }

        String type = dto.getType();
        if (type == null || type.isBlank()) {
            type = "TEXT";
        }

        Message message = Message.builder()
                .senderId(dto.getSenderId())
                .receiverId(isGroupMessage ? null : dto.getReceiverId())
                .roomId(roomId)
                .groupId(isGroupMessage ? groupId : null)
                .isGroup(isGroupMessage)
                .content(dto.getContent())
                .type(type)
                .fileUrl(dto.getFileUrl())
                .originalSenderId(dto.getOriginalSenderId())
                .originalContent(dto.getOriginalContent())
                .originalMessageId(dto.getOriginalMessageId())
                .isDeleted(false)
                .isRecalled(false)
                .isPinned(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(message);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + roomId,
                saved
        );

        String textContent = dto.getContent() != null ? dto.getContent().trim() : "";

        if (textContent.startsWith("/ai")) {

            String question = textContent.length() > 3
                    ? textContent.substring(3).trim()
                    : "";

            if (question.isEmpty()) {
                question = "Hãy trả lời thân thiện bằng tiếng Việt";
            }

            String aiReply = aiService.askAI(question);

            Message botMsg = Message.builder()
                    .senderId(0L)
                    .receiverId(isGroupMessage ? null : dto.getReceiverId())
                    .roomId(roomId)
                    .groupId(isGroupMessage ? groupId : null)
                    .isGroup(isGroupMessage)
                    .content(aiReply)
                    .type("TEXT")
                    .isDeleted(false)
                    .isRecalled(false)
                    .isPinned(false)
                    .createdAt(LocalDateTime.now())
                    .build();

            Message savedBot = messageRepository.save(botMsg);

            messagingTemplate.convertAndSend(
                    "/topic/chat/" + roomId,
                    savedBot
            );
        }

        return saved;
    }

    // =========================
    // GET MESSAGES
    // =========================
    public List<Message> getMessages(String roomId, Long userId) {

        validateRoomAccess(roomId, userId);

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        List<Message> messages =
                messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);

        if (state != null && Boolean.TRUE.equals(state.getIsDeleted())) {
            return messages.stream()
                    .filter(m ->
                            m.getCreatedAt() != null
                                    && state.getDeletedAt() != null
                                    && m.getCreatedAt().isAfter(state.getDeletedAt())
                    )
                    .toList();
        }

        return messages;
    }

    // =========================
    // GET PINNED MESSAGES
    // =========================
    public List<Message> getPinnedMessages(String roomId, Long userId) {

        validateRoomAccess(roomId, userId);

        return messageRepository.findByRoomIdAndIsPinnedTrueOrderByPinnedAtDesc(roomId);
    }

    // =========================
    // PIN MESSAGE
    // =========================
    public Message pinMessage(String messageId, Long userId) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("Thiếu messageId");
        }

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        validateRoomAccess(msg.getRoomId(), userId);

        if (Boolean.TRUE.equals(msg.getIsRecalled())) {
            throw new RuntimeException("Không thể ghim tin nhắn đã thu hồi");
        }

        if (Boolean.TRUE.equals(msg.getIsDeleted())) {
            throw new RuntimeException("Không thể ghim tin nhắn đã xóa");
        }

        msg.setIsPinned(true);
        msg.setPinnedAt(LocalDateTime.now());
        msg.setPinnedBy(userId);

        Message saved = messageRepository.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + msg.getRoomId() + "/pin",
                saved
        );

        return saved;
    }

    // =========================
    // UNPIN MESSAGE
    // =========================
    public Message unpinMessage(String messageId, Long userId) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("Thiếu messageId");
        }

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        validateRoomAccess(msg.getRoomId(), userId);

        msg.setIsPinned(false);
        msg.setPinnedAt(null);
        msg.setPinnedBy(null);

        Message saved = messageRepository.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + msg.getRoomId() + "/pin",
                saved
        );

        return saved;
    }

    // =========================
    // XOÁ 1 CHIỀU
    // =========================
    public Message deleteForMe(String messageId, Long userId) {

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        validateRoomAccess(msg.getRoomId(), userId);

        msg.setDeletedBy(userId);

        return messageRepository.save(msg);
    }

    // =========================
    // THU HỒI
    // =========================
    public Message recallMessage(String messageId) {

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Message not found"));

        msg.setIsRecalled(true);
        msg.setContent(null);

        if (Boolean.TRUE.equals(msg.getIsPinned())) {
            msg.setIsPinned(false);
            msg.setPinnedAt(null);
            msg.setPinnedBy(null);
        }

        Message saved = messageRepository.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + msg.getRoomId() + "/recall",
                msg.getId()
        );

        messagingTemplate.convertAndSend(
                "/topic/chat/" + msg.getRoomId() + "/pin",
                saved
        );

        return saved;
    }

    // =========================
    // XOÁ CUỘC TRÒ CHUYỆN 1 CHIỀU
    // =========================
    public void deleteConversationForMe(String roomId, Long userId) {

        validateRoomAccess(roomId, userId);

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        if (state == null) {
            state = ConversationState.builder()
                    .conversationKey(roomId)
                    .userId(userId)
                    .build();
        }

        state.setIsDeleted(true);
        state.setDeletedAt(LocalDateTime.now());

        conversationRepository.save(state);
    }

    // =========================
    // HELPER
    // =========================
    private void validateRoomAccess(String roomId, Long userId) {

        if (roomId == null || roomId.isBlank()) {
            throw new RuntimeException("Thiếu roomId");
        }

        if (userId == null) {
            throw new RuntimeException("Thiếu userId");
        }

        if (isGroupRoomId(roomId)) {
            String groupId = roomId.startsWith("group_")
                    ? roomId.replace("group_", "")
                    : roomId;

            boolean isMember = memberRepo.existsByGroupIdAndUserId(groupId, userId);

            if (!isMember) {
                throw new RuntimeException("Bạn không thuộc nhóm");
            }
        }
    }

    private String generateRoomId(Long a, Long b) {

        if (a == null || b == null) {
            throw new RuntimeException("Thiếu userId để tạo roomId");
        }

        return (a < b) ? a + "_" + b : b + "_" + a;
    }

    private String resolveGroupId(SendMessageDTO dto) {

        if (dto.getGroupId() != null && !dto.getGroupId().isBlank()) {
            return dto.getGroupId().startsWith("group_")
                    ? dto.getGroupId().replace("group_", "")
                    : dto.getGroupId();
        }

        if (dto.getRoomId() != null && dto.getRoomId().startsWith("group_")) {
            return dto.getRoomId().replace("group_", "");
        }

        return dto.getRoomId();
    }

    private boolean isGroupRoomId(String roomId) {

        if (roomId == null || roomId.isBlank()) {
            return false;
        }

        if (roomId.matches("\\d+_\\d+")) {
            return false;
        }

        if (roomId.startsWith("group_")) {
            return true;
        }

        return true;
    }
}