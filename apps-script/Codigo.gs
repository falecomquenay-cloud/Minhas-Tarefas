/**
 * CadastroSB — Controle de Cadastro de Sobressalentes
 * Backend Google Apps Script. A planilha é o banco de dados.
 *
 * Instalação: veja README.md desta pasta.
 */

/* ===================== CONFIGURAÇÃO ===================== */

/**
 * Deixe vazio quando o script estiver vinculado à planilha
 * (Extensões › Apps Script a partir da própria planilha).
 * Para um script avulso, cole aqui o ID da planilha — é o trecho da URL
 * entre /d/ e /edit.
 */
var PLANILHA_ID = '';

var ABA = 'Cadastros';

/** Ordem em que as colunas são criadas. A leitura é feita pelo nome, não pela posição. */
var COLUNAS = [
  'ID', 'Equipamento', 'Parte', 'Componente', 'NI',
  'Especialidade', 'Responsavel', 'Status', 'Observacoes',
  'AtualizadoEm', 'AtualizadoPor'
];

/* Fluxo do cadastro, na ordem do trabalho */
var STATUS_VALIDOS = ['pendente', 'andamento', 'cadastro', 'concluido'];
/* Status que só valem com o NI preenchido */
var EXIGE_NI = ['cadastro', 'concluido'];
var ROTULO_STATUS = {
  pendente: 'Pendente',
  andamento: 'Em andamento',
  cadastro: 'Em cadastro',
  concluido: 'Concluído'
};
var ESPECIALIDADES = ['Mecânica', 'Elétrica'];

/* ===================== ENTRADA WEB ===================== */

function doGet() {
  garantirAba_();
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('CadastroSB — Sobressalentes')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite montar o HTML a partir de vários arquivos. */
function include(nome) {
  return HtmlService.createHtmlOutputFromFile(nome).getContent();
}

/** Menu na planilha para abrir o app rapidamente. */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('CadastroSB')
      .addItem('Abrir aplicativo', 'mostrarApp_')
      .addSeparator()
      .addItem('Preparar planilha', 'prepararPlanilha')
      .addToUi();
  } catch (e) { /* fora do contexto da planilha */ }
}

function mostrarApp_() {
  var html = HtmlService.createTemplateFromFile('Index')
    .evaluate().setWidth(1200).setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, 'CadastroSB');
}

/** Cria a aba, o cabeçalho e as validações. Pode ser rodada manualmente. */
function prepararPlanilha() {
  var aba = garantirAba_();
  try {
    SpreadsheetApp.getActive().toast(
      'Planilha pronta na aba "' + aba.getName() + '".', 'CadastroSB', 5);
  } catch (e) { /* rodando fora da planilha */ }
  return 'Planilha pronta na aba "' + aba.getName() + '".';
}

/* ===================== ACESSO À PLANILHA ===================== */

function planilha_() {
  if (PLANILHA_ID) return SpreadsheetApp.openById(PLANILHA_ID);
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error(
      'Nenhuma planilha encontrada. Vincule o script a uma planilha ou ' +
      'preencha PLANILHA_ID no topo de Codigo.gs.');
  }
  return ss;
}

function garantirAba_() {
  var ss = planilha_();
  var aba = ss.getSheetByName(ABA);

  if (!aba) {
    aba = ss.insertSheet(ABA);
    aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
  } else if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, COLUNAS.length).setValues([COLUNAS]);
  } else {
    /* Acrescenta colunas que faltarem, sem mexer nas existentes. */
    var cab = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1))
      .getValues()[0].map(function (c) { return String(c).trim(); });
    COLUNAS.forEach(function (nome) {
      if (cab.indexOf(nome) === -1) {
        aba.insertColumnAfter(aba.getLastColumn());
        aba.getRange(1, aba.getLastColumn()).setValue(nome);
        cab.push(nome);
      }
    });
  }

  formatarAba_(aba);
  return aba;
}

