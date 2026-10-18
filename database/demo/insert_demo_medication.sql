-- Script idempotente para os passos 9 e 11 do roteiro do professor.
-- O UUID fixo impede duplicidade se o script for executado mais de uma vez.
INSERT INTO medication.medications
    (id, name, active_ingredient, pharmaceutical_form, concentration, unit, created_by, updated_by)
VALUES
    ('40000000-0000-4000-8000-000000000099', 'Soro fisiológico 0,9%', 'Cloreto de sódio', 'Solução intravenosa', '0,9%', 'mL',
     '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO UPDATE SET
    active = TRUE,
    version = medication.medications.version + 1,
    updated_at = now();

INSERT INTO sync.change_feed (entity_type, entity_id, entity_version, action, payload)
SELECT 'MEDICATION', m.id, m.version, 'UPSERT', jsonb_build_object(
    'id', m.id, 'name', m.name, 'activeIngredient', m.active_ingredient,
    'pharmaceuticalForm', m.pharmaceutical_form, 'concentration', m.concentration,
    'unit', m.unit, 'active', m.active, 'version', m.version,
    'createdAt', m.created_at, 'updatedAt', m.updated_at)
FROM medication.medications m
WHERE m.id='40000000-0000-4000-8000-000000000099'
  AND NOT EXISTS (
      SELECT 1 FROM sync.change_feed c
       WHERE c.entity_type='MEDICATION' AND c.entity_id=m.id AND c.entity_version=m.version
  );

