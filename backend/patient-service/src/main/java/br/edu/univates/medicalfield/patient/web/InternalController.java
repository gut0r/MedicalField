package br.edu.univates.medicalfield.patient.web;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
public class InternalController {
    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "service", "patient-service");
    }
}

