package com.chatapp.service;

import com.chatapp.dto.CreateGroupDTO;
import com.chatapp.dto.GroupMemberDTO;
import com.chatapp.entity.Group;
import com.chatapp.entity.GroupMember;
import com.chatapp.entity.GroupRole;
import com.chatapp.entity.Message;
import com.chatapp.entity.User;
import com.chatapp.repository.GroupMemberRepository;
import com.chatapp.repository.GroupRepository;
import com.chatapp.repository.MessageRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepo;
    private final GroupMemberRepository memberRepo;
    private final UserRepository userRepo;
    private final MessageRepository messageRepo;
    private final SimpMessagingTemplate messagingTemplate;

    public Group createGroup(CreateGroupDTO dto, Long currentUserId) {

        if (currentUserId == null) {
            throw new RuntimeException("Thiếu người tạo nhóm");
        }

        List<Long> memberIds = dto.getMemberIds() == null
                ? new ArrayList<>()
                : new ArrayList<>(dto.getMemberIds());

        memberIds.removeIf(Objects::isNull);

        if (!memberIds.contains(currentUserId)) {
            memberIds.add(currentUserId);
        }

        memberIds = memberIds.stream()
                .distinct()
                .collect(Collectors.toList());

        if (memberIds.size() < 3) {
            throw new RuntimeException("Nhóm phải có ít nhất 3 thành viên gồm cả bạn");
        }

        String groupName = dto.getName();

        if (groupName == null || groupName.isBlank()) {
            groupName = buildDefaultGroupName(memberIds);
        } else {
            groupName = groupName.trim();
        }

        validateDuplicateGroupName(currentUserId, groupName);

        Group group = Group.builder()
                .name(groupName)
                .createdBy(currentUserId)
                .createdAt(LocalDateTime.now())
                .backgroundUrl(null)
                .avatarUrl(null)
                .build();

        Group savedGroup = groupRepo.save(group);

        for (Long userId : memberIds) {
            GroupRole role = userId.equals(currentUserId)
                    ? GroupRole.OWNER
                    : GroupRole.MEMBER;

            GroupMember member = GroupMember.builder()
                    .groupId(savedGroup.getId())
                    .userId(userId)
                    .role(role)
                    .build();

            memberRepo.save(member);

            if (!userId.equals(currentUserId)) {
                publishGroupSystemMessage(
                        savedGroup.getId(),
                        getDisplayName(userId) + " đã được thêm vào nhóm bởi " + getDisplayName(currentUserId)
                );
            }
        }

        publishGroupSystemMessage(
                savedGroup.getId(),
                getDisplayName(currentUserId) + " đã tạo nhóm"
        );

        notifyGroupMembers(savedGroup.getId(), "GROUP_CREATED");

        return savedGroup;
    }

    public List<Group> getGroupsByUser(Long userId) {
        List<GroupMember> memberships = memberRepo.findByUserId(userId);

        return memberships.stream()
                .map(m -> groupRepo.findById(m.getGroupId()).orElse(null))
                .filter(Objects::nonNull)
                .sorted((a, b) -> {
                    LocalDateTime t1 = a.getCreatedAt();
                    LocalDateTime t2 = b.getCreatedAt();

                    if (t1 == null && t2 == null) return 0;
                    if (t1 == null) return 1;
                    if (t2 == null) return -1;

                    return t2.compareTo(t1);
                })
                .toList();
    }

    public List<GroupMemberDTO> getMembers(String groupId) {
    List<GroupMember> members = memberRepo.findByGroupId(groupId);

    return members.stream().map(member -> {
        User user = userRepo.findById(member.getUserId()).orElse(null);

        GroupMemberDTO dto = new GroupMemberDTO();

        dto.setUserId(member.getUserId());
        dto.setUsername(
                user != null ? user.getUsername() : "User " + member.getUserId()
        );
        dto.setAvatar(user != null ? user.getAvatar() : null);
        dto.setRole(member.getRole());

        return dto;
    }).toList();
}
    public void addMember(String groupId, Long userId, Long currentUserId) {

        Group group = getGroupOrThrow(groupId);

        checkCanManage(groupId, currentUserId);

        if (memberRepo.existsByGroupIdAndUserId(groupId, userId)) {
            throw new RuntimeException("User đã trong nhóm");
        }

        GroupMember member = GroupMember.builder()
                .groupId(groupId)
                .userId(userId)
                .role(GroupRole.MEMBER)
                .build();

        memberRepo.save(member);

        publishGroupSystemMessage(
                group.getId(),
                getDisplayName(userId) + " đã được thêm vào nhóm bởi " + getDisplayName(currentUserId)
        );

        notifyGroupMembers(groupId, "GROUP_MEMBER_ADDED");
    }

    public void removeMember(String groupId, Long userId, Long currentUserId) {

        getGroupOrThrow(groupId);

        checkCanManage(groupId, currentUserId);

        if (userId.equals(currentUserId)) {
            throw new RuntimeException("Không thể tự xoá chính mình");
        }

        GroupMember target = memberRepo.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("User không trong nhóm"));

        if (target.getRole() == GroupRole.OWNER) {
            throw new RuntimeException("Không thể xoá chủ nhóm");
        }

        memberRepo.deleteByGroupIdAndUserId(groupId, userId);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(userId) + " đã bị xoá khỏi nhóm bởi " + getDisplayName(currentUserId)
        );

        notifyGroupMembers(groupId, "GROUP_MEMBER_REMOVED");
        notifyUser(userId, "GROUP_MEMBER_REMOVED", groupId);
    }

    public void deleteGroup(String groupId, Long currentUserId) {

        getGroupOrThrow(groupId);

        GroupMember me = memberRepo.findByGroupIdAndUserId(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Bạn không có quyền giải tán nhóm");
        }

        List<GroupMember> members = memberRepo.findByGroupId(groupId);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã giải tán nhóm"
        );

        groupRepo.deleteById(groupId);

        for (GroupMember member : members) {
            memberRepo.deleteByGroupIdAndUserId(groupId, member.getUserId());
            notifyUser(member.getUserId(), "GROUP_DELETED", groupId);
        }
    }

    public void updateRole(
            String groupId,
            Long userId,
            GroupRole role,
            Long currentUserId
    ) {

        getGroupOrThrow(groupId);

        GroupMember me = memberRepo.findByGroupIdAndUserId(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Chỉ chủ nhóm được cập nhật quyền");
        }

        GroupMember target = memberRepo.findByGroupIdAndUserId(groupId, userId)
                .orElseThrow(() -> new RuntimeException("User không tồn tại trong nhóm"));

        if (target.getRole() == GroupRole.OWNER) {
            throw new RuntimeException("Không thể sửa OWNER");
        }

        if (role == GroupRole.OWNER) {
            throw new RuntimeException("Không thể set OWNER tại đây");
        }

        target.setRole(role);
        memberRepo.save(target);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã cập nhật quyền của " + getDisplayName(userId)
        );

        notifyGroupMembers(groupId, "GROUP_ROLE_UPDATED");
    }

    public void leaveGroup(String groupId, Long currentUserId, Long newOwnerId) {

        getGroupOrThrow(groupId);

        GroupMember me = memberRepo.findByGroupIdAndUserId(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        List<GroupMember> members = memberRepo.findByGroupId(groupId);

        if (me.getRole() == GroupRole.OWNER) {
            if (members.size() > 1) {
                if (newOwnerId == null) {
                    throw new RuntimeException("Chủ nhóm phải chọn người nhận quyền trước khi rời nhóm");
                }

                GroupMember newOwner = memberRepo.findByGroupIdAndUserId(groupId, newOwnerId)
                        .orElseThrow(() -> new RuntimeException("Người nhận quyền không thuộc nhóm"));

                newOwner.setRole(GroupRole.OWNER);
                memberRepo.save(newOwner);

                publishGroupSystemMessage(
                        groupId,
                        getDisplayName(currentUserId) + " đã chuyển quyền chủ nhóm cho " + getDisplayName(newOwnerId)
                );
            }
        }

        memberRepo.deleteByGroupIdAndUserId(groupId, currentUserId);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã rời nhóm"
        );

        notifyGroupMembers(groupId, "GROUP_MEMBER_LEFT");
        notifyUser(currentUserId, "GROUP_MEMBER_LEFT", groupId);
    }

    public Group renameGroup(String groupId, String name, Long currentUserId) {

        if (name == null || name.isBlank()) {
            throw new RuntimeException("Tên nhóm không được để trống");
        }

        Group group = getGroupOrThrow(groupId);

        checkCanManage(groupId, currentUserId);

        String newName = name.trim();

        group.setName(newName);

        Group saved = groupRepo.save(group);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã đổi tên nhóm thành " + newName
        );

        notifyGroupMembers(groupId, "GROUP_RENAMED");

        return saved;
    }

    public Group updateGroupBackground(
            String groupId,
            String backgroundUrl,
            Long currentUserId
    ) {

        if (backgroundUrl == null || backgroundUrl.isBlank()) {
            throw new RuntimeException("Thiếu nền đoạn chat");
        }

        Group group = getGroupOrThrow(groupId);

        checkCanManage(groupId, currentUserId);

        group.setBackgroundUrl(backgroundUrl);

        Group saved = groupRepo.save(group);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã đổi nền đoạn chat"
        );

        notifyGroupMembers(groupId, "GROUP_BACKGROUND_CHANGED");

        return saved;
    }

    public Group updateGroupAvatar(
            String groupId,
            String avatarUrl,
            Long currentUserId
    ) {

        if (avatarUrl == null || avatarUrl.isBlank()) {
            throw new RuntimeException("Thiếu ảnh đại diện nhóm");
        }

        Group group = getGroupOrThrow(groupId);

        checkCanManage(groupId, currentUserId);

        group.setAvatarUrl(avatarUrl);

        Group saved = groupRepo.save(group);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã đổi ảnh đại diện nhóm"
        );

        notifyGroupMembers(groupId, "GROUP_AVATAR_CHANGED");

        return saved;
    }

    private void checkCanManage(String groupId, Long currentUserId) {
        GroupMember me = memberRepo.findByGroupIdAndUserId(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.OWNER && me.getRole() != GroupRole.ADMIN) {
            throw new RuntimeException("Bạn không có quyền thực hiện thao tác này");
        }
    }

    private Group getGroupOrThrow(String groupId) {
        return groupRepo.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy nhóm"));
    }

    private String getDisplayName(Long userId) {
        return userRepo.findById(userId)
                .map(User::getUsername)
                .orElse("User " + userId);
    }

    private String buildDefaultGroupName(List<Long> memberIds) {
        return memberIds.stream()
                .map(this::getDisplayName)
                .collect(Collectors.joining(", "));
    }

    private void validateDuplicateGroupName(Long currentUserId, String groupName) {
        List<Group> myGroups = getGroupsByUser(currentUserId);

        boolean duplicated = myGroups.stream()
                .anyMatch(g -> g.getName() != null
                        && g.getName().trim().equalsIgnoreCase(groupName.trim()));

        if (duplicated) {
            throw new RuntimeException("Tên nhóm đã tồn tại");
        }
    }

    private void publishGroupSystemMessage(String groupId, String content) {
        Message msg = Message.builder()
                .senderId(0L)
                .receiverId(null)
                .roomId(groupId)
                .groupId(groupId)
                .isGroup(true)
                .content(content)
                .type("SYSTEM")
                .fileUrl(null)
                .isDeleted(false)
                .isRecalled(false)
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepo.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/chat/" + groupId,
                saved
        );
    }

    private void notifyGroupMembers(String groupId, String action) {
        List<GroupMember> members = memberRepo.findByGroupId(groupId);

        for (GroupMember member : members) {
            notifyUser(member.getUserId(), action, groupId);
        }
    }

    private void notifyUser(Long userId, String action, String groupId) {
        Map<String, Object> event = new HashMap<>();
        event.put("action", action);
        event.put("groupId", groupId);

        messagingTemplate.convertAndSend(
                "/topic/user/" + userId + "/group",
                event
        );
    }
}