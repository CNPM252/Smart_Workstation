package com.hcmut.backend.controller;

import com.hcmut.backend.model.User;
import com.hcmut.backend.model.DailySummary;
import com.hcmut.backend.repository.DailySummaryRepository;
import com.hcmut.backend.repository.HistoryLogRepository;
import com.hcmut.backend.repository.UserConfigRepository;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.model.UserConfig;
import com.hcmut.backend.model.HistoryLog;

import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DashboardController {

    private final DailySummaryRepository dailySummaryRepository;
    private final UserConfigRepository userConfigRepository;
    private final HistoryLogRepository historyLogRepository;
    private final UserRepository userRepository;


    @GetMapping("/today")
    public ResponseEntity<?> getTodayStats(@RequestParam String userId) {
        User user = userRepository.findByUsername(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));
        LocalDateTime startOfDay = LocalDate.now().atStartOfDay();
        LocalDateTime now = LocalDateTime.now();

        List<HistoryLog> logs = historyLogRepository.findByCurrentUserIdAndRecordedAtBetween(user.getId().toString(), startOfDay, now);

        UserConfig config = null;

        if (!userId.startsWith("guest_")) {
            try {
                UUID userUuid = UUID.fromString(userId);
                config = userConfigRepository.findByUserId(userUuid).orElse(null);
            } catch (IllegalArgumentException e) {
            }
        }

        if (logs.isEmpty()) {
            return ResponseEntity.ok(Map.of("message", "Chưa có dữ liệu cho ngày hôm nay"));
        }

        int totalMinutes = logs.size();
        double sittingHours = totalMinutes / 60.0;

        long sumDistance = 0;
        int goodPostureCount = 0;
        int sleepLogCount = 0;

        int minDist = (config != null) ? config.getDistanceThresholdMin() : 40;
        int maxDist = (config != null) ? config.getDistanceThresholdMax() : 70;

        // Cập nhật khoảng cách biên độ cho phép giống với luồng Telemetry
        int lowerBound = (int) (minDist * 0.8);
        int upperBound = (int) (maxDist * 1.2);

        for (HistoryLog log : logs) {
            int dist = log.getDistanceValue();
            sumDistance += dist;

            // Đánh giá tư thế chuẩn (Strict Min-Max)
            if (dist >= minDist && dist <= maxDist) {
                goodPostureCount++;
            }

            // Đánh giá trạng thái Vắng mặt / Sleep (Dựa trên Tolerance Boundaries)
            // Lịch sử sẽ ghi nhận là "sleep/away" nếu khoảng cách rơi ra ngoài ngưỡng cho phép
            if (dist < lowerBound || dist > upperBound) {
                sleepLogCount++;
            }
        }

        Map<String, Object> stats = new HashMap<>();
        stats.put("sittingHours", Math.round(sittingHours * 10.0) / 10.0);
        stats.put("posturePercent", (int) ((goodPostureCount * 100.0) / totalMinutes));
        stats.put("averageDistance", (int) (sumDistance / totalMinutes));
        stats.put("sleepHours", Math.round((sleepLogCount / 60.0) * 10) / 10.0);
        stats.put("totalMinutes", totalMinutes);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/weekly-chart")
    public ResponseEntity<?> getWeeklyChartData(@RequestParam String userId) {
        User user = userRepository.findByUsername(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        String dbUserId = user.getId().toString();
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        List<DailySummary> realData = dailySummaryRepository.findByUserIdAndSummaryDateBetweenOrderBySummaryDateAsc(
                dbUserId, monday, monday.plusDays(6));

        Map<LocalDate, DailySummary> dataMap = realData.stream()
                .collect(Collectors.toMap(DailySummary::getSummaryDate, s -> s));

        String[] vietnameseDays = {"T2", "T3", "T4", "T5", "T6", "T7", "CN"};
        List<Map<String, Object>> chartResponse = new java.util.ArrayList<>();

        for (int i = 0; i < 7; i++) {
            LocalDate currentDate = monday.plusDays(i);
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("day", vietnameseDays[i]);

            // 🚀 VÁ DỮ LIỆU REAL-TIME CHO HÔM NAY
            if (currentDate.isEqual(today)) {
                long minutesToday = historyLogRepository.countByCurrentUserIdAndRecordedAtBetween(
                        dbUserId, today.atStartOfDay(), today.atTime(23, 59, 59));
                double hours = Math.round((minutesToday / 60.0) * 10.0) / 10.0;
                item.put("hours", hours);
            }
            // Dữ liệu quá khứ lấy từ bảng tổng hợp
            else if (dataMap.containsKey(currentDate)) {
                int minutes = dataMap.get(currentDate).getTotalMinutesSeated();
                double hours = Math.round((minutes / 60.0) * 10.0) / 10.0;
                item.put("hours", hours);
            } else {
                item.put("hours", 0);
            }

            chartResponse.add(item);
        }

        return ResponseEntity.ok(chartResponse);
    }


    @GetMapping("/monthly-chart")
    public ResponseEntity<?> getMonthlyChartData(@RequestParam String userId) {
        User user = userRepository.findByUsername(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        String dbUserId = user.getId().toString();
        LocalDate today = LocalDate.now();
        LocalDate firstDayOfMonth = today.withDayOfMonth(1);
        int lengthOfMonth = today.lengthOfMonth();

        List<DailySummary> realData = dailySummaryRepository.findByUserIdAndSummaryDateBetweenOrderBySummaryDateAsc(
                dbUserId, firstDayOfMonth, firstDayOfMonth.plusDays(lengthOfMonth - 1));

        Map<LocalDate, DailySummary> dataMap = realData.stream()
                .collect(Collectors.toMap(DailySummary::getSummaryDate, s -> s));

        List<Map<String, Object>> chartResponse = new java.util.ArrayList<>();
        java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter.ofPattern("dd/MM");

        for (int i = 0; i < lengthOfMonth; i++) {
            LocalDate currentDate = firstDayOfMonth.plusDays(i);
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("day", currentDate.format(formatter));

            // 🚀 VÁ DỮ LIỆU REAL-TIME CHO HÔM NAY
            if (currentDate.isEqual(today)) {
                long minutesToday = historyLogRepository.countByCurrentUserIdAndRecordedAtBetween(
                        dbUserId, today.atStartOfDay(), today.atTime(23, 59, 59));
                double hours = Math.round((minutesToday / 60.0) * 10.0) / 10.0;
                item.put("hours", hours);
            }
            // Dữ liệu quá khứ
            else if (dataMap.containsKey(currentDate)) {
                int minutes = dataMap.get(currentDate).getTotalMinutesSeated();
                double hours = Math.round((minutes / 60.0) * 10.0) / 10.0;
                item.put("hours", hours);
            } else {
                item.put("hours", 0);
            }

            chartResponse.add(item);
        }

        return ResponseEntity.ok(chartResponse);
    }


    @GetMapping("/heatmap")
    public ResponseEntity<?> getHeatmapData(
            @RequestParam String userId,
            @RequestParam(required = false) Integer year){

        if (userId.startsWith("guest_")) {
            return ResponseEntity.ok(List.of());
        }
        User user = userRepository.findByUsername(userId)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        String dbUserId = user.getId().toString();
        LocalDate today = LocalDate.now();
        int targetYear = (year != null)? year : today.getYear();
        LocalDate startDate = LocalDate.of(targetYear, 1, 1);
        LocalDate endDate = LocalDate.of(targetYear, 12, 31);

        List<DailySummary> summaries = dailySummaryRepository.findByUserIdAndSummaryDateBetweenOrderBySummaryDateAsc(
                dbUserId, startDate, endDate);

        List<Map<String, Object>> heatmapResponse = summaries.stream().map(summary -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("date", summary.getSummaryDate().toString());
            map.put("minutes", summary.getTotalMinutesSeated());
            map.put("level", summary.getHeatmapLevel());
            return map;
        }).collect(Collectors.toList());

        // 🚀 VÁ DỮ LIỆU REAL-TIME CHO HEATMAP (Chỉ vá nếu năm truy vấn là năm hiện tại)
        if (targetYear == today.getYear()) {
            long minutesToday = historyLogRepository.countByCurrentUserIdAndRecordedAtBetween(
                    dbUserId, today.atStartOfDay(), today.atTime(23, 59, 59));

            if (minutesToday > 0) {
                // Thuật toán gán màu Level Heatmap (Mô phỏng lại logic của Entity DailySummary)
                int level = 0;
                if (minutesToday > 0 && minutesToday <= 60) level = 1;         // Dưới 1 tiếng
                else if (minutesToday > 60 && minutesToday <= 180) level = 2;  // 1 - 3 tiếng
                else if (minutesToday > 180 && minutesToday <= 300) level = 3; // 3 - 5 tiếng
                else if (minutesToday > 300) level = 4;                        // Trên 5 tiếng

                // Quét xem trong mảng trả về có record của hôm nay chưa (nếu CronJob lỡ chạy rồi), có thì xóa đi để ghi đè
                heatmapResponse.removeIf(item -> item.get("date").equals(today.toString()));

                Map<String, Object> todayData = new java.util.HashMap<>();
                todayData.put("date", today.toString());
                todayData.put("minutes", minutesToday);
                todayData.put("level", level);

                heatmapResponse.add(todayData);
            }
        }

        return ResponseEntity.ok(heatmapResponse);
    }



}
