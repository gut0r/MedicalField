package br.edu.univates.medicalfield.sync.strategy;

public record ConflictDecision(String strategy, boolean requiresManualReview, String explanation) {}

