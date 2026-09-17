import {
  CompanyConfig,
  Batch,
  WaterMeasurement,
  Incident,
  InventoryItem,
  SalesOrder,
  ReceivableBill,
  AppDocument,
} from './types';

export const INITIAL_COMPANY_CONFIG: CompanyConfig = {
  id: 'mari-ne-001',
  name: 'Maricultura Nordeste Ltda.',
  cnpj: 'A confirmar',
  modality: 'AMBAS',
  units: ['Fazenda Maré Barra', 'Unidade Litoral Sul'],
  activeUnit: 'Fazenda Maré Barra',
  ownerName: 'José da Silva (Proprietário)',
  primaryProblem: 'Controlar custos por lote em tempo real e conciliar pedidos com estoque liberado',
  systemsInUse: 'Planilhas dispersas e anotações de campo em caderno',
};

// DEMO SCENARIO DATA (STRICTLY CONFORMING TO SECTION 14)
export const DEMO_BATCHES: Batch[] = [
  {
    id: 'batch-demo-a',
    code: 'LOTE DEMO-A',
    unit: 'Fazenda Maré Barra',
    pondId: 'Viveiro 01 (Engorda)',
    species: 'Litopenaeus vannamei',
    modality: 'ENGORDA',
    status: 'ENCERRADO',
    startDate: '2026-06-01',
    endDate: '2026-09-10',
    responsible: 'Manoel Aquacultor',
    initialBiomassKg: 10,
    finalBiomassKg: 1000,
    sellableQuantity: 1000,
    sellableUnit: 'KG',
    feedConsumedKg: 1500,
    budgetedCostPerUnit: 20.0, // Orçamento fictício de R$ 20/kg
    hasSurvivalData: false, // Regra estrita: Não inventar contagens para calcular sobrevivência deste lote
    notes: 'Lote encerrado conforme padrão técnico. Sem transferências ou despescas parciais.',
    costs: [
      {
        id: 'cost-1',
        category: 'RACAO',
        description: 'Ração 35% proteína bruta (30 sacas)',
        amount: 12000,
        quantity: 1500,
        unit: 'KG',
        date: '2026-07-15',
        invoiceNumber: 'NF-8921',
        status: 'CONFERIDO',
      },
      {
        id: 'cost-2',
        category: 'POS_LARVAS',
        description: 'Pós-larvas PL-10 certificadas',
        amount: 1500,
        date: '2026-06-01',
        invoiceNumber: 'NF-8800',
        status: 'CONFERIDO',
      },
      {
        id: 'cost-3',
        category: 'ENERGIA',
        description: 'Energia elétrica atribuída (aeradores e bombeamento)',
        amount: 2500,
        date: '2026-08-30',
        invoiceNumber: 'FAT-COELBA-08',
        status: 'CONFERIDO',
      },
      {
        id: 'cost-4',
        category: 'MAO_DE_OBRA',
        description: 'Mão de obra direta de manejo e arraçoamento',
        amount: 3000,
        date: '2026-09-05',
        status: 'CONFERIDO',
      },
      {
        id: 'cost-5',
        category: 'OUTROS',
        description: 'Insumos de calagem, probióticos e análise laboratorial',
        amount: 2000,
        date: '2026-08-20',
        status: 'CONFERIDO',
      },
    ],
    biometrics: [
      { id: 'bio-demo-1', date: '2026-06-01', dayOfCulture: 0, week: 0, averageWeightG: 0.02, gmdPeriodG: 0, gmdAccumulatedG: 0, sampleSize: 200, uniformityPercent: 95, notes: 'Povoamento com PL-10 aclimatadas' },
      { id: 'bio-demo-2', date: '2026-06-15', dayOfCulture: 14, week: 2, averageWeightG: 0.50, gmdPeriodG: 0.034, gmdAccumulatedG: 0.034, sampleSize: 100, uniformityPercent: 88, notes: 'Transição para ração peletizada inicial' },
      { id: 'bio-demo-3', date: '2026-06-29', dayOfCulture: 28, week: 4, averageWeightG: 1.80, gmdPeriodG: 0.093, gmdAccumulatedG: 0.064, sampleSize: 100, uniformityPercent: 86, notes: 'Bom consumo nas bandejas de alimentação' },
      { id: 'bio-demo-4', date: '2026-07-13', dayOfCulture: 42, week: 6, averageWeightG: 4.10, gmdPeriodG: 0.164, gmdAccumulatedG: 0.097, sampleSize: 100, uniformityPercent: 89, notes: 'Início da fase de crescimento acelerado' },
      { id: 'bio-demo-5', date: '2026-07-27', dayOfCulture: 56, week: 8, averageWeightG: 6.90, gmdPeriodG: 0.200, gmdAccumulatedG: 0.123, sampleSize: 100, uniformityPercent: 91, notes: 'Ótima qualidade de água e aeração contínua' },
      { id: 'bio-demo-6', date: '2026-08-10', dayOfCulture: 70, week: 10, averageWeightG: 9.80, gmdPeriodG: 0.207, gmdAccumulatedG: 0.140, sampleSize: 100, uniformityPercent: 90, notes: 'Pico de ganho de peso diário zootécnico' },
      { id: 'bio-demo-7', date: '2026-08-24', dayOfCulture: 84, week: 12, averageWeightG: 12.40, gmdPeriodG: 0.186, gmdAccumulatedG: 0.147, sampleSize: 100, uniformityPercent: 87, notes: 'Ajuste de arraçoamento para evitar sobra' },
      { id: 'bio-demo-8', date: '2026-09-10', dayOfCulture: 101, week: 15, averageWeightG: 15.20, gmdPeriodG: 0.165, gmdAccumulatedG: 0.150, sampleSize: 150, uniformityPercent: 92, notes: 'Biometria pré-despesca comercial finalizada' },
    ],
  },
  {
    id: 'batch-demo-larva',
    code: 'LOTE LARVA-01',
    unit: 'Unidade Litoral Sul',
    pondId: 'Berçário 04',
    species: 'Litopenaeus vannamei',
    modality: 'LARVICULTURA',
    status: 'ENCERRADO',
    startDate: '2026-07-01',
    endDate: '2026-08-15',
    responsible: 'Dra. Luísa Geneticista',
    sellableQuantity: 2000, // 2.000 milheiros (equivalente a 2.000.000 pós-larvas)
    sellableUnit: 'MILHEIRO',
    hasSurvivalData: true,
    initialPopulationCount: 2300000,
    finalPopulationCount: 2000000,
    notes: 'Exemplo separado de larvicultura. 2.000 milheiros produzidos a R$ 20,00 por milheiro.',
    costs: [
      {
        id: 'c-larv-1',
        category: 'RACAO',
        description: 'Artemia salina e dietas microencapsuladas',
        amount: 18000,
        date: '2026-07-20',
        status: 'CONFERIDO',
      },
      {
        id: 'c-larv-2',
        category: 'ENERGIA',
        description: 'Aquecimento e iluminação fotoperíodo',
        amount: 10000,
        date: '2026-08-01',
        status: 'CONFERIDO',
      },
      {
        id: 'c-larv-3',
        category: 'MAO_DE_OBRA',
        description: 'Equipe técnica laboratorial especializada',
        amount: 12000,
        date: '2026-08-10',
        status: 'CONFERIDO',
      },
    ],
  },
  {
    id: 'batch-demo-b',
    code: 'LOTE DEMO-B',
    unit: 'Fazenda Maré Barra',
    pondId: 'Viveiro 02 (Engorda)',
    species: 'Litopenaeus vannamei',
    modality: 'ENGORDA',
    status: 'EM_ANDAMENTO',
    startDate: '2026-07-20',
    responsible: 'Manoel Aquacultor',
    initialBiomassKg: 12,
    sellableQuantity: 450,
    sellableUnit: 'KG',
    feedConsumedKg: 620,
    budgetedCostPerUnit: 20.0,
    hasSurvivalData: false,
    notes: 'Lote ativo em fase intermediária de engorda. Excelente taxa de crescimento.',
    costs: [
      {
        id: 'cost-b-1',
        category: 'RACAO',
        description: 'Ração crescimento 38% PB',
        amount: 4800,
        quantity: 620,
        unit: 'KG',
        date: '2026-08-15',
        status: 'CONFERIDO',
      },
      {
        id: 'cost-b-2',
        category: 'POS_LARVAS',
        description: 'Pós-larvas PL-10 povoamento',
        amount: 1600,
        date: '2026-07-20',
        status: 'CONFERIDO',
      },
    ],
    biometrics: [
      { id: 'bio-b-1', date: '2026-07-20', dayOfCulture: 0, week: 0, averageWeightG: 0.02, gmdPeriodG: 0, gmdAccumulatedG: 0, sampleSize: 200, uniformityPercent: 96, notes: 'Povoamento regular' },
      { id: 'bio-b-2', date: '2026-08-03', dayOfCulture: 14, week: 2, averageWeightG: 0.55, gmdPeriodG: 0.038, gmdAccumulatedG: 0.038, sampleSize: 100, uniformityPercent: 90, notes: 'Aclimação e sobrevivência inicial elevadas' },
      { id: 'bio-b-3', date: '2026-08-17', dayOfCulture: 28, week: 4, averageWeightG: 2.10, gmdPeriodG: 0.111, gmdAccumulatedG: 0.074, sampleSize: 100, uniformityPercent: 88, notes: 'Crescimento vigoroso' },
      { id: 'bio-b-4', date: '2026-08-31', dayOfCulture: 42, week: 6, averageWeightG: 4.80, gmdPeriodG: 0.193, gmdAccumulatedG: 0.114, sampleSize: 100, uniformityPercent: 92, notes: 'Boa conversão alimentar observada' },
      { id: 'bio-b-5', date: '2026-09-14', dayOfCulture: 56, week: 8, averageWeightG: 7.70, gmdPeriodG: 0.207, gmdAccumulatedG: 0.137, sampleSize: 120, uniformityPercent: 93, notes: 'Biometria recente - GMD atingiu 0,21 g/dia' },
    ],
  },
];

