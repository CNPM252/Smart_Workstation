package com.hcmut.backend.config;

import com.hcmut.backend.model.Device;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DatabaseSeeder implements CommandLineRunner {

    private final DeviceRepository deviceRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
            if (userRepository.findByUsername("admin").isEmpty()) {

                System.out.println("Tạo tài khoản Admin");

                User admin = new User();
                admin.setUsername("admin");
                admin.setPasswordHash(passwordEncoder.encode("admin123")); // Mã hóa mật khẩu
                admin.setRole("ROLE_ADMIN");
                admin.setInAppName("Quản Trị Viên");

                userRepository.save(admin);

                System.out.println("Đã tạo tài khoản Admin! (User: admin | Pass: admin123)");
            }
    }
}