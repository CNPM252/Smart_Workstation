package com.hcmut.backend.repository;

import com.hcmut.backend.model.EventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

public interface EventLogRepository extends JpaRepository<EventLog, Long> {
    List<EventLog> findAllByOrderByCreatedAtDesc();

    List<EventLog> findByActedByUserOrderByCreatedAtDesc(String username);

    List<EventLog> findByDevice_MacAddressOrderByCreatedAtDesc(String macAddress);

    List<EventLog> findByActedByUserAndDevice_MacAddress(String username, String macAddress);
}