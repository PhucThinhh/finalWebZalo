package com.chatapp.controller;

import com.chatapp.dto.CreateGroupDTO;
import com.chatapp.dto.GroupMemberDTO;
import com.chatapp.entity.Group;
import com.chatapp.entity.GroupRole;
import com.chatapp.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat/group")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    // =========================
    // CREATE GROUP
    // =========================
    @PostMapping("/create")
    public Group create(@RequestBody CreateGroupDTO dto) {
        System.out.println(">>> CONTROLLER HIT");
        return groupService.createGroup(dto);
    }

    // =========================
    // GET MY GROUPS
    // =========================
    @GetMapping("/my-groups")
    public List<Group> getMyGroups(@RequestParam Long userId) {
        return groupService.getGroupsByUser(userId);
    }

    // =========================
    // ADD MEMBER
    // =========================
    @PostMapping("/add-member")
    public void addMember(
            @RequestParam String groupId,
            @RequestParam Long userId,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());

        groupService.addMember(groupId, userId, currentUserId);
    }

    // =========================
    // GET GROUP MEMBERS
    // =========================
    @GetMapping("/members")
    public List<GroupMemberDTO> getMembers(@RequestParam String groupId) {
        return groupService.getMembers(groupId);
    }

    // =========================
    // REMOVE MEMBER
    // =========================
    @DeleteMapping("/remove-member")
    public void removeMember(
            @RequestParam String groupId,
            @RequestParam Long userId,
            @RequestParam Long currentUserId
    ) {
        groupService.removeMember(groupId, userId, currentUserId);
    }

    // =========================
    // DELETE GROUP
    // =========================
    @DeleteMapping("/delete")
    public void deleteGroup(
            @RequestParam String groupId,
            @RequestParam Long currentUserId
    ) {
        groupService.deleteGroup(groupId, currentUserId);
    }

    // =========================
    // UPDATE MEMBER ROLE
    // =========================
    @PutMapping("/update-role")
    public void updateRole(
            @RequestParam String groupId,
            @RequestParam Long userId,
            @RequestParam GroupRole role,
            @RequestParam Long currentUserId
    ) {
        groupService.updateRole(groupId, userId, role, currentUserId);
    }

    @PutMapping("/transfer-owner")
    public void transferOwner(
            @RequestParam String groupId,
            @RequestParam Long userId,
            @RequestParam Long currentUserId
    ) {
        groupService.transferOwner(groupId, userId, currentUserId);
    }

    // =========================
    // UPDATE GROUP AVATAR
    // =========================
    @PutMapping("/avatar")
    public Group updateGroupAvatar(
            @RequestParam String groupId,
            @RequestParam String avatar,
            @RequestParam Long currentUserId
    ) {
        return groupService.updateGroupAvatar(groupId, avatar, currentUserId);
    }

    // =========================
    // LEAVE GROUP
    // =========================
    @DeleteMapping("/leave")
    public void leaveGroup(
            @RequestParam String groupId,
            @RequestParam Long userId,
            @RequestParam(required = false) Long newOwnerId
    ) {
        groupService.leaveGroup(groupId, userId, newOwnerId);
    }

    @PutMapping("/name")
    public Group updateGroupName(
            @RequestParam String groupId,
            @RequestParam String name,
            @RequestParam Long currentUserId
    ) {
        return groupService.updateGroupName(groupId, name, currentUserId);
    }
}
