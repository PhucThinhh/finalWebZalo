package com.chatapp.controller;

import com.chatapp.dto.ChangePasswordRequest;
import com.chatapp.dto.UpdateUserRequest;
import com.chatapp.dto.UserResponse;
import com.chatapp.entity.User;
import com.chatapp.service.S3Service;
import com.chatapp.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserService userService;
    private final S3Service s3Service;

    public UserController(UserService userService,
                          S3Service s3Service) {
        this.userService = userService;
        this.s3Service = s3Service;
    }

    @GetMapping("/me")
    public UserResponse getProfile(Authentication authentication) {

        Long userId = Long.valueOf(authentication.getName()); // ✅ lấy ID

        User user = userService.getById(userId); // ✅ đổi sang getById

        return map(user);
    }

    @PutMapping("/update")
    public UserResponse updateProfile(
            Authentication authentication,
            @RequestBody UpdateUserRequest request
    ) {

        Long userId = Long.valueOf(authentication.getName());

        User user = userService.updateUser(userId, request);

        return map(user);
    }

    @PostMapping(value = "/upload-avatar", consumes = "multipart/form-data")
    public String uploadAvatar(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) throws Exception {

        Long userId = Long.valueOf(authentication.getName());

        User user = userService.getById(userId);

        String url = s3Service.uploadFile(file);

        user.setAvatar(url);
        userService.save(user);

        return url;
    }

    @PostMapping(value = "/upload-cover", consumes = "multipart/form-data")
    public String uploadCover(
            Authentication authentication,
            @RequestParam("file") MultipartFile file
    ) throws Exception {

        Long userId = Long.valueOf(authentication.getName());

        User user = userService.getById(userId);

        String url = s3Service.uploadFile(file);

        user.setCoverImage(url);
        userService.save(user);

        return url;
    }

    private UserResponse map(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .phone(user.getPhone())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .birthday(user.getBirthday())
                .avatar(user.getAvatar())
                .coverImage(user.getCoverImage())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .locked(Boolean.TRUE.equals(user.getLocked()))
                .build();
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request
    ) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401)
                    .body(Map.of("message", "Chưa đăng nhập"));
        }

        try {
            Long userId = Long.valueOf(authentication.getName());

            String result = userService.changePassword(userId, request);

            return ResponseEntity.ok(
                    Map.of("message", result)
            );

        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", e.getMessage()));
        }
    }
    @GetMapping("/{id}")
    public UserResponse getUserInfo(@PathVariable Long id) {
        return userService.getUserInfo(id);
    }


}
