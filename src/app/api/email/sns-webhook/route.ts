import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { markEmailBounced, markEmailComplained } from '@/lib/email/suppression'

// Webhook de Amazon SNS para notificaciones de SES (bounces y complaints).
//
// SEGURIDAD (excepción documentada al guard de roles de AGENTS.md): este
// endpoint es PÚBLICO porque lo invoca AWS, no una sesión. La autenticidad se
// garantiza verificando la FIRMA criptográfica de SNS (certificado servido por
// *.amazonaws.com) y, opcionalmente, restringiendo al TopicArn esperado
// (SES_SNS_TOPIC_ARN). No usa service role salvo dentro de los helpers de
// supresión, que sí lo necesitan para escribir.
export const runtime = 'nodejs'

const CERT_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com$/i

type SnsMessage = Record<string, string>

/** Campos firmados, en orden, según el tipo de mensaje SNS. */
function signingKeys(msg: SnsMessage): string[] | null {
  if (msg.Type === 'Notification') {
    return msg.Subject != null
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'Timestamp', 'TopicArn', 'Type']
  }
  if (msg.Type === 'SubscriptionConfirmation' || msg.Type === 'UnsubscribeConfirmation') {
    return ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type']
  }
  return null
}

async function verifySignature(msg: SnsMessage): Promise<boolean> {
  const certUrl = msg.SigningCertURL || msg.SigningCertUrl
  if (!certUrl) return false
  let u: URL
  try { u = new URL(certUrl) } catch { return false }
  if (u.protocol !== 'https:' || !CERT_HOST_RE.test(u.hostname)) return false

  const keys = signingKeys(msg)
  if (!keys) return false
  let canonical = ''
  for (const k of keys) {
    if (msg[k] == null) continue
    canonical += `${k}\n${msg[k]}\n`
  }
  try {
    const certPem = await fetch(certUrl).then(r => r.text())
    const algo = msg.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1'
    const verifier = crypto.createVerify(algo)
    verifier.update(canonical, 'utf8')
    return verifier.verify(certPem, msg.Signature, 'base64')
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    let msg: SnsMessage
    try { msg = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

    // Firma de SNS (autenticidad). Sin firma válida no se procesa.
    if (!(await verifySignature(msg))) {
      return NextResponse.json({ error: 'Firma SNS inválida' }, { status: 403 })
    }
    // Allowlist opcional de tópico.
    const expectedArn = process.env.SES_SNS_TOPIC_ARN
    if (expectedArn && msg.TopicArn !== expectedArn) {
      return NextResponse.json({ error: 'TopicArn no autorizado' }, { status: 403 })
    }

    // Confirmación de suscripción del tópico: AWS espera que visitemos SubscribeURL.
    if (msg.Type === 'SubscriptionConfirmation') {
      if (msg.SubscribeURL) await fetch(msg.SubscribeURL).catch(() => {})
      return NextResponse.json({ ok: true, confirmed: true })
    }

    if (msg.Type === 'Notification') {
      const payload = JSON.parse(msg.Message) as {
        notificationType?: string; eventType?: string
        bounce?: { bounceType?: string; bouncedRecipients?: Array<{ emailAddress: string }> }
        complaint?: { complainedRecipients?: Array<{ emailAddress: string }> }
      }
      const type = payload.notificationType ?? payload.eventType

      if (type === 'Bounce' && payload.bounce) {
        // Solo bounces PERMANENTES (duros) suprimen la dirección.
        if (payload.bounce.bounceType === 'Permanent') {
          for (const r of payload.bounce.bouncedRecipients ?? []) {
            if (r.emailAddress) await markEmailBounced(r.emailAddress)
          }
        }
      } else if (type === 'Complaint' && payload.complaint) {
        for (const r of payload.complaint.complainedRecipients ?? []) {
          if (r.emailAddress) await markEmailComplained(r.emailAddress)
        }
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, ignored: msg.Type })
  } catch (error) {
    console.error('POST /api/email/sns-webhook:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
