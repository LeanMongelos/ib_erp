/**
 * Guías paso a paso para conectar cada canal (Fase 9).
 * Se muestran en Configuración → Integraciones.
 */

export type PasoGuia = {
  titulo: string
  descripcion: string
  campos?: string[]
  link?: { label: string; href: string }
  nota?: string
}

export type GuiaCanal = {
  titulo: string
  subtitulo: string
  pasos: PasoGuia[]
  webhookPath?: string
  docsUrl?: string
}

export const GUIAS_INTEGRACION: Record<string, GuiaCanal> = {
  WHATSAPP: {
    titulo: 'WhatsApp Business (Cloud API)',
    subtitulo: 'Modo coexistence: la app del celular y la API funcionan juntas.',
    docsUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    webhookPath: '/api/webhooks/whatsapp',
    pasos: [
      {
        titulo: '1. Crear app en Meta for Developers',
        descripcion: 'Entrá a Meta for Developers → Crear app → tipo Business → agregá el producto WhatsApp.',
        link: { label: 'Meta for Developers', href: 'https://developers.facebook.com/apps/' },
      },
      {
        titulo: '2. Verificar Meta Business',
        descripcion: 'En Business Settings verificá la cuenta comercial de Ingeniería Biomédica. Sin verificación no podés usar la API en producción.',
        link: { label: 'Business Manager', href: 'https://business.facebook.com/settings' },
      },
      {
        titulo: '3. Conectar número (coexistence)',
        descripcion: 'En WhatsApp → API Setup → conectá el número +54… con coexistence habilitado para seguir usando WhatsApp Business en el celular.',
        nota: 'El número no puede estar en WhatsApp personal.',
      },
      {
        titulo: '4. Token permanente',
        descripcion: 'Generá un System User en Business Manager con permiso whatsapp_business_messaging y creá un token permanente (no uses el token temporal de 24 h).',
        campos: ['phoneNumberId', 'businessAccountId', 'accessToken'],
      },
      {
        titulo: '5. Configurar webhook',
        descripcion: 'En la app Meta → WhatsApp → Configuration pegá la URL de callback y el Verify Token que definís acá. Meta hará un GET de verificación.',
        campos: ['verifyToken', 'webhookUrl'],
        nota: 'La URL debe ser HTTPS pública (tu VPS con Caddy/Nginx).',
      },
      {
        titulo: '6. Probar y activar',
        descripcion: 'Enviá un mensaje de prueba al número conectado. Si llega a la bandeja, marcá el canal como activo.',
      },
    ],
  },

  INSTAGRAM: {
    titulo: 'Instagram Direct',
    subtitulo: 'Mensajes directos de la cuenta profesional vinculada a tu Página de Facebook.',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform/instagram',
    webhookPath: '/api/webhooks/meta',
    pasos: [
      {
        titulo: '1. Cuenta profesional de Instagram',
        descripcion: 'La cuenta debe ser Business o Creator y estar vinculada a una Página de Facebook de la empresa.',
      },
      {
        titulo: '2. Permisos en la app Meta',
        descripcion: 'En la misma app de Meta agregá Instagram → permisos instagram_manage_messages, pages_manage_metadata, pages_messaging.',
      },
      {
        titulo: '3. Conectar la Página',
        descripcion: 'Seleccioná la Página de Facebook que tiene vinculada la cuenta de Instagram.',
        campos: ['pageId', 'instagramAccountId', 'pageAccessToken'],
      },
      {
        titulo: '4. Webhook unificado Meta',
        descripcion: 'Usá el mismo webhook que Facebook Messenger. Suscribite al campo messages e instagram.',
        campos: ['verifyToken', 'webhookUrl'],
      },
      {
        titulo: '5. Probar DM',
        descripcion: 'Enviá un DM de prueba desde otra cuenta. Debe aparecer en la bandeja unificada.',
      },
    ],
  },

  FACEBOOK: {
    titulo: 'Facebook Messenger',
    subtitulo: 'Mensajes de la Página de Facebook de la empresa.',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    webhookPath: '/api/webhooks/meta',
    pasos: [
      {
        titulo: '1. Página de Facebook',
        descripcion: 'Creá o usá la Página oficial de Ingeniería Biomédica. Debe ser admin de la página.',
      },
      {
        titulo: '2. App Meta + Messenger',
        descripcion: 'En tu app Meta agregá el producto Messenger → conectá la Página.',
        campos: ['pageId', 'pageAccessToken'],
      },
      {
        titulo: '3. Webhook',
        descripcion: 'Callback URL → pegá la URL pública del ERP. Verify Token → el que guardás acá. Suscribí messages y messaging_postbacks.',
        campos: ['verifyToken', 'webhookUrl'],
      },
      {
        titulo: '4. Token de página',
        descripcion: 'Generá un Page Access Token de larga duración desde Graph API Explorer o Business Manager.',
      },
      {
        titulo: '5. Probar',
        descripcion: 'Escribí a la Página desde otra cuenta. El mensaje debe ingresar a la bandeja.',
      },
    ],
  },

  EMAIL_IMAP: {
    titulo: 'Correo IMAP/SMTP',
    subtitulo: 'Para @hotmail.com, @outlook.com u otro buzón con usuario y contraseña de aplicación.',
    pasos: [
      {
        titulo: '1. Contraseña de aplicación',
        descripcion: 'En la cuenta Microsoft/Google generá una contraseña de aplicación (no uses la contraseña normal).',
        link: { label: 'Microsoft App Passwords', href: 'https://account.live.com/proofs/AppPassword' },
      },
      {
        titulo: '2. Datos IMAP (entrada)',
        descripcion: 'Hotmail/Outlook: imap-mail.outlook.com puerto 993 SSL. Gmail: imap.gmail.com 993.',
        campos: ['imapHost', 'imapPort', 'imapUser', 'imapPassword'],
      },
      {
        titulo: '3. Datos SMTP (salida)',
        descripcion: 'Hotmail: smtp-mail.outlook.com puerto 587 STARTTLS. Gmail: smtp.gmail.com 587.',
        campos: ['smtpHost', 'smtpPort', 'smtpUser', 'smtpPassword', 'fromName', 'fromEmail'],
      },
      {
        titulo: '4. Probar conexión',
        descripcion: 'El sistema intentará leer la bandeja INBOX y enviar un mail de prueba. Si OK, activá el canal.',
        nota: 'Los mails se agrupan por hilo y se vinculan al cliente por dirección.',
      },
    ],
  },

  EMAIL_GRAPH: {
    titulo: 'Correo Microsoft 365 / Graph',
    subtitulo: 'Para dominio propio con OAuth (recomendado cuando migren de @hotmail.com).',
    docsUrl: 'https://learn.microsoft.com/graph/api/resources/mail-api-overview',
    pasos: [
      {
        titulo: '1. App registration en Azure AD',
        descripcion: 'Azure Portal → App registrations → New. Redirect URI: la URL de callback del ERP.',
        link: { label: 'Azure Portal', href: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade' },
      },
      {
        titulo: '2. Permisos Microsoft Graph',
        descripcion: 'Mail.Read, Mail.Send, offline_access. Grant admin consent si es tenant corporativo.',
        campos: ['tenantId', 'clientId', 'clientSecret'],
      },
      {
        titulo: '3. OAuth — conectar buzón',
        descripcion: 'Guardá tenantId, clientId y clientSecret. Luego usá "Conectar con Microsoft" en el wizard. Redirect URI en Azure:',
        campos: ['redirectUri'],
        nota: 'Registrá la Redirect URI exacta que muestra el wizard (ej. https://erp.tudominio.com/api/integraciones/graph/callback).',
      },
      {
        titulo: '4. Buzón a monitorear',
        descripcion: 'Indicá el email del buzón (ej. ingenieriabiomedica@tudominio.com).',
        campos: ['mailboxEmail'],
      },
      {
        titulo: '5. Sincronización',
        descripcion: 'El worker poll cada 2 min o usa Graph webhooks (change notifications) en producción.',
      },
    ],
  },

  N8N: {
    titulo: 'n8n — Automatizaciones',
    subtitulo: 'Conectá flujos automáticos bidireccionales con el ERP.',
    docsUrl: 'https://docs.n8n.io/',
    pasos: [
      {
        titulo: '1. Instalar n8n en el VPS',
        descripcion: 'Docker Compose ya incluye n8n en puerto 5678. En producción protegelo con auth y HTTPS.',
        link: { label: 'Abrir n8n local', href: 'http://localhost:5678' },
      },
      {
        titulo: '2. API Key del ERP',
        descripcion: 'Generá una clave de integración (solo SUPERADMIN). n8n la usará en el header Authorization.',
        campos: ['apiKey', 'baseUrl'],
      },
      {
        titulo: '3. Webhooks salientes (ERP → n8n)',
        descripcion: 'Pegá la URL del webhook de n8n. El ERP emitirá: mensaje.nuevo, conversacion.creada, cliente.sin_respuesta_2h.',
        campos: ['webhookUrlN8n'],
      },
      {
        titulo: '4. Webhooks entrantes (n8n → ERP)',
        descripcion: 'En n8n usá HTTP Request hacia POST /api/n8n/responder, /api/n8n/etiquetar, /api/n8n/crear-lead.',
        nota: 'Documentación de endpoints en la pestaña API del wizard.',
      },
      {
        titulo: '5. Flujos sugeridos',
        descripcion: 'Fuera de horario → auto-respuesta. Palabra "presupuesto" → asignar Ventas. "falla/no anda" → crear OT.',
      },
    ],
  },
}

export function getWebhookBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
}

export function buildWebhookUrl(path: string) {
  return `${getWebhookBaseUrl()}${path}`
}
