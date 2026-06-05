package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class SendMessageDTO {

    private Long senderId;
    private Long receiverId;

    private String roomId;

    private String content;

    // TEXT | FILE | IMAGE | EMOJI | CALL
    private String type;

    private String fileUrl;

    // ===== GROUP CHAT =====
    private String groupId;
    private Boolean isGroup;

    // ===== FORWARD MESSAGE =====
    private Long originalSenderId;
    private String originalContent;
    private String originalMessageId;
}