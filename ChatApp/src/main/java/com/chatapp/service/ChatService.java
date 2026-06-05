package com.chatapp.service;

import com.chatapp.dto.BackgroundChangedDTO;
import com.chatapp.dto.MessageResponseDTO;
import com.chatapp.dto.PrivateConversationDTO;
import com.chatapp.dto.ReactionEventDTO;
import com.chatapp.dto.ReactionSummaryDTO;
import com.chatapp.dto.SendMessageDTO;
import com.chatapp.entity.BackgroundScope;
import com.chatapp.entity.ConversationBackground;
import com.chatapp.entity.ConversationState;
import com.chatapp.entity.Message;
import com.chatapp.entity.MessageReaction;
import com.chatapp.entity.User;
import com.chatapp.repository.ConversationBackgroundRepository;
import com.chatapp.repository.ConversationStateRepository;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.repository.MessageReactionRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.chatapp.entity.ConversationNickname;
import com.chatapp.repository.ConversationNicknameRepository;

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
    private final UserRepository userRepository;
    private final ConversationBackgroundRepository backgroundRepository;
    private final MessageReactionRepository reactionRepository;
    private final ConversationNicknameRepository nicknameRepository;

    // =========================
    // SEND MESSAGE
    // =========================
    public Message sendMessage(SendMessageDTO dto) {

        String roomId;

        // =========================
        // GROUP CHAT
        // =========================
        if (dto.getRoomId() != null && dto.getRoomId().startsWith("group_")) {

            roomId = dto.getRoomId();
            String groupId = roomId.replace("group_", "");

            boolean isMember = memberRepo
                    .existsByGroupIdAndUserIdAndRemovedFalse(groupId, dto.getSenderId());

            if (!isMember) {
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "Bạn không thuộc nhóm"
                );
            }

        } else {

            // =========================
            // CHAT 1-1
            // =========================
            if (blockedService.isEitherBlocked(dto.getSenderId(), dto.getReceiverId())) {
                System.out.println("🚫 BLOCKED MESSAGE");
                return null;
            }

            roomId = generateRoomId(dto.getSenderId(), dto.getReceiverId());
        }

        // =========================
        // SAVE USER MESSAGE
        // =========================
        Message message = Message.builder()
                .senderId(dto.getSenderId())
                .receiverId(dto.getReceiverId())
                .roomId(roomId)
                .content(dto.getContent())
                .type(dto.getType())
                .fileUrl(dto.getFileUrl())
                .originalSenderId(dto.getOriginalSenderId())
                .originalContent(dto.getOriginalContent())
                .originalMessageId(dto.getOriginalMessageId())
                .isDeleted(false)
                .isRecalled(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(message);

        MessageResponseDTO response = toResponse(saved);

// Gửi vào room chat hiện tại
        messagingTemplate.convertAndSend(
                "/topic/chat/" + roomId,
                response
        );

// Gửi riêng cho người nhận để sidebar hiện box chat mới realtime
        if (saved.getReceiverId() != null) {
            messagingTemplate.convertAndSend(
                    "/topic/conversation-updates/" + saved.getReceiverId(),
                    response
            );
        }

        // =========================
        // AI MESSAGE
        // =========================
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
                    .receiverId(dto.getSenderId())
                    .roomId(roomId)
                    .content(aiReply)
                    .type("TEXT")
                    .isDeleted(false)
                    .isRecalled(false)
                    .createdAt(LocalDateTime.now())
                    .build();

            Message savedBotMsg = messageRepository.save(botMsg);

            messagingTemplate.convertAndSend(
                    "/topic/chat/" + roomId,
                    toResponse(savedBotMsg)
            );
        }

        return saved;
    }

    // =========================
    // GET MESSAGES
    // =========================
    public List<MessageResponseDTO> getMessages(String roomId, Long userId) {

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        List<Message> messages =
                messageRepository.findByRoomIdOrderByCreatedAtAsc(roomId);

        if (state != null && Boolean.TRUE.equals(state.getIsDeleted())) {
            messages = messages.stream()
                    .filter(m -> m.getCreatedAt().isAfter(state.getDeletedAt()))
                    .toList();
        }

        return messages.stream()
                .map(message -> toResponse(message, userId))
                .toList();
    }

    // =========================
    // XOÁ 1 CHIỀU (DELETE FOR ME)
    // =========================
    public Message deleteForMe(String messageId, Long userId) {

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Message not found"
                ));

        msg.setDeletedBy(userId);

        return messageRepository.save(msg);
    }

    // =========================
    // THU HỒI (DELETE FOR EVERYONE)
    // =========================
    public Message recallMessage(String messageId, Long userId) {

        Message msg = messageRepository.findById(messageId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Message not found"
                ));

        if (!msg.getSenderId().equals(userId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Bạn không có quyền thu hồi tin nhắn này"
            );
        }

        if (Boolean.TRUE.equals(msg.getIsRecalled())) {
            return msg;
        }

        msg.setIsRecalled(true);
        msg.setContent(null);

        Message saved = messageRepository.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + msg.getRoomId() + "/recall",
                msg.getId()
        );

        return saved;
    }

    // =========================
    // DELETE CONVERSATION FOR ME
    // =========================
    public void deleteConversationForMe(String roomId, Long userId) {

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        if (state == null) {
            state = ConversationState.builder()
                    .conversationKey(roomId)
                    .userId(userId)
                    .isDeleted(false)
                    .build();
        }

        state.setIsDeleted(true);
        state.setDeletedAt(LocalDateTime.now());

        conversationRepository.save(state);
    }

    // =========================
    // MAP MESSAGE -> RESPONSE DTO
    // =========================
    private MessageResponseDTO toResponse(Message msg) {
        return toResponse(msg, null);
    }

    private MessageResponseDTO toResponse(Message msg, Long currentUserId) {

        if (msg.getSenderId() != null && msg.getSenderId().equals(0L)) {
            return MessageResponseDTO.builder()
                    .id(msg.getId())
                    .senderId(msg.getSenderId())
                    .receiverId(msg.getReceiverId())
                    .roomId(msg.getRoomId())
                    .content(msg.getContent())
                    .type(msg.getType())
                    .fileUrl(msg.getFileUrl())
                    .isDeleted(msg.getIsDeleted())
                    .isRecalled(msg.getIsRecalled())
                    .createdAt(msg.getCreatedAt())
                    .deletedBy(msg.getDeletedBy())
                    .originalSenderId(msg.getOriginalSenderId())
                    .originalContent(msg.getOriginalContent())
                    .originalMessageId(msg.getOriginalMessageId())
                    .senderName("AI Assistant")
                    .senderAvatar("default-avatar.png")
                    .reactions(buildReactionSummary(msg.getId(), currentUserId))

                    .pinned(Boolean.TRUE.equals(msg.getPinned()))
                    .pinnedBy(msg.getPinnedBy())
                    .pinnedAt(msg.getPinnedAt())
                    .pollId(msg.getPollId())
                    .build();
        }

        User sender = null;

        if (msg.getSenderId() != null) {
            sender = userRepository.findById(msg.getSenderId()).orElse(null);
        }

        return MessageResponseDTO.builder()
                .id(msg.getId())
                .senderId(msg.getSenderId())
                .receiverId(msg.getReceiverId())
                .roomId(msg.getRoomId())
                .content(msg.getContent())
                .type(msg.getType())
                .fileUrl(msg.getFileUrl())
                .isDeleted(msg.getIsDeleted())
                .isRecalled(msg.getIsRecalled())
                .createdAt(msg.getCreatedAt())
                .deletedBy(msg.getDeletedBy())
                .originalSenderId(msg.getOriginalSenderId())
                .originalContent(msg.getOriginalContent())
                .originalMessageId(msg.getOriginalMessageId())
                .senderName(sender != null ? sender.getUsername() : "Người dùng")
                .senderAvatar(sender != null ? sender.getAvatar() : "default-avatar.png")
                .reactions(buildReactionSummary(msg.getId(), currentUserId))

                .pinned(Boolean.TRUE.equals(msg.getPinned()))
                .pinnedBy(msg.getPinnedBy())
                .pinnedAt(msg.getPinnedAt())
                .pollId(msg.getPollId())
                .build();
    }

    // =========================
    // REACTION SUMMARY
    // =========================
    private List<ReactionSummaryDTO> buildReactionSummary(
            String messageId,
            Long currentUserId
    ) {
        if (messageId == null || messageId.isBlank()) {
            return new ArrayList<>();
        }

        List<MessageReaction> reactions = reactionRepository.findByMessageId(messageId);

        Map<String, List<MessageReaction>> grouped = reactions.stream()
                .collect(Collectors.groupingBy(
                        MessageReaction::getEmoji,
                        LinkedHashMap::new,
                        Collectors.toList()
                ));

        List<ReactionSummaryDTO> result = new ArrayList<>();

        for (Map.Entry<String, List<MessageReaction>> entry : grouped.entrySet()) {
            String emoji = entry.getKey();
            List<MessageReaction> items = entry.getValue();

            long myCount = 0;

            if (currentUserId != null) {
                myCount = items.stream()
                        .filter(r -> r.getUserId() != null && r.getUserId().equals(currentUserId))
                        .count();
            }

            result.add(
                    ReactionSummaryDTO.builder()
                            .emoji(emoji)
                            .count(items.size())
                            .myCount(myCount)
                            .build()
            );
        }

        return result;
    }

    // =========================
    // REACT MESSAGE
    // =========================
    public ReactionEventDTO reactMessage(String messageId, Long userId, String emoji) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("MessageId không hợp lệ");
        }

        if (emoji == null || emoji.isBlank()) {
            throw new RuntimeException("Emoji không hợp lệ");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        MessageReaction reaction = MessageReaction.builder()
                .messageId(messageId)
                .roomId(message.getRoomId())
                .userId(userId)
                .emoji(emoji)
                .createdAt(LocalDateTime.now())
                .build();

        reactionRepository.save(reaction);

        User user = userRepository.findById(userId).orElse(null);

        ReactionEventDTO event = ReactionEventDTO.builder()
                .messageId(messageId)
                .roomId(message.getRoomId())
                .userId(userId)
                .username(user != null ? user.getUsername() : "Người dùng")
                .emoji(emoji)
                .reactions(buildReactionSummary(messageId, userId))
                .build();

        messagingTemplate.convertAndSend(
                "/topic/chat/" + message.getRoomId() + "/reaction",
                event
        );

        return event;
    }

    // =========================
    // GENERATE ROOM ID
    // =========================
    private String generateRoomId(Long a, Long b) {
        return (a < b) ? a + "_" + b : b + "_" + a;
    }

    public void markAsRead(String roomId, Long userId) {

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        if (state == null) {
            state = ConversationState.builder()
                    .conversationKey(roomId)
                    .userId(userId)
                    .isDeleted(false)
                    .build();
        }

        state.setLastReadAt(LocalDateTime.now());

        conversationRepository.save(state);
    }

    public long getUnreadCount(String roomId, Long userId) {

        ConversationState state = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .orElse(null);

        LocalDateTime lastReadAt = state != null && state.getLastReadAt() != null
                ? state.getLastReadAt()
                : LocalDateTime.of(1970, 1, 1, 0, 0);

        return messageRepository
                .countByRoomIdAndSenderIdNotAndCreatedAtAfterAndIsRecalledFalse(
                        roomId,
                        userId,
                        lastReadAt
                );
    }

    public List<PrivateConversationDTO> getPrivateConversations(Long userId) {

        List<Message> allMessages = messageRepository
                .findBySenderIdOrReceiverIdOrderByCreatedAtDesc(userId, userId);

        Map<String, Message> latestMessageByRoom = new LinkedHashMap<>();

        for (Message msg : allMessages) {

            if (msg.getRoomId() == null) continue;

            String roomId = msg.getRoomId();

            if (roomId.startsWith("group_")) continue;

            if (!roomId.contains("_")) continue;

            latestMessageByRoom.putIfAbsent(roomId, msg);
        }

        List<PrivateConversationDTO> result = new ArrayList<>();

        for (Map.Entry<String, Message> entry : latestMessageByRoom.entrySet()) {

            String roomId = entry.getKey();
            Message latestMsg = entry.getValue();

            Long otherUserId = extractOtherUserIdFromPrivateRoom(roomId, userId);

            if (otherUserId == null) continue;

            User otherUser = userRepository.findById(otherUserId).orElse(null);

            if (otherUser == null) continue;

            long unreadCount = getUnreadCount(roomId, userId);

            String nickname = getPrivateNickname(roomId, userId, otherUserId);
            String displayName = nickname != null && !nickname.isBlank()
                    ? nickname
                    : otherUser.getUsername();

            result.add(
                    PrivateConversationDTO.builder()
                            .id("private_" + roomId)
                            .type("PRIVATE")
                            .name(displayName)
                            .avatar(otherUser.getAvatar())
                            .roomId(roomId)
                            .unreadCount(unreadCount)
                            .lastMessageAt(latestMsg.getCreatedAt())
                            .targetUser(
                                    PrivateConversationDTO.TargetUserDTO.builder()
                                            .id(otherUser.getId())
                                            .username(otherUser.getUsername())
                                            .avatar(otherUser.getAvatar())
                                            .build()
                            )
                            .build()
            );
        }

        return result;
    }

    private Long extractOtherUserIdFromPrivateRoom(String roomId, Long currentUserId) {
        if (roomId == null || !roomId.contains("_")) {
            return null;
        }

        try {
            String[] parts = roomId.split("_");

            if (parts.length != 2) {
                return null;
            }

            Long userA = Long.parseLong(parts[0]);
            Long userB = Long.parseLong(parts[1]);

            if (userA.equals(currentUserId)) {
                return userB;
            }

            if (userB.equals(currentUserId)) {
                return userA;
            }

            return null;
        } catch (Exception e) {
            return null;
        }
    }

    public String updateConversationBackground(
            String roomId,
            Long userId,
            String background,
            BackgroundScope scope
    ) {
        if (roomId == null || roomId.isBlank()) {
            throw new RuntimeException("RoomId không hợp lệ");
        }

        if (background == null || background.isBlank()) {
            throw new RuntimeException("Background không hợp lệ");
        }

        if (scope == null) {
            scope = BackgroundScope.PERSONAL;
        }

        User user = userRepository.findById(userId).orElse(null);
        String username = user != null ? user.getUsername() : "Ai đó";

        if (scope == BackgroundScope.PERSONAL) {
            ConversationState state = conversationRepository
                    .findByConversationKeyAndUserId(roomId, userId)
                    .orElse(null);

            if (state == null) {
                state = ConversationState.builder()
                        .conversationKey(roomId)
                        .userId(userId)
                        .isDeleted(false)
                        .build();
            }

            state.setBackground(background);
            conversationRepository.save(state);

            return background;
        }

        ConversationBackground bg = backgroundRepository
                .findByRoomId(roomId)
                .orElse(null);

        if (bg == null) {
            bg = ConversationBackground.builder()
                    .roomId(roomId)
                    .build();
        }

        bg.setBackground(background);
        bg.setUpdatedBy(userId);
        bg.setUpdatedAt(LocalDateTime.now());

        backgroundRepository.save(bg);

// FIX: Khi đổi nền SHARED thì xoá nền PERSONAL cũ của mọi user trong room.
// Nếu không, F5 sẽ ưu tiên lấy ConversationState.background cũ.
        List<ConversationState> states =
                conversationRepository.findByConversationKey(roomId);

        for (ConversationState state : states) {
            state.setBackground(null);
        }
        conversationRepository.saveAll(states);
        messagingTemplate.convertAndSend(
                "/topic/chat/" + roomId + "/background",
                BackgroundChangedDTO.builder()
                        .roomId(roomId)
                        .background(background)
                        .scope(scope.name())
                        .updatedBy(userId)
                        .updatedByName(username)
                        .build()
        );

        Message systemMessage = Message.builder()
                .senderId(userId)
                .receiverId(null)
                .roomId(roomId)
                .content(username + " đã đổi nền đoạn chat")
                .type("SYSTEM")
                .isDeleted(false)
                .isRecalled(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message savedSystemMessage = messageRepository.save(systemMessage);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + roomId,
                toResponse(savedSystemMessage)
        );

        return background;
    }

    public String getConversationBackground(String roomId, Long userId) {

        String personalBackground = conversationRepository
                .findByConversationKeyAndUserId(roomId, userId)
                .map(ConversationState::getBackground)
                .orElse(null);

        if (personalBackground != null && !personalBackground.isBlank()) {
            return personalBackground;
        }

        return backgroundRepository
                .findByRoomId(roomId)
                .map(ConversationBackground::getBackground)
                .orElse(null);
    }

    public ReactionEventDTO clearMyReactions(String messageId, Long userId) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("MessageId không hợp lệ");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        reactionRepository.deleteByMessageIdAndUserId(messageId, userId);

        User user = userRepository.findById(userId).orElse(null);

        ReactionEventDTO event = ReactionEventDTO.builder()
                .messageId(messageId)
                .roomId(message.getRoomId())
                .userId(userId)
                .username(user != null ? user.getUsername() : "Người dùng")
                .emoji(null)
                .reactions(buildReactionSummary(messageId, userId))
                .build();

        messagingTemplate.convertAndSend(
                "/topic/chat/" + message.getRoomId() + "/reaction",
                event
        );

        return event;
    }

    // =========================
