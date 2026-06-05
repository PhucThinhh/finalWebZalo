package com.chatapp.controller;

import com.chatapp.dto.ChangePasswordRequest;
import com.chatapp.dto.UpdateUserRequest;
import com.chatapp.entity.User;
import com.chatapp.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.Principal;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    private static final String UPLOAD_DIR = "uploads";

    @GetMapping("/me")
    public User me(Principal principal) {
        Long userId = Long.parseLong(principal.getName());
        return userService.getById(userId);
    }

    @PutMapping("/update")
    public User update(
            @RequestBody UpdateUserRequest request,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return userService.updateUser(userId, request);
    }

    @PostMapping("/upload-avatar")
    public User uploadAvatar(
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) throws Exception {
        Long userId = Long.parseLong(principal.getName());

        String avatarUrl = saveFileLocal(file);

        return userService.updateAvatarById(userId, avatarUrl);
    }

    @PostMapping("/upload-cover")
    public User uploadCover(
            @RequestParam("file") MultipartFile file,
            Principal principal
    ) throws Exception {
        Long userId = Long.parseLong(principal.getName());

        String coverUrl = saveFileLocal(file);

        return userService.updateCoverById(userId, coverUrl);
    }

    @PostMapping("/change-password")
    public String changePassword(
            @RequestBody ChangePasswordRequest request,
            Principal principal
    ) {
        Long userId = Long.parseLong(principal.getName());
        return userService.changePassword(userId, request);
    }

    private String saveFileLocal(MultipartFile file) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File không hợp lệ");
        }

        Path uploadPath = Paths.get(UPLOAD_DIR);

        if (!Files.exists(uploadPath)) {
            Files.createDirectories(uploadPath);
        }

        String originalName = file.getOriginalFilename();

        if (originalName == null || originalName.isBlank()) {
            originalName = "image.jpg";
        }

        String safeName = originalName.replaceAll("[^a-zA-Z0-9\\.\\-_]", "_");
        String fileName = System.currentTimeMillis() + "_" + safeName;

        Path filePath = uploadPath.resolve(fileName);

        Files.copy(file.getInputStream(), filePath);

        return "http://10.0.2.2:8080/uploads/" + fileName;
    }
}