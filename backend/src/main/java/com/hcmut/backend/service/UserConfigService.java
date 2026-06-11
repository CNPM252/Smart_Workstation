package com.hcmut.backend.service;

import com.hcmut.backend.model.User;
import com.hcmut.backend.model.UserConfig;
import com.hcmut.backend.repository.DeviceRepository;
import com.hcmut.backend.repository.UserConfigRepository;
import com.hcmut.backend.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.HashMap;
import java.util.Map;

@Service
public class UserConfigService {

    @Autowired
    private UserConfigRepository userConfigRepository;

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Autowired
    private RedisTemplate<String, Object>  redisTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    DeviceRepository deviceRepository;
    @Autowired
    private MqttService mqttService;

    public UserConfig getUserConfig(String username){
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy tài khoản!"));

        return userConfigRepository.findById(user.getId()).orElseGet(() -> {
            UserConfig newConfig = new UserConfig();

            newConfig.setUser(user);
            newConfig.setDistanceThresholdMin(40);
            newConfig.setDistanceThresholdMax(70);
            newConfig.setAutoDimEnabled(true);
            newConfig.setManualLightLevel(50);
            newConfig.setAutoSleepEnabled(true);
            newConfig.setSleepTimeoutMins(3);

            return newConfig;
        });
    }

    @Transactional
    public UserConfig updateUserConfig(String username, UserConfig configData) {
        UserConfig existingConfig = getUserConfig(username);

        if (configData.getDistanceThresholdMin() != null)
            existingConfig.setDistanceThresholdMin(configData.getDistanceThresholdMin());

        if (configData.getDistanceThresholdMax() != null)
            existingConfig.setDistanceThresholdMax(configData.getDistanceThresholdMax());

        if (configData.getAutoDimEnabled() != null)
            existingConfig.setAutoDimEnabled(configData.getAutoDimEnabled());

        if (configData.getManualLightLevel() != null)
            existingConfig.setManualLightLevel(configData.getManualLightLevel());

        if (configData.getAutoSleepEnabled() != null)
            existingConfig.setAutoSleepEnabled(configData.getAutoSleepEnabled());

        if (configData.getSleepTimeoutMins() != null)
            existingConfig.setSleepTimeoutMins(configData.getSleepTimeoutMins());

        UserConfig savedConfig = userConfigRepository.save(existingConfig);


        stringRedisTemplate.delete("user_config_cache:" + username);

        System.out.println("=== DEBUG MQTT ===");
        System.out.println("Đang tìm máy cho user: [" + username + "]");
        deviceRepository.findByCurrentUser(username).ifPresentOrElse(device -> {
            System.out.println(">> Đã tìm thấy user ngồi tại máy: " + device.getMacAddress());

            Map<String, Object> payload = new HashMap<>();
            payload.put("autoDimEnabled", savedConfig.getAutoDimEnabled());
            payload.put("manualLightLevel", savedConfig.getManualLightLevel());
            payload.put("autoSleepEnabled", savedConfig.getAutoSleepEnabled());
            payload.put("sleepTimeoutMins", savedConfig.getSleepTimeoutMins());
            payload.put("distanceThresholdMin", savedConfig.getDistanceThresholdMin());
            payload.put("distanceThresholdMax", savedConfig.getDistanceThresholdMax());

            mqttService.publishConfig(device.getMacAddress(), payload);
        }, () -> {
            System.err.println(">> LỖI: Không tìm thấy thiết bị nào đang có current_user_id = [" + username + "]");
        });
        System.out.println("==================");

        return savedConfig;
    }

    public UserConfig getGuestConfig(String guestId){
        Object cachedData = redisTemplate.opsForValue().get(guestId);
        if (cachedData != null){
            return (UserConfig) cachedData;
        }

        UserConfig defaultGuestWs = new UserConfig();

        defaultGuestWs.setDistanceThresholdMin(40);
        defaultGuestWs.setDistanceThresholdMax(70);
        defaultGuestWs.setAutoDimEnabled(true);
        defaultGuestWs.setManualLightLevel(50);
        defaultGuestWs.setAutoSleepEnabled(true);
        defaultGuestWs.setSleepTimeoutMins(3);

        return defaultGuestWs;
    }

    public UserConfig updateGuestConfig(String guestId, UserConfig configData) {
        redisTemplate.opsForValue().set(guestId, configData, 7, TimeUnit.DAYS);

        deviceRepository.findByCurrentUser(guestId).ifPresent(device -> {
            Map<String, Object> data = new HashMap<>();
            data.put("autoDimEnabled", configData.getAutoDimEnabled());
            data.put("manualLightLevel", configData.getManualLightLevel());
            data.put("autoSleepEnabled", configData.getAutoSleepEnabled());
            data.put("sleepTimeoutMins", configData.getSleepTimeoutMins());
            data.put("distanceThresholdMin", configData.getDistanceThresholdMin());
            data.put("distanceThresholdMax", configData.getDistanceThresholdMax());
        });
        System.out.println("==================");

        return configData;
    }

    @Transactional
    public void transferGuestConfigToUser(String guestId, String username){
        if (guestId == null || !guestId.startsWith("guest_")) return;


        Object cachedData = redisTemplate.opsForValue().get(guestId);
        if (cachedData != null){
            UserConfig guestWs = (UserConfig) cachedData;

            UserConfig userWs = getUserConfig(username);

            userWs.setDistanceThresholdMin(guestWs.getDistanceThresholdMin());
            userWs.setDistanceThresholdMax(guestWs.getDistanceThresholdMax());
            userWs.setAutoDimEnabled(guestWs.getAutoDimEnabled());
            userWs.setManualLightLevel(guestWs.getManualLightLevel());
            userWs.setAutoSleepEnabled(guestWs.getAutoSleepEnabled());
            userWs.setSleepTimeoutMins(guestWs.getSleepTimeoutMins());

            userConfigRepository.save(userWs);

            redisTemplate.delete(guestId);
            System.out.println(guestId + " thành" + username);
        }
    }
}
