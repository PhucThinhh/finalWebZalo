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

    @PostMapping("/create")
    public Group create(
            @RequestBody CreateGroupDTO dto,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        return groupService.createGroup(dto, currentUserId);
    }

    @GetMapping("/my-groups")
    public List<Group> getMyGroups(Authentication authentication) {
        Long currentUserId = Long.parseLong(authentication.getName());
        return groupService.getGroupsByUser(currentUserId);
    }

    @GetMapping("/members")
    public List<GroupMemberDTO> getMembers(@RequestParam String groupId) {
        return groupService.getMembers(groupId);
    }

    @PostMapping("/add-member")
    public void addMember(
            @RequestParam String groupId,
            @RequestParam Long userId,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        groupService.addMember(groupId, userId, currentUserId);
    }

    @DeleteMapping("/remove-member")
    public void removeMember(
            @RequestParam String groupId,
            @RequestParam Long userId,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        groupService.removeMember(groupId, userId, currentUserId);
    }

    @DeleteMapping("/delete")
    public void deleteGroup(
            @RequestParam String groupId,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        groupService.deleteGroup(groupId, currentUserId);
    }

    @PutMapping("/update-role")
    public void updateRole(
            @RequestParam String groupId,
            @RequestParam Long userId,
            @RequestParam GroupRole role,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        groupService.updateRole(groupId, userId, role, currentUserId);
    }

    @DeleteMapping("/leave")
    public void leaveGroup(
            @RequestParam String groupId,
            @RequestParam(required = false) Long newOwnerId,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        groupService.leaveGroup(groupId, currentUserId, newOwnerId);
    }

    @PutMapping("/rename")
    public Group renameGroup(
            @RequestParam String groupId,
            @RequestParam String name,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        return groupService.renameGroup(groupId, name, currentUserId);
    }

    @PutMapping("/background")
    public Group updateBackground(
            @RequestParam String groupId,
            @RequestParam String backgroundUrl,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        return groupService.updateGroupBackground(groupId, backgroundUrl, currentUserId);
    }

    @PutMapping("/avatar")
    public Group updateAvatar(
            @RequestParam String groupId,
            @RequestParam String avatarUrl,
            Authentication authentication
    ) {
        Long currentUserId = Long.parseLong(authentication.getName());
        return groupService.updateGroupAvatar(groupId, avatarUrl, currentUserId);
    }
}