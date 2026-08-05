# Datos de prueba — agosto 2026

> **Borrar el 2026-08-19.** Después de esa fecha este set no debería seguir en la base.
> Se borra con `npx tsx scripts/limpiar-datos-de-prueba.ts --aplicar` (sin `--aplicar` solo lista).

Generado el 2026-08-05 por `scripts/seed-datos-de-prueba.ts`.

## Cómo reconocerlos

- El nombre empieza con **`[prueba]`** — se ve en cualquier listado sin abrir nada.
- `external_id` con prefijo **`PRUEBA-`** — es la llave del borrado.
- Los correos son **@prueba.theosplace.invalid**: el TLD `.invalid` está reservado (RFC 2606) y no
  resuelve, así que un comunicado mandado por error no le llega a ninguna persona real.
- Los teléfonos son del rango ficticio **8000-00xx**.
- Todos están juntos en la lista guardada **[prueba] Datos de prueba agosto 2026**
  (/miembros/listas).

**Contraseña de todas las cuentas:** `Prueba.Agosto.2026`
(cuentas de prueba con correo inexistente; se borran junto con el resto)

## Personas

| Nombre | Correo | Cuenta | Rol | Qué caso representa | Qué se puede probar |
|---|---|---|---|---|---|
| [prueba] Dora Dirigente | dora.dirigente@prueba.theosplace.invalid | sí | dirigente | Dirigente de todos los grupos del set | Entrar como dirigente y ver solo SUS grupos; tomar asistencia y cerrar un grupo |
| [prueba] Coco Codirigente | coco.codirigente@prueba.theosplace.invalid | sí | dirigente | Co-dirigente | Probar que el co-dirigente ve el grupo igual que el dirigente |
| [prueba] Ana Nivel Uno | ana.nivel.uno@prueba.theosplace.invalid | sí | miembro | Sin historial: elegible solo para N1 y campañas | Matrícula a N1 y a la campaña; ver que N2+ le salen bloqueados por prerequisito |
| [prueba] Bruno Nivel Tres | bruno.nivel.tres@prueba.theosplace.invalid | sí | miembro | N1 y N2 completados | Matrícula a N3 (prerequisito cumplido) y ver el histórico de estudios en su ficha |
| [prueba] Cintia Inicial | cintia.inicial@prueba.theosplace.invalid | sí | miembro | Asistencia activa (8 charlas, una reciente) | Matrícula a etapa inicial (SCJ) con el resumen de compromisos en verde |
| [prueba] Daniel Intermedio | daniel.intermedio@prueba.theosplace.invalid | sí | miembro | Cumple los 3 compromisos de intermedia: 14 charlas, donante y servidor | Matrícula a intermedia (DIS1) con los tres compromisos en verde |
| [prueba] Elena Avanzada | elena.avanzada@prueba.theosplace.invalid | sí | miembro | Cumple los compromisos de avanzada pero NO tiene invitación | Ver que CDEB no aparece aunque cumpla todo (EST-5: es por invitación) |
| [prueba] Nora Sin Asistencia | nora.sin.asistencia@prueba.theosplace.invalid | no | miembro | NEGATIVO · donante y servidora, pero sin charlas | Ver el bloqueo y el mensaje de asistencia en el resumen de compromisos (MAT-1) |
| [prueba] Nelson Sin Donar | nelson.sin.donar@prueba.theosplace.invalid | no | miembro | NEGATIVO · asistencia reforzada y servidor, pero no donante | Ver el bloqueo por donante en intermedia |
| [prueba] Nidia Sin Servicio | nidia.sin.servicio@prueba.theosplace.invalid | no | miembro | NEGATIVO · asistencia reforzada y donante, pero no sirve en ningún comité | Ver el bloqueo por servicio en intermedia |
| [prueba] Nacho Sin Prerequisito | nacho.sin.prerequisito@prueba.theosplace.invalid | no | miembro | NEGATIVO · sin ningún estudio completado | Ver el bloqueo por prerequisito al intentar N3 |
| [prueba] Pablo Pago Pendiente | pablo.pago.pendiente@prueba.theosplace.invalid | sí | miembro | Matriculado en N1 con cobro pendiente, sin comprobante | Ver el cobro en /mis-pagos y subir el comprobante desde el perfil |
| [prueba] Paula Pago En Revision | paula.pago.en.revision@prueba.theosplace.invalid | sí | miembro | Comprobante subido, esperando revisión | Aprobar o rechazar desde la cola de /finanzas/pagos |
| [prueba] Pedro Pago Rechazado | pedro.pago.rechazado@prueba.theosplace.invalid | sí | miembro | Comprobante rechazado hace 2 días | Ver el motivo del rechazo y volver a subir; comprobar que NO pierde la matrícula |
| [prueba] Beatriz Beca Activa | beatriz.beca.activa@prueba.theosplace.invalid | sí | miembro | Beca activa del 100% para N1 | Matricularse aplicando la beca y ver que no se genera cobro |
| [prueba] Benito Beca Usada | benito.beca.usada@prueba.theosplace.invalid | sí | miembro | Beca ya consumida | Ver que una beca usada no se puede volver a aplicar |
| [prueba] Est01 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 1 de 8 del grupo listo para cierre | Marcarlo aprobado, reprobado o retirado en el cierre |
| [prueba] Est02 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 2 de 8 del grupo listo para cierre | — |
| [prueba] Est03 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 3 de 8 del grupo listo para cierre | — |
| [prueba] Est04 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 4 de 8 del grupo listo para cierre | — |
| [prueba] Est05 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 5 de 8 del grupo listo para cierre | — |
| [prueba] Est06 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 6 de 8 del grupo listo para cierre | — |
| [prueba] Est07 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 7 de 8 del grupo listo para cierre | — |
| [prueba] Est08 Para Cierre | est.para.cierre@prueba.theosplace.invalid | no | miembro | Estudiante 8 de 8 del grupo listo para cierre | — |
| [prueba] Dis1 Candidato CDEB | dis.candidato.cdeb@prueba.theosplace.invalid | no | miembro | Estudiante 1 de DIS3, candidato a CDEB | Llenar la recomendación a CDEB al cerrar el grupo |
| [prueba] Dis2 Candidato CDEB | dis.candidato.cdeb@prueba.theosplace.invalid | no | miembro | Estudiante 2 de DIS3, candidato a CDEB | Llenar la recomendación a CDEB al cerrar el grupo |
| [prueba] Dis3 Candidato CDEB | dis.candidato.cdeb@prueba.theosplace.invalid | no | miembro | Estudiante 3 de DIS3, candidato a CDEB | Llenar la recomendación a CDEB al cerrar el grupo |
| [prueba] Dis4 Candidato CDEB | dis.candidato.cdeb@prueba.theosplace.invalid | no | miembro | Estudiante 4 de DIS3, candidato a CDEB | Llenar la recomendación a CDEB al cerrar el grupo |
| [prueba] Cumple Novio | cumple.novio@prueba.theosplace.invalid | sí | miembro | Novio que CUMPLE el requisito (N1 completado + matriculado en N2, con cédula) | Inscripción al prematrimonial que pasa los guards |
| [prueba] Cumple Novia | cumple.novia@prueba.theosplace.invalid | sí | miembro | Novia que CUMPLE el requisito | La otra mitad de la pareja que sí puede |
| [prueba] NoCumple Novio | nocumple.novio@prueba.theosplace.invalid | sí | miembro | Novio que NO cumple (sin N1 ni N2) | Ver el bloqueo de PRE-5 diciendo quién no cumple |
| [prueba] NoCumple Novia | nocumple.novia@prueba.theosplace.invalid | sí | miembro | Novia sin documento registrado | Ver el bloqueo por documento faltante |

