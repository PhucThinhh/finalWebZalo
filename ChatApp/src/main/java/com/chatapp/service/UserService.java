package com.chatapp.service;

import com.chatapp.dto.ChangePasswordRequest;
import com.chatapp.dto.UpdateUserRequest;
import com.chatapp.entity.Gender;
import com.chatapp.entity.Role;
import com.chatapp.entity.User;
import com.chatapp.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // =========================
    // REGISTER
    // =========================
    public User register(User user) {

        if (userRepository.existsByPhone(user.getPhone())) {
            throw new RuntimeException("SĐT đã tồn tại");
        }

        if (userRepository.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email đã tồn tại");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole(Role.USER);

       user.setAvatar("https://ui-avatars.com/api/?name=User&background=E5E7EB&color=111827");

        user.setCoverImage("https://picsum.photos/800/200");

        return userRepository.save(user);
    }

    // =========================
    // LOGIN
    // =========================
    public Optional<User> loginByPhone(String phone, String password) {
        return userRepository.findByPhone(phone)
                .filter(user -> passwordEncoder.matches(password, user.getPassword()));
    }

    // =========================
    // GET USER
    // =========================
    public User getByPhone(String phone) {
        return userRepository.findByPhone(phone)
                .orElseThrow(() -> new RuntimeException("User không tồn tại"));
    }

    public User getById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Email không tồn tại"));
    }

    public List<User> getAll() {
        return userRepository.findAll();
    }

    // =========================
    // UPDATE USER INFO
    // =========================
    public User updateUser(Long userId, UpdateUserRequest request) {

        User user = getById(userId);

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

    // =========================
    // UPDATE AVATAR BY PHONE - GIỮ LẠI CHO WEB CŨ NẾU CẦN
    // =========================
    public User updateAvatar(String phone, String avatarUrl) {
        User user = getByPhone(phone);

        if (avatarUrl == null || avatarUrl.isBlank()) {
            throw new RuntimeException("Avatar không hợp lệ");
        }

        user.setAvatar(avatarUrl);
        return userRepository.save(user);
    }

    // =========================
    // UPDATE COVER BY PHONE - GIỮ LẠI CHO WEB CŨ NẾU CẦN
    // =========================
    public User updateCover(String phone, String coverUrl) {
        User user = getByPhone(phone);

        if (coverUrl == null || coverUrl.isBlank()) {
            throw new RuntimeException("Ảnh bìa không hợp lệ");
        }

        user.setCoverImage(coverUrl);
        return userRepository.save(user);
    }

    // =========================
    // UPDATE AVATAR BY ID - APP NÊN DÙNG CÁI NÀY
    // =========================
    public User updateAvatarById(Long userId, String avatarUrl) {
        User user = getById(userId);

        if (avatarUrl == null || avatarUrl.isBlank()) {
            throw new RuntimeException("Avatar không hợp lệ");
        }

        user.setAvatar(avatarUrl);

        return userRepository.save(user);
    }

    // =========================
    // UPDATE COVER BY ID - APP NÊN DÙNG CÁI NÀY
    // =========================
    public User updateCoverById(Long userId, String coverUrl) {
        User user = getById(userId);

        if (coverUrl == null || coverUrl.isBlank()) {
            throw new RuntimeException("Ảnh bìa không hợp lệ");
        }

        user.setCoverImage(coverUrl);

        return userRepository.save(user);
    }

    // =========================
    // DELETE
    // =========================
    public void deleteById(Long id) {
        userRepository.deleteById(id);
    }

    // =========================
    // CHECK EXISTS
    // =========================
    public boolean existsByEmail(String email) {
        return userRepository.existsByEmail(email);
    }

    public boolean existsByPhone(String phone) {
        return userRepository.existsByPhone(phone);
    }

    // =========================
    // SAVE
    // =========================
    public User save(User user) {
        return userRepository.save(user);
    }

    // =========================
    // CHANGE PASSWORD
    // =========================
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

    // =========================
    // PARSE GENDER
    // =========================
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
}