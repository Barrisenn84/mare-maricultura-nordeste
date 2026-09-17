# Maré — Maricultura Nordeste Ltda.

Sistema integrado de gestão aquícola, rastreabilidade zootécnica e financeira para carcinicultura (engorda e larvicultura de *Litopenaeus vannamei*) no Nordeste brasileiro.

---

## 🌊 Funcionalidades Principais (Pontos 2 a 5 Implementados)

1. **Inteligência de Mercado & Clima do Nordeste (Ponto 2):**
   - Cotações regionais de camarão vivo por gramatura (8-10g até 18-20g) em polos do RN (Tibau do Sul, Goianinha), CE (Jaguaruana, Aracati) e BA (Valença).
   - Preços de ração (35% e 40% PB) e pós-larvas PL-10 por milheiro.
   - Boletim agroclimático regional (INMET/CPTEC) com fase de marés e alertas de oxigênio dissolvido.
   - **Isolamento Contábil Garantido:** Indicadores com metadados obrigatórios (Fonte, Data, Região) atuando como comparativo sem alterar o balanço contábil da empresa.

2. **Esteira do Agente Pós-Recebimento de Arquivos (Ponto 3):**
   - Agente inteligente pós-upload (PDFs, faturas Cosern/Enel, notas de ração, imagens e planilhas).
   - Extração estruturada de fornecedores, valores, alíquotas e itens.
   - Sugestão automática do lote de destino cruzando datas e viveiros ativos.

3. **Detector de Anomalias & Conferência Humana com 1 Clique (Ponto 4):**
   - Detecção de arquivos duplicados por hash SHA-256 e duplicidade de nota fiscal.
   - Alerta de preço unitário discrepante em relação à média nordestina.
   - Fila de conferência manual com aprovação de lançamento em 1 clique para inclusão auditada no lote.

4. **Deploy e Persistência na Railway (Ponto 5):**
   - Suporte nativo a volume persistente (`RAILWAY_VOLUME_MOUNT_PATH`).
   - Servidor Node.js contínuo com uploads multipart de até 100 MB (100.000.000 bytes).

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- Node.js 20+ ou 22+
- Chave da API do Google AI Studio (Gemini)

### Passos
1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente:
   Crie o arquivo `.env` com:
   ```env
   GEMINI_API_KEY=sua_chave_do_google_ai_studio
   PORT=3000
   NODE_ENV=development
   ```
3. Inicie o servidor:
   ```bash
   npm run dev
   ```
4. Acesse: `http://localhost:3000`

---

## 🚂 Como Hospedar na Railway

1. Crie um novo projeto na [Railway](https://railway.com) apontando para o repositório Git.
2. A Railway detectará automaticamente o arquivo `Dockerfile` e `railway.json`.
3. Adicione as **Variáveis de Ambiente** no painel da Railway:
   - `GEMINI_API_KEY`: sua chave da API Gemini.
   - `NODE_ENV`: `production`.
4. **Adicionar Volume Persistente (Recomendado):**
   - No painel da Railway, clique em **Add Volume**.
   - Monte o volume no caminho: `/app/data`
   - Pronto! O banco de dados real, backups e notas fiscais persistirão a cada novo deploy.

---

## 🧪 Testes de Aceitação

Para rodar a suíte independente de 21 testes automatizados cobrindo as regras financeiras, estoque, FCA e upload de 100 MB:
```bash
npx tsx -e "import { runIndependentTestSuite } from './server/testSuite'; const r = runIndependentTestSuite(); console.log('Passed:', r.passedCount, 'Failed:', r.failedCount);"
```
