package com.chatapp.controller.admincontroller;

import com.chatapp.dto.UserResponse;
import com.chatapp.entity.LockAppeal;
import com.chatapp.entity.Role;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import com.chatapp.service.LockAppealService;
import com.chatapp.websocket.SocketEventListener;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final UserRepository userRepository;
    private final SocketEventListener socketEventListener;
    private final LockAppealService lockAppealService;
    private final Instant startedAt = Instant.now();

    public AdminUserController(
            UserRepository userRepository,
            SocketEventListener socketEventListener,
            LockAppealService lockAppealService
    ) {
        this.userRepository = userRepository;
        this.socketEventListener = socketEventListener;
        this.lockAppealService = lockAppealService;
    }

    @GetMapping
    public List<UserResponse> getAllUsers() {
        Set<String> onlineIds = socketEventListener.getOnlineUserIds();

        return userRepository.findAll()
                .stream()
                .sorted(Comparator.comparing(User::getId).reversed())
                .map(user -> map(user, onlineIds.contains(String.valueOf(user.getId()))))
                .toList();
    }

    @GetMapping("/summary")
    public Map<String, Object> getSummary() {
        List<User> users = userRepository.findAll();
        long total = users.size();
        long admins = users.stream().filter(user -> user.getRole() == Role.ADMIN).count();
        long locked = users.stream().filter(user -> Boolean.TRUE.equals(user.getLocked())).count();
        long online = socketEventListener.getOnlineUserIds().size();

        return Map.of(
                "totalUsers", total,
                "adminUsers", admins,
                "normalUsers", Math.max(total - admins, 0),
                "lockedUsers", locked,
                "onlineUsers", online
        );
    }

    @PutMapping("/{id}/role")
    public UserResponse updateRole(
            @PathVariable Long id,
            @RequestParam Role role,
            Authentication authentication
    ) {
        Long currentAdminId = Long.parseLong(authentication.getName());
        User target = findUser(id);

        if (target.getId().equals(currentAdminId)) {
            throw new RuntimeException("Admin không thể tự đổi quyền của chính mình");
        }

        if (target.getRole() == Role.ADMIN) {
            throw new RuntimeException("Admin không thể thay đổi quyền của admin ngang cấp");
        }

        target.setRole(role);
        return map(userRepository.save(target), isOnline(target.getId()));
    }

    @PutMapping("/{id}/lock")
    public UserResponse lockUser(@PathVariable Long id, Authentication authentication) {
        Long currentAdminId = Long.parseLong(authentication.getName());
        User target = findUser(id);

        if (target.getId().equals(currentAdminId)) {
            throw new RuntimeException("Admin không thể tự khóa tài khoản của chính mình");
        }

        if (target.getRole() == Role.ADMIN) {
            throw new RuntimeException("Admin không thể khóa admin ngang cấp");
        }

        target.setLocked(true);
        return map(userRepository.save(target), isOnline(target.getId()));
    }

    @PutMapping("/{id}/unlock")
    public UserResponse unlockUser(@PathVariable Long id, Authentication authentication) {
        Long currentAdminId = Long.parseLong(authentication.getName());
        User target = findUser(id);

        if (target.getId().equals(currentAdminId)) {
            throw new RuntimeException("Admin không cần mở khóa chính mình");
        }

        if (target.getRole() == Role.ADMIN) {
            throw new RuntimeException("Admin không thể thay đổi trạng thái admin ngang cấp");
        }

        target.setLocked(false);
        return map(userRepository.save(target), isOnline(target.getId()));
    }

    @GetMapping("/{id}/device")
    public Map<String, Object> getLoginDevice(@PathVariable Long id) {
        User user = findUser(id);

        Map<String, Object> device = new HashMap<>();
        device.put("userId", user.getId());
        device.put("username", user.getUsername());
        device.put("online", isOnline(user.getId()));
        device.put("lastLoginAt", user.getLastLoginAt());
        device.put("lastLoginIp", valueOrEmpty(user.getLastLoginIp()));
        device.put("lastLoginUserAgent", valueOrEmpty(user.getLastLoginUserAgent()));
        return device;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = runtime.totalMemory() - runtime.freeMemory();

        Instant before = Instant.now();
        userRepository.count();
        long dbResponseMs = Duration.between(before, Instant.now()).toMillis();

        return Map.of(
                "status", "UP",
                "startedAt", startedAt.toString(),
                "uptimeMs", uptimeMs,
                "processors", runtime.availableProcessors(),
                "usedMemoryBytes", usedMemory,
                "totalMemoryBytes", runtime.totalMemory(),
                "maxMemoryBytes", runtime.maxMemory(),
                "dbResponseMs", dbResponseMs,
                "onlineSocketUsers", socketEventListener.getOnlineUserIds().size()
        );
    }

    @GetMapping("/lock-appeals")
    public List<LockAppeal> getPendingLockAppeals() {
        return lockAppealService.getPendingAppeals();
    }

    @PutMapping("/lock-appeals/{appealId}/approve")
    public LockAppeal approveLockAppeal(
            @PathVariable Long appealId,
            Authentication authentication
    ) {
        Long adminId = Long.parseLong(authentication.getName());
        return lockAppealService.approve(appealId, adminId);
    }

    private User findUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));
    }

    private boolean isOnline(Long userId) {
        return socketEventListener.getOnlineUserIds().contains(String.valueOf(userId));
    }

    private UserResponse map(User user, boolean online) {
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
                .online(online)
                .lastLoginAt(user.getLastLoginAt())
                .lastLoginIp(user.getLastLoginIp())
                .lastLoginUserAgent(user.getLastLoginUserAgent())
                .build();
    }

    private String valueOrEmpty(String value) {
        return value == null ? "" : value;
    }
}
