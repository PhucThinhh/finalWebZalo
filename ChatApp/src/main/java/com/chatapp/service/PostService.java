package com.chatapp.service;

import com.chatapp.dto.CreatePostDTO;
import com.chatapp.entity.Post;
import com.chatapp.entity.User;
import com.chatapp.repository.PostRepository;
import com.chatapp.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;

    public Post createPost(CreatePostDTO dto, Long currentUserId) {

        if ((dto.getContent() == null || dto.getContent().isBlank())
                && (dto.getImageUrl() == null || dto.getImageUrl().isBlank())) {
            throw new RuntimeException("Bài viết phải có nội dung hoặc ảnh");
        }

        User user = userRepository.findById(currentUserId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Post post = Post.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .userAvatar(user.getAvatar())
                .content(dto.getContent())
                .imageUrl(dto.getImageUrl())
                .isDeleted(false)
                .createdAt(LocalDateTime.now())
                .build();

        return postRepository.save(post);
    }

    public List<Post> getFeed() {
        return postRepository.findByIsDeletedFalseOrderByCreatedAtDesc();
    }

    public List<Post> getMyPosts(Long currentUserId) {
        return postRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(currentUserId);
    }

    public void deletePost(String postId, Long currentUserId) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy bài viết"));

        if (!post.getUserId().equals(currentUserId)) {
            throw new RuntimeException("Bạn không có quyền xoá bài viết này");
        }

        post.setIsDeleted(true);

        postRepository.save(post);
    }
}