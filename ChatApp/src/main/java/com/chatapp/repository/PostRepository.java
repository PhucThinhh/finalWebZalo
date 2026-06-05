package com.chatapp.repository;

import com.chatapp.entity.Post;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface PostRepository extends MongoRepository<Post, String> {

    List<Post> findByIsDeletedFalseOrderByCreatedAtDesc();

    List<Post> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(Long userId);
}