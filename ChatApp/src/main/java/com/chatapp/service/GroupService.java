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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepo;
    private final GroupMemberRepository memberRepo;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private static final String DEFAULT_GROUP_AVATAR =
            "https://s3-dyamodb-cloudfront.s3.ap-southeast-1.amazonaws.com/uploads/d5fe980e-ba1d-4219-bd58-bef84289a982_avatar.jpg";

    public Group createGroup(CreateGroupDTO dto) {

        if (dto.getMemberIds() == null || dto.getMemberIds().size() < 2) {
            throw new RuntimeException("Nhóm phải có ít nhất 3 thành viên");
        }

        String groupName = dto.getName();

        if (groupName == null || groupName.isBlank()) {
            groupName = buildDefaultGroupName(dto.getCreatorId(), dto.getMemberIds());
        }

        Group group = groupRepo.save(
                Group.builder()
                        .name(groupName)
                        .createdBy(dto.getCreatorId())
                        .createdAt(LocalDateTime.now())
                        .avatar(DEFAULT_GROUP_AVATAR)
                        .build()
        );

        if (group.getId() == null) {
            throw new RuntimeException("Group ID null - Mongo chưa generate");
        }

        memberRepo.save(GroupMember.builder()
                .groupId(group.getId())
                .userId(dto.getCreatorId())
                .role(GroupRole.OWNER)
                .removed(false)
                .build());

        for (Long id : dto.getMemberIds()) {

            if (id.equals(dto.getCreatorId())) continue;

            memberRepo.save(GroupMember.builder()
                    .groupId(group.getId())
                    .userId(id)
                    .role(GroupRole.MEMBER)
                    .removed(false)
                    .build());

            publishGroupSystemMessage(
                    group.getId(),
                    getDisplayName(id) + " đã được thêm vào nhóm bởi " + getDisplayName(dto.getCreatorId())
            );
        }

        publishGroupSystemMessage(
                group.getId(),
                getDisplayName(dto.getCreatorId()) + " đã tạo nhóm"
        );

        Set<Long> changedUsers = new HashSet<>();
        changedUsers.add(dto.getCreatorId());
        changedUsers.addAll(dto.getMemberIds());

        notifyGroupChanged(changedUsers, "GROUP_CREATED", group.getId());

        return group;
    }

    public List<Group> getGroupsByUser(Long userId) {

        /*
         * GIỮ NGUYÊN findByUserId:
         * - User bị kick vẫn còn record GroupMember removed = true
         * - Nhờ vậy vẫn thấy boxchat cũ
         */
        List<GroupMember> members = memberRepo.findByUserId(userId);

        List<String> groupIds = members.stream()
                .map(GroupMember::getGroupId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        return groupRepo.findAllById(groupIds);
    }

    public void addMember(String groupId, Long userId, Long currentUserId) {

        memberRepo
                .findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Khong thuoc nhom"));

        GroupMember oldMember = memberRepo
                .findByGroupIdAndUserId(groupId, userId)
                .orElse(null);

        if (oldMember != null && Boolean.FALSE.equals(oldMember.getRemoved())) {
            throw new RuntimeException("User da trong nhom");
        }

        if (oldMember != null && Boolean.TRUE.equals(oldMember.getRemoved())) {
            oldMember.setRemoved(false);
            oldMember.setRemovedAt(null);
            oldMember.setRemovedBy(null);
            oldMember.setRole(GroupRole.MEMBER);
            memberRepo.save(oldMember);
        } else {
            memberRepo.save(GroupMember.builder()
                    .groupId(groupId)
                    .userId(userId)
                    .role(GroupRole.MEMBER)
                    .removed(false)
                    .build());
        }

        publishGroupSystemMessage(
                groupId,
                getDisplayName(userId) + " da duoc them vao nhom boi " + getDisplayName(currentUserId)
        );

        notifyGroupChanged(Set.of(userId), "GROUP_MEMBER_ADDED", groupId);
    }

    public List<GroupMemberDTO> getMembers(String groupId) {

        /*
         * Chỉ trả về thành viên còn trong nhóm.
         * Người removed = true không còn hiện trong danh sách thành viên.
         */
        List<GroupMember> members = memberRepo.findByGroupIdAndRemovedFalse(groupId);

        if (members.isEmpty()) {
            return List.of();
        }

        List<Long> userIds = members.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        Map<Long, User> userById = userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));

        return members.stream().map(m -> {
            Long uid = m.getUserId();
            User user = uid != null ? userById.get(uid) : null;

            return new GroupMemberDTO(
                    uid,
                    user != null ? user.getUsername() : "User " + uid,
                    user != null ? user.getAvatar() : "/default-avatar.png",
                    m.getRole().name()
            );
        }).toList();
    }

    public void removeMember(String groupId, Long targetUserId, Long currentUserId) {

        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.ADMIN && me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Bạn không có quyền");
        }

        if (currentUserId.equals(targetUserId)) {
            throw new RuntimeException("Không thể tự xoá chính mình");
        }

        GroupMember target = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, targetUserId)
                .orElseThrow(() -> new RuntimeException("User không trong nhóm"));

        if (target.getRole() == GroupRole.OWNER) {
            throw new RuntimeException("Không thể xoá chủ nhóm");
        }

        if (me.getRole() == GroupRole.ADMIN && target.getRole() == GroupRole.ADMIN) {
            throw new RuntimeException("Quản trị viên không thể xoá quản trị viên khác");
        }

        String targetName = getDisplayName(targetUserId);
        String actorName = getDisplayName(currentUserId);

        /*
         * Không xoá record nữa.
         * Chỉ đánh dấu removed = true để người bị kick vẫn giữ lịch sử chat.
         */
        target.setRemoved(true);
        target.setRemovedAt(LocalDateTime.now());
        target.setRemovedBy(currentUserId);
        memberRepo.save(target);

        publishGroupSystemMessage(
                groupId,
                targetName + " đã bị xóa khỏi nhóm bởi " + actorName
        );

        notifyGroupChanged(Set.of(targetUserId), "GROUP_MEMBER_REMOVED", groupId);
    }

    public void deleteGroup(String groupId, Long currentUserId) {

        /*
         * Giải tán nhóm:
         * - Chỉ OWNER còn active mới được giải tán.
         * - Khi giải tán thì xoá tất cả member records, kể cả removed = true.
         * - Như vậy boxchat sẽ mất với tất cả người dùng.
         */
        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Chỉ chủ nhóm mới được giải tán");
        }

        List<GroupMember> members = memberRepo.findByGroupId(groupId);

        Set<Long> notifyUsers = members.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        memberRepo.deleteAll(members);

        groupRepo.deleteById(groupId);

        notifyGroupChanged(notifyUsers, "GROUP_DELETED", groupId);
    }

    public void updateRole(String groupId, Long targetUserId, GroupRole newRole, Long currentUserId) {
        if (newRole == GroupRole.OWNER) {
            throw new RuntimeException("Hay dung API chuyen quyen truong nhom");
        }

        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Ban khong thuoc nhom"));

        if (me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Chi truong nhom moi duoc cap nhat quyen");
        }

        GroupMember target = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, targetUserId)
                .orElseThrow(() -> new RuntimeException("Thanh vien khong ton tai hoac da bi xoa khoi nhom"));

        if (target.getRole() == GroupRole.OWNER) {
            throw new RuntimeException("Khong the sua quyen truong nhom bang API nay");
        }

        target.setRole(newRole);
        memberRepo.save(target);
    }

    public void transferOwner(String groupId, Long targetUserId, Long currentUserId) {
        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Khong thuoc nhom"));

        if (me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Chi truong nhom moi duoc chuyen quyen");
        }

        if (Objects.equals(targetUserId, currentUserId)) {
            throw new RuntimeException("Khong the chuyen quyen cho chinh minh");
        }

        GroupMember target = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, targetUserId)
                .orElseThrow(() -> new RuntimeException("Thanh vien khong ton tai hoac da bi xoa khoi nhom"));

        me.setRole(GroupRole.ADMIN);
        target.setRole(GroupRole.OWNER);

        memberRepo.save(me);
        memberRepo.save(target);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " da chuyen quyen truong nhom cho " + getDisplayName(targetUserId)
        );

        List<GroupMember> members = memberRepo.findByGroupIdAndRemovedFalse(groupId);
        Set<Long> notifyUsers = members.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        notifyGroupChanged(notifyUsers, "GROUP_OWNER_TRANSFERRED", groupId);
    }

    public Group updateGroupAvatar(String groupId, String avatarUrl, Long currentUserId) {

        if (groupId == null || groupId.isBlank()) {
            throw new RuntimeException("GroupId không hợp lệ");
        }

        if (avatarUrl == null || avatarUrl.isBlank()) {
            throw new RuntimeException("Avatar không hợp lệ");
        }

        Group group = groupRepo.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group không tồn tại"));

        /*
         * SỬA Ở ĐÂY:
         * Người đã bị kick không được đổi avatar nhóm.
         */
        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.ADMIN && me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Bạn không có quyền đổi ảnh nhóm");
        }

        group.setAvatar(avatarUrl);

        Group saved = groupRepo.save(group);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId) + " đã đổi ảnh đại diện nhóm"
        );

        /*
         * Chỉ notify thành viên còn active.
         * Người đã bị kick chỉ giữ lịch sử tới lúc bị kick.
         */
        List<GroupMember> members = memberRepo.findByGroupIdAndRemovedFalse(groupId);

        Set<Long> notifyUsers = members.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        notifyGroupAvatarChanged(notifyUsers, groupId, avatarUrl);

        return saved;
    }

    public Group updateGroupName(String groupId, String newName, Long currentUserId) {

        if (groupId == null || groupId.isBlank()) {
            throw new RuntimeException("GroupId không hợp lệ");
        }

        if (newName == null || newName.isBlank()) {
            throw new RuntimeException("Tên nhóm không được để trống");
        }

        Group group = groupRepo.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group không tồn tại"));

        /*
         * SỬA Ở ĐÂY:
         * Người đã bị kick không được đổi tên nhóm.
         */
        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, currentUserId)
                .orElseThrow(() -> new RuntimeException("Bạn không thuộc nhóm"));

        if (me.getRole() != GroupRole.ADMIN && me.getRole() != GroupRole.OWNER) {
            throw new RuntimeException("Bạn không có quyền đổi tên nhóm");
        }

        String oldName = group.getName();

        group.setName(newName.trim());

        Group saved = groupRepo.save(group);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(currentUserId)
                        + " đã đổi tên nhóm từ \""
                        + oldName
                        + "\" thành \""
                        + saved.getName()
                        + "\""
        );

        /*
         * Chỉ notify thành viên còn active.
         */
        List<GroupMember> members = memberRepo.findByGroupIdAndRemovedFalse(groupId);

        Set<Long> notifyUsers = members.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        notifyGroupNameChanged(notifyUsers, groupId, saved.getName());

        return saved;
    }

    public void leaveGroup(String groupId, Long userId) {
        leaveGroup(groupId, userId, null);
    }

    public void leaveGroup(String groupId, Long userId, Long newOwnerId) {

        /*
         * Người đã removed không thể rời nhóm lần nữa.
         */
        GroupMember me = memberRepo.findByGroupIdAndUserIdAndRemovedFalse(groupId, userId)
                .orElseThrow(() -> new RuntimeException("Không thuộc nhóm"));

        if (me.getRole() == GroupRole.OWNER) {

            /*
             * Chỉ tính thành viên còn active khi chuyển quyền.
             */
            List<GroupMember> members = memberRepo.findByGroupIdAndRemovedFalse(groupId);

            if (members.size() <= 1) {
                /*
                 * Nếu chỉ còn OWNER active, giải tán luôn group.
                 * Nhưng vẫn xoá toàn bộ record kể cả removed để boxchat mất khỏi tất cả.
                 */
                List<GroupMember> allMembers = memberRepo.findByGroupId(groupId);

                Set<Long> notifyUsers = allMembers.stream()
                        .map(GroupMember::getUserId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());

                memberRepo.deleteAll(allMembers);
                groupRepo.deleteById(groupId);

                notifyGroupChanged(notifyUsers, "GROUP_DELETED", groupId);
                return;
            }

            if (newOwnerId == null || Objects.equals(newOwnerId, userId)) {
                throw new RuntimeException("Truong nhom phai chon thanh vien nhan quyen truoc khi roi nhom");
            }

            GroupMember newOwner = members.stream()
                    .filter(m -> Objects.equals(m.getUserId(), newOwnerId))
                    .findFirst()
                    .orElseThrow(() -> new RuntimeException("Thanh vien nhan quyen khong hop le"));

            members.stream()
                    .filter(m -> m.getRole() == GroupRole.OWNER)
                    .filter(m -> !Objects.equals(m.getUserId(), newOwnerId))
                    .forEach(m -> {
                        m.setRole(GroupRole.ADMIN);
                        memberRepo.save(m);
                    });

            newOwner.setRole(GroupRole.OWNER);
            memberRepo.save(newOwner);

            publishGroupSystemMessage(
                    groupId,
                    getDisplayName(userId) + " da chuyen quyen truong nhom cho " + getDisplayName(newOwnerId)
            );
        }

        /*
         * Rời nhóm cũng giữ lịch sử chat.
         * Nếu bạn muốn rời nhóm là mất boxchat, đổi lại thành deleteByGroupIdAndUserId.
         */
        me.setRemoved(true);
        me.setRemovedAt(LocalDateTime.now());
        me.setRemovedBy(userId);
        memberRepo.save(me);

        publishGroupSystemMessage(
                groupId,
                getDisplayName(userId) + " đã rời nhóm"
        );

        List<GroupMember> notifyMembers = memberRepo.findByGroupId(groupId);
        Set<Long> notifyUsers = notifyMembers.stream()
                .map(GroupMember::getUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        notifyGroupChanged(notifyUsers, "GROUP_MEMBER_REMOVED", groupId);
    }

    private String buildDefaultGroupName(Long creatorId, List<Long> memberIds) {

        List<Long> allIds = new ArrayList<>();

        if (creatorId != null) {
            allIds.add(creatorId);
        }

        if (memberIds != null) {
            memberIds.stream()
                    .filter(Objects::nonNull)
                    .filter(id -> !allIds.contains(id))
                    .forEach(allIds::add);
        }

        if (allIds.isEmpty()) {
            return "Nhóm mới";
        }

        List<User> users = userRepository.findAllById(allIds);

        Map<Long, String> nameById = users.stream()
                .collect(Collectors.toMap(
                        User::getId,
                        user -> user.getUsername() != null && !user.getUsername().isBlank()
                                ? user.getUsername()
                                : "User " + user.getId()
                ));

        String name = allIds.stream()
                .map(id -> nameById.getOrDefault(id, "User " + id))
                .collect(Collectors.joining(", "));

        return name.isBlank() ? "Nhóm mới" : name;
    }

    private void notifyGroupChanged(Set<Long> userIds, String action, String groupId) {
        if (userIds == null || userIds.isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("groupId", groupId);
        payload.put("timestamp", System.currentTimeMillis());

        userIds.stream()
                .filter(Objects::nonNull)
                .forEach(uid ->
                        messagingTemplate.convertAndSend(
                                "/topic/group-updates/" + uid,
                                payload
                        )
                );
    }

    private void notifyGroupAvatarChanged(Set<Long> userIds, String groupId, String avatar) {
        if (userIds == null || userIds.isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GROUP_AVATAR_UPDATED");
        payload.put("groupId", groupId);
        payload.put("avatar", avatar);
        payload.put("timestamp", System.currentTimeMillis());

        userIds.stream()
                .filter(Objects::nonNull)
                .forEach(uid ->
                        messagingTemplate.convertAndSend(
                                "/topic/group-updates/" + uid,
                                payload
                        )
                );
    }

    private void notifyGroupNameChanged(Set<Long> userIds, String groupId, String groupName) {
        if (userIds == null || userIds.isEmpty()) return;

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", "GROUP_NAME_UPDATED");
        payload.put("groupId", groupId);
        payload.put("groupName", groupName);
        payload.put("timestamp", System.currentTimeMillis());

        userIds.stream()
                .filter(Objects::nonNull)
                .forEach(uid ->
                        messagingTemplate.convertAndSend(
                                "/topic/group-updates/" + uid,
                                payload
                        )
                );
    }

    private String getDisplayName(Long userId) {
        if (userId == null) return "Người dùng";

        return userRepository.findById(userId)
                .map(User::getUsername)
                .filter(name -> name != null && !name.isBlank())
                .orElse("User " + userId);
    }

    private void publishGroupSystemMessage(String groupId, String text) {
        if (groupId == null || groupId.isBlank() || text == null || text.isBlank()) return;

        Message systemMsg = Message.builder()
                .senderId(0L)
                .roomId("group_" + groupId)
                .content(text)
                .type("SYSTEM")
                .createdAt(LocalDateTime.now())
                .build();

        Message saved = messageRepository.save(systemMsg);

        messagingTemplate.convertAndSend(
                "/topic/chat/group_" + groupId,
                saved
        );
    }
}
