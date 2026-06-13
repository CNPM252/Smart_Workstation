package com.hcmut.backend.model;

import jakarta.persistence.*;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.hibernate.annotations.CreationTimestamp;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;


@Data
@Entity
@Table(name = "event_logs")
@NoArgsConstructor
public class EventLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "device_mac_address", referencedColumnName = "device_mac_address")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Device device;

    @Column(name = "acted_by_user")
    private String actedByUser;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;



    
}
