package com.chatapp.service;

import com.chatapp.dto.LockAppealRequest;
import com.chatapp.entity.LockAppeal;
import com.chatapp.entity.User;
import com.chatapp.repository.LockAppealRepository;
import com.chatapp.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class LockAppealService {

    private final LockAppealRepository lockAppealRepository;
    private final UserRepository userRepository;

    public LockAppealService(
            LockAppealRepository lockAppealRepository,
            UserRepository userRepository
    ) {
        this.lockAppealRepository = lockAppealRepository;
        this.userRepository = userRepository;
    }

    public LockAppeal createAppeal(LockAppealRequest request) {
        User user = userRepository.findByPhone(request.getPhone())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản"));

        if (!Boolean.TRUE.equals(user.getLocked())) {
            throw new RuntimeException("Tài khoản này hiện không bị khóa");
        }

        if (lockAppealRepository.existsByUserIdAndStatus(user.getId(), LockAppeal.Status.PENDING)) {
            throw new RuntimeException("Bạn đã gửi phản hồi và đang chờ admin duyệt");
        }

        LockAppeal appeal = LockAppeal.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .phone(user.getPhone())
                .message(request.getMessage().trim())
                .status(LockAppeal.Status.PENDING)
                .createdAt(LocalDateTime.now())
                .build();

        return lockAppealRepository.save(appeal);
    }

    public List<LockAppeal> getPendingAppeals() {
        return lockAppealRepository.findByStatusOrderByCreatedAtDesc(LockAppeal.Status.PENDING);
    }

    public LockAppeal approve(Long appealId, Long adminId) {
        LockAppeal appeal = lockAppealRepository.findById(appealId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phản hồi"));

        User user = userRepository.findById(appeal.getUserId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user"));

        user.setLocked(false);
        userRepository.save(user);

        appeal.setStatus(LockAppeal.Status.APPROVED);
        appeal.setReviewedAt(LocalDateTime.now());
        appeal.setReviewedBy(adminId);
        return lockAppealRepository.save(appeal);
    }
}
