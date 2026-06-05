package com.chatapp.service;

import com.chatapp.dto.FriendResponseDTO;
import com.chatapp.dto.UserSearchDTO;
import com.chatapp.entity.Friendship;
import com.chatapp.entity.User;
import com.chatapp.mapper.FriendshipMapper;
import com.chatapp.repository.FriendshipRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendshipRepository repo;
    private final UserRepository userRepo;

    // 🔥 GỬI LỜI MỜI
    @Transactional
    public void sendRequest(Long senderId, Long receiverId) {

        if (senderId.equals(receiverId)) {
            throw new RuntimeException("Không thể tự kết bạn");
        }

        User sender = userRepo.findById(senderId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người gửi"));

        User receiver = userRepo.findById(receiverId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy người nhận"));

        Friendship existing = repo.findRelation(senderId, receiverId).orElse(null);

        if (existing != null) {

            if (existing.getStatus() == Friendship.Status.PENDING) {
                throw new RuntimeException("Đã gửi lời mời kết bạn");
            }

            if (existing.getStatus() == Friendship.Status.ACCEPTED) {
                throw new RuntimeException("Hai bạn đã là bạn bè");
            }

            // Trường hợp còn sót dữ liệu REJECTED cũ trong database
            // Cho phép gửi lại bằng cách cập nhật lại record cũ
            if (existing.getStatus() == Friendship.Status.REJECTED) {
                existing.setSenderId(senderId);
                existing.setReceiverId(receiverId);
                existing.setStatus(Friendship.Status.PENDING);
                existing.setCreatedAt(LocalDateTime.now());
                repo.save(existing);
                return;
            }

            throw new RuntimeException("Đã tồn tại quan hệ");
        }

        Friendship f = Friendship.builder()
                .senderId(sender.getId())
                .receiverId(receiver.getId())
                .status(Friendship.Status.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        repo.save(f);
    }

    // ✅ CHẤP NHẬN
    @Transactional
    public void accept(Long id) {
        Friendship f = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lời mời"));

        if (f.getStatus() != Friendship.Status.PENDING) {
            throw new RuntimeException("Lời mời không còn hợp lệ");
        }

        f.setStatus(Friendship.Status.ACCEPTED);
        repo.save(f);
    }

    // ❌ TỪ CHỐI
    @Transactional
    public void reject(Long id) {
        Friendship f = repo.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy lời mời"));

        if (f.getStatus() != Friendship.Status.PENDING) {
            throw new RuntimeException("Lời mời không còn hợp lệ");
        }

        // Quan trọng:
        // Từ chối thì xóa luôn record để sau này có thể gửi kết bạn lại
        repo.delete(f);
    }

    // 👥 DANH SÁCH BẠN
    public List<FriendResponseDTO> getFriends(Long userId) {

        return repo.findFriends(userId).stream().map(f -> {

            Long friendId = f.getSenderId().equals(userId)
                    ? f.getReceiverId()
                    : f.getSenderId();

            User u = userRepo.findById(friendId)
                    .orElseThrow(() -> new RuntimeException("User not found"));

            return FriendshipMapper.toDTO(f, u);

        }).toList();
    }

    // 📩 DANH SÁCH LỜI MỜI
    public List<FriendResponseDTO> getRequests(Long userId) {

        return repo.findRequests(userId).stream().map(f -> {

            User u = userRepo.findById(f.getSenderId())
                    .orElseThrow(() -> new RuntimeException("User not found"));

            return FriendshipMapper.toDTO(f, u);

        }).toList();
    }

    // 🔍 SEARCH USER
    public List<UserSearchDTO> searchUsers(String keyword, Long currentUserId) {

        if (keyword == null || keyword.isBlank()) return List.of();

        String k = keyword.toLowerCase();

        List<User> users = userRepo.findAll();

        return users.stream()
                .filter(user -> !user.getId().equals(currentUserId))
                .filter(user ->
                        (user.getUsername() != null && user.getUsername().toLowerCase().contains(k)) ||
                                (user.getPhone() != null && user.getPhone().contains(k)) ||
                                (user.getEmail() != null && user.getEmail().toLowerCase().contains(k))
                )
                .map(user -> {

                    Friendship f = repo
                            .findRelation(currentUserId, user.getId())
                            .orElse(null);

                    String status = "NONE";

                    if (f != null) {
                        if (f.getStatus() == Friendship.Status.ACCEPTED) {
                            status = "FRIEND";
                        } else if (f.getStatus() == Friendship.Status.PENDING) {
                            status = "PENDING";
                        } else if (f.getStatus() == Friendship.Status.REJECTED) {
                            status = "NONE";
                        }
                    }

                    return new UserSearchDTO(
                            user.getId(),
                            user.getUsername(),
                            user.getAvatar(),
                            status
                    );
                })
                .toList();
    }
}