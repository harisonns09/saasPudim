export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatWeight(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) {
    return `${grams / 1000}kg`;
  }
  if (grams >= 1000) {
    return `${(grams / 1000).toFixed(1).replace('.', ',')}kg`;
  }
  return `${grams}g`;
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(value));
}

export function calculateProfitMargin(precoVenda: number, custoEstimado: number): number {
  if (precoVenda <= 0) return 0;
  return ((precoVenda - custoEstimado) / precoVenda) * 100;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
