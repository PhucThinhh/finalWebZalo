package com.chatapp.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
                .cors(cors -> {})
                .csrf(csrf -> csrf.disable())

                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                )

                .headers(headers -> headers
                        .frameOptions(frame -> frame.disable())
                )

                .authorizeHttpRequests(auth -> auth

                        // Cho phép preflight
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Public
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/ws/**").permitAll()
                        .requestMatchers("/swagger-ui/**").permitAll()
                        .requestMatchers("/v3/api-docs/**").permitAll()
                        .requestMatchers("/uploads/**").permitAll()
                        .requestMatchers("/api/posts/**").authenticated()

                        // File upload / file view
                        .requestMatchers("/api/file/**").authenticated()

                        // Chat API
                        .requestMatchers("/api/chat/messages/**").authenticated()
                        .requestMatchers("/api/chat/message/**").authenticated()
                        .requestMatchers("/api/chat/conversation/**").authenticated()
                        .requestMatchers("/api/chat/group/**").authenticated()
                        .requestMatchers("/api/chat/**").authenticated()

                        // Admin
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // User
                        .requestMatchers("/api/user/**").hasAnyRole("USER", "ADMIN")

                        // Còn lại
                        .anyRequest().authenticated()
                )

                .addFilterBefore(
                        jwtFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class
                );

        return http.build();
    }
}