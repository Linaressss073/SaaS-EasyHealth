# Billing / claims

Estado: **no implementado.**

Según el HLD (`hld-saas-salud-microservicios.excalidraw`), este servicio se
mantiene separado del resto por su ciclo de vida y requisitos de compliance
propios (facturación, reclamos a seguros).

Decisiones ya tomadas para cuando se implemente:

- Postgres propio (separado del de `identity-patient` y `ehr-prescriptions`).
- Sin cache delante de este servicio — se prioriza consistencia fuerte sobre
  velocidad en datos sensibles/regulados.
- Integraciones previstas: clearinghouse de seguros, pasarela de pago.
- Comprobantes/documentos livianos van en S3, guardando solo la key de S3 en
  Postgres.