export const DEMO_WATER_MEASUREMENTS: WaterMeasurement[] = [
  {
    id: 'water-1',
    pondId: 'Viveiro 02 (Ativo)',
    unit: 'Fazenda Maré Barra',
    parameter: 'OXIGENIO',
    value: 3.2, // 3,2 mg/L às 11:55 -> FORA DA FAIXA (4-12 mg/L)
    unitMeasurement: 'mg/L',
    collectedAt: '2026-09-16T11:55:00-03:00',
    collectedBy: 'Carlos Operador',
    calibrationStatus: 'CALIBRADO',
    minAcceptable: 4.0,
    maxAcceptable: 12.0,
    maxAgeMinutes: 30,
    status: 'FORA_DA_FAIXA',
  },
  {
    id: 'water-2',
    pondId: 'Viveiro 03 (Ativo)',
    unit: 'Fazenda Maré Barra',
    parameter: 'OXIGENIO',
    value: 6.0, // 6,0 mg/L às 10:00 -> 120 min atrás (> 30 min) -> LEITURA ATRASADA!
    unitMeasurement: 'mg/L',
    collectedAt: '2026-09-16T10:00:00-03:00',
    collectedBy: 'Carlos Operador',
    calibrationStatus: 'CALIBRADO',
    minAcceptable: 4.0,
    maxAcceptable: 12.0,
    maxAgeMinutes: 30,
    status: 'LEITURA_ATRASADA',
  },
];

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: 'inc-001',
    pondId: 'Viveiro 02 (Ativo)',
    unit: 'Fazenda Maré Barra',
    ruleCode: 'RULE_OXIGENIO_CRITICO',
    severity: 'CRITICA',
    title: 'Oxigênio abaixo do limite crítico (3,2 mg/L)',
    evidence: 'Sonda óptica coletada às 11:55 com valor 3,2 mg/L (mínimo exigido: 4,0 mg/L).',
    responsible: 'Manoel Aquacultor',
    nextAction: 'Ligar o aerador reserva de 3 cv no Viveiro 02 e verificar comportamento natatório.',
    status: 'ABERTO',
    openedAt: '2026-09-16T11:56:00-03:00',
  },
  {
    id: 'inc-002',
    pondId: 'Viveiro 03 (Ativo)',
    unit: 'Fazenda Maré Barra',
    ruleCode: 'RULE_LEITURA_EXPIRADA',
    severity: 'MEDIA',
    title: 'Monitoramento de água atrasado (> 30 min)',
    evidence: 'Última coleta registrada ocorreu às 10:00 (120 minutos atrás). Faixa de segurança exige medições a cada 30 min.',
    responsible: 'Carlos Operador',
    nextAction: 'Realizar nova coleta imediata com oxímetro calibrado no Viveiro 03.',
    status: 'ABERTO',
    openedAt: '2026-09-16T10:31:00-03:00',
  },
];

