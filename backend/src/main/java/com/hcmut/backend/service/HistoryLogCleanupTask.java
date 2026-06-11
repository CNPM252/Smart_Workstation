package com.hcmut.backend.service;

import com.hcmut.backend.model.HistoryLog;
import com.hcmut.backend.repository.HistoryLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class HistoryLogCleanupTask {

    private final HistoryLogRepository historyLogRepository;

    // Clear history luc 2h sang
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanupOldLogs(){
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(14);

        System.out.println("Xóa logs trước ngày:" + cutoffDate);

        try{
            historyLogRepository.deleteOldLogs(cutoffDate);
            System.out.println("Đã xóa");
        } catch (Exception e){
            System.err.println("Lỗi khi xóa logs" + e.getMessage());
        }
    }
}
