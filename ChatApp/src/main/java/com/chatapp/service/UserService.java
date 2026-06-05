package com.chatapp.service;

import com.chatapp.dto.ChangePasswordRequest;
import com.chatapp.dto.UpdateUserRequest;
import com.chatapp.entity.Gender;
import com.chatapp.entity.Role;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.chatapp.dto.UserResponse;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(User user) {

        // 🔹 check duplicate
        if (userRepository.existsByPhone(user.getPhone())) {
            throw new RuntimeException("SĐT đã tồn tại");
        }

        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email đã tồn tại");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));

        user.setRole(Role.USER);

        user.setAvatar("https://s3-dyamodb-cloudfront.s3.ap-southeast-1.amazonaws.com/uploads/d5fe980e-ba1d-4219-bd58-bef84289a982_avatar.jpg");

        user.setCoverImage("https://picsum.photos/800/200");

        return userRepository.save(user);
    }

    public Optional<User> loginByPhone(String phone, String password) {

        return userRepository.findByPhone(phone)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()));

    }

    public void updateLoginMetadata(User user, String ip, String userAgent) {
        user.setLastLoginAt(LocalDateTime.now());
        user.setLastLoginIp(ip);
        user.setLastLoginUserAgent(userAgent);
        userRepository.save(user);
    }

    public User getByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
    }

    public List<User> getAll() {
        return userRepository.findAll();
    }

    public User updateUser(Long userId, UpdateUserRequest request) {

        User user = getById(userId);

        // 🔹 username
        if (request.getUsername() != null && !request.getUsername().isBlank()) {
            user.setUsername(request.getUsername());
        }

        if (request.getGender() != null) {
            user.setGender(parseGender(request.getGender()));
        }

        if (request.getBirthday() != null) {
            user.setBirthday(request.getBirthday());
        }

        return userRepository.save(user);
    }


    public User updateAvatar(String phone, String avatarUrl) {
        User user = getByPhone(phone);
        user.setAvatar(avatarUrl);
        return userRepository.save(user);
    }

    public User updateCover(String phone, String coverUrl) {
        User user = getByPhone(phone);
        user.setCoverImage(coverUrl);
        return userRepository.save(user);
    }

    public void deleteById(Long id) {
        userRepository.deleteById(id);
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByPhone(String phone) {
        return userRepository.existsByPhone(phone);
    }
    public User save(User user) {
        return userRepository.save(user);
    }

    private Gender parseGender(String g) {
        if (g == null) return null;

        if (g.equalsIgnoreCase("Nam")) return Gender.MALE;
        if (g.equalsIgnoreCase("Nữ")) return Gender.FEMALE;

        try {
            return Gender.valueOf(g.toUpperCase());
        } catch (Exception e) {
            throw new RuntimeException("Giới tính không hợp lệ (MALE/FEMALE)");
        }
    }
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email không tồn tại"));
    }
    public String changePassword(Long userId, ChangePasswordRequest request) {


        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new RuntimeException("Mật khẩu cũ không đúng");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPassword())) {
            throw new RuntimeException("Mật khẩu mới không được trùng mật khẩu cũ");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));

        userRepository.save(user);

        return "Đổi mật khẩu thành công";
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public UserResponse getUserInfo(Long id) {

        User user = getById(id);

        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .phone(user.getPhone())
                .gender(user.getGender() != null ? toGenderText(user.getGender()) : null)
                .birthday(user.getBirthday())
                .avatar(user.getAvatar())
                .coverImage(user.getCoverImage())
                .role(user.getRole() != null ? user.getRole().name() : null)
                .locked(Boolean.TRUE.equals(user.getLocked()))
                .lastLoginAt(user.getLastLoginAt())
                .lastLoginIp(user.getLastLoginIp())
                .lastLoginUserAgent(user.getLastLoginUserAgent())
                .build();
    }
    private String toGenderText(Gender gender) {
        if (gender == null) return null;

        if (gender == Gender.MALE) return "Nam";
        if (gender == Gender.FEMALE) return "Nữ";

        return gender.name();
    }
}
