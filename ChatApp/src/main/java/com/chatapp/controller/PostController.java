package com.chatapp.controller;

import com.chatapp.dto.CreatePostDTO;
import com.chatapp.entity.Post;
import com.chatapp.service.PostService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@RestController
@RequestMapping("/api/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @PostMapping
    public Post createPost(
            @RequestBody CreatePostDTO dto,
            Principal principal
    ) {
        Long currentUserId = Long.parseLong(principal.getName());
        return postService.createPost(dto, currentUserId);
    }

    @GetMapping("/feed")
    public List<Post> getFeed() {
        return postService.getFeed();
    }

    @GetMapping("/me")
    public List<Post> getMyPosts(Principal principal) {
        Long currentUserId = Long.parseLong(principal.getName());
        return postService.getMyPosts(currentUserId);
    }

    @DeleteMapping("/{postId}")
    public void deletePost(
            @PathVariable String postId,
            Principal principal
    ) {
        Long currentUserId = Long.parseLong(principal.getName());
        postService.deletePost(postId, currentUserId);
    }
}