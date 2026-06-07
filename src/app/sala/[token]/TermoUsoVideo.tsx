'use client'

import { useState } from 'react'

/**
 * Termo de Consentimento Informado pra Atendimento Psicológico Online.
 * Texto fundamentado em:
 * - Resolução CFP nº 11/2018 (atendimento psicológico online)
 * - Resolução CFP nº 06/2019 (prontuário psicológico)
 * - Resolução CFP nº 09/2024 (uso de IA — sem diagnóstico, sem treino)
 * - Lei nº 13.709/2018 — LGPD (dados pessoais sensíveis de saúde)
 *
 * Quando alterar materialmente o texto, bumpe TERMO_VIDEO_VERSAO no
 * service de salaVideo — pacientes precisarão reaceitar.
 */

type Props = {
  psicologaNome: string
}

export function TermoUsoVideo({ psicologaNome }: Props) {
  const [aberto, setAberto] = useState(false)

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--rsm)',
      background: 'var(--card)', marginBottom: 12,
    }}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          width: '100%', padding: '10px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 12, color: 'var(--ink-soft)', fontWeight: 500,
        }}
      >
        <span>Ler termo completo</span>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{aberto ? '−' : '+'}</span>
      </button>

      {aberto && (
        <div style={{
          padding: '4px 16px 16px',
          fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.65,
        }}>
          <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 16, margin: '6px 0 10px', fontWeight: 500 }}>
            Termo de Consentimento Informado · Atendimento Psicológico Online
          </h4>

          <p style={{ marginTop: 0 }}>
            Você está prestes a participar de uma sessão de psicoterapia online conduzida por{' '}
            <strong>{psicologaNome}</strong>, psicóloga(o) regularmente inscrita(o) no Conselho Regional
            de Psicologia. Antes de entrar na sala, leia com atenção e manifeste sua concordância
            com os pontos abaixo.
          </p>

          <h5 style={Sub}>1. Natureza do atendimento</h5>
          <p>
            O atendimento será realizado por videochamada em tempo real, sem gravação de vídeo
            ou imagem. A escuta clínica respeita os mesmos princípios éticos do atendimento
            presencial, conforme o Código de Ética Profissional do Psicólogo e a Resolução
            CFP nº 11/2018, que regulamenta o atendimento psicológico online no Brasil.
          </p>

          <h5 style={Sub}>2. Uso de Inteligência Artificial como apoio</h5>
          <p>
            Durante a sessão, o áudio da conversa pode ser processado por sistemas de
            transcrição e organização (Inteligência Artificial) com o propósito exclusivo
            de apoiar a continuidade clínica do(a) profissional — isto é, registrar
            observações, frequências e padrões da fala para que a psicóloga possa retomar
            temas em sessões futuras.
          </p>
          <p>
            <strong>A IA do Audere não emite diagnóstico</strong>, não substitui avaliação clínica
            e não interpreta clinicamente o que você relata. Toda nota gerada é um rascunho
            destinado à revisão e assinatura da própria psicóloga, conforme a Resolução CFP
            nº 09/2024.
          </p>

          <h5 style={Sub}>3. Proteção dos seus dados</h5>
          <p>
            Os dados desta sessão (transcrição, resumos e notas clínicas) são armazenados
            criptografados em padrão AES-256-GCM em repouso e protegidos por TLS 1.3 em
            trânsito. <strong>O áudio bruto é descartado imediatamente após a transcrição</strong>
            e nunca é gravado em arquivo. Seus dados <strong>não são utilizados para treinar
            modelos de Inteligência Artificial</strong> de terceiros.
          </p>
          <p>
            O tratamento desses dados se ampara na Lei Geral de Proteção de Dados Pessoais
            (Lei nº 13.709/2018), com base legal em (a) consentimento informado para fins
            de cuidado em saúde e (b) execução de contrato. Você é o(a) titular de seus dados
            e tem direito de acesso, correção, portabilidade, oposição e revogação a qualquer
            momento.
          </p>

          <h5 style={Sub}>4. Sigilo e prontuário</h5>
          <p>
            O sigilo profissional é assegurado nos termos do Código de Ética do(a) psicólogo(a),
            podendo ser rompido apenas nas hipóteses legalmente previstas (risco iminente à vida,
            requisição judicial fundamentada, denúncia de violência contra criança/adolescente
            ou pessoa em vulnerabilidade). O prontuário será mantido pela psicóloga conforme a
            Resolução CFP nº 06/2019, pelo prazo mínimo de 5 anos.
          </p>

          <h5 style={Sub}>5. Limitações do atendimento online</h5>
          <p>
            O atendimento online não é indicado em situações de crise psíquica aguda, ideação
            suicida com risco iminente ou emergências psiquiátricas. Caso esteja em risco,
            procure atendimento presencial ou ligue para o CVV (188) — 24h, gratuito.
          </p>

          <h5 style={Sub}>6. Suas responsabilidades</h5>
          <p>
            Você se compromete a participar da sessão em ambiente reservado, com privacidade
            adequada e equipamento que permita áudio claro. Você declara ter pelo menos 18 anos
            ou estar acompanhado(a) de responsável legal que também consente com o atendimento.
          </p>

          <h5 style={Sub}>7. Revogação</h5>
          <p>
            Você pode revogar este consentimento a qualquer momento, sem prejuízo da continuidade
            clínica, comunicando à psicóloga. A revogação não afeta o tratamento de dados
            realizado anteriormente, mas interrompe novos processamentos.
          </p>

          <p style={{ marginTop: 14, fontSize: 11, color: 'var(--faint)' }}>
            Ao marcar a opção de aceite abaixo e entrar na sala, você declara ter lido,
            compreendido e concordado com este termo. O registro do aceite (data, hora e IP)
            será arquivado como evidência conforme a LGPD.
          </p>
        </div>
      )}
    </div>
  )
}

const Sub: React.CSSProperties = {
  marginTop: 14, marginBottom: 4,
  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500, color: 'var(--ink)',
}
