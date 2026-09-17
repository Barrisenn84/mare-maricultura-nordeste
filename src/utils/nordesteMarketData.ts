import { MarketReferenceItem, RegionalWeatherAlert } from '../types';

/**
 * Base de dados de inteligência de mercado da carcinicultura no Nordeste brasileiro.
 * Fontes de referência: ABCC (Associação Brasileira de Criadores de Camarão),
 * CEASA-CE, Cooperativa dos Produtores de Camarão do RN, SEAGRI-BA e INMET.
 * 
 * REGRA DE ISOLAMENTO: Estes dados são estritamente informativos / comparativos
 * (benchmarks) e NÃO alteram a contabilidade ou os registros fiscais da empresa.
 */

export const NORDESTE_MARKET_REFERENCES: MarketReferenceItem[] = [
  // --- COTAÇÕES DE CAMARÃO VIVO / FRESCO (L. vannamei) ---
  {
    id: 'mkt-shrimp-8-10g-rn',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '8 a 10g (Classificação Miúdo/Médio)',
    unit: 'KG',
    minPrice: 19.5,
    maxPrice: 22.0,
    averagePrice: 20.8,
    region: 'Litoral Sul Potiguar (Tibau do Sul, Goianinha, Canguaretama)',
    state: 'RN',
    source: 'Cooperativa dos Criadores de Camarão do RN / ABCC',
    quotedAt: '15/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Demanda firme para distribuição regional e feiras livres.',
  },
  {
    id: 'mkt-shrimp-10-12g-rn',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '10 a 12g (Classificação Comercial Padrão)',
    unit: 'KG',
    minPrice: 23.0,
    maxPrice: 25.5,
    averagePrice: 24.2,
    region: 'Litoral Sul Potiguar (Tibau do Sul / Canguaretama)',
    state: 'RN',
    source: 'Bolsa de Camarão do RN / Cotação Atacadista',
    quotedAt: '15/09/2026',
    tendency: 'ALTA',
    notes: 'Principal faixa de saída para intermediários e restaurantes da Grande Natal.',
  },
  {
    id: 'mkt-shrimp-12-14g-rn',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '12 a 14g (Classificação Médio/Grande)',
    unit: 'KG',
    minPrice: 27.5,
    maxPrice: 30.0,
    averagePrice: 28.7,
    region: 'Grande Natal e Litoral Oriental',
    state: 'RN',
    source: 'ABCC — Informativo Semanal de Preços',
    quotedAt: '15/09/2026',
    tendency: 'ALTA',
    notes: 'Valorização pela proximidade do período turístico de fim de ano.',
  },
  {
    id: 'mkt-shrimp-14-16g-rn',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '14 a 16g (Classificação Nobre)',
    unit: 'KG',
    minPrice: 32.0,
    maxPrice: 35.5,
    averagePrice: 33.8,
    region: 'Litoral Leste e Sul Potiguar',
    state: 'RN',
    source: 'Rede de Frigoríficos e Distribuidores NE',
    quotedAt: '15/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Produto selecionado para congelamento rápido IQF e hotéis.',
  },
  {
    id: 'mkt-shrimp-18-20g-rn',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '18 a 20g+ (Classificação Especial / GG)',
    unit: 'KG',
    minPrice: 39.0,
    maxPrice: 44.0,
    averagePrice: 41.5,
    region: 'Polo Costa Branca e Litoral Sul',
    state: 'RN',
    source: 'Cooperativa e Exportadores Regionais',
    quotedAt: '15/09/2026',
    tendency: 'ALTA',
    notes: 'Escassez de oferta na faixa acima de 18g; forte prêmio de preço.',
  },
  {
    id: 'mkt-shrimp-10-12g-ce',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '10 a 12g (Padrão Comercial CE)',
    unit: 'KG',
    minPrice: 22.8,
    maxPrice: 25.0,
    averagePrice: 23.9,
    region: 'Baixo Jaguaribe e Aracati',
    state: 'CE',
    source: 'CEASA-CE / Associação Cearense de Criadores de Camarão',
    quotedAt: '14/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Mercado de Fortaleza absorvendo volumes contínuos.',
  },
  {
    id: 'mkt-shrimp-12-14g-ba',
    category: 'CAMARAO_VIVO',
    productName: 'Camarão Inteiro L. vannamei',
    specification: '12 a 14g (Sul da Bahia)',
    unit: 'KG',
    minPrice: 28.0,
    maxPrice: 31.5,
    averagePrice: 29.8,
    region: 'Baixo Sul (Valença, Canavieiras, Santo Amaro)',
    state: 'BA',
    source: 'SEAGRI-BA / Cotação Regional de Aquicultura',
    quotedAt: '15/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Forte demanda pelo mercado de Salvador e litoral turístico baiano.',
  },

  // --- INSUMOS: RAÇÕES PARA CAMARÃO ---
  {
    id: 'mkt-feed-35pb-rn',
    category: 'RACAO',
    productName: 'Ração Camarão Engorda 35% PB',
    specification: 'Pellets 1.6 a 2.0mm — Saco 25kg',
    unit: 'SACO_25KG',
    minPrice: 122.0,
    maxPrice: 132.5,
    averagePrice: 127.0,
    region: 'Polos Potiguares (Natal, Goianinha, Mossoró)',
    state: 'RN',
    source: 'Distribuidores de Nutrição Aquícola (Guabi, Presence, Total)',
    quotedAt: '12/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Equivalente a R$ 5,08/kg a granel. Desconto médio de 4% para pagamento à vista.',
  },
  {
    id: 'mkt-feed-40pb-rn',
    category: 'RACAO',
    productName: 'Ração Camarão Berçário/Inicial 40% PB',
    specification: 'Micro-pellet 1.0 a 1.2mm — Saco 25kg',
    unit: 'SACO_25KG',
    minPrice: 140.0,
    maxPrice: 152.0,
    averagePrice: 146.0,
    region: 'Litoral Potiguar',
    state: 'RN',
    source: 'Revendas Autorizadas de Insumos Aquícolas',
    quotedAt: '12/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Equivalente a R$ 5,84/kg. Alta digestibilidade para berçários intensivos.',
  },

  // --- PÓS-LARVAS (PL-10) ---
  {
    id: 'mkt-pl10-rn',
    category: 'POS_LARVAS',
    productName: 'Pós-Larvas L. vannamei (PL-10)',
    specification: 'Genética melhorada, certificação sanitária WSSV-Free',
    unit: 'MILHEIRO',
    minPrice: 18.0,
    maxPrice: 22.0,
    averagePrice: 20.0,
    region: 'Laboratórios do Litoral Potiguar (Touros, Tibau do Sul, Guamaré)',
    state: 'RN',
    source: 'Laboratórios de Larvicultura Certificados (Aquavita, Aquatec, Maricultura)',
    quotedAt: '14/09/2026',
    tendency: 'ESTAVEL',
    notes: 'Preço posto fazenda com transporte oxigenado incluso até 100 km.',
  },
];