// UPDATE PRIVATE NICKNAME
// =========================
    public ConversationNickname updatePrivateNickname(
            String roomId,
            Long ownerUserId,
            Long targetUserId,
            String nickname
    ) {
        if (roomId == null || roomId.isBlank()) {
            throw new RuntimeException("RoomId không hợp lệ");
        }

        if (targetUserId == null) {
            throw new RuntimeException("TargetUserId không hợp lệ");
        }

        ConversationNickname item = nicknameRepository
                .findByConversationKeyAndOwnerUserIdAndTargetUserId(
                        roomId,
                        ownerUserId,
                        targetUserId
                )
                .orElse(null);

        if (item == null) {
            item = ConversationNickname.builder()
                    .conversationKey(roomId)
                    .ownerUserId(ownerUserId)
                    .targetUserId(targetUserId)
                    .build();
        }

        item.setNickname(nickname == null ? "" : nickname.trim());
        item.setUpdatedAt(LocalDateTime.now());

        return nicknameRepository.save(item);
    }

    // =========================
// GET PRIVATE NICKNAME
// =========================
    public String getPrivateNickname(
            String roomId,
            Long ownerUserId,
            Long targetUserId
    ) {
        if (roomId == null || roomId.isBlank()) {
            return "";
        }

        if (targetUserId == null) {
            return "";
        }

        return nicknameRepository
                .findByConversationKeyAndOwnerUserIdAndTargetUserId(
                        roomId,
                        ownerUserId,
                        targetUserId
                )
                .map(ConversationNickname::getNickname)
                .orElse("");
    }

    // =========================
