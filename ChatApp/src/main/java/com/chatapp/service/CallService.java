package com.chatapp.service;

import com.chatapp.dto.CallSignalDTO;
import com.chatapp.entity.GroupMember;
import com.chatapp.repository.GroupMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CallService {

    private final SimpMessagingTemplate messagingTemplate;
    private final GroupMemberRepository groupMemberRepository;

    public void handleSignal(CallSignalDTO dto) {

        if (dto.getRoomId() == null || dto.getRoomId().isBlank()) {
            throw new RuntimeException("Thiếu roomId cuộc gọi");
        }

        if (dto.getSignalType() == null || dto.getSignalType().isBlank()) {
            throw new RuntimeException("Thiếu signalType");
        }

        if (dto.getCreatedAt() == null) {
            dto.setCreatedAt(System.currentTimeMillis());
        }

        boolean isGroup = Boolean.TRUE.equals(dto.getIsGroup());

        if (isGroup) {
            sendGroupSignal(dto);
        } else {
            sendPrivateSignal(dto);
        }
    }

    private void sendPrivateSignal(CallSignalDTO dto) {
        messagingTemplate.convertAndSend(
                "/topic/call/" + dto.getRoomId(),
                dto
        );
    }

    private void sendGroupSignal(CallSignalDTO dto) {
        String groupId = dto.getGroupId() != null
                ? dto.getGroupId()
                : dto.getRoomId();

        List<GroupMember> members = groupMemberRepository.findByGroupId(groupId);

        for (GroupMember member : members) {
            if (dto.getCallerId() != null
                    && member.getUserId() != null
                    && member.getUserId().equals(dto.getCallerId())) {
                continue;
            }

            messagingTemplate.convertAndSend(
                    "/topic/user/" + member.getUserId() + "/call",
                    dto
            );
        }

        messagingTemplate.convertAndSend(
                "/topic/call/" + dto.getRoomId(),
                dto
        );
    }
}