export const NORDESTE_WEATHER_ALERTS: RegionalWeatherAlert[] = [
  {
    id: 'wth-rn-litoral-sul',
    region: 'Litoral Sul Potiguar (Tibau do Sul / Canguaretama / Goianinha)',
    state: 'RN',
    forecastPeriod: '16/09 a 22/09/2026',
    condition: 'PARCIALMENTE_NUBLADO',
    temperatureMinC: 24,
    temperatureMaxC: 31,
    precipitationExpectedMm: 12,
    tidePhase: 'SIZIGIA',
    impactOnPonds: 'Maré de sizígia favorece renovação e captação de água salobra, mas requer atenção às comportas de drenagem. Dias com nebulosidade matinal reduzem fotossíntese do fitoplâncton.',
    operationalRecommendation: 'Manter aeradores em funcionamento preventivo entre 02:00 e 06:30. Aferir oxigênio às 05:00 antes do primeiro arraçoamento.',
    source: 'INMET / CPTEC-INPE / Marinha do Brasil — Tábua de Marés Porto de Natal',
    updatedAt: '16/09/2026 08:00',
  },
  {
    id: 'wth-ce-jaguaribe',
    region: 'Baixo Jaguaribe e Aracati',
    state: 'CE',
    forecastPeriod: '16/09 a 22/09/2026',
    condition: 'ENSOLARADO',
    temperatureMinC: 25,
    temperatureMaxC: 34,
    precipitationExpectedMm: 2,
    tidePhase: 'QUADRATURA',
    impactOnPonds: 'Alta taxa de evaporação com elevação gradual de salinidade nos viveiros (podendo superar 38 ppm). Consumo de oxigênio elevado no final da tarde.',
    operationalRecommendation: 'Acompanhar salinidade a cada 48h. Evitar arraçoamento excessivo nos horários de pico térmico (11:30 às 14:00).',
    source: 'FUNCEME / INMET',
    updatedAt: '16/09/2026 07:30',
  },
  {
    id: 'wth-ba-baixo-sul',
    region: 'Baixo Sul da Bahia (Valença / Canavieiras)',
    state: 'BA',
    forecastPeriod: '16/09 a 22/09/2026',
    condition: 'CHUVA_MODERADA',
    temperatureMinC: 22,
    temperatureMaxC: 28,
    precipitationExpectedMm: 35,
    tidePhase: 'SIZIGIA',
    impactOnPonds: 'Queda súbita de salinidade nas camadas superficiais (estratificação da coluna d’água) e risco de descarte precoce de fitoplâncton.',
    operationalRecommendation: 'Misturar a coluna d’água com aeradores mecânicos imediatamente após chuvas. Dosar calcário dolomítico para correção de alcalinidade se pH cair abaixo de 7.5.',
    source: 'INMET / SEAGRI-BA',
    updatedAt: '16/09/2026 06:45',
  },
];

