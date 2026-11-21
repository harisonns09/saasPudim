import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Save,
  Bot,
  MessageCircle,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { AdminLayout } from '../components/AdminLayout';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { StoreConfig } from '../types';
import { formatCurrency, formatInteger, slugify } from '../utils/format';

const TONE_PRESETS = [
  {
    label: 'Acolhedor & Artesanal',
    text: 'Atenda com carinho e elegância de confeitaria artesanal, usando linguagem acolhedora, clara e objetiva. Sempre destaque a cremosidade sem furinhos, confirme o peso desejado (500g ou 1kg), informe a taxa de entrega e sugira nosso Pudim de Pistache quando o cliente pedir uma recomendação especial.',
  },
  {
    label: 'Direto & Rápido',
    text: 'Seja cordial, direto e ágil. Apresente imediatamente os sabores com estoque disponível, informe preço, peso e taxa de entrega na primeira resposta e conduza o cliente para fechar o pedido em até 3 mensagens.',
  },
  {
    label: 'Boutique Gourmet',
    text: 'Use tom refinado de patisserie boutique. Valorize ingredientes selecionados como pistache siciliano, doce de leite argentino e fava de baunilha. Ofereça embalagem para presente e cartão personalizado ao finalizar.',
  },
];

function buildAiPreviewReply(config: StoreConfig): string {
  const toneLower = config.tomDeVozIa.toLowerCase();
  const deliveryFeeText =
    config.taxaEntregaPadrao > 0
      ? `a taxa de entrega padrão é ${formatCurrency(config.taxaEntregaPadrao)} (ou retirada gratuita na loja)`
      : 'a entrega está com frete grátis hoje';

  if (toneLower.includes('direto') || toneLower.includes('rápido') || toneLower.includes('ágil')) {
    return `Olá! Aqui é o atendimento da ${config.nomeLoja}. Temos hoje: Tradicional 1kg (R$ 89), Pistache 1kg (R$ 138) e Doce de Leite 500g (R$ 62). Para sua região, ${deliveryFeeText}. Qual sabor e horário você prefere para reservarmos?`;
  }

  if (toneLower.includes('boutique') || toneLower.includes('refinado') || toneLower.includes('presente')) {
    return `Seja bem-vindo à ${config.nomeLoja}. Nossos pudins são assados em banho-maria lento para uma textura sedosa impecável. Hoje destacamos o Pistache Siciliano (1kg, R$ 138) e o Clássico de Leite Condensado (1kg, R$ 89) — ${deliveryFeeText}. Deseja incluir embalagem para presente?`;
  }

  return `Olá! Que alegria receber sua mensagem na ${config.nomeLoja}. Nossos pudins são feitos artesanalmente, bem cremosos e sem furinhos. Para um jantar especial, recomendo o nosso Pudim de Pistache 1kg (R$ 138) ou o Tradicional 1kg (R$ 89). Lembrando que ${deliveryFeeText}. Prefere 500g ou 1kg?`;
}