## Grupos de estudio

| Grupo | Plan | Etapa | Estado | Dirigente | Estudiantes | Qué flujo permite probar |
|---|---|---|---|---|---|---|
| [prueba] Grupo N1 en matrícula | N1 | niveles | en_matricula | [prueba] Dora Dirigente | 0 | Matrícula sin compromisos: cualquiera elegible por cadena |
| [prueba] Grupo N2 en matrícula | N2 | niveles | en_matricula | [prueba] Dora Dirigente | 0 | Pide N1 completado — probar el bloqueo por prerequisito |
| [prueba] Grupo N3 en matrícula | N3 | niveles | en_matricula | [prueba] Dora Dirigente | 0 | Pide N2 completado |
| [prueba] Grupo N4 en matrícula | N4 | niveles | en_matricula | [prueba] Dora Dirigente | 0 | Último de la cadena de niveles |
| [prueba] Grupo SCJ en matrícula | SCJ | inicial | en_matricula | [prueba] Dora Dirigente | 0 | Etapa inicial: pide asistencia activa (≥6 charlas) |
| [prueba] Grupo DIS1 en matrícula | DIS1 | intermedia | en_matricula | [prueba] Dora Dirigente | 0 | Etapa intermedia: pide donante + servidor + asistencia reforzada (≥12) |
| [prueba] Grupo CDEB en matrícula | CDEB | avanzada | en_matricula | [prueba] Dora Dirigente | 0 | Etapa avanzada: mismos compromisos que intermedia Y solo por invitación (EST-5) |
| [prueba] Grupo TRANS en matrícula | TRANS | campaña | en_matricula | [prueba] Dora Dirigente | 0 | Campaña: sin compromisos ni prerequisitos |
| [prueba] Grupo N2 listo para cierre | N2 | niveles | en_curso | [prueba] Dora Dirigente | 8 | Probar el cierre completo: aprobados, reprobados con justificación y retirados con motivo (ahora obligatorio) |
| [prueba] Grupo DIS3 listo para cierre | DIS3 | intermedia | en_curso | [prueba] Dora Dirigente | 4 | Cierre con recomendación a CDEB por estudiante (EST-9) |
| [prueba] Grupo Panorama cerrado | PAN | intermedia | finalizado | [prueba] Coco Codirigente | 2 | Grupo ya cerrado · aporta una SEGUNDA evaluación a CDEB del mismo candidato, hecha por otro dirigente |

