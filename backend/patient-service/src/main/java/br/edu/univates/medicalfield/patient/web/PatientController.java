package br.edu.univates.medicalfield.patient.web;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import br.edu.univates.medicalfield.patient.model.Patient;
import br.edu.univates.medicalfield.patient.model.PatientRequest;
import br.edu.univates.medicalfield.patient.security.CurrentProfessional;
import br.edu.univates.medicalfield.patient.service.PatientService;

@RestController
@RequestMapping("/patients")
public class PatientController {
    private final PatientService service;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @GetMapping
    public List<Patient> search(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "false") boolean includeInactive,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return service.search(search, includeInactive, Math.max(0, page), Math.clamp(size, 1, 200));
    }

    @GetMapping("/{id}")
    public Patient get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Patient create(@Valid @RequestBody PatientRequest request, Authentication authentication) {
        return service.create(request, CurrentProfessional.id(authentication));
    }

    @PutMapping("/{id}")
    public Patient update(@PathVariable UUID id, @Valid @RequestBody PatientRequest request,
                          Authentication authentication) {
        return service.update(id, request, CurrentProfessional.id(authentication));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('ADMIN')")
    public void inactivate(@PathVariable UUID id, Authentication authentication) {
        service.inactivate(id, CurrentProfessional.id(authentication));
    }
}

