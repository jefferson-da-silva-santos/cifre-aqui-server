const UNIDADES = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Converte strings simples de duração ("15m", "30d", "2h") em milissegundos.
 * Evita depender de um pacote externo só para isso.
 */
export default function ms(valor) {
  if (typeof valor === "number") return valor;
  const match = /^(\d+)\s*(ms|s|m|h|d)$/.exec(valor.trim());
  if (!match) throw new Error(`Duração inválida: "${valor}"`);
  const [, quantidade, unidade] = match;
  return Number(quantidade) * UNIDADES[unidade];
}