## Lo demás

| Bloque | Qué | Detalle |
|---|---|---|
| Servicio | [prueba] Puesto de servicio | Comité "Charlistas" · lo usan los servidores del set |
| Recomendaciones CDEB | [prueba] Dis1 Candidato CDEB | Sí, sin reservas |
| Recomendaciones CDEB | [prueba] Dis2 Candidato CDEB | Sí, con reservas |
| Recomendaciones CDEB | [prueba] Dis3 Candidato CDEB | No recomendado |
| Recomendaciones CDEB | [prueba] Dis1 Candidato CDEB (2.ª) | Sí, con reservas · la hizo [prueba] Coco Codirigente al cerrar Panorama |
| Recomendaciones CDEB | [prueba] Dis2 Candidato CDEB (2.ª) | Sí, pero debería llevar otro estudio primero · la hizo [prueba] Coco Codirigente al cerrar Panorama |
| Prematrimonial | [prueba] Cumple Novio + [prueba] Cumple Novia | CUMPLE PRE-5: ambos con N1 completado y matriculados en N2, géneros distintos |
| Prematrimonial | [prueba] NoCumple Novio + [prueba] NoCumple Novia | NO cumple: sirve para ver los bloqueos de PRE-5 y PRE-7 |
| Eventos | [prueba] Evento con inscripción | Inscripción abierta, check-in activo, sin costo · en 10 días |
| Formularios | [prueba] Formulario del evento | Asociado al evento de prueba · probar respuestas, export y acceso puntual |
| Listas | [prueba] Datos de prueba agosto 2026 | 32 personas · verlas juntas en /miembros/listas |

## Recorridos sugeridos

1. **Matrícula y compromisos.** Entrá como `[prueba] Daniel Intermedio` y matriculate en el
   grupo DIS1: los tres compromisos salen en verde. Después probá con
   `[prueba] Nelson Sin Donar` — el mismo grupo le sale bloqueado, y el resumen dice cuál
   requisito falta.
2. **Invitación (EST-5).** `[prueba] Elena Avanzada` cumple todo pero CDEB no le aparece:
   es solo por invitación. Mandale una desde el perfil y volvé a mirar.
3. **Pagos.** La cola de /finanzas/pagos tiene un comprobante en revisión y uno rechazado.
   Aprobá el primero; rechazá y comprobá que la persona **no** pierde la matrícula.
4. **Cierre de grupo.** El grupo N2 listo para cierre tiene 8 estudiantes: marcá uno
   aprobado, uno reprobado (pide justificación) y uno retirado (ahora también pide motivo).
5. **Recomendación a CDEB.** El grupo DIS3 tiene 4 estudiantes y tres recomendaciones ya
   llenas, con las tres respuestas posibles.
6. **Prematrimonial.** La pareja "Cumple" pasa los guards; la pareja "NoCumple" sirve para
   ver los mensajes de PRE-5 y PRE-7.
7. **Evento y formulario.** Inscribite al evento de prueba, hacé check-in y respondé el
   formulario asociado.
