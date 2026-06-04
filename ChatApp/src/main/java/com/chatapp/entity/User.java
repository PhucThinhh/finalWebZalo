package com.chatapp.entity;


import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;


@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;

    private String password;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(unique = true, nullable = false)
    private String phone;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    private LocalDate birthday;

    private String avatar = "default-avatar.png";

    private String coverImage = "default-cover.jpg";

    @Enumerated(EnumType.STRING)
    private Role role;

    private Boolean locked = false;

    private LocalDateTime lastLoginAt;

    @Column(length = 80)
    private String lastLoginIp;

    @Column(length = 512)
    private String lastLoginUserAgent;
}
