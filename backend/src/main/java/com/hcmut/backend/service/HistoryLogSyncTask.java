package com.hcmut.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hcmut.backend.model.HistoryLog;
import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.repository.HistoryLogRepository;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.model.Device;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class HistoryLogSyncTask {

    private final StringRedisTemplate stringRedisTemplate;
    private final HistoryLogRepository historyLogRepository;
    private final DeviceRepository deviceRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UserRepository userRepository;

    // 15p sync 1 lan, test thi thanh 30000ms = 30s
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void syncLogsToDatabase() {
        String queueName = "history_log_queue";

        Long size = stringRedisTemplate.opsForList().size(queueName);
        if (size == null || size == 0) return;

        System.out.println("=== BẮT ĐẦU RÚT [" + size + "] LOG TỪ REDIS ĐỂ GOM CỤM ===");

        List<HistoryLog> rawLogs = new ArrayList<>();
        for (int i = 0; i < size; i++) {
            String jsonLog = stringRedisTemplate.opsForList().leftPop(queueName);
            if (jsonLog != null) {
                try {
                    JsonNode data = objectMapper.readTree(jsonLog);
                    HistoryLog log = new HistoryLog();

                    String macAddressStr = data.get("deviceMacAddress").asText();
                    Device deviceRef = deviceRepository.findById(macAddressStr).orElse(null);
                    if (deviceRef != null) log.setDevice(deviceRef);

                    // Lúc rút từ Redis ra, nó vẫn là "a123" hoặc "guest_123"
                    log.setCurrentUserId(data.get("currentUserId").asText());
                    log.setLightValue(data.get("lightValue").asInt());
                    log.setDistanceValue(data.get("distanceValue").asInt());

                    long timestamp = data.get("recordedAt").asLong();
                    LocalDateTime recordedTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
                    log.setRecordedAt(recordedTime);

                    rawLogs.add(log);
                } catch (Exception e) {
                    System.err.println("Lỗi parse log: " + e.getMessage());
                }
            }
        }

        // 2. GOM CỤM THEO MAC + USER + PHÚT
        Map<String, List<HistoryLog>> groupedLogs = rawLogs.stream().collect(
                Collectors.groupingBy(log -> {
                    String mac = log.getDevice() != null ? log.getDevice().getMacAddress() : "UNKNOWN";
                    String user = log.getCurrentUserId();
                    LocalDateTime minuteBucket = log.getRecordedAt().truncatedTo(ChronoUnit.MINUTES);
                    return mac + "_" + user + "_" + minuteBucket.toString();
                })
        );

        // 3. TÍNH TRUNG BÌNH & DỊCH UUID
        List<HistoryLog> batchToSave = new ArrayList<>();

        for (Map.Entry<String, List<HistoryLog>> entry : groupedLogs.entrySet()) {
            List<HistoryLog> logsInMinute = entry.getValue();

            int avgDistance = (int) logsInMinute.stream().mapToInt(HistoryLog::getDistanceValue).average().orElse(0);
            int avgLight = (int) logsInMinute.stream().mapToInt(HistoryLog::getLightValue).average().orElse(0);

            HistoryLog firstLog = logsInMinute.get(0);
            String rawUserId = firstLog.getCurrentUserId();
            String finalDbUserId = rawUserId; // Mặc định giữ nguyên nếu không tìm thấy

            if (rawUserId != null) {
                if (rawUserId.startsWith("guest_")) {
                    finalDbUserId = UUID.nameUUIDFromBytes(rawUserId.getBytes()).toString();
                } else if (!rawUserId.contains("-")) {
                    // Nếu không có dấu "-" (tức là username, không phải UUID text)
                    User user = userRepository.findByUsername(rawUserId).orElse(null);
                    if (user != null) {
                        finalDbUserId = user.getId().toString();
                    } else {
                        finalDbUserId = UUID.nameUUIDFromBytes(rawUserId.getBytes()).toString();
                    }
                }
            }

            HistoryLog aggregatedLog = new HistoryLog();
            aggregatedLog.setDevice(firstLog.getDevice());

            // Gán chuỗi UUID chuẩn đã dịch vào Entity
            aggregatedLog.setCurrentUserId(finalDbUserId);

            aggregatedLog.setDistanceValue(avgDistance);
            aggregatedLog.setLightValue(avgLight);
            aggregatedLog.setRecordedAt(firstLog.getRecordedAt().truncatedTo(ChronoUnit.MINUTES));

            batchToSave.add(aggregatedLog);
        }

        // 4. LƯU XUỐNG DB
        if (!batchToSave.isEmpty()) {
            try {
                historyLogRepository.saveAllAndFlush(batchToSave);
                System.out.println(">> Đã nén thành " + batchToSave.size() + " log phút và dịch UUID thành công!");
            } catch (Exception e) {
                System.err.println("❌ LỖI LƯU DB:");
                e.printStackTrace();
            }
        }
    }



}