function formatarAba_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn());
  cab.setFontWeight('bold')
    .setBackground('#16181a')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  aba.setRowHeight(1, 30);
  aba.setFrozenRows(1);

  var idx = indices_(aba);
  var linhas = Math.max(aba.getMaxRows() - 1, 1);

  if (idx.Status) {
    aba.getRange(2, idx.Status, linhas, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(STATUS_VALIDOS, true)
        .setAllowInvalid(false).build());
  }
  if (idx.Especialidade) {
    aba.getRange(2, idx.Especialidade, linhas, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(ESPECIALIDADES, true)
        .setAllowInvalid(false).build());
  }
  if (idx.ID) aba.hideColumns(idx.ID);
}

/** Mapa nome-da-coluna -> número da coluna (base 1). */
function indices_(aba) {
  var cab = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
  var m = {};
  cab.forEach(function (nome, i) {
    nome = String(nome).trim();
    if (nome) m[nome] = i + 1;
  });
  return m;
}

/* ===================== LEITURA ===================== */

/** Tudo que o app precisa para desenhar a primeira tela, numa só chamada. */
function iniciar() {
  return {
    itens: listar(),
    eu: meuNome(),
    sugestao: sugerirNome_(),
    email: usuario_()
  };
}

/** Devolve todos os componentes cadastrados. */
function listar() {
  var aba = garantirAba_();
  var ultima = aba.getLastRow();
  if (ultima < 2) return [];

  var idx = indices_(aba);
  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();

  var itens = [];
  for (var i = 0; i < dados.length; i++) {
    var it = objetoDaLinha_(dados[i], idx);
    /* ignora linhas em branco deixadas por exclusões manuais */
    if (it.equipamento || it.parte || it.componente) itens.push(it);
  }
  return itens;
}

function objetoDaLinha_(linha, idx) {
  var v = function (nome) {
    return idx[nome] ? String(linha[idx[nome] - 1] == null ? '' : linha[idx[nome] - 1]).trim() : '';
  };
  var status = v('Status').toLowerCase();
  var esp = v('Especialidade');
  return {
    id: v('ID'),
    equipamento: v('Equipamento'),
    parte: v('Parte'),
    componente: v('Componente'),
    ni: v('NI'),
    especialidade: esp === 'Elétrica' ? 'Elétrica' : 'Mecânica',
    responsavel: v('Responsavel'),
    status: STATUS_VALIDOS.indexOf(status) >= 0 ? status : 'pendente',
    obs: v('Observacoes'),
    atualizadoEm: v('AtualizadoEm'),
    atualizadoPor: v('AtualizadoPor')
  };
}

/** Número da linha (base 1) de um ID; 0 se não achar. */
function linhaDoId_(aba, id) {
  var ultima = aba.getLastRow();
  if (ultima < 2) return 0;
  var idx = indices_(aba);
  if (!idx.ID) return 0;
  var ids = aba.getRange(2, idx.ID, ultima - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2;
  }
  return 0;
}

/* ===================== QUEM É O COLABORADOR ===================== */

/**
 * O nome fica guardado por conta Google, então a pessoa escolhe uma vez
 * e a aba "Meus cadastros" já abre certa em qualquer aparelho.
 */
function meuNome() {
  try {
    return PropertiesService.getUserProperties().getProperty('meuNome') || '';
  } catch (e) {
    return '';
  }
}

function definirMeuNome(nome) {
  nome = String(nome || '').trim();
  try {
    var p = PropertiesService.getUserProperties();
    if (nome) p.setProperty('meuNome', nome);
    else p.deleteProperty('meuNome');
  } catch (e) { /* o app ainda funciona, só não lembra */ }
  return { ok: true, eu: nome };
}

