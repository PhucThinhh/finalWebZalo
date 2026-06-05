package com.chatapp.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CallSignalDTO {

    private String roomId;

    private Long callerId;

    private Long receiverId;

    private String groupId;

    private Boolean isGroup;

    // AUDIO | VIDEO
    private String callType;

    // INVITE | ACCEPT | REJECT | CANCEL | END | OFFER | ANSWER | ICE
    private String signalType;

    // WebRTC SDP hoặc ICE candidate dạng JSON string
    private String payload;

    private String callerName;

    private String callerAvatar;

    private Long createdAt;
}