// PIN MESSAGE
// =========================
    public MessageResponseDTO pinMessage(String messageId, Long userId) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("MessageId không hợp lệ");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        if (Boolean.TRUE.equals(message.getIsRecalled())) {
            throw new RuntimeException("Không thể ghim tin nhắn đã thu hồi");
        }

        message.setPinned(true);
        message.setPinnedBy(userId);
        message.setPinnedAt(LocalDateTime.now());

        Message saved = messageRepository.save(message);

        MessageResponseDTO response = toResponse(saved, userId);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + saved.getRoomId() + "/pin",
                response
        );

        return response;
    }

    // =========================
// UNPIN MESSAGE
// =========================
    public MessageResponseDTO unpinMessage(String messageId, Long userId) {

        if (messageId == null || messageId.isBlank()) {
            throw new RuntimeException("MessageId không hợp lệ");
        }

        Message message = messageRepository.findById(messageId)
                .orElseThrow(() -> new RuntimeException("Tin nhắn không tồn tại"));

        message.setPinned(false);
        message.setPinnedBy(null);
        message.setPinnedAt(null);

        Message saved = messageRepository.save(message);

        MessageResponseDTO response = toResponse(saved, userId);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + saved.getRoomId() + "/pin",
                response
        );

        return response;
    }

    // =========================
// GET PINNED MESSAGES
// =========================
    public List<MessageResponseDTO> getPinnedMessages(String roomId, Long userId) {

        if (roomId == null || roomId.isBlank()) {
            throw new RuntimeException("RoomId không hợp lệ");
        }

        List<Message> pinnedMessages =
                messageRepository.findByRoomIdAndPinnedTrueOrderByPinnedAtDesc(roomId);

        return pinnedMessages.stream()
                .map(message -> toResponse(message, userId))
                .toList();
    }


}
