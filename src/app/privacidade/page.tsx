import { Nav } from '../lancamento/v2/nav'
import { Footer } from '../lancamento/v2/sections-close'

/**
 * Política de Privacidade — página pública. É a URL exigida pela Meta pra
 * publicar o app do WhatsApp (Cloud API) e o documento de referência da LGPD
 * pro cadastro, pro consentimento do paciente e pro rodapé da landing.
 *
 * Texto operacional, alinhado ao que o produto faz de fato (ver CLAUDE.md §2
 * e §14). Mudou o tratamento, muda aqui — e o "Atualizada em" abaixo.
 */
const ATUALIZADA_EM = '11 de setembro de 2026'
const CONTATO = 'contato@automaxia.com.br'

export default function PrivacidadePage() {
  return (
    <div className="lp" style={{ background: 'var(--page)', color: 'var(--ink)', fontFamily: 'var(--f-body)' }}>
      <Nav />

      <main className="wrap" style={{ paddingTop: 'clamp(110px, 12vw, 160px)', paddingBottom: 80, maxWidth: 860 }}>
        <p className="eyebrow-sm" style={{ color: 'var(--accent)' }}>Privacidade</p>
        <h1 className="serif" style={{ fontSize: 'clamp(32px,4.2vw,52px)', marginTop: 14 }}>
          Política de <em style={{ color: 'var(--accent)' }}>Privacidade</em>
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 14 }}>Atualizada em {ATUALIZADA_EM}.</p>

        <div className="priv-doc">
          <p>
            A <strong>Audere</strong> é uma plataforma de apoio à prática clínica de psicólogos, operada por
            <strong> AUTOMAXIA INTELIGENCIA PARA NEGOCIOS LTDA</strong> (“Automaxia”, “nós”). Esta política explica
            quais dados tratamos, por quê, por quanto tempo e quais são os seus direitos, em conformidade com a
            Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD), com a Resolução CFP 11/2018 e com a
            Resolução CFP 09/2024.
          </p>

          <h2>1. Quem somos e quem é responsável</h2>
          <p>
            Para os dados de <strong>psicólogos(as)</strong> cadastrados na plataforma, a Automaxia é a
            <strong> controladora</strong>. Para os dados de <strong>pacientes</strong>, o(a) psicólogo(a) responsável
            pelo atendimento é o(a) controlador(a) e a Automaxia atua como <strong>operadora</strong>, tratando os
            dados exclusivamente conforme as instruções do(a) profissional e para as finalidades desta política.
          </p>

          <h2>2. Quais dados tratamos</h2>
          <ul>
            <li><strong>Do(a) psicólogo(a):</strong> nome, CRP, e-mail, telefone, CPF, dados de cobrança e de recebimento (via Pagar.me), preferências de uso.</li>
            <li><strong>Do paciente:</strong> nome, telefone (WhatsApp), e-mail (opcional), agenda de sessões, status de pagamento, histórico das conversas por WhatsApp com a plataforma e registro do consentimento (data e hora).</li>
            <li><strong>Dados clínicos:</strong> transcrições de sessão, resumos, notas, temas recorrentes, objetivos terapêuticos e demais anotações produzidas ou revisadas pelo(a) psicólogo(a). São <strong>dados sensíveis</strong> e recebem a proteção descrita na seção 6.</li>
            <li><strong>Técnicos:</strong> registros de acesso (data, hora, IP), identificadores de sessão e métricas de uso necessárias à segurança e ao funcionamento do serviço.</li>
          </ul>

          <h2>3. Para que usamos</h2>
          <ul>
            <li>Operar a agenda, a cobrança e a confirmação de sessões.</li>
            <li>Enviar, <strong>pelo WhatsApp</strong>, mensagens transacionais ao paciente: boas-vindas e link de consentimento, lembretes de sessão, pedidos e confirmações de pagamento, link da sala de vídeo e mensagem pós-sessão. Não enviamos publicidade por esse canal.</li>
            <li>Transcrever a sessão (quando o(a) psicólogo(a) ativa o recurso e o paciente consentiu) e gerar <strong>rascunhos</strong> de resumo e observações, que só passam a integrar o prontuário após revisão e assinatura do(a) profissional.</li>
            <li>Apoiar a continuidade clínica com análises de frequência e padrão ao longo das sessões. A tecnologia <strong>não emite diagnóstico</strong> nem substitui a avaliação do(a) psicólogo(a).</li>
            <li>Cumprir obrigações legais, emitir documentos fiscais e prevenir fraudes.</li>
          </ul>

          <h2>4. Bases legais</h2>
          <p>
            Tratamos dados com fundamento na <strong>execução do contrato</strong> com o(a) psicólogo(a), no
            <strong> consentimento</strong> do paciente (colhido por link enviado pelo WhatsApp, com registro de data e
            hora, e revogável a qualquer momento), na <strong>tutela da saúde</strong> em procedimento realizado por
            profissional de saúde (art. 11, II, “f”, da LGPD), no <strong>cumprimento de obrigação legal</strong> e no
            <strong> legítimo interesse</strong> restrito à segurança e à melhoria do serviço.
          </p>

          <h2>5. WhatsApp</h2>
          <p>
            A comunicação com o paciente é feita pela <strong>WhatsApp Business Platform</strong> (Meta). Ao usar esse
            canal, o número de telefone e o conteúdo das mensagens trafegam pela infraestrutura da Meta, sujeitos
            à política de privacidade dela. A plataforma registra as mensagens trocadas para que o(a) psicólogo(a)
            possa acompanhar a conversa; não usamos esse histórico para fins publicitários. O paciente pode pedir a
            interrupção das mensagens respondendo ao próprio WhatsApp ou pelo canal de contato abaixo.
          </p>

          <h2>6. Inteligência artificial e dados clínicos</h2>
          <ul>
            <li>Áudio de sessão é capturado, transcrito e <strong>descartado imediatamente</strong>; não armazenamos gravações.</li>
            <li>Transcrições, resumos e notas clínicas são cifrados em repouso (AES-256) e em trânsito (TLS).</li>
            <li>Utilizamos provedores de IA (OpenAI, Anthropic e AssemblyAI) sob contratos que <strong>proíbem o uso dos seus dados para treinar modelos</strong>. Nenhum dado de paciente é usado para treinamento.</li>
            <li>Todo texto gerado por IA é um rascunho identificado como tal e depende de revisão e assinatura do(a) psicólogo(a).</li>
          </ul>

          <h2>7. Com quem compartilhamos</h2>
          <p>
            Apenas com operadores necessários ao serviço: Meta (WhatsApp), Pagar.me (pagamentos), Resend (e-mail),
            provedores de IA citados acima e a infraestrutura de hospedagem. Cada um trata os dados sob contrato e
            somente para a finalidade contratada. Não vendemos dados pessoais.
          </p>

          <h2>8. Por quanto tempo guardamos</h2>
          <p>
            Dados clínicos seguem o prazo mínimo de guarda de prontuário definido pelo Conselho Federal de
            Psicologia (Resolução CFP 01/2009 — 5 anos), sob responsabilidade do(a) psicólogo(a). Dados de conta e
            cobrança são mantidos enquanto durar o contrato e pelos prazos legais fiscais. Registros técnicos são
            mantidos por até 6 meses (Marco Civil da Internet). Ao encerrar a conta, o(a) psicólogo(a) pode exportar
            os dados antes da exclusão.
          </p>

          <h2>9. Seus direitos</h2>
          <p>
            Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, exclusão
            e informação sobre compartilhamentos, além de revogar o consentimento. Pedidos de pacientes sobre dados
            clínicos são encaminhados ao(à) psicólogo(a) responsável, controlador(a) desses dados. Escreva para
            <a href={`mailto:${CONTATO}`}> {CONTATO}</a>. Respondemos em até 15 dias.
          </p>

          <h2>10. Segurança</h2>
          <p>
            Controle de acesso por conta individual, cifragem em repouso e em trânsito, registro de operações,
            segregação por psicólogo(a) e revisão de permissões. Incidentes de segurança relevantes são comunicados
            aos titulares afetados e à ANPD conforme a LGPD.
          </p>

          <h2>11. Alterações</h2>
          <p>
            Esta política pode ser atualizada. A data no topo indica a versão vigente; mudanças relevantes são
            comunicadas por e-mail ao(à) psicólogo(a).
          </p>

          <h2>12. Contato e encarregado (DPO)</h2>
          <p>
            AUTOMAXIA INTELIGENCIA PARA NEGOCIOS LTDA — encarregado pelo tratamento de dados:
            <a href={`mailto:${CONTATO}`}> {CONTATO}</a>.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
