# EHR & prescripciones

Estado: **no implementado.**

Según el HLD (`hld-saas-salud-microservicios.excalidraw`), este servicio agrupa
historia clínica electrónica (EHR) y prescripciones/recetas.

Decisiones ya tomadas para cuando se implemente:

- Postgres propio, encriptado (separado del de `identity-patient`).
- Sin cache delante de este servicio — se prioriza consistencia fuerte sobre
  velocidad en datos clínicos sensibles.
- Integración prevista con HL7/FHIR para interoperabilidad clínica.
- Documentos livianos asociados (recetas en PDF) van en S3, guardando solo la
  key de S3 en Postgres — nunca metadata clínica dentro de S3.