export const DEMO_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-1',
    code: 'RAC-35-ENG',
    name: 'Ração Camarão Engorda 35% PB',
    category: 'RACAO',
    unit: 'kg',
    usableBalance: 300, // 300 kg
    averageDailyConsumption: 100, // 100 kg/dia
    leadTimeDays: 4, // 4 dias
    safetyStockDays: 2, // 2 dias (cobertura necessária = 6 dias; atual = 3 dias)
    reservedBalance: 0,
    lastUpdated: '2026-09-16T08:00:00-03:00',
  },
  {
    id: 'inv-2',
    code: 'PROB-AQUA',
    name: 'Probiótico Bacilar para Berçário',
    category: 'INSUMO',
    unit: 'litros',
    usableBalance: 80,
    averageDailyConsumption: 4,
    leadTimeDays: 5,
    safetyStockDays: 3,
    reservedBalance: 0,
    lastUpdated: '2026-09-15T18:00:00-03:00',
  },
];

export const DEMO_SALES_ORDERS: SalesOrder[] = [
  {
    id: 'order-1',
    orderNumber: 'PED-2026-001',
    customerName: 'Pescados Mar Aberto Distribuidora',
    productId: 'CAMARAO-G-DEMO',
    productName: 'Camarão Inteiro Congelado 12g (Lote DEMO-A)',
    batchId: 'batch-demo-a',
    quantity: 600, // 600 kg
    commercialUnit: 'KG',
    unitPrice: 35.0, // R$ 35,00/kg
    variableCostPerUnit: 18.0, // R$ 18,00/kg
    freightCost: 400.0, // R$ 400
    taxAndCommissionRatePercent: 8.0, // 8% tributos/comissão
    status: 'RESERVADO',
    dueDate: '2026-09-22',
    responsible: 'Renata Comercial',
    isReserved: true,
    reservationNotes: 'Reserva confirmada. Saldo físico baixado de 900 kg disponíveis para 300 kg.',
  },
  {
    id: 'order-2',
    orderNumber: 'PED-2026-002',
    customerName: 'Rede Gastronômica Costa Dourada',
    productId: 'CAMARAO-G-DEMO',
    productName: 'Camarão Inteiro Congelado 12g (Lote DEMO-A)',
    batchId: 'batch-demo-a',
    quantity: 400, // 400 kg
    commercialUnit: 'KG',
    unitPrice: 36.0,
    variableCostPerUnit: 18.0,
    freightCost: 350.0,
    taxAndCommissionRatePercent: 8.0,
    status: 'EM_REVISAO', // Segue para revisão por insuficiência de estoque liberado!
    dueDate: '2026-09-25',
    responsible: 'Renata Comercial',
    isReserved: false,
    reservationNotes: 'Bloqueado na reserva: saldo disponível é 300 kg, insuficiente para atender 400 kg.',
  },
];

