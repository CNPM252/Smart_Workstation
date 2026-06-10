package com.hcmut.backend.task;

import com.hcmut.backend.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class SessionCleanupTask {

    private final DeviceRepository deviceRepository;

    @Scheduled(fixedRate = 300000)
    public void executePassiveCleanup() {
        log.info("[Cron Job] Đang tiến hành quét dọn các phiên làm việc ma (Ghost Sessions)...");

        int terminatedSessions = deviceRepository.logoutGhostSessions();

        if (terminatedSessions > 0) {
            log.info("[Cron Job] Phát hiện bất thường! Đã tự động thu hồi và giải phóng {} thiết bị mất kết nối đột ngột.", terminatedSessions);
        }
    }
}