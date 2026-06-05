package com.chatapp.controller;

import com.chatapp.dto.CallSignalDTO;
import com.chatapp.dto.GroupMemberDTO;
import com.chatapp.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class CallSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final GroupService groupService;

    @MessageMapping("/call.signal")
    public void handleCallSignal(CallSignalDTO signal) {

        if (signal == null || signal.getType() == null) {
            return;
        }

        String type = signal.getType();

        // ================= GROUP CALL =================
        if (type.startsWith("GROUP_CALL_")) {
            handleGroupCallSignal(signal);
            return;
        }

        // ================= PRIVATE CALL =================
        handlePrivateCallSignal(signal);
    }

    private void handlePrivateCallSignal(CallSignalDTO signal) {

        // Gửi cho người nhận
        if (signal.getReceiverId() != null) {
            sendToUser(signal.getReceiverId(), signal);
        }

        // Gửi lại cho người gọi để nhận ACCEPT / REJECT / END / ICE nếu cần
        if (signal.getCallerId() != null) {
            sendToUser(signal.getCallerId(), signal);
        }
    }

    private void handleGroupCallSignal(CallSignalDTO signal) {

        /*
         * GROUP_CALL_OFFER / GROUP_CALL_ANSWER / GROUP_CALL_ICE
         * là tín hiệu WebRTC giữa 2 user, có receiverId thì gửi thẳng.
         */
        if (signal.getReceiverId() != null) {
            sendToUser(signal.getReceiverId(), signal);
            return;
        }

        /*
         * GROUP_CALL_START / GROUP_CALL_JOIN / GROUP_CALL_LEAVE / GROUP_CALL_END
         * thường không có receiverId, nên phải gửi cho toàn bộ thành viên nhóm.
         */
        String groupId = extractGroupId(signal);

        if (groupId == null || groupId.isBlank()) {
            return;
        }

        List<GroupMemberDTO> members = groupService.getMembers(groupId);

        for (GroupMemberDTO member : members) {
            if (member == null || member.getUserId() == null) {
                continue;
            }

            Long userId = member.getUserId();

            // Không gửi lại cho chính người vừa phát signal
            if (signal.getCallerId() != null
                    && userId.longValue() == signal.getCallerId().longValue()) {
                continue;
            }

            sendToUser(userId, signal);
        }
    }

    private String extractGroupId(CallSignalDTO signal) {

        /*
         * Trường hợp frontend gửi payload:
         * payload: {
         *   groupId: selectedGroup.id,
         *   groupName: selectedGroup.name,
         *   mediaType: "VIDEO"
         * }
         */
        Object payloadObj = signal.getPayload();

        if (payloadObj instanceof Map<?, ?> payload) {
            Object groupId = payload.get("groupId");

            if (groupId != null) {
                return String.valueOf(groupId);
            }
        }

        /*
         * Trường hợp lấy từ roomId:
         * roomId = group_abc123
         */
        String roomId = signal.getRoomId();

        if (roomId != null && roomId.startsWith("group_")) {
            return roomId.replace("group_", "");
        }

        return null;
    }

    private void sendToUser(Long userId, CallSignalDTO signal) {
        if (userId == null) return;

        messagingTemplate.convertAndSend(
                "/topic/call/user/" + userId,
                signal
        );
    }
}