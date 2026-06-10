package com.hcmut.backend.service;

import com.hcmut.backend.model.DailySummary;
import com.hcmut.backend.model.HistoryLog;
import com.hcmut.backend.repository.DailySummaryRepository;
import com.hcmut.backend.repository.HistoryLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DailySummaryTask {

    private final HistoryLogRepository historyLogRepository;
    private final DailySummaryRepository dailySummaryRepository;

    // Chạy vào lúc 00:00 sáng mỗi ngày (Giờ hệ thống)
    // Cấu trúc Cron: Giây - Phút - Giờ - Ngày - Tháng - Thứ
//    @Scheduled(cron = "0 0 0 * * ?")
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void generateDailySummaries() {
        System.out.println("=== BẮT ĐẦU CHẠY BATCH JOB TỔNG HỢP DỮ LIỆU NGÀY HÔM QUA ===");

        // 1. Xác định khoảng thời gian của "Ngày hôm qua"
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDateTime startOfDay = yesterday.atStartOfDay();             // 00:00:00
        LocalDateTime endOfDay = yesterday.atTime(LocalTime.MAX);        // 23:59:59

        // 2. Tìm danh sách những ai đã sử dụng máy trong ngày hôm qua
        List<String> activeUsers = historyLogRepository.findActiveUsersInTimeRange(startOfDay, endOfDay);

        if (activeUsers == null || activeUsers.isEmpty()) {
            System.out.println(">> Hôm qua không ai dùng hệ thống");
            return;
        }

        // 3. Xử lý dữ liệu cho từng User
        for (String userId : activeUsers) {
            // Bỏ qua nếu là tài khoản khách (Guest) vì ta không cần vẽ Heatmap cho khách
            if (userId != null && userId.startsWith("guest_")) {
                continue;
            }

            // Lấy toàn bộ log của user này trong ngày hôm qua
            List<HistoryLog> logs = historyLogRepository.findByCurrentUserIdAndRecordedAtBetween(userId, startOfDay, endOfDay);

            if (logs.isEmpty()) continue;

            // --- BẮT ĐẦU TÍNH TOÁN CÁC CHỈ SỐ ---
            int totalMinutes = logs.size(); // Mỗi log = 1 phút
            int goodPostureMinutes = 0;
            long sumDistance = 0;
            long sumLight = 0;

            // Ngưỡng tư thế chuẩn (Tạm fix cứng 40-70cm. Sau này có thể Query từ UserConfig lên)
            int minDist = 40;
            int maxDist = 70;

            for (HistoryLog log : logs) {
                sumDistance += log.getDistanceValue();
                sumLight += log.getLightValue();

                // Đếm số phút ngồi đúng tư thế
                if (log.getDistanceValue() >= minDist && log.getDistanceValue() <= maxDist) {
                    goodPostureMinutes++;
                }
            }

            // --- LƯU VÀO DATABASE (COLD DATA) ---
            // Tìm xem đã có bản ghi của ngày hôm qua chưa (tránh tạo trùng nếu lỡ chạy Job 2 lần)
            DailySummary summary = dailySummaryRepository.findByUserIdAndSummaryDate(userId, yesterday)
                    .orElse(new DailySummary());

            summary.setUserId(userId);
            summary.setSummaryDate(yesterday);
            summary.setTotalMinutesSeated(totalMinutes);
            summary.setTotalMinutesGoodPosture(goodPostureMinutes);

            // Tính trung bình (Ép kiểu về int)
            summary.setAverageDistance((int) (sumDistance / totalMinutes));
            summary.setAverageLight((int) (sumLight / totalMinutes));

            dailySummaryRepository.save(summary);
            System.out.println(">> Đã tổng hợp dữ liệu thành công cho User: " + userId + " | Tổng thời gian: " + totalMinutes + " phút");
        }

        System.out.println("=== KẾT THÚC BATCH JOB ===");
    }
}