/** Palpite de quem é a pessoa, comparando o e-mail com os responsáveis. */
function sugerirNome_() {
  var email = usuario_();
  if (!email || email.indexOf('@') < 0) return '';

  var local = email.split('@')[0].toLowerCase().replace(/[._-]+/g, ' ').trim();
  if (!local) return '';
  var partes = local.split(' ').filter(function (p) { return p.length > 2; });
  if (!partes.length) return '';

  var nomes = {};
  listar().forEach(function (i) { if (i.responsavel) nomes[i.responsavel] = 1; });

  var melhor = '', melhorPontos = 0;
  Object.keys(nomes).forEach(function (nome) {
    var alvo = nome.toLowerCase();
    var pontos = 0;
    partes.forEach(function (p) { if (alvo.indexOf(p) >= 0) pontos++; });
    if (pontos > melhorPontos) { melhorPontos = pontos; melhor = nome; }
  });
  return melhorPontos > 0 ? melhor : '';
}

/* ===================== ESCRITA ===================== */

/**
 * Cria ou atualiza um componente.
 * Devolve { ok, itens } — a lista completa e atualizada, para o cliente
 * enxergar também o que outras pessoas gravaram nesse meio-tempo.
 */
function salvarComponente(dados) {
  return comTrava_(function () {
    var aba = garantirAba_();
    var idx = indices_(aba);
    var it = normalizar_(dados);

    validar_(it);
    checarNiDuplicado_(aba, idx, it.ni, it.id);

    var agora = new Date();
    var quem = usuario_();

    if (it.id) {
      var linha = linhaDoId_(aba, it.id);
      if (!linha) throw new Error('Componente não encontrado. Ele pode ter sido excluído por outra pessoa.');
      gravarLinha_(aba, idx, linha, it, agora, quem);
    } else {
      it.id = Utilities.getUuid();
      gravarLinha_(aba, idx, aba.getLastRow() + 1, it, agora, quem);
    }
    return { ok: true, itens: listar() };
  });
}

function gravarLinha_(aba, idx, linha, it, agora, quem) {
  var por = function (nome, valor) {
    if (idx[nome]) aba.getRange(linha, idx[nome]).setValue(valor);
  };
  por('ID', it.id);
  por('Equipamento', it.equipamento);
  por('Parte', it.parte);
  por('Componente', it.componente);
  por('NI', it.ni);
  por('Especialidade', it.especialidade);
  por('Responsavel', it.responsavel);
  por('Status', it.status);
  por('Observacoes', it.obs);
  por('AtualizadoEm', Utilities.formatDate(agora, fuso_(), 'dd/MM/yyyy HH:mm'));
  por('AtualizadoPor', quem);
}

function excluirComponente(id) {
  return comTrava_(function () {
    var aba = garantirAba_();
    var linha = linhaDoId_(aba, id);
    if (!linha) throw new Error('Componente não encontrado.');
    aba.deleteRow(linha);
    return { ok: true, itens: listar() };
  });
}

/** Renomeia o equipamento em todos os seus componentes. */
function renomearEquipamento(antigo, novo) {
  return comTrava_(function () {
    novo = String(novo || '').trim();
    if (!novo) throw new Error('O nome do equipamento não pode ficar vazio.');
    var n = substituir_(function (it) { return it.equipamento === antigo; },
      'Equipamento', novo);
    return { ok: true, alterados: n, itens: listar() };
  });
}

/** Renomeia uma parte dentro de um equipamento. */
function renomearParte(equipamento, antiga, nova) {
  return comTrava_(function () {
    nova = String(nova || '').trim();
    if (!nova) throw new Error('O nome da parte não pode ficar vazio.');
    var n = substituir_(function (it) {
      return it.equipamento === equipamento && it.parte === antiga;
    }, 'Parte', nova);
    return { ok: true, alterados: n, itens: listar() };
  });
}

function excluirEquipamento(nome) {
  return comTrava_(function () {
    var n = excluirOnde_(function (it) { return it.equipamento === nome; });
    return { ok: true, excluidos: n, itens: listar() };
  });
}

function excluirParte(equipamento, parte) {
  return comTrava_(function () {
    var n = excluirOnde_(function (it) {
      return it.equipamento === equipamento && it.parte === parte;
    });
    return { ok: true, excluidos: n, itens: listar() };
  });
}

/* ===================== APOIO ===================== */

