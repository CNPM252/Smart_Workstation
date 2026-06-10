package com.hcmut.backend.repository;

import com.hcmut.backend.model.HistoryLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.time.LocalDateTime;

public interface HistoryLogRepository extends JpaRepository<HistoryLog, Long> {
    List<HistoryLog> findByCurrentUserIdOrderByRecordedAtDesc(String currentUserId);

    List<HistoryLog> findByDevice_MacAddressOrderByRecordedAtDesc(String macAddress);

    List<HistoryLog> findByCurrentUserIdAndRecordedAtBetween(String currentUserId, LocalDateTime start, LocalDateTime end);


    @Query("SELECT DISTINCT h.currentUserId FROM HistoryLog h WHERE h.recordedAt >= :start AND h.recordedAt <= :end")
    List<String> findActiveUsersInTimeRange(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query(value = "SELECT * FROM history_logs WHERE device_mac_address = :macAddress ORDER BY recorded_at DESC LIMIT :limit", nativeQuery = true)
    List<HistoryLog> findRecentLogsByDevice(@Param("macAddress") String macAddress, @Param("limit") int limit);

    @Modifying
    @Transactional
    @Query("DELETE FROM HistoryLog h WHERE h.recordedAt < :cutoffDate")
    void deleteOldLogs(@Param("cutoffDate") LocalDateTime cutoffDate);


    long countByCurrentUserIdAndRecordedAtBetween(String currentUserId, LocalDateTime start, LocalDateTime end);
}