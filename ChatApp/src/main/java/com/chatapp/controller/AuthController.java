package com.chatapp.controller;

import com.chatapp.dto.ForgotPasswordRequest;
import com.chatapp.dto.LoginRequest;
import com.chatapp.dto.LoginResponse;
import com.chatapp.dto.LockAppealRequest;
import com.chatapp.dto.RegisterRequest;
import com.chatapp.dto.ResetPasswordRequest;
import com.chatapp.entity.LockAppeal;
import com.chatapp.entity.Gender;
import com.chatapp.entity.Otp;
import com.chatapp.entity.User;
import com.chatapp.repository.OtpRepository;
import com.chatapp.service.JwtService;
import com.chatapp.service.LockAppealService;
import com.chatapp.service.OtpService;
import com.chatapp.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final OtpRepository otpRepository;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final PasswordEncoder passwordEncoder;
    private final LockAppealService lockAppealService;

    public AuthController(
            UserService userService,
            OtpRepository otpRepository,
            JwtService jwtService,
            OtpService otpService,
            PasswordEncoder passwordEncoder,
            LockAppealService lockAppealService
    ) {
        this.userService = userService;
        this.otpRepository = otpRepository;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.passwordEncoder = passwordEncoder;
        this.lockAppealService = lockAppealService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            Otp otp = otpRepository
                    .findTopByEmailOrderByCreatedAtDesc(request.getEmail())
                    .orElseThrow(() -> new RuntimeException("Chưa gửi OTP"));

            if (!otp.getVerified()) {
                return ResponseEntity.badRequest().body("Email chưa xác thực OTP");
            }

            if (userService.existsByEmail(request.getEmail())) {
                return ResponseEntity.badRequest().body("Email đã tồn tại");
            }

            if (userService.existsByPhone(request.getPhone())) {
                return ResponseEntity.badRequest().body("SĐT đã tồn tại");
            }

            Gender gender;
            try {
                gender = Gender.valueOf(request.getGender().toUpperCase());
            } catch (Exception e) {
                return ResponseEntity.badRequest().body("Giới tính không hợp lệ");
            }

            User user = User.builder()
                    .username(request.getUsername())
                    .password(request.getPassword())
                    .email(request.getEmail())
                    .phone(request.getPhone())
                    .gender(gender)
                    .birthday(request.getBirthday())
                    .build();

            userService.register(user);

            otp.setVerified(false);
            otpRepository.save(otp);

            return ResponseEntity.ok("Đăng ký thành công");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public LoginResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        return userService.loginByPhone(request.getPhone(), request.getPassword())
                .map(user -> {
                    if (Boolean.TRUE.equals(user.getLocked())) {
                        throw new RuntimeException("Tài khoản đã bị khóa");
                    }

                    userService.updateLoginMetadata(
                            user,
                            resolveClientIp(httpRequest),
                            httpRequest.getHeader("User-Agent")
                    );

                    return LoginResponse.builder()
                            .token(jwtService.generateToken(
                                    String.valueOf(user.getId()),
                                    user.getRole().name()
                            ))
                            .username(user.getUsername())
                            .phone(user.getPhone())
                            .role(user.getRole().name())
                            .build();
                })
                .orElseThrow(() -> new RuntimeException("Sai SĐT hoặc mật khẩu"));
    }

    @PostMapping("/forgot-password")
    public String forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        return otpService.sendOtp(request.getEmail());
    }

    @PostMapping("/reset-password")
    public String resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        Otp otp = otpRepository
                .findTopByEmailOrderByCreatedAtDesc(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy OTP"));

        if (!otp.getVerified()) {
            throw new RuntimeException("OTP chưa xác thực");
        }

        User user = userService.findByEmail(request.getEmail());

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userService.save(user);
        otp.setVerified(false);
        otp.setUsed(true);
        otpRepository.save(otp);

        return "Đổi mật khẩu thành công";
    }

    @PostMapping("/lock-appeals")
    public LockAppeal createLockAppeal(@Valid @RequestBody LockAppealRequest request) {
        return lockAppealService.createAppeal(request);
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        return request.getRemoteAddr();
    }
}