function substituir_(criterio, coluna, valor) {
  var aba = garantirAba_();
  var idx = indices_(aba);
  var ultima = aba.getLastRow();
  if (ultima < 2 || !idx[coluna]) return 0;

  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  var faixa = aba.getRange(2, idx[coluna], ultima - 1, 1);
  var atuais = faixa.getValues();
  var n = 0;

  for (var i = 0; i < dados.length; i++) {
    if (criterio(objetoDaLinha_(dados[i], idx))) { atuais[i][0] = valor; n++; }
  }
  if (n) faixa.setValues(atuais);
  return n;
}

function excluirOnde_(criterio) {
  var aba = garantirAba_();
  var idx = indices_(aba);
  var ultima = aba.getLastRow();
  if (ultima < 2) return 0;

  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  var alvo = [];
  for (var i = 0; i < dados.length; i++) {
    if (criterio(objetoDaLinha_(dados[i], idx))) alvo.push(i + 2);
  }
  /* de baixo para cima, para os números de linha não mudarem no caminho */
  for (var j = alvo.length - 1; j >= 0; j--) aba.deleteRow(alvo[j]);
  return alvo.length;
}

function normalizar_(d) {
  d = d || {};
  var esp = String(d.especialidade || '').trim();
  var st = String(d.status || 'pendente').trim().toLowerCase();
  return {
    id: String(d.id || '').trim(),
    equipamento: String(d.equipamento || '').trim(),
    parte: String(d.parte || '').trim(),
    componente: String(d.componente || '').trim(),
    ni: String(d.ni || '').trim(),
    especialidade: esp === 'Elétrica' ? 'Elétrica' : 'Mecânica',
    responsavel: String(d.responsavel || '').trim(),
    status: STATUS_VALIDOS.indexOf(st) >= 0 ? st : 'pendente',
    obs: String(d.obs || '').trim()
  };
}

function validar_(it) {
  if (!it.equipamento) throw new Error('Informe o equipamento.');
  if (!it.parte) throw new Error('Informe a parte.');
  if (!it.componente) throw new Error('Informe o componente.');
  if (EXIGE_NI.indexOf(it.status) >= 0 && !it.ni) {
    throw new Error('Informe o NI para marcar como ' + ROTULO_STATUS[it.status] + '.');
  }
}

function checarNiDuplicado_(aba, idx, ni, idAtual) {
  if (!ni) return;
  var ultima = aba.getLastRow();
  if (ultima < 2) return;

  var dados = aba.getRange(2, 1, ultima - 1, aba.getLastColumn()).getValues();
  for (var i = 0; i < dados.length; i++) {
    var it = objetoDaLinha_(dados[i], idx);
    if (it.ni && it.ni.toLowerCase() === ni.toLowerCase() && it.id !== idAtual) {
      throw new Error('O NI ' + ni + ' já está em "' + it.componente + '".');
    }
  }
}

/** Serializa as escritas: duas pessoas salvando ao mesmo tempo não se atropelam. */
function comTrava_(fn) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) {
    throw new Error('A planilha está ocupada. Tente novamente em instantes.');
  }
  try {
    return fn();
  } finally {
    trava.releaseLock();
  }
}

function usuario_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

function fuso_() {
  try {
    return planilha_().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
  } catch (e) {
    return 'America/Sao_Paulo';
  }
}

/** URL da planilha, para o botão "Abrir planilha". */
function urlDaPlanilha() {
  return planilha_().getUrl();
}

/* ===================== DADOS DE EXEMPLO ===================== */

