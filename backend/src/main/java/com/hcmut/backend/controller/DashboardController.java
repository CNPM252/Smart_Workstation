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

    @GetMapping("/heatmap")
    public ResponseEntity<?> getHeatmapData(
            @RequestParam String userId,
            @RequestParam(required = false) Integer year){

        if (userId.startsWith("guest_")) {
            return ResponseEntity.ok(List.of());
        }
        User user = userRepository.findByUsername(userId)
            .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        int targetYear = (year != null)? year : LocalDate.now().getYear();
        LocalDate startDate = LocalDate.of(targetYear, 1, 1);
        LocalDate endDate = LocalDate.of(targetYear, 12, 31);

        List<DailySummary> summaries = dailySummaryRepository.findByUserIdAndSummaryDateBetweenOrderBySummaryDateAsc(user.getId().toString(), startDate, endDate);

        List<Map<String, Object>> heatmapResponse = summaries.stream().map(summary -> {
            Map<String, Object> map = new java.util.HashMap<>();
            map.put("date", summary.getSummaryDate().toString());
            map.put("minutes", summary.getTotalMinutesSeated());
            map.put("level", summary.getHeatmapLevel());
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(heatmapResponse);
    }

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

        // Lấy ngưỡng từ config, nếu không có thì dùng mặc định (40-70cm)
        int minDist = (config != null) ? config.getDistanceThresholdMin() : 40;
        int maxDist = (config != null) ? config.getDistanceThresholdMax() : 70;

        for (HistoryLog log : logs) {
            int dist = log.getDistanceValue();
            sumDistance += dist;

            if (dist >= minDist && dist <= maxDist) {
                goodPostureCount++;
            }

            //  Sleep được tính khi khoảng cách trả về 0 hoặc 200
            if (dist == 0) {
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
        LocalDate today = LocalDate.now();
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));

        // 1. Lấy dữ liệu từ DB
        List<DailySummary> realData = dailySummaryRepository.findByUserIdAndSummaryDateBetweenOrderBySummaryDateAsc(
                user.getId().toString(), monday, monday.plusDays(6));

        // 2. Chuyển sang Map để tra cứu
        Map<LocalDate, DailySummary> dataMap = realData.stream()
                .collect(Collectors.toMap(DailySummary::getSummaryDate, s -> s));

        // 3. Mảng tên các ngày tiếng Việt để ánh xạ
        String[] vietnameseDays = {"T2", "T3", "T4", "T5", "T6", "T7", "CN"};

        // 4. Tạo danh sách đúng cấu trúc FE: { day: '...', hours: ... }
        List<Map<String, Object>> chartResponse = new java.util.ArrayList<>();
        
        for (int i = 0; i < 7; i++) {
            LocalDate currentDate = monday.plusDays(i);
            Map<String, Object> item = new java.util.HashMap<>();
            
            item.put("day", vietnameseDays[i]); // Gán T2, T3...

            if (dataMap.containsKey(currentDate)) {
                int minutes = dataMap.get(currentDate).getTotalMinutesSeated();
                // Chuyển phút sang giờ, làm tròn 1 chữ số thập phân
                double hours = Math.round((minutes / 60.0) * 10.0) / 10.0;
                item.put("hours", hours);
            } else {
                item.put("hours", 0);
            }
            
            chartResponse.add(item);
        }

        return ResponseEntity.ok(chartResponse);
    }

}
