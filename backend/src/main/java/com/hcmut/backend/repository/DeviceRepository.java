package com.hcmut.backend.repository;

import com.hcmut.backend.model.Device;
import com.hcmut.backend.model.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

public interface DeviceRepository extends JpaRepository<Device, String> {
    Optional<Device> findByCurrentUser(String currentUser);

    List<Device> findByRoom_Id(UUID roomId);

    @Modifying
    @Transactional
    @Query(value = "UPDATE devices " +
            "SET is_active = false, current_user_id = null " +
            "FROM user_configs " +
            "WHERE devices.current_user_id = user_configs.user_id::varchar " +
            "AND devices.is_active = true " +
            "AND NOT EXISTS (" +
            "    SELECT 1 FROM history_logs " +
            "    WHERE history_logs.current_user_id = devices.current_user_id " +
            "    AND history_logs.recorded_at >= NOW() " +
            "        - INTERVAL '15 minutes' " +  // Thời gian trễ xả đệm của Redis
            "        - INTERVAL '30 minutes' " +  // Ngưỡng thời gian tối đa cho phép Sleep máy
            "        - (user_configs.sleep_timeout_mins || ' minutes')::INTERVAL" + // Thời gian chờ vô trạng thái sleep
            ")", nativeQuery = true)
    int logoutGhostSessions();
}
