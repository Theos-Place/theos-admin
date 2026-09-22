# Healthchecks: un check por cron

Cada cron pingea su check al terminar BIEN. Si el ping no llega en la ventana
esperada, healthchecks.io manda un correo.

**La meta es cero correos por día.** Cada correo que llegue tiene que significar
que algo hay que hacer; si llegan correos de rutina, se dejan de leer y el
monitoreo deja de servir. Esto se escribió el 2026-09-22, después de una semana
de 30-40 correos diarios.

## La tabla

Horarios en **UTC**, que es como los interpreta Vercel. Costa Rica es UTC−6, así
que un cron de `0 13 * * *` corre a las 7:00 a.m. de acá.

| Cron | Schedule (UTC) | Hora CR | Variable | Período | Grace |
|---|---|---|---|---|---|
| `/api/cron/report-snapshots` | `0 6 * * *` | 12:00 a.m. | `HEALTHCHECK_URL_REPORT_SNAPSHOTS` | 1 día | 2 h |
| `/api/cron/birthday-greetings` | `0 12 * * *` | 6:00 a.m. | `HEALTHCHECK_URL_BIRTHDAYS` | 1 día | 2 h |
| `/api/cron/group-enrollment-windows` | `30 12 * * *` | 6:30 a.m. | `HEALTHCHECK_URL_GROUP_WINDOWS` | 1 día | 2 h |
| `/api/cron/folleto-blocks` | `0 13 * * *` | 7:00 a.m. | `HEALTHCHECK_URL_FOLLETO_BLOCKS` | 1 día | 2 h |
| `/api/cron/cuentas-sin-ficha` | `15 13 * * *` | 7:15 a.m. | `HEALTHCHECK_URL_CUENTAS_SIN_FICHA` | 1 día | 2 h |
| `/api/studies/start-reminders` | `30 13 * * *` | 7:30 a.m. | `HEALTHCHECK_URL_START_REMINDERS` | 1 día | 2 h |
| `/api/notifications/leader-absence-check` | `0 14 * * *` | 8:00 a.m. | `HEALTHCHECK_URL_LEADER_ABSENCE` | 1 día | 2 h |
| `/api/cron/close-reminders` | `30 14 * * *` | 8:30 a.m. | `HEALTHCHECK_URL_CLOSE_REMINDERS` | 1 día | 2 h |
| `/api/cron/payment-holds-expire` | `0 16 * * *` | 10:00 a.m. | `HEALTHCHECK_URL_PAYMENT_HOLDS_EXPIRE` | 1 día | 2 h |
| `/api/cron/event-surveys` | `0 17 * * *` | 11:00 a.m. | `HEALTHCHECK_URL_EVENT_SURVEYS` | 1 día | 2 h |
| `/api/cron/study-surveys` | `30 17 * * *` | 11:30 a.m. | `HEALTHCHECK_URL_STUDY_SURVEYS` | 1 día | 2 h |
| `/api/cron/scheduled-broadcasts` | `0 * * * *` | cada hora | `HEALTHCHECK_URL_SCHEDULED_BROADCASTS` | **1 hora** | **30 min** |
| `/api/cron/storage-orphans` | `0 15 * * 1` | lunes 9:00 a.m. | `HEALTHCHECK_URL_STORAGE_ORPHANS` | 1 semana | 6 h |
| `/api/cron/payment-reminders` | `30 16 * * 1` | lunes 10:30 a.m. | `HEALTHCHECK_URL_PAYMENT_REMINDERS` | 1 semana | 6 h |
| `/api/cron/desbloquear-mayores` | `0 13 1 * *` | 1.º, 7:00 a.m. | `HEALTHCHECK_URL_DESBLOQUEAR_MAYORES` | 1 mes | 1 día |
| `/api/cron/study-requests-expire` | `0 13 1 2,6,10 *` | 1.º de feb/jun/oct | `HEALTHCHECK_URL_STUDY_REQUESTS_EXPIRE` | **4 meses** | 1 día |

## Cómo se eligen período y grace

**Período = el intervalo REAL del cron.** No el que uno quisiera: el de
`vercel.json`. Si el check espera un ping cada hora y el cron corre una vez al
día, el check se cae todos los días y vuelve todos los días — y eso es
exactamente el ruido que hay que evitar.

**Grace = margen para el atraso normal, no para una falla.** Vercel no dispara
los crons al segundo exacto; el atraso típico es de minutos. Dos horas sobre un
cron diario cubre eso con aire de sobra y aun así avisa el mismo día. Un grace de
medio período —que suena prolijo— en un cron diario significa enterarse doce
horas tarde.

El de una hora es el más delicado: con grace corto, el atraso normal de Vercel lo
hace caer y levantarse cada hora. Treinta minutos es la mitad del intervalo y no
se cae por jitter.

## Antes de agregar un cron nuevo

1. Agregarlo a `vercel.json`.
2. Agregar su `HEALTHCHECK_URL_*` a `src/lib/health.ts` y a `.env.example`.
3. Llamar a `pingHealthcheck(...)` **AL FINAL** del handler, después del éxito.
   Un ping al inicio reporta como sana una corrida que reventó a la mitad.
4. Crear el check en healthchecks.io con el período y el grace de esta tabla, y
   pegar la URL en Vercel (Production).
5. Agregar la fila acá.

`src/lib/health.test.ts` vigila los pasos 2 y 3: falla si un cron no pingea o si
una variable no está en `.env.example`. Lo que NO puede vigilar es el paso 4 —que
la variable exista en Vercel y que el check esté bien configurado— porque eso vive
fuera del repo. Es justo donde se rompió.