/**
 * Função utilitária para comparar o custo real de um lote com a média do mercado do Nordeste.
 */
export function compareBatchWithNordesteBenchmark(
  batchAverageWeightG: number,
  batchUnitCost: number,
  state: 'RN' | 'CE' | 'PB' | 'BA' = 'RN'
): {
  closestSpecification: string;
  marketAveragePrice: number;
  marketMinPrice: number;
  marketMaxPrice: number;
  estimatedMarginPerKg: number;
  marginPercent: number;
  status: 'OTIMA_MARGEM' | 'MARGEM_ACEITAVEL' | 'ALERTA_CUSTO_ALTO';
  source: string;
} {
  // Determina faixa de gramatura mais próxima
  let spec = '10 a 12g (Classificação Comercial Padrão)';
  if (batchAverageWeightG < 10) spec = '8 a 10g (Classificação Miúdo/Médio)';
  else if (batchAverageWeightG <= 12) spec = '10 a 12g (Classificação Comercial Padrão)';
  else if (batchAverageWeightG <= 14) spec = '12 a 14g (Classificação Médio/Grande)';
  else if (batchAverageWeightG <= 16) spec = '14 a 16g (Classificação Nobre)';
  else spec = '18 a 20g+ (Classificação Especial / GG)';

  const found = NORDESTE_MARKET_REFERENCES.find(
    (m) => m.category === 'CAMARAO_VIVO' && m.specification.includes(spec.split(' ')[0]) && (m.state === state || m.state === 'RN')
  ) || NORDESTE_MARKET_REFERENCES[1];

  const marketAvg = found.averagePrice;
  const estimatedMargin = marketAvg - batchUnitCost;
  const marginPct = marketAvg > 0 ? (estimatedMargin / marketAvg) * 100 : 0;

  let status: 'OTIMA_MARGEM' | 'MARGEM_ACEITAVEL' | 'ALERTA_CUSTO_ALTO' = 'MARGEM_ACEITAVEL';
  if (marginPct >= 35) status = 'OTIMA_MARGEM';
  else if (marginPct < 15) status = 'ALERTA_CUSTO_ALTO';

  return {
    closestSpecification: found.specification,
    marketAveragePrice: marketAvg,
    marketMinPrice: found.minPrice,
    marketMaxPrice: found.maxPrice,
    estimatedMarginPerKg: Number(estimatedMargin.toFixed(2)),
    marginPercent: Number(marginPct.toFixed(1)),
    status,
    source: `${found.source} (${found.quotedAt} — ${found.region})`,
  };
}