/** Popula a planilha vazia com exemplos. Chamado pelo botão do app. */
function carregarExemplos() {
  return comTrava_(function () {
    var aba = garantirAba_();
    if (aba.getLastRow() > 1) {
      throw new Error('A planilha já tem dados. Os exemplos só entram em uma planilha vazia.');
    }
    var idx = indices_(aba);
    var carimbo = Utilities.formatDate(new Date(), fuso_(), 'dd/MM/yyyy HH:mm');
    var quem = usuario_();

    var ex = [
      ['Slitter', 'Desbobinador', 'Motor desbobinador', 'NI-450231', 'Elétrica', 'Carlos Andrade', 'concluido', 'Motor 45 kW. Cadastro conferido com a plaqueta.'],
      ['Slitter', 'Desbobinador', 'Redutor do desbobinador', 'NI-450232', 'Mecânica', 'Carlos Andrade', 'concluido', ''],
      ['Slitter', 'Desbobinador', 'Mandril expansivo', '', 'Mecânica', 'Marina Lopes', 'andamento', 'Aguardando desenho do fabricante para confirmar o código.'],
      ['Slitter', 'Facas circulares', 'Jogo de facas superiores', '', 'Mecânica', 'Marina Lopes', 'pendente', ''],
      ['Slitter', 'Facas circulares', 'Espaçadores', '', 'Mecânica', 'Marina Lopes', 'pendente', ''],
      ['Slitter', 'Rebobinador', 'Motor rebobinador', '', 'Elétrica', 'Carlos Andrade', 'andamento', 'NI solicitado, aguardando liberação.'],
      ['Slitter', 'Rebobinador', 'Encoder do rebobinador', 'NI-450240', 'Elétrica', 'Rafael Souza', 'cadastro', ''],
      ['Slitter', 'Painel elétrico', 'Inversor de frequência', 'NI-450255', 'Elétrica', 'Rafael Souza', 'concluido', 'Modelo com realimentação.'],
      ['Slitter', 'Painel elétrico', 'Contatores de potência', '', 'Elétrica', 'Rafael Souza', 'pendente', ''],
      ['Laminador', 'Cilindro de trabalho', 'Rolamento do mancal', 'NI-470110', 'Mecânica', 'Marina Lopes', 'concluido', ''],
      ['Laminador', 'Cilindro de trabalho', 'Mancal de encosto', '', 'Mecânica', 'João Pereira', 'andamento', 'Verificar se o item já existe sob outro NI.'],
      ['Laminador', 'Sistema hidráulico', 'Bomba hidráulica principal', 'NI-470118', 'Mecânica', 'João Pereira', 'cadastro', ''],
      ['Laminador', 'Sistema hidráulico', 'Válvula proporcional', '', 'Mecânica', 'João Pereira', 'pendente', ''],
      ['Laminador', 'Sistema hidráulico', 'Filtro de retorno', '', 'Mecânica', 'João Pereira', 'pendente', ''],
      ['Laminador', 'Acionamento', 'Motor principal', '', 'Elétrica', 'Rafael Souza', 'andamento', ''],
      ['Ponte Rolante', 'Translação', 'Motofreio de translação', 'NI-482001', 'Elétrica', 'Carlos Andrade', 'concluido', ''],
      ['Ponte Rolante', 'Içamento', 'Cabo de aço', 'NI-482010', 'Mecânica', 'João Pereira', 'cadastro', 'Cabo 16 mm, 6x19.'],
      ['Ponte Rolante', 'Içamento', 'Freio eletromagnético', '', 'Elétrica', 'Carlos Andrade', 'pendente', ''],
      ['Ponte Rolante', 'Segurança', 'Fim de curso', '', 'Elétrica', 'Rafael Souza', 'pendente', '']
    ];

    var largura = aba.getLastColumn();
    var linhas = ex.map(function (e) {
      var linha = [];
      for (var c = 0; c < largura; c++) linha.push('');
      var por = function (nome, valor) { if (idx[nome]) linha[idx[nome] - 1] = valor; };
      por('ID', Utilities.getUuid());
      por('Equipamento', e[0]); por('Parte', e[1]); por('Componente', e[2]);
      por('NI', e[3]); por('Especialidade', e[4]); por('Responsavel', e[5]);
      por('Status', e[6]); por('Observacoes', e[7]);
      por('AtualizadoEm', carimbo); por('AtualizadoPor', quem);
      return linha;
    });

    aba.getRange(2, 1, linhas.length, largura).setValues(linhas);
    return { ok: true, itens: listar() };
  });
}
