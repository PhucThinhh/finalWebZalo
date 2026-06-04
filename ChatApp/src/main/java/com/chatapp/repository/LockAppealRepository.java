package com.chatapp.repository;

import com.chatapp.entity.LockAppeal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LockAppealRepository extends JpaRepository<LockAppeal, Long> {
    List<LockAppeal> findByStatusOrderByCreatedAtDesc(LockAppeal.Status status);
    boolean existsByUserIdAndStatus(Long userId, LockAppeal.Status status);
}