export function SettingsPage() {
  const { isDemoMode, navigate, setStoreSlug, setStoreName, pushToast } = useApp();
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStoreConfig();
      setConfig(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar as configurações da loja.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig, isDemoMode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const cleanedSlug = slugify(config.slug || config.nomeLoja) || 'pudim-da-maria';
      const updated = await api.updateStoreConfig({
        ...config,
        slug: cleanedSlug,
      });
      setConfig(updated);
      setStoreSlug(updated.slug);
      setStoreName(updated.nomeLoja);
      pushToast({
        title: 'Configurações salvas',
        description: `Cardápio /loja/${updated.slug} e agente de IA atualizados.`,
        tone: 'success',
      });
    } catch (err) {
      pushToast({
        title: 'Erro ao salvar configurações',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const tokenPercent = useMemo(() => {
    if (!config || config.consumoIa.limiteMensal <= 0) return 0;
    return Math.min(
      100,
      (config.consumoIa.tokensUsados / config.consumoIa.limiteMensal) * 100
    );
  }, [config]);

  const aiPreviewReply = useMemo(() => {
    if (!config) return '';
    return buildAiPreviewReply(config);
  }, [config]);

  return (
    <AdminLayout
      title="Agente de IA & Configurações da Loja"
      sectionLabel="Agente de IA & Loja"
      topBarAction={
        config && (
          <button
            type="button"
            onClick={() => navigate(`/loja/${config.slug}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#DFD2C0] bg-white px-3.5 py-2 text-xs font-semibold text-[#291D16] transition-colors hover:border-[#B45309] hover:text-[#B45309] whitespace-nowrap shrink-0 sm:text-sm"
          >
            <span>Abrir Cardápio</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )
      }
    >
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadConfig}
            className="inline-flex items-center gap-1.5 font-semibold underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Recarregar
          </button>
        </div>
      )}

      {loading || !config ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl border border-[#EAE1D5] bg-white lg:col-span-7" />
          <div className="h-96 animate-pulse rounded-xl border border-[#EAE1D5] bg-white lg:col-span-5" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          {/* Left Column: Store & AI Settings Form */}
          <div className="space-y-6 lg:col-span-7">
            <section className="rounded-xl border border-[#EAE1D5] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0E8DD] pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#291D16]">
                    Identidade e operação da loja
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7A6658]">
                    Esses dados aparecem no cabeçalho do cardápio público e nas mensagens da IA.
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-[#291D16]">
                  <span>
                    {config.abertaParaEncomendas ? 'Aberta para encomendas' : 'Loja fechada'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.abertaParaEncomendas}
                    onClick={() =>
                      setConfig({
                        ...config,
                        abertaParaEncomendas: !config.abertaParaEncomendas,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      config.abertaParaEncomendas ? 'bg-emerald-700' : 'bg-[#D6C9B8]'
                    }`}
                  >
                    <span
                      className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white transition-transform ${
                        config.abertaParaEncomendas ? 'translate-x-5.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cfg-store-name"
                    className="block text-sm font-medium text-[#291D16]"
                  >
                    Nome da loja
                  </label>
                  <input
                    id="cfg-store-name"
                    type="text"
                    required
                    value={config.nomeLoja}
                    onChange={(e) =>
                      setConfig({ ...config, nomeLoja: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] px-3.5 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cfg-slug"
                    className="block text-sm font-medium text-[#291D16]"
                  >
                    Slug da URL (Multi-Tenant)
                  </label>
                  <div className="mt-1.5 flex items-center rounded-lg border border-[#DFD4C6] bg-[#FAF7F2] focus-within:border-[#B45309] focus-within:ring-2 focus-within:ring-[#B45309]/15">
                    <span className="pl-3 font-mono text-xs text-[#7A6658]">/loja/</span>
                    <input
                      id="cfg-slug"
                      type="text"
                      required
                      value={config.slug}
                      onChange={(e) =>
                        setConfig({ ...config, slug: e.target.value.toLowerCase() })
                      }
                      className="w-full rounded-r-lg bg-white px-2 py-2 font-mono text-sm text-[#291D16] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="cfg-fee"
                    className="block text-sm font-medium text-[#291D16]"
                  >
                    Taxa de entrega padrão (R$)
                  </label>
                  <input
                    id="cfg-fee"
                    type="number"
                    min={0}
                    step="0.50"
                    required
                    value={config.taxaEntregaPadrao}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        taxaEntregaPadrao: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] px-3.5 py-2 font-mono text-sm tabular-nums text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cfg-whatsapp"
                    className="block text-sm font-medium text-[#291D16]"
                  >
                    ID / Número do WhatsApp conectado
                  </label>
                  <input
                    id="cfg-whatsapp"
                    type="text"
                    required
                    value={config.whatsappId}
                    onChange={(e) =>
                      setConfig({ ...config, whatsappId: e.target.value })
                    }
                    placeholder="+55 11 98765-4321"
                    className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] px-3.5 py-2 font-mono text-sm tabular-nums text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="cfg-address"
                    className="block text-sm font-medium text-[#291D16]"
                  >
                    Endereço para retirada
                  </label>
                  <input
                    id="cfg-address"
                    type="text"
                    value={config.enderecoRetirada}
                    onChange={(e) =>
                      setConfig({ ...config, enderecoRetirada: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-[#DFD4C6] px-3.5 py-2 text-sm text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                  />
                </div>
              </div>
            </section>

            {/* AI Tone of Voice */}
            <section className="rounded-xl border border-[#EAE1D5] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0E8DD] pb-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#291D16]">
                    Tom de voz da Inteligência Artificial
                  </h2>
                  <p className="mt-0.5 text-xs text-[#7A6658]">
                    Defina a personalidade do atendente de WhatsApp ao receber novos clientes.
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  WhatsApp conectado
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {TONE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setConfig({ ...config, tomDeVozIa: preset.text })}
                    className="rounded-lg border border-[#E4D8C7] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#5C4A3E] transition-colors hover:border-[#B45309] hover:text-[#B45309]"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="cfg-ai-tone"
                  className="block text-sm font-medium text-[#291D16]"
                >
                  Instruções de comportamento e atendimento
                </label>
                <textarea
                  id="cfg-ai-tone"
                  rows={5}
                  value={config.tomDeVozIa}
                  onChange={(e) =>
                    setConfig({ ...config, tomDeVozIa: e.target.value })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DFD4C6] px-3.5 py-2.5 text-sm leading-relaxed text-[#291D16] focus:border-[#B45309] focus:outline-none focus:ring-2 focus:ring-[#B45309]/15"
                />
              </div>

              <div className="mt-5 flex justify-end border-t border-[#F0E8DD] pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#B45309] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#92400E] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  <span>{saving ? 'Salvando...' : 'Salvar configurações'}</span>
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: AI Token Usage + Live WhatsApp Preview */}
          <div className="space-y-6 lg:col-span-5">
            {/* Monthly AI Token Usage Card */}
            <section className="rounded-xl border border-[#EAE1D5] bg-white p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#7A6658]">
                    Consumo de Tokens de IA do Mês
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-[#291D16]">
                    {config.consumoIa.plano}
                  </h2>
                </div>
                <Sparkles className="h-5 w-5 text-[#B45309]" />
              </div>

              <div className="mt-5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-2xl font-semibold text-[#291D16] tabular-nums">
                    {formatInteger(config.consumoIa.tokensUsados)}
                  </p>
                  <p className="font-mono text-xs text-[#7A6658] tabular-nums">
                    de {formatInteger(config.consumoIa.limiteMensal)} tokens
                  </p>
                </div>

                <div
                  className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[#F1E8DC]"
                  role="progressbar"
                  aria-valuenow={Math.round(tokenPercent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-[#D97706] transition-all duration-300"
                    style={{ width: `${tokenPercent}%` }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs text-[#6B574A]">
                  <span className="font-mono font-semibold text-[#B45309] tabular-nums">
                    {tokenPercent.toFixed(1).replace('.', ',')}% utilizado
                  </span>
                  <span>{config.consumoIa.cicloRenovacao}</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[#F0E8DD] pt-4 text-xs">
                <div>
                  <p className="text-[#7A6658]">Atendimentos no mês</p>
                  <p className="mt-1 font-mono text-base font-semibold text-[#291D16] tabular-nums">
                    {config.consumoIa.atendimentosMes}
                  </p>
                </div>
                <div>
                  <p className="text-[#7A6658]">Conversão em pedido</p>
                  <p className="mt-1 font-mono text-base font-semibold text-emerald-800 tabular-nums">
                    {config.consumoIa.conversaoPercentual.toFixed(1).replace('.', ',')}%
                  </p>
                </div>
              </div>
            </section>

            {/* Live AI Response Preview */}
            <section className="rounded-xl border border-[#EAE1D5] bg-white p-6">
              <div className="flex items-center justify-between border-b border-[#F0E8DD] pb-3.5">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4.5 w-4.5 text-emerald-700" />
                  <h2 className="font-display text-base font-semibold text-[#291D16]">
                    Preview de resposta no WhatsApp
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-[#7A6658]">
                  Simulação em tempo real
                </span>
              </div>

              <div className="mt-4 space-y-3 rounded-xl border border-[#EBE2D6] bg-[#FAF7F2] p-4">
                {/* Customer bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#291D16] px-3.5 py-2.5 text-xs leading-relaxed text-[#FAF7F2]">
                    Oi! Quero encomendar um pudim bem gostoso para um jantar hoje à noite.
                    Qual vocês indicam e quanto fica a entrega?
                  </div>
                </div>

                {/* AI agent bubble */}
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-800">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-[#E6DCD0] bg-white px-3.5 py-2.5 text-xs leading-relaxed text-[#291D16]">
                    <p className="mb-1 text-[11px] font-semibold text-[#B45309]">
                      Agente IA · {config.nomeLoja}
                    </p>
                    <p>{aiPreviewReply}</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </form>
      )}
    </AdminLayout>
  );
}
