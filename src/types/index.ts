export enum OrderStatus {
  PENDENTE = 'PENDENTE',
  PAGO = 'PAGO',
  EM_PRODUCAO = 'EM_PRODUCAO',
  PRONTO = 'PRONTO',
  ENTREGUE = 'ENTREGUE',
}

export enum OrderOrigin {
  WHATSAPP_IA = 'WHATSAPP_IA',
  CARDAPIO_WEB = 'CARDAPIO_WEB',
  MANUAL = 'MANUAL',
}

export enum DeliveryType {
  ENTREGA = 'ENTREGA',
  RETIRADA = 'RETIRADA',
}

export interface AuthSession {
  token: string;
  tenantId: string;
  nome: string;
  email: string;
}

export interface Product {
  id: string;
  nome: string;
  descricao: string;
  pesoGramas: number;
  precoVenda: number;
  custoEstimado: number;
  estoqueAtual: number;
  ativo: boolean;
  imagemUrl: string;
  destaque?: string;
}

export interface OrderItem {
  produtoId: string;
  nomeProduto: string;
  pesoGramas: number;
  quantidade: number;
  precoUnitario: number;
}

export interface Order {
  id: string;
  codigo: string;
  clienteNome: string;
  clienteWhatsapp: string;
  horarioEntrega: string;
  tipoEntrega: DeliveryType;
  endereco?: string;
  observacoes?: string;
  itens: OrderItem[];
  subtotal: number;
  taxaEntrega: number;
  valorTotal: number;
  status: OrderStatus;
  origem: OrderOrigin;
  criadoEm: string;
}

export interface AiTokenUsage {
  tokensUsados: number;
  limiteMensal: number;
  plano: string;
  atendimentosMes: number;
  conversaoPercentual: number;
  cicloRenovacao: string;
}

export interface StoreConfig {
  tenantId: string;
  nomeLoja: string;
  slug: string;
  subtitulo: string;
  taxaEntregaPadrao: number;
  whatsappId: string;
  whatsappConectado: boolean;
  abertaParaEncomendas: boolean;
  tempoPreparoMedio: string;
  enderecoRetirada: string;
  tomDeVozIa: string;
  bannerUrl: string;
  consumoIa: AiTokenUsage;
}

export interface CreatePublicOrderPayload {
  clienteNome: string;
  clienteWhatsapp: string;
  tipoEntrega: DeliveryType;
  endereco?: string;
  horarioEntrega: string;
  observacoes?: string;
  itens: Array<{
    produtoId: string;
    quantidade: number;
  }>;
}

export interface PublicMenuResponse {
  loja: Pick<
    StoreConfig,
    | 'nomeLoja'
    | 'slug'
    | 'subtitulo'
    | 'taxaEntregaPadrao'
    | 'abertaParaEncomendas'
    | 'tempoPreparoMedio'
    | 'enderecoRetirada'
    | 'bannerUrl'
    | 'whatsappId'
  >;
  produtos: Product[];
}
