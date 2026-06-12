import 'server-only'

/**
 * Templates HTML/texto pros emails do Audere.
 *
 * Padrão visual: paleta do app (#6a4ec8 accent, #5a9e8a sage, #f9f8f5 page,
 * Cormorant Garamond no título, DM Sans no corpo). HTML inline pra
 * compatibilidade com clientes de email (Gmail, Outlook, Apple Mail).
 *
 * Sem imagens externas. Logo é uma "espiral" feita com pseudo-elementos
 * simples (sem SVG inline porque Gmail strip).
 */

type BoasVindasInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoCrp: string
  psicologoEmail: string
  link: string
}

export function tplPacienteBoasVindas(p: BoasVindasInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `Bem-vindo(a) ao acompanhamento com ${p.psicologoNome}`

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Sou da equipe de ${p.psicologoNome} (${p.psicologoCrp}). Você foi cadastrado(a) no Audere,`,
    `o sistema que organiza o acompanhamento clínico.`,
    ``,
    `Pra começar, leia e aceite o termo de consentimento no link abaixo:`,
    ``,
    p.link,
    ``,
    `Em paralelo, você também recebeu uma mensagem por WhatsApp.`,
    ``,
    `Qualquer dúvida, responda direto pra ${p.psicologoNome} em ${p.psicologoEmail}.`,
    ``,
    `Audere`,
    `Sistema operacional da prática clínica · CFP 09/2024 · LGPD`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f9f8f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1825;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9f8f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e3d8;">

        <!-- Header / Brand -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid #e6e3d8;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <div style="width:34px;height:34px;border-radius:8px;background:linear-gradient(145deg,#7b5ee8,#5a9e8a);"></div>
              </td>
              <td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:20px;">
                <span style="color:#291860;font-weight:300;">Au</span><span style="font-weight:600;background:linear-gradient(90deg,#6a4ec8,#5c9d88);-webkit-background-clip:text;background-clip:text;color:#6a4ec8;">dere</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Corpo -->
        <tr><td style="padding:30px 32px 14px;">
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:26px;line-height:1.2;color:#291860;letter-spacing:-.3px;">
            Olá, ${escapeHtml(primeiroNome)}.
          </h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#38324e;">
            Sou da equipe de <strong>${escapeHtml(p.psicologoNome)}</strong>
            (${escapeHtml(p.psicologoCrp)}). Você foi cadastrado(a) no
            <strong>Audere</strong> — o sistema que organiza o seu
            acompanhamento clínico.
          </p>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#38324e;">
            Pra começar, leia e aceite o termo de consentimento clicando no botão abaixo.
            Você também recebeu uma mensagem por WhatsApp — pode aceitar pelo canal que preferir.
          </p>

          <!-- CTA -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
            <tr><td style="background:#6a4ec8;border-radius:999px;">
              <a href="${escapeHtml(p.link)}"
                 style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;letter-spacing:.2px;">
                Aceitar termo →
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 8px;font-size:11px;color:#7a7590;">
            Se o botão não funcionar, copie e cole este link no seu navegador:
          </p>
          <p style="margin:0 0 22px;font-size:11px;color:#6a4ec8;word-break:break-all;">
            ${escapeHtml(p.link)}
          </p>

          <!-- Box CFP -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;background:#f1efe9;border-radius:8px;">
            <tr><td style="padding:14px 16px;">
              <p style="margin:0 0 6px;font-size:11px;color:#7a5520;font-weight:600;letter-spacing:.4px;text-transform:uppercase;">
                IA assistente · CFP 09/2024 · LGPD
              </p>
              <p style="margin:0;font-size:12px;color:#38324e;line-height:1.55;">
                Audere usa inteligência artificial como apoio à continuidade clínica.
                A IA NÃO emite diagnóstico. Notas e resumos são sempre rascunho até
                serem assinados pelo profissional responsável. Seus dados ficam
                criptografados e nunca são usados pra treinar modelos.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 32px 24px;border-top:1px solid #e6e3d8;font-size:11px;color:#9c97b0;">
          <p style="margin:0 0 4px;">
            Dúvidas? Responda esse email — ele vai direto pra
            <a href="mailto:${escapeHtml(p.psicologoEmail)}" style="color:#6a4ec8;text-decoration:none;">${escapeHtml(p.psicologoEmail)}</a>.
          </p>
          <p style="margin:0;">
            Audere · Sistema operacional da prática clínica
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { html, text, subject }
}

// ─── Sessão confirmada (após pagamento) ─────────────────────────────

type SessaoConfirmadaInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoEmail: string
  dataHora: string         // já formatado em pt-BR
  modalidade: string       // "online" | "presencial"
  linkSala?: string | null
}

export function tplSessaoConfirmada(p: SessaoConfirmadaInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `Sessão confirmada · ${p.dataHora}`
  const modalidadeLbl = p.modalidade === 'presencial' ? 'Presencial' : 'Online'

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Pagamento confirmado. Sua sessão está marcada:`,
    ``,
    `Data: ${p.dataHora}`,
    `Modalidade: ${modalidadeLbl}`,
    p.linkSala ? `Sala: ${p.linkSala}` : '',
    ``,
    `Profissional: ${p.psicologoNome}`,
    `Dúvidas? Responda este email — vai direto pra ${p.psicologoEmail}.`,
    ``,
    `Audere · CFP 09/2024 · LGPD`,
  ].filter(Boolean).join('\n')

  const html = baseHtml({
    titulo: 'Sessão confirmada',
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: p.psicologoEmail,
    corpo: `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#38324e;">
        Recebemos seu pagamento. Sua sessão com <strong>${escapeHtml(p.psicologoNome)}</strong>
        está confirmada — anote na agenda.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:#e8f1ed;border-radius:10px;border:1px solid rgba(90,158,138,.25);">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:11px;color:#2a6456;font-weight:700;letter-spacing:.4px;text-transform:uppercase;">
            ✓ Sessão confirmada
          </p>
          <p style="margin:0 0 4px;font-size:18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#1a1825;line-height:1.3;">
            ${escapeHtml(p.dataHora)}
          </p>
          <p style="margin:0;font-size:12px;color:#38324e;">${modalidadeLbl}</p>
        </td></tr>
      </table>

      ${p.linkSala ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
        <tr><td style="background:#6a4ec8;border-radius:999px;">
          <a href="${escapeHtml(p.linkSala)}"
             style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;letter-spacing:.2px;">
            Entrar na sala →
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 22px;font-size:11px;color:#7a7590;">
        A sala fica disponível alguns minutos antes do horário marcado.
      </p>
      ` : ''}
    `,
  })

  return { html, text, subject }
}

// ─── Lembrete 15 min antes (com link da sala) ────────────────────────

type Lembrete15minInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoEmail: string
  dataHora: string
  modalidade: string
  linkSala?: string | null
}

export function tplLembrete15min(p: Lembrete15minInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `Sua sessão começa em ~15 min · ${p.dataHora}`
  const modalidadeLbl = p.modalidade === 'presencial' ? 'Presencial' : 'Online'

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Sua sessão com ${p.psicologoNome} começa em ~15 minutos:`,
    ``,
    `Data: ${p.dataHora}`,
    `Modalidade: ${modalidadeLbl}`,
    p.linkSala ? `Sala de vídeo: ${p.linkSala}` : '',
    ``,
    `Dúvidas? Responda este email — vai direto pra ${p.psicologoEmail}.`,
    ``,
    `Audere · CFP 09/2024 · LGPD`,
  ].filter(Boolean).join('\n')

  const html = baseHtml({
    titulo: 'Sua sessão está quase começando',
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: p.psicologoEmail,
    corpo: `
      <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#38324e;">
        Sua sessão com <strong>${escapeHtml(p.psicologoNome)}</strong> começa em <strong>~15 minutos</strong>.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:#f0eef9;border-radius:10px;border:1px solid rgba(106,78,200,.22);">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:11px;color:#391d96;font-weight:700;letter-spacing:.4px;text-transform:uppercase;">⏰ Em ~15 minutos</p>
          <p style="margin:0 0 4px;font-size:18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#1a1825;line-height:1.3;">${escapeHtml(p.dataHora)}</p>
          <p style="margin:0;font-size:12px;color:#38324e;">${modalidadeLbl}</p>
        </td></tr>
      </table>

      ${p.linkSala ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
        <tr><td style="background:#6a4ec8;border-radius:999px;">
          <a href="${escapeHtml(p.linkSala)}"
             style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;letter-spacing:.2px;">
            Entrar na sala →
          </a>
        </td></tr>
      </table>
      ` : ''}
    `,
  })

  return { html, text, subject }
}

// ─── Lembrete 24h antes ──────────────────────────────────────────────

type Lembrete24hInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoEmail: string
  dataHora: string
  modalidade: string
  linkSala?: string | null
}

export function tplLembrete24h(p: Lembrete24hInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `Lembrete · sua sessão é amanhã (${p.dataHora})`
  const modalidadeLbl = p.modalidade === 'presencial' ? 'Presencial' : 'Online'

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Lembrando que sua sessão é amanhã, ${p.dataHora} (${modalidadeLbl}).`,
    ``,
    `Caso precise confirmar ou cancelar, responda a mensagem no WhatsApp.`,
    p.linkSala ? `Sala: ${p.linkSala}` : '',
    ``,
    `Audere`,
  ].filter(Boolean).join('\n')

  const html = baseHtml({
    titulo: 'Sessão amanhã',
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: p.psicologoEmail,
    corpo: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#38324e;">
        Lembrando que sua sessão com <strong>${escapeHtml(p.psicologoNome)}</strong> é amanhã.
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:#f1efe9;border-radius:10px;border:1px solid #e6e3d8;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 4px;font-size:11px;color:#7a7590;font-weight:600;letter-spacing:.4px;text-transform:uppercase;">
            Amanhã
          </p>
          <p style="margin:0 0 4px;font-size:18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#1a1825;line-height:1.3;">
            ${escapeHtml(p.dataHora)}
          </p>
          <p style="margin:0;font-size:12px;color:#38324e;">${modalidadeLbl}</p>
        </td></tr>
      </table>

      <p style="margin:0 0 16px;font-size:13px;color:#7a7590;line-height:1.55;">
        Pra confirmar ou cancelar, responda no WhatsApp. ${p.linkSala ? 'A sala estará disponível pouco antes do horário.' : ''}
      </p>
    `,
  })

  return { html, text, subject }
}

// ─── Sessão cancelada ────────────────────────────────────────────────

type SessaoCanceladaInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoEmail: string
  dataHora: string
  comReembolso: boolean
}

export function tplSessaoCancelada(p: SessaoCanceladaInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `Sessão cancelada · ${p.dataHora}`

  const reembolsoTxt = p.comReembolso
    ? 'O reembolso já foi solicitado e cai na conta de origem em até 5 dias úteis (PIX em 1 dia, cartão em até 30).'
    : 'Como o cancelamento foi feito em menos de 24h da sessão, não há reembolso conforme acordo prévio.'

  const text = [
    `Olá, ${primeiroNome}.`,
    ``,
    `Sua sessão de ${p.dataHora} foi cancelada.`,
    ``,
    reembolsoTxt,
    ``,
    `Pra remarcar, responda este email ou converse com ${p.psicologoNome} em ${p.psicologoEmail}.`,
    ``,
    `Audere`,
  ].join('\n')

  const html = baseHtml({
    titulo: 'Sessão cancelada',
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: p.psicologoEmail,
    corpo: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px;background:#f7eaee;border-radius:10px;border:1px solid rgba(196,96,122,.25);">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:11px;color:#823045;font-weight:700;letter-spacing:.4px;text-transform:uppercase;">
            Sessão cancelada
          </p>
          <p style="margin:0 0 4px;font-size:18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;color:#1a1825;line-height:1.3;">
            ${escapeHtml(p.dataHora)}
          </p>
        </td></tr>
      </table>

      <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#38324e;">
        ${escapeHtml(reembolsoTxt)}
      </p>

      <p style="margin:0 0 16px;font-size:13px;color:#7a7590;line-height:1.55;">
        Pra remarcar, responda este email ou fale com <strong>${escapeHtml(p.psicologoNome)}</strong>.
      </p>
    `,
  })

  return { html, text, subject }
}

