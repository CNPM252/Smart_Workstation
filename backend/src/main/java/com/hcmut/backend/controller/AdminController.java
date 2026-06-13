package com.hcmut.backend.controller;

import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.RoomRepository;
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
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final EventLogRepository eventLogRepository;
    private final RoomRepository roomRepository;
    private final DeviceRepository  deviceRepository;

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

    @GetMapping("/dashboard")
    public ResponseEntity<?> getDashboardStats() {
        long totalUsers = userRepository.count();
        long totalRooms = roomRepository.count();
        long totalDevices = deviceRepository.count();
        long totalLogs = eventLogRepository.count();

        return ResponseEntity.ok(Map.of(
                "totalUsers", totalUsers,
                "totalRooms", totalRooms,
                "totalDevices", totalDevices,
                "totalLogs", totalLogs
        ));
    }


    @Data
    static class CreateUserRequest {
        private String username;
        private String password;
        private String inAppName;
        private String role;
    }
}