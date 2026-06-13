package com.hcmut.backend.controller;

import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.repository.EventLogRepository;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@PreAuthorize("hasRole('ROLE_ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EventLogRepository eventLogRepository;

    @GetMapping("/users")
    public ResponseEntity<?> getAllUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody CreateUserRequest request) {
        if (userRepository.findByUsername(request.getUsername()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Tên đăng nhập đã tồn tại!"));
        }

        User newUser = new User();
        newUser.setUsername(request.getUsername());
        newUser.setInAppName(request.getInAppName());

        if (request.getRole() != null && !request.getRole().isEmpty()) {
            newUser.setRole(request.getRole());
        }

        newUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        userRepository.save(newUser);

        return ResponseEntity.ok(Map.of(
                "message", "Tạo tài khoản thành công!",
                "userId", newUser.getId(),
                "username", newUser.getUsername()
        ));
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getSystemLogs() {
        return ResponseEntity.ok(eventLogRepository.findAllByOrderByCreatedAtDesc());
    }


    @Data
    static class CreateUserRequest {
        private String username;
        private String password;
        private String inAppName;
        private String role;
    }
}