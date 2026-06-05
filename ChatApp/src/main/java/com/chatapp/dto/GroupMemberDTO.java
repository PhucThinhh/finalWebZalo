package com.chatapp.dto;

import com.chatapp.entity.GroupRole;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GroupMemberDTO {

    private Long userId;

    private String username;

    private String avatar;

    private GroupRole role;
}