package com.hcmut.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hcmut.backend.model.HistoryLog;
import com.hcmut.backend.repository.HistoryLogRepository;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.model.Device;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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

    // 15p sync 1 lan, test thi thanh 30000ms = 30s
    @Scheduled(fixedRate = 30000)
    @Transactional
    public void syncLogsToDatabase() {
        String queueName = "history_log_queue";

        // Lấy kích thước hiện tại của hàng đợi
        Long size = stringRedisTemplate.opsForList().size(queueName);

        if (size == null || size == 0) {
            return;
        }

        System.out.println("=== BẮT ĐẦU ĐỒNG BỘ BATCH [" + size + "] LOG TỪ REDIS XUỐNG POSTGRES ===");
        List<HistoryLog> batchToSave = new ArrayList<>();

        for (int i = 0; i < size; i++) {
            String jsonLog = stringRedisTemplate.opsForList().leftPop(queueName);

            if (jsonLog != null) {
                try {
                    JsonNode data = objectMapper.readTree(jsonLog);
                    HistoryLog log = new HistoryLog();

                    String macAddressStr = data.get("deviceMacAddress").asText();

                    Device deviceRef = deviceRepository.findById(macAddressStr).orElse(null);

                    if (deviceRef != null) {
                        log.setDevice(deviceRef);
                    }

                    log.setCurrentUserId(data.get("currentUserId").asText());
                    log.setLightValue(data.get("lightValue").asInt());
                    log.setDistanceValue(data.get("distanceValue").asInt());

                    long timestamp = data.get("recordedAt").asLong();
                    LocalDateTime recordedTime = LocalDateTime.ofInstant(Instant.ofEpochMilli(timestamp), ZoneId.systemDefault());
                    log.setRecordedAt(recordedTime);

                    batchToSave.add(log);
                } catch (Exception e) {
                    System.err.println("Lỗi khi parse log từ Redis: " + e.getMessage());
                }
            }
        }

        // Lưu toàn bộ mảng vào DB
        if (!batchToSave.isEmpty()) {
            try {
                historyLogRepository.saveAllAndFlush(batchToSave);
                System.out.println(">> Đã saveAllAndFlush() thành công " + batchToSave.size() + " bản ghi vào DB!");
            } catch (Exception e) {
                // Nếu có lỗi constraint (Khóa ngoại, Null...), nó sẽ văng thẳng vào đây
                System.err.println(">> LỖI NGHIÊM TRỌNG KHI GHI XUỐNG POSTGRES:");
                e.printStackTrace();
            }
        }
    }
}