// ─── Série de sessões agendada ──────────────────────────────────────

type SerieAgendadaInput = {
  nomePaciente: string
  psicologoNome: string
  psicologoEmail: string
  datas: string[]      // já formatadas
  valor: number
}

export function tplSerieAgendada(p: SerieAgendadaInput): { html: string; text: string; subject: string } {
  const primeiroNome = p.nomePaciente.trim().split(/\s+/)[0]
  const subject = `${p.datas.length} sessões agendadas com ${p.psicologoNome}`
  const valorBrl = p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Foram agendadas ${p.datas.length} sessões pra você (${valorBrl} cada):`,
    ``,
    ...p.datas.map((d, i) => `${i + 1}. ${d}`),
    ``,
    `Vou te perguntar o método de pagamento (PIX, crédito ou débito) ~48h antes de cada uma.`,
    ``,
    `Qualquer dúvida ou mudança, responda este email.`,
    ``,
    `Audere`,
  ].join('\n')

  const linhasHtml = p.datas
    .map((d, i) => `<li style="margin-bottom:6px;font-size:13.5px;color:#38324e;line-height:1.5;"><strong style="color:#6a4ec8;">${i + 1}.</strong> ${escapeHtml(d)}</li>`)
    .join('')

  const html = baseHtml({
    titulo: `${p.datas.length} sessões agendadas`,
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: p.psicologoEmail,
    corpo: `
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#38324e;">
        Suas próximas <strong>${p.datas.length} sessões</strong> com
        <strong>${escapeHtml(p.psicologoNome)}</strong> foram agendadas
        (${valorBrl} cada):
      </p>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;background:#f0eef9;border-radius:10px;border:1px solid rgba(106,78,200,.25);">
        <tr><td style="padding:16px 22px;">
          <ol style="margin:0;padding:0 0 0 6px;list-style:none;">
            ${linhasHtml}
          </ol>
        </td></tr>
      </table>

      <p style="margin:0 0 16px;font-size:13px;color:#7a7590;line-height:1.55;">
        Vou te perguntar o método de pagamento (PIX, crédito ou débito)
        no WhatsApp <strong>cerca de 48h antes de cada sessão</strong>.
      </p>
    `,
  })

  return { html, text, subject }
}

// ─── Lista de espera (lançamento) ───────────────────────────────────

/** Confirmação enviada a quem entrou na lista de espera. */
export function tplListaEsperaConfirmacao(p: { nome: string }): { html: string; text: string; subject: string } {
  const primeiroNome = p.nome.trim().split(/\s+/)[0]
  const subject = 'Você está na lista de espera do Audere'

  const text = [
    `Olá, ${primeiroNome}!`,
    ``,
    `Recebemos sua inscrição na lista de espera do Audere.`,
    `Vamos te avisar por email assim que seu acesso abrir.`,
    ``,
    `Qualquer dúvida, escreva pra contato@automaxia.com.br.`,
    ``,
    `Audere · Sistema operacional da prática clínica`,
  ].join('\n')

  const html = baseHtml({
    titulo: 'Você está na lista',
    saudacao: `Olá, ${primeiroNome}.`,
    psicologoEmail: 'contato@automaxia.com.br',
    corpo: `
      <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#38324e;">
        Recebemos sua inscrição na <strong>lista de espera do Audere</strong>.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;background:#e8f1ed;border-radius:10px;border:1px solid rgba(90,158,138,.25);">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:13.5px;color:#2a6456;line-height:1.55;">
            ✓ Te avisamos por email assim que seu acesso abrir.
          </p>
        </td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:#7a7590;line-height:1.55;">
        Sem spam — só o aviso quando for a sua vez.
      </p>
    `,
  })

  return { html, text, subject }
}

/** Aviso interno (pra equipe) de nova inscrição na lista. */
export function tplListaEsperaAviso(p: {
  nome: string; email: string; crp?: string | null; mensagem?: string | null; origem?: string | null
}): { html: string; text: string; subject: string } {
  const subject = `Nova lista de espera: ${p.nome}`
  const linhas = [
    `Nome: ${p.nome}`,
    `Email: ${p.email}`,
    p.crp ? `CRP: ${p.crp}` : null,
    p.origem ? `Origem: ${p.origem}` : null,
    p.mensagem ? `Mensagem: ${p.mensagem}` : null,
  ].filter(Boolean) as string[]

  const text = ['Nova inscrição na lista de espera:', '', ...linhas].join('\n')

  const html = baseHtml({
    titulo: 'Nova inscrição',
    saudacao: 'Nova inscrição na lista de espera',
    psicologoEmail: 'contato@automaxia.com.br',
    corpo: `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 8px;background:#f0eef9;border-radius:10px;border:1px solid rgba(106,78,200,.25);">
        <tr><td style="padding:16px 20px;">
          ${linhas.map(l => {
            const [rotulo, ...resto] = l.split(': ')
            return `<p style="margin:0 0 8px;font-size:13.5px;color:#38324e;line-height:1.5;"><strong style="color:#6a4ec8;">${escapeHtml(rotulo)}:</strong> ${escapeHtml(resto.join(': '))}</p>`
          }).join('')}
        </td></tr>
      </table>
    `,
  })

  return { html, text, subject }
}

// ─── Base HTML compartilhado ────────────────────────────────────────

type BaseHtmlInput = {
  titulo: string
  saudacao: string
  corpo: string
  psicologoEmail: string
}

function baseHtml(p: BaseHtmlInput): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(p.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f9f8f5;font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1825;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f9f8f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e3d8;">
        <tr><td style="padding:24px 32px 16px;border-bottom:1px solid #e6e3d8;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <div style="width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#7b5ee8,#5a9e8a);"></div>
              </td>
              <td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:18px;">
                <span style="color:#291860;font-weight:300;">Au</span><span style="font-weight:600;color:#6a4ec8;">dere</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td style="padding:28px 32px 14px;">
          <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.2;color:#291860;letter-spacing:-.3px;">
            ${escapeHtml(p.saudacao)}
          </h1>
          ${p.corpo}
        </td></tr>

        <tr><td style="padding:16px 32px 22px;border-top:1px solid #e6e3d8;font-size:11px;color:#9c97b0;">
          <p style="margin:0 0 4px;">
            Respondendo este email você fala diretamente com
            <a href="mailto:${escapeHtml(p.psicologoEmail)}" style="color:#6a4ec8;text-decoration:none;">${escapeHtml(p.psicologoEmail)}</a>.
          </p>
          <p style="margin:0;">
            Audere · CFP 09/2024 · LGPD
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
