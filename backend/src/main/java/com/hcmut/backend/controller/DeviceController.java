package com.hcmut.backend.controller;

import com.hcmut.backend.dto.TelemetryRequest;
import com.hcmut.backend.dto.DeviceJoinRequest;
import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.User;
import com.hcmut.backend.repository.UserRepository;
import com.hcmut.backend.service.DeviceService;
import com.hcmut.backend.model.UserConfig;
import com.hcmut.backend.repository.UserConfigRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.concurrent.TimeUnit;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/devices")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class DeviceController {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    private final DeviceService deviceService;

    private final UserRepository userRepository;
    private final UserConfigRepository userConfigRepository;

    @PostMapping("/{macAddress}/check-in")
    public ResponseEntity<?> checkIn(@PathVariable String macAddress, @RequestParam String userId) {
        try {
            deviceService.checkIn(macAddress, userId);
            return ResponseEntity.ok("Check-in thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{macAddress}/check-out")
    public ResponseEntity<?> checkOut(@PathVariable String macAddress) {
        try {
            deviceService.checkOut(macAddress);
            return ResponseEntity.ok("Check-out thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }


    /// /////////////////////////////////
    /// Gắn máy và x,y vào room
    /// ////////////////////////////////


    @GetMapping("/room/{roomId}")
    public ResponseEntity<?> getDevicesByRoom(@PathVariable java.util.UUID roomId) {
        return ResponseEntity.ok(deviceService.getDevicesByRoom(roomId));
    }

    @PostMapping("/auto-join")
    public ResponseEntity<?> autoJoin(@RequestBody DeviceJoinRequest request) {
        try {
            Device savedDevice = deviceService.autoJoinRoom(request);
            return ResponseEntity.ok("Thiết bị " + savedDevice.getMacAddress() + " đã vào phòng thành công!");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/manual-join")
    public ResponseEntity<?> manualJoin(@RequestBody DeviceJoinRequest request) {
        try {
            Device savedDevice = deviceService.manuallyAssignRoom(request);
            return ResponseEntity.ok(savedDevice);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{macAddress}/position")
    public ResponseEntity<?> updatePosition(@PathVariable String macAddress, @RequestBody Map<String, Integer> position) {
        try {
            Device updated = deviceService.updatePosition(macAddress, position.get("x"), position.get("y"));
            return ResponseEntity.ok(updated);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /// /////////////////////////////////
    /// ingest data tu react
    /// ////////////////////////////////


    @PostMapping("/telemetry")
    public ResponseEntity<?> receiveTelemetry(@RequestBody TelemetryRequest request) {
        try {
            String finalUserId = request.getCurrentUserId();
            String macAddress = request.getMacAddress();
            long now = System.currentTimeMillis();

            // 1.1 GHI VÀO REDIS QUEUE CHO CRON JOB
            ObjectNode logNode = objectMapper.createObjectNode();
            logNode.put("deviceMacAddress", macAddress);
            logNode.put("currentUserId", finalUserId);
            logNode.put("lightValue", request.getLight());
            logNode.put("distanceValue", request.getDistance());
            // LƯU Ý: Nếu entity HistoryLog có cột motion, nên lưu thêm vào đây để phục vụ thống kê chính xác hơn
            // logNode.put("motionValue", request.getMotion());
            logNode.put("recordedAt", now);
            stringRedisTemplate.opsForList().rightPush("history_log_queue", objectMapper.writeValueAsString(logNode));

            // 1.2 KHỞI TẠO GIÁ TRỊ MẶC ĐỊNH
            boolean autoDimActive = true;
            int manualBrightness = 100;
            boolean commandSleep = false;

            // 1.3 TRUY XUẤT CẤU HÌNH & XỬ LÝ LOGIC NGỦ ĐÔNG
            if (finalUserId != null && !finalUserId.startsWith("guest_")) {
                try {
                    int distMin = 40;
                    int distMax = 70;
                    long timeoutMins = 3;

                    // BƯỚC 1: TÌM TRONG REDIS TRƯỚC
                    String configCacheKey = "user_config_cache:" + finalUserId;
                    String cachedConfigStr = stringRedisTemplate.opsForValue().get(configCacheKey);

                    if (cachedConfigStr != null) {
                        JsonNode cacheNode = objectMapper.readTree(cachedConfigStr);
                        autoDimActive = cacheNode.get("autoDimEnabled").asBoolean();
                        manualBrightness = cacheNode.get("manualLightLevel").asInt();
                        distMin = cacheNode.get("distanceThresholdMin").asInt();
                        distMax = cacheNode.get("distanceThresholdMax").asInt();
                        timeoutMins = cacheNode.get("sleepTimeoutMins").asLong();
                    } else {
                        UUID userUuid = null;
                        if (finalUserId.contains("-") && finalUserId.length() == 36) {
                            userUuid = UUID.fromString(finalUserId);
                        } else {
                            User user = userRepository.findByUsername(finalUserId).orElse(null);
                            if (user != null) userUuid = user.getId();
                        }

                        if (userUuid != null) {
                            UserConfig config = userConfigRepository.findByUserId(userUuid).orElse(null);
                            if (config != null) {
                                autoDimActive = config.getAutoDimEnabled();
                                manualBrightness = config.getManualLightLevel();
                                distMin = config.getDistanceThresholdMin();
                                distMax = config.getDistanceThresholdMax();
                                timeoutMins = config.getSleepTimeoutMins();

                                ObjectNode cacheNode = objectMapper.createObjectNode();
                                cacheNode.put("autoDimEnabled", autoDimActive);
                                cacheNode.put("manualLightLevel", manualBrightness);
                                cacheNode.put("distanceThresholdMin", distMin);
                                cacheNode.put("distanceThresholdMax", distMax);
                                cacheNode.put("sleepTimeoutMins", timeoutMins);

                                stringRedisTemplate.opsForValue().set(configCacheKey, objectMapper.writeValueAsString(cacheNode), 1, TimeUnit.DAYS);
                            }
                        }
                    }

                    // BƯỚC 2: COMPOSITION FILTER V2 (Cửa sổ xác minh 30s)
                    String lastActiveKey = "last_active:" + macAddress;
                    String suspicionKey = "suspicion_start:" + macAddress;

                    boolean hasMotion = Boolean.TRUE.equals(request.getMotion());
                    int currentDist = request.getDistance();

                    // Biên độ mở rộng (Tolerance)
                    int lowerBound = (int) (distMin * 0.8);
                    int upperBound = (int) (distMax * 1.2);

                    boolean isImmediatelyPresent = hasMotion || (currentDist >= lowerBound && currentDist <= upperBound);
                    boolean isPresent = false;

                    if (isImmediatelyPresent) {
                        stringRedisTemplate.delete(suspicionKey);
                        isPresent = true;
                    } else {
                        String suspicionTimeStr = stringRedisTemplate.opsForValue().get(suspicionKey);
                        if (suspicionTimeStr == null) {
                            stringRedisTemplate.opsForValue().set(suspicionKey, String.valueOf(now));
                            isPresent = true; // Bắt đầu 30s ân hạn
                        } else {
                            long suspicionTime = Long.parseLong(suspicionTimeStr);
                            long timeInSuspicion = now - suspicionTime;

                            if (timeInSuspicion >= 30 * 1000L) {
                                isPresent = false; // Đã quá 30s -> Chính thức xác nhận Vắng mặt
                            } else {
                                isPresent = true; // Vẫn đang trong 30s ân hạn
                            }
                        }
                    }

                    // BƯỚC 3: XỬ LÝ TIME-OUT NGỦ ĐÔNG
                    if (isPresent) {
                        stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                        commandSleep = false;
                    } else {
                        String lastActiveStr = stringRedisTemplate.opsForValue().get(lastActiveKey);
                        if (lastActiveStr != null) {
                            long lastActiveTime = Long.parseLong(lastActiveStr);
                            long timeAwayMillis = now - lastActiveTime;
                            long timeoutMillisLimit = timeoutMins * 60L * 1000L;

                            if (timeAwayMillis > 24 * 60 * 60 * 1000L) {
                                stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                                commandSleep = false;
                            } else if (timeAwayMillis > timeoutMillisLimit) {
                                commandSleep = true;
                            }
                        } else {
                            stringRedisTemplate.opsForValue().set(lastActiveKey, String.valueOf(now));
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Lỗi xử lý Telemetry Cache: " + e.getMessage());
                }
            }

            // ĐÓNG GÓI LỆNH TRẢ VỀ FRONTEND
            Map<String, Object> commandResponse = new HashMap<>();
            commandResponse.put("action", commandSleep ? "SLEEP" : "AWAKE");
            commandResponse.put("autoDim", autoDimActive);
            commandResponse.put("manualBrightness", manualBrightness);

            return ResponseEntity.ok(commandResponse);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Lỗi xử lý Telemetry: " + e.getMessage());
        }
    }


}