export const DEMO_RECEIVABLES: ReceivableBill[] = [
  {
    id: 'rec-1',
    invoiceCode: 'FAT-2026-0810-A',
    customerName: 'Frutos do Oceano Comércio de Alimentos',
    originalAmount: 10000, // R$ 10.000
    receivedAmount: 4000, // R$ 4.000
    dueDate: '10/09/2026', // Vencimento 10/09/2026
    isReconciled: true, // Conciliado
    status: 'PAGAMENTO_PARCIAL',
    hasActiveDispute: false,
    lastPaymentDate: '2026-09-08',
  },
  {
    id: 'rec-2',
    invoiceCode: 'FAT-2026-0812-B',
    customerName: 'Restaurante Nau dos Sabores',
    originalAmount: 1000, // R$ 1.000
    receivedAmount: 1000, // Integralmente pago
    dueDate: '14/09/2026',
    isReconciled: true,
    status: 'PAGO',
    hasActiveDispute: false,
    lastPaymentDate: '2026-09-14',
  },
  {
    id: 'rec-3',
    invoiceCode: 'FAT-2026-0815-C',
    customerName: 'Boutique do Pescado Salvador',
    originalAmount: 5500,
    receivedAmount: 0,
    dueDate: '12/09/2026',
    isReconciled: true,
    status: 'EM_DISPUTA',
    hasActiveDispute: true, // Disputa ativa suspende cobrança!
  },
];

export const DEMO_DOCUMENTS: AppDocument[] = [
  {
    id: 'doc-1',
    fileName: 'NF_8921_Racao_Engorda.pdf',
    fileSizeBytes: 1845000,
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
    companyId: 'mari-ne-001',
    unit: 'Fazenda Maré Barra',
    batchId: 'batch-demo-a',
    category: 'NOTA_FISCAL',
    uploadedAt: '2026-07-15T14:30:00-03:00',
    uploadedBy: 'Ana Administrativo',
    status: 'CONCLUIDO',
    progressPercent: 100,
    confirmedByHuman: true,
    extractedDraft: {
      totalValue: 12000,
      items: [{ description: 'Ração Camarão 35% 30 sacas', value: 12000, category: 'RACAO' }],
      evidencePage: 1,
      confidenceNote: 'Conferido com canhoto de entrega em 15/07/2026.',
    },
  },
  {
    id: 'doc-2',
    fileName: 'Biometria_Lote_DEMO_A_Semana14.xlsx',
    fileSizeBytes: 420000,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileExtension: 'xlsx',
    companyId: 'mari-ne-001',
    unit: 'Fazenda Maré Barra',
    batchId: 'batch-demo-a',
    category: 'PLANILHA_BIOMETRIA',
    uploadedAt: '2026-09-08T09:15:00-03:00',
    uploadedBy: 'Manoel Aquacultor',
    status: 'CONCLUIDO',
    progressPercent: 100,
    confirmedByHuman: true,
  },
];
