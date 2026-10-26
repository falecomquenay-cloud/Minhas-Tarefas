/* ==========================================================================
   CadastroSB — Controle de Cadastro de Sobressalentes
   Hierarquia: Equipamento › Parte › Componente
   Acompanha o cadastramento do NI no sistema Usiminas.
   Dados persistidos localmente no navegador (localStorage).
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "cadastrosb.db.v1";

  /* Fluxo do cadastro, do início ao fim. A ordem aqui é a ordem do trabalho. */
  const STATUS = {
    pendente:  { rotulo: "Pendente",     classe: "c-wait", sub: "ainda não iniciados" },
    andamento: { rotulo: "Em andamento", classe: "c-and",  sub: "em levantamento" },
    cadastro:  { rotulo: "Em cadastro",  classe: "c-cad",  sub: "com ID de cadastro" },
    concluido: { rotulo: "Concluído",    classe: "c-done", sub: "cadastro finalizado" },
  };
  /* Status que exigem o NI preenchido */
  const EXIGE_NI = ["cadastro", "concluido"];

  const DB = { itens: [] };

  /* Quem é o colaborador neste navegador, e de quem é a lista exibida */
  const CHAVE_EU = "cadastrosb.eu";
  let eu = null;
  let pessoaVista = null;

  /* Equipamento aberto na ficha e partes recolhidas */
  let equipAtual = null;
  const partesFechadas = new Set();

  /* ---------------- utilidades ---------------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

  /* ---------------- persistência ---------------- */
  function save() {
    ultimaMudanca = new Date();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    } catch (e) {
      toast("Não foi possível salvar. O armazenamento do navegador está cheio.", "error");
    }
  }

  function carregarEu() {
    try { eu = localStorage.getItem(CHAVE_EU) || null; } catch (e) { eu = null; }
    pessoaVista = eu;
  }

  function definirEu(nome) {
    eu = (nome || "").trim() || null;
    pessoaVista = eu;
    try {
      if (eu) localStorage.setItem(CHAVE_EU, eu);
      else localStorage.removeItem(CHAVE_EU);
    } catch (e) { /* segue sem lembrar */ }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        DB.itens = Array.isArray(d.itens) ? d.itens : [];
        return;
      } catch (e) { /* cai no seed */ }
    }
    seed();
    save();
  }

  function seed() {
    const mk = (equipamento, parte, componente, especialidade, responsavel, status, ni, obs) =>
      ({ id: uid(), equipamento, parte, componente, especialidade, responsavel, status, ni: ni || "", obs: obs || "" });

    DB.itens = [
      mk("Slitter", "Desbobinador", "Motor desbobinador", "Elétrica", "Carlos Andrade", "concluido", "NI-450231", "Motor 45 kW. Cadastro conferido com a plaqueta."),
      mk("Slitter", "Desbobinador", "Redutor do desbobinador", "Mecânica", "Carlos Andrade", "concluido", "NI-450232", ""),
      mk("Slitter", "Desbobinador", "Mandril expansivo", "Mecânica", "Marina Lopes", "andamento", "", "Aguardando desenho do fabricante para confirmar o código."),
      mk("Slitter", "Facas circulares", "Jogo de facas superiores", "Mecânica", "Marina Lopes", "pendente", "", ""),
      mk("Slitter", "Facas circulares", "Espaçadores", "Mecânica", "Marina Lopes", "pendente", "", ""),
      mk("Slitter", "Rebobinador", "Motor rebobinador", "Elétrica", "Carlos Andrade", "andamento", "", "NI solicitado, aguardando liberação."),
      mk("Slitter", "Rebobinador", "Encoder do rebobinador", "Elétrica", "Rafael Souza", "cadastro", "NI-450240", ""),
      mk("Slitter", "Painel elétrico", "Inversor de frequência", "Elétrica", "Rafael Souza", "concluido", "NI-450255", "Modelo com realimentação."),
      mk("Slitter", "Painel elétrico", "Contatores de potência", "Elétrica", "Rafael Souza", "pendente", "", ""),

      mk("Laminador", "Cilindro de trabalho", "Rolamento do mancal", "Mecânica", "Marina Lopes", "concluido", "NI-470110", ""),
      mk("Laminador", "Cilindro de trabalho", "Mancal de encosto", "Mecânica", "João Pereira", "andamento", "", "Verificar se o item já existe sob outro NI."),
      mk("Laminador", "Sistema hidráulico", "Bomba hidráulica principal", "Mecânica", "João Pereira", "cadastro", "NI-470118", ""),
      mk("Laminador", "Sistema hidráulico", "Válvula proporcional", "Mecânica", "João Pereira", "pendente", "", ""),
      mk("Laminador", "Sistema hidráulico", "Filtro de retorno", "Mecânica", "João Pereira", "pendente", "", ""),
      mk("Laminador", "Acionamento", "Motor principal", "Elétrica", "Rafael Souza", "andamento", "", ""),

      mk("Ponte Rolante", "Translação", "Motofreio de translação", "Elétrica", "Carlos Andrade", "concluido", "NI-482001", ""),
      mk("Ponte Rolante", "Içamento", "Cabo de aço", "Mecânica", "João Pereira", "cadastro", "NI-482010", "Cabo 16 mm, 6x19."),
      mk("Ponte Rolante", "Içamento", "Freio eletromagnético", "Elétrica", "Carlos Andrade", "pendente", "", ""),
      mk("Ponte Rolante", "Segurança", "Fim de curso", "Elétrica", "Rafael Souza", "pendente", "", ""),
    ];
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg, tipo = "success") {
    const el = $("#toast");
    el.textContent = msg;
    el.className = "toast " + (tipo === "error" ? "error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3000);
  }

  /* ---------------- agregação p/ painel ---------------- */
  function agrupar(chaveFn) {
    const mapa = new Map();
    DB.itens.forEach((it) => {
      const k = (chaveFn(it) || "").trim() || "— não informado —";
      if (!mapa.has(k)) mapa.set(k, { nome: k, total: 0, concluido: 0, cadastro: 0, andamento: 0, pendente: 0 });
      const g = mapa.get(k);
      g.total++;
      g[it.status] = (g[it.status] || 0) + 1;
    });
    return Array.from(mapa.values()).sort(
      (a, b) => pct(b.concluido, b.total) - pct(a.concluido, a.total) || b.total - a.total
    );
  }

  /* Barra em três faixas: concluído, em cadastro e em andamento.
     O que sobra é o trilho, que representa o pendente. */
  function barra(g) {
    const c = pct(g.concluido, g.total);
    const k = pct(g.cadastro, g.total);
    const a = pct(g.andamento, g.total);
    return `<div class="prog-bar" role="img" aria-label="${c}% concluído, ${k}% em cadastro, ${a}% em andamento">
      <div class="seg seg-done" style="width:${c}%"></div>
      <div class="seg seg-cad" style="width:${k}%"></div>
      <div class="seg seg-and" style="width:${a}%"></div>
    </div>`;
  }

  function linhaProgresso(g, chipHTML, opc) {
    const alvo = opc && (opc.equip ? "equip" : (opc.pessoa ? "pessoa" : null));
    const link = !!alvo;
    const tag = link ? "button" : "div";
    return `<${tag} class="prog-row"${
      link ? ` data-ir-${alvo}="${esc(g.nome)}" title="Abrir ${esc(g.nome)}"` : ""}>
      <span class="prog-name">${chipHTML || ""}<span class="txt">${esc(g.nome)}</span>${
        link ? `<span class="prog-ir">→</span>` : ""}</span>
      ${barra(g)}
      <span class="prog-meta"><b>${g.concluido}</b>/${g.total}</span>
      <span class="prog-pct">${pct(g.concluido, g.total)}%</span>
    </${tag}>`;
  }

  function vazio(icone, titulo, texto) {
    return `<div class="empty"><span class="empty-ico">${icone}</span><b>${esc(titulo)}</b>${esc(texto || "")}</div>`;
  }

  /* ---------------- painel ---------------- */
  function contar(status) {
    return DB.itens.filter((i) => i.status === status).length;
  }

  function renderPainel() {
    const total = DB.itens.length;
    const c = contar("concluido"), k = contar("cadastro");
    const a = contar("andamento"), p = contar("pendente");
    const equipamentos = agrupar((i) => i.equipamento).length;

    $("#faixa").innerHTML = `
      <div class="kpi">
        <div class="rot">Componentes</div>
        <div class="kpi-valor">${total}</div>
        <div class="kpi-sub">${equipamentos} equipamento(s)</div>
      </div>
      <div class="kpi k-done">
        <div class="rot">Concluídos</div>
        <div class="kpi-valor">${c}<span class="pctg">${pct(c, total)}%</span></div>
        <div class="kpi-sub">${STATUS.concluido.sub}</div>
      </div>
      <div class="kpi k-cad">
        <div class="rot">Em cadastro</div>
        <div class="kpi-valor">${k}</div>
        <div class="kpi-sub">${STATUS.cadastro.sub}</div>
      </div>
      <div class="kpi k-and">
        <div class="rot">Em andamento</div>
        <div class="kpi-valor">${a}</div>
        <div class="kpi-sub">${STATUS.andamento.sub}</div>
      </div>
      <div class="kpi k-wait">
        <div class="rot">Pendentes</div>
        <div class="kpi-valor">${p}</div>
        <div class="kpi-sub">${STATUS.pendente.sub}</div>
      </div>`;

    if (!total) {
      const msg = vazio("—", "Sem dados ainda", "Cadastre o primeiro componente para ver a evolução.");
      $("#painel-equip").innerHTML = msg;
      $("#painel-resp").innerHTML = msg;
      $("#painel-esp").innerHTML = msg;
      return;
    }

    $("#painel-equip").innerHTML = agrupar((i) => i.equipamento)
      .map((g) => linhaProgresso(g, "", { equip: g.nome })).join("");
    $$("[data-ir-equip]", $("#painel-equip")).forEach((el) =>
      el.addEventListener("click", () => abrirFicha(el.dataset.irEquip)));

    $("#painel-resp").innerHTML = agrupar((i) => i.responsavel)
      .map((g) => linhaProgresso(g, "", { pessoa: g.nome })).join("");
    $$("[data-ir-pessoa]", $("#painel-resp")).forEach((el) =>
      el.addEventListener("click", () => abrirPessoa(el.dataset.irPessoa)));
    $("#painel-esp").innerHTML = agrupar((i) => i.especialidade)
      .map((g) => linhaProgresso(g, chipEsp(g.nome))).join("");
  }

  let ultimaMudanca = null;
  function marcarCarimbo() {
    const el = $("#carimbo");
    if (!el) return;
    if (!ultimaMudanca) { el.textContent = "atualizado agora"; return; }
    const hh = String(ultimaMudanca.getHours()).padStart(2, "0");
    const mm = String(ultimaMudanca.getMinutes()).padStart(2, "0");
    el.textContent = `atualizado às ${hh}:${mm}`;
  }

  /* Resumo de conclusão que acompanha o usuário na barra lateral */
  function renderResumoLateral() {
    const total = DB.itens.length;
    const c = contar("concluido");
    const g = { total, concluido: c, cadastro: contar("cadastro"), andamento: contar("andamento") };
    $("#resumo-lateral").innerHTML = `
      <div class="rot">Concluído</div>
      <div class="valor">
        <span class="pctg">${pct(c, total)}%</span>
        <span class="frac">${c}/${total}</span>
      </div>
      ${barra(g)}`;
  }

  function chipEsp(esp) {
    if (esp === "Mecânica") return `<span class="chip esp c-mec">Mec</span>`;
    if (esp === "Elétrica") return `<span class="chip esp c-ele">Elé</span>`;
    return "";
  }

  /* ---------------- meus cadastros ---------------- */

  /** Iniciais para o avatar: primeira letra do primeiro e do último nome. */
  function iniciais(nome) {
    const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }

  function responsaveis() {
    return valoresUnicos("responsavel");
  }

  function renderMeus() {
    const alvo = $("#meus-conteudo");

    /* Sem ninguém escolhido: pede a identificação uma única vez. */
    if (!pessoaVista) {
      $("#meus-titulo").textContent = "Meus cadastros";
      $("#meus-sub").textContent = "Componentes sob sua responsabilidade";
      $("#btn-trocar-eu").classList.add("hidden");
      $("#meus-filtros").classList.add("hidden");
      $("#meus-faixa").classList.add("hidden");
      alvo.innerHTML = telaQuemSouEu();
      ligarQuemSouEu(alvo);
      return;
    }

    const souEu = pessoaVista === eu;
    $("#meus-titulo").textContent = souEu ? "Meus cadastros" : "Cadastros de " + pessoaVista;
    $("#meus-sub").innerHTML = (souEu
      ? "Componentes sob sua responsabilidade"
      : "Você está vendo a lista de outra pessoa") +
      '<br><span class="eu-chip"><span class="eu-ini">' + esc(iniciais(pessoaVista)) +
      '</span><span class="eu-nome">' + esc(pessoaVista) + "</span></span>";
    $("#btn-trocar-eu").classList.remove("hidden");
    $("#btn-trocar-eu").textContent = souEu ? "Trocar responsável" : "Ver os meus";
    $("#meus-filtros").classList.remove("hidden");
    $("#meus-faixa").classList.remove("hidden");

    const todos = DB.itens.filter((i) => i.responsavel === pessoaVista);
    const g = {
      total: todos.length,
      concluido: todos.filter((i) => i.status === "concluido").length,
      cadastro: todos.filter((i) => i.status === "cadastro").length,
      andamento: todos.filter((i) => i.status === "andamento").length,
      pendente: todos.filter((i) => i.status === "pendente").length,
    };
    const emAberto = g.total - g.concluido;

    $("#meus-faixa").innerHTML = `
      <div class="kpi">
        <div class="rot">Sob responsabilidade</div>
        <div class="kpi-valor">${g.total}</div>
        <div class="kpi-sub">${new Set(todos.map((i) => i.equipamento)).size} equipamento(s)</div>
      </div>
      <div class="kpi k-done">
        <div class="rot">Concluídos</div>
        <div class="kpi-valor">${g.concluido}<span class="pctg">${pct(g.concluido, g.total)}%</span></div>
        <div class="kpi-sub">${STATUS.concluido.sub}</div>
      </div>
      <div class="kpi k-cad">
        <div class="rot">Em cadastro</div>
        <div class="kpi-valor">${g.cadastro}</div>
        <div class="kpi-sub">${STATUS.cadastro.sub}</div>
      </div>
      <div class="kpi k-and">
        <div class="rot">Em andamento</div>
        <div class="kpi-valor">${g.andamento}</div>
        <div class="kpi-sub">${STATUS.andamento.sub}</div>
      </div>
      <div class="kpi k-wait">
        <div class="rot">Pendentes</div>
        <div class="kpi-valor">${g.pendente}</div>
        <div class="kpi-sub">${STATUS.pendente.sub}</div>
      </div>`;

    if (!todos.length) {
      alvo.innerHTML = vazio("—", "Nada sob essa responsabilidade",
        souEu ? "Nenhum componente está atribuído a você no momento."
              : "Nenhum componente está atribuído a essa pessoa.");
      return;
    }

    /* filtros locais da aba */
    const termo = $("#busca-meus").value.trim().toLowerCase();
    const fe = $("#meus-esp").value, fs = $("#meus-status").value;
    const lista = todos.filter((i) => {
      if (fe && i.especialidade !== fe) return false;
      if (fs === "aberto") { if (i.status === "concluido") return false; }
      else if (fs && i.status !== fs) return false;
      if (!termo) return true;
      return `${i.equipamento} ${i.parte} ${i.componente} ${i.ni} ${i.obs}`
        .toLowerCase().includes(termo);
    });

    if (!lista.length) {
      alvo.innerHTML = vazio("—", "Nenhum componente", "Ajuste a busca ou os filtros desta aba.");
      return;
    }

    /* agrupa por equipamento, que é como a pessoa organiza o próprio trabalho */
    const porEquip = new Map();
    lista.forEach((i) => {
      const k = i.equipamento || "— sem equipamento —";
      if (!porEquip.has(k)) porEquip.set(k, []);
      porEquip.get(k).push(i);
    });

    alvo.innerHTML = Array.from(porEquip.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([nomeEquip, itens]) => {
        itens.sort((a, b) =>
          a.parte.localeCompare(b.parte, "pt-BR") ||
          a.componente.localeCompare(b.componente, "pt-BR"));
        /* A barra mede o progresso real da pessoa naquele equipamento,
           então conta tudo dela — não só o que o filtro deixou à vista. */
        const dela = todos.filter((i) => (i.equipamento || "— sem equipamento —") === nomeEquip);
        const ge = {
          total: dela.length,
          concluido: dela.filter((i) => i.status === "concluido").length,
          cadastro: dela.filter((i) => i.status === "cadastro").length,
          andamento: dela.filter((i) => i.status === "andamento").length,
        };
        return `<section class="parte">
          <div class="parte-head">
            <button class="parte-seta-btn" data-ir-equip="${esc(nomeEquip)}" title="Abrir ${esc(nomeEquip)}">
              <span class="parte-nome">${esc(nomeEquip)}</span>
              <span class="parte-mini">${barra(ge)}</span>
              <span class="parte-conta"><b>${ge.concluido}</b>/${ge.total}</span>
            </button>
          </div>
          <div class="parte-corpo">${itens.map(linhaMinha).join("")}</div>
        </section>`;
      }).join("");

    $$("[data-ir-equip]", alvo).forEach((b) =>
      b.addEventListener("click", () => abrirFicha(b.dataset.irEquip)));
    $$("[data-edit]", alvo).forEach((b) =>
      b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    $$("[data-del]", alvo).forEach((b) =>
      b.addEventListener("click", () => excluir(b.dataset.del)));
  }

  function linhaMinha(i) {
    const st = STATUS[i.status] || STATUS.pendente;
    return `<div class="comp">
      <div class="comp-nome">
        <div class="comp-crumb">${esc(i.parte)}</div>
        ${esc(i.componente)}
        ${i.obs ? `<div class="comp-obs">${esc(i.obs.length > 120 ? i.obs.slice(0, 120) + "…" : i.obs)}</div>` : ""}
      </div>
      <div class="comp-ni">${i.ni ? `<span class="ni-tag">${esc(i.ni)}</span>` : `<span class="ni-empty">sem NI</span>`}</div>
      <div class="comp-esp">${chipEspCompleto(i.especialidade)}</div>
      <div class="comp-resp"></div>
      <div class="comp-status"><span class="chip ${st.classe}">${st.rotulo}</span></div>
      <div class="comp-acoes">
        <button class="icon-btn" title="Editar" aria-label="Editar ${esc(i.componente)}" data-edit="${i.id}">✏️</button>
        <button class="icon-btn danger" title="Excluir" aria-label="Excluir ${esc(i.componente)}" data-del="${i.id}">🗑️</button>
      </div>
    </div>`;
  }

  function telaQuemSouEu() {
    const nomes = responsaveis();
    return `<div class="vazio-inicio">
      <h3>Quem é você?</h3>
      <p>Escolha seu nome para ver apenas os componentes sob sua responsabilidade.
         A escolha fica salva neste navegador.</p>
      ${nomes.length ? `<div class="eu-opcoes">${nomes.map((n) =>
        `<button class="btn-sec" data-sou="${esc(n)}">
           <span class="eu-ini" style="display:inline-grid;vertical-align:-4px;margin-right:6px">${esc(iniciais(n))}</span>${esc(n)}
         </button>`).join("")}</div>
      <div class="eu-sep">ou</div>` : ""}
      <div class="eu-outro">
        <input type="text" id="eu-novo" class="search" placeholder="Digite seu nome" autocomplete="off" />
        <button class="btn-primary" id="btn-eu-novo">Confirmar</button>
      </div>
    </div>`;
  }

  function ligarQuemSouEu(ctx) {
    $$("[data-sou]", ctx).forEach((b) =>
      b.addEventListener("click", () => {
        definirEu(b.dataset.sou);
        toast(`Você está vendo os cadastros de ${eu}.`);
        renderMeus();
      }));
    const confirmar = () => {
      const v = $("#eu-novo", ctx).value.trim();
      if (!v) return toast("Digite seu nome.", "error");
      definirEu(v);
      toast(`Você está vendo os cadastros de ${eu}.`);
      renderMeus();
    };
    const btn = $("#btn-eu-novo", ctx);
    if (btn) btn.addEventListener("click", confirmar);
    const inp = $("#eu-novo", ctx);
    if (inp) inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); confirmar(); }
    });
  }

  function trocarEu() {
    /* Vendo outra pessoa: o botão volta para a própria lista. */
    if (pessoaVista !== eu && eu) { pessoaVista = eu; return renderMeus(); }
    definirEu(null);
    renderMeus();
  }

  function abrirPessoa(nome) {
    pessoaVista = nome;
    mostrarView("meus");
    renderMeus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- grade de equipamentos ---------------- */
  function renderEquipamentos() {
    const termo = $("#busca-equip").value.trim().toLowerCase();
    const grupos = agrupar((i) => i.equipamento)
      .filter((g) => !termo || g.nome.toLowerCase().includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    const grade = $("#equip-grid");
    if (!grupos.length) {
      grade.innerHTML = DB.itens.length
        ? vazio("🔎", "Nenhum equipamento encontrado", "Tente outro termo de busca.")
        : vazio("⚙️", "Nenhum equipamento", "Clique em “Novo equipamento” para começar.");
      return;
    }

    grade.innerHTML = grupos.map((g) => {
      const itens = DB.itens.filter((i) => i.equipamento === g.nome);
      const partes = new Set(itens.map((i) => i.parte)).size;
      const temMec = itens.some((i) => i.especialidade === "Mecânica");
      const temEle = itens.some((i) => i.especialidade === "Elétrica");
      return `<button class="equip-card" data-equip="${esc(g.nome)}">
        <div class="equip-top">
          <div class="equip-id">
            <div class="equip-nome">${esc(g.nome)}</div>
            <div class="equip-sub">${partes} parte(s) · ${g.total} componente(s)</div>
          </div>
          <div class="equip-pct">${pct(g.concluido, g.total)}%</div>
        </div>
        ${barra(g)}
        <div class="equip-stats">
          <div class="stat s-done"><b>${g.concluido}</b><span>Concl.</span></div>
          <div class="stat s-cad"><b>${g.cadastro}</b><span>Cadastro</span></div>
          <div class="stat s-and"><b>${g.andamento}</b><span>Andam.</span></div>
          <div class="stat s-wait"><b>${g.pendente}</b><span>Pend.</span></div>
        </div>
        <div class="equip-foot">
          <div class="equip-esp">
            ${temMec ? `<span class="chip esp c-mec">Mecânica</span>` : ""}
            ${temEle ? `<span class="chip esp c-ele">Elétrica</span>` : ""}
          </div>
          <span class="equip-go">Abrir →</span>
        </div>
      </button>`;
    }).join("");

    $$("[data-equip]", grade).forEach((b) =>
      b.addEventListener("click", () => abrirFicha(b.dataset.equip)));
  }

  /* ---------------- ficha do equipamento ---------------- */
  function abrirFicha(nome) {
    equipAtual = nome;
    partesFechadas.clear();
    mostrarView("ficha");
    $("#busca-ficha").value = "";
    $("#ficha-esp").value = "";
    $("#ficha-status").value = "";
    renderFicha();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function itensDoEquip() {
    return DB.itens.filter((i) => i.equipamento === equipAtual);
  }

  function renderFicha() {
    if (!equipAtual) return;
    const todos = itensDoEquip();

    /* Se o equipamento deixou de existir (último componente excluído) */
    if (!todos.length) {
      atualizarCabecalhoFicha(todos);
      $("#ficha-partes").innerHTML = vazio("📭", "Equipamento sem componentes",
        "Cadastre o primeiro componente ou volte para a lista de equipamentos.");
      return;
    }
    atualizarCabecalhoFicha(todos);

    /* filtros locais da ficha */
    const termo = $("#busca-ficha").value.trim().toLowerCase();
    const fe = $("#ficha-esp").value, fs = $("#ficha-status").value;
    const visiveis = todos.filter((i) => {
      if (fe && i.especialidade !== fe) return false;
      if (fs && i.status !== fs) return false;
      if (!termo) return true;
      return `${i.parte} ${i.componente} ${i.ni} ${i.responsavel} ${i.obs}`.toLowerCase().includes(termo);
    });

    const alvo = $("#ficha-partes");
    if (!visiveis.length) {
      alvo.innerHTML = vazio("🔎", "Nenhum componente", "Ajuste a busca ou os filtros desta ficha.");
      return;
    }

    /* agrupa por Parte */
    const porParte = new Map();
    visiveis.forEach((i) => {
      const k = (i.parte || "").trim() || "— sem parte —";
      if (!porParte.has(k)) porParte.set(k, []);
      porParte.get(k).push(i);
    });
    const partes = Array.from(porParte.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

    alvo.innerHTML = partes.map(([nomeParte, lista]) => {
      lista.sort((a, b) => a.componente.localeCompare(b.componente, "pt-BR"));
      const g = {
        total: lista.length,
        concluido: lista.filter((i) => i.status === "concluido").length,
        cadastro: lista.filter((i) => i.status === "cadastro").length,
        andamento: lista.filter((i) => i.status === "andamento").length,
      };
      const fechada = partesFechadas.has(nomeParte) ? " fechada" : "";
      return `<section class="parte${fechada}" data-parte="${esc(nomeParte)}">
        <div class="parte-head">
          <button class="parte-seta-btn" data-toggle="${esc(nomeParte)}" aria-expanded="${!fechada}">
            <span class="parte-seta">▼</span>
            <span class="parte-nome">${esc(nomeParte)}</span>
            <span class="parte-mini">${barra(g)}</span>
            <span class="parte-conta"><b>${g.concluido}</b>/${g.total}</span>
          </button>
          <div class="parte-acoes">
            <button class="icon-btn" title="Renomear parte" data-ren-parte="${esc(nomeParte)}">✏️</button>
            <button class="icon-btn danger" title="Excluir parte" data-del-parte="${esc(nomeParte)}">🗑️</button>
          </div>
        </div>
        <div class="parte-corpo">
          ${lista.map((i) => linhaComponente(i)).join("")}
          <button class="parte-add" data-add-parte="${esc(nomeParte)}">
            + Adicionar componente em “${esc(nomeParte)}”
          </button>
        </div>
      </section>`;
    }).join("");

    $$("[data-toggle]", alvo).forEach((b) => b.addEventListener("click", () => {
      const p = b.dataset.toggle;
      if (partesFechadas.has(p)) partesFechadas.delete(p); else partesFechadas.add(p);
      renderFicha();
    }));
    $$("[data-add-parte]", alvo).forEach((b) => b.addEventListener("click", () =>
      abrirForm(null, { equipamento: equipAtual, parte: b.dataset.addParte })));
    $$("[data-ren-parte]", alvo).forEach((b) =>
      b.addEventListener("click", () => renomearParte(b.dataset.renParte)));
    $$("[data-del-parte]", alvo).forEach((b) =>
      b.addEventListener("click", () => excluirParte(b.dataset.delParte)));
    $$("[data-edit]", alvo).forEach((b) => b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    $$("[data-del]", alvo).forEach((b) => b.addEventListener("click", () => excluir(b.dataset.del)));
  }

  function linhaComponente(i) {
    const st = STATUS[i.status] || STATUS.pendente;
    return `<div class="comp">
      <div class="comp-nome">
        ${esc(i.componente)}
        ${i.obs ? `<div class="comp-obs">${esc(i.obs.length > 120 ? i.obs.slice(0, 120) + "…" : i.obs)}</div>` : ""}
      </div>
      <div class="comp-ni">${i.ni ? `<span class="ni-tag">${esc(i.ni)}</span>` : `<span class="ni-empty">sem NI</span>`}</div>
      <div class="comp-esp">${chipEspCompleto(i.especialidade)}</div>
      <div class="comp-resp">${esc(i.responsavel || "—")}</div>
      <div class="comp-status"><span class="chip ${st.classe}">${st.rotulo}</span></div>
      <div class="comp-acoes">
        <button class="icon-btn" title="Editar" aria-label="Editar ${esc(i.componente)}" data-edit="${i.id}">✏️</button>
        <button class="icon-btn danger" title="Excluir" aria-label="Excluir ${esc(i.componente)}" data-del="${i.id}">🗑️</button>
      </div>
    </div>`;
  }

  function atualizarCabecalhoFicha(todos) {
    const g = {
      total: todos.length,
      concluido: todos.filter((i) => i.status === "concluido").length,
      cadastro: todos.filter((i) => i.status === "cadastro").length,
      andamento: todos.filter((i) => i.status === "andamento").length,
    };
    const pendente = g.total - g.concluido - g.cadastro - g.andamento;
    const partes = new Set(todos.map((i) => i.parte)).size;

    $("#ficha-head").innerHTML = `
      <div class="ficha-topo">
        <div class="ficha-titulo">
          <div class="ficha-eyebrow">Equipamento</div>
          <h2>${esc(equipAtual)}</h2>
        </div>
        <div class="ficha-acoes">
          <button class="btn-sec" id="btn-renomear">✏️ Renomear</button>
          <button class="btn-sec danger" id="btn-excluir-equip">🗑️ Excluir equipamento</button>
        </div>
      </div>
      <div class="ficha-resumo">
        <div class="ficha-pct">${pct(g.concluido, g.total)}%</div>
        <div class="ficha-barra">
          ${barra(g)}
          <div class="ficha-conta">
            <b>${g.concluido} concluído(s)</b> · ${g.cadastro} em cadastro · ${g.andamento} em andamento · ${pendente} pendente(s)
            &nbsp;·&nbsp; ${partes} parte(s) · ${g.total} componente(s)
          </div>
        </div>
      </div>`;

    $("#btn-renomear").addEventListener("click", renomearEquip);
    $("#btn-excluir-equip").addEventListener("click", excluirEquip);
  }

  function renomearEquip() {
    const atual = equipAtual;
    const novo = prompt(`Renomear equipamento:\n(o novo nome vale para todos os componentes)`, atual);
    if (novo === null) return;
    const nome = novo.trim();
    if (!nome) return toast("O nome não pode ficar vazio.", "error");
    if (nome === atual) return;

    const n = DB.itens.filter((i) => i.equipamento === atual).length;
    DB.itens.forEach((i) => { if (i.equipamento === atual) i.equipamento = nome; });
    equipAtual = nome;
    save();
    toast(`Equipamento renomeado em ${n} componente(s).`);
    renderFicha();
  }

  function renomearParte(parte) {
    const nova = prompt(`Renomear a parte "${parte}" de ${equipAtual}:`, parte);
    if (nova === null) return;
    const nome = nova.trim();
    if (!nome) return toast("O nome da parte não pode ficar vazio.", "error");
    if (nome === parte) return;

    let n = 0;
    DB.itens.forEach((i) => {
      if (i.equipamento === equipAtual && i.parte === parte) { i.parte = nome; n++; }
    });
    save();
    toast(`Parte renomeada em ${n} componente(s).`);
    renderFicha();
  }

  function excluirParte(parte) {
    const n = itensDoEquip().filter((i) => i.parte === parte).length;
    if (!confirm(`Excluir a parte "${parte}"?\n\n${n} componente(s) serão excluídos.\nEsta ação não pode ser desfeita.`)) return;
    DB.itens = DB.itens.filter((i) => !(i.equipamento === equipAtual && i.parte === parte));
    save();
    toast(`Parte excluída (${n} componente(s)).`);
    renderFicha();
  }

  function excluirEquip() {
    const n = itensDoEquip().length;
    if (!confirm(`Excluir o equipamento "${equipAtual}"?\n\n${n} componente(s) serão excluídos junto.\nEsta ação não pode ser desfeita.`)) return;
    DB.itens = DB.itens.filter((i) => i.equipamento !== equipAtual);
    save();
    toast(`Equipamento excluído (${n} componente(s)).`);
    equipAtual = null;
    mostrarView("equipamentos");
    renderEquipamentos();
  }

  /* ---------------- lista de cadastros ---------------- */
  function filtrados() {
    const termo = $("#busca").value.trim().toLowerCase();
    const fe = $("#f-equip").value, fs = $("#f-status").value;
    const fp = $("#f-esp").value, fr = $("#f-resp").value;

    return DB.itens.filter((i) => {
      if (fe && i.equipamento !== fe) return false;
      if (fs && i.status !== fs) return false;
      if (fp && i.especialidade !== fp) return false;
      if (fr && i.responsavel !== fr) return false;
      if (!termo) return true;
      return `${i.equipamento} ${i.parte} ${i.componente} ${i.ni} ${i.responsavel} ${i.obs}`
        .toLowerCase().includes(termo);
    }).sort((a, b) =>
      a.equipamento.localeCompare(b.equipamento, "pt-BR") ||
      a.parte.localeCompare(b.parte, "pt-BR") ||
      a.componente.localeCompare(b.componente, "pt-BR"));
  }

  function renderCadastros() {
    sincronizarFiltros();
    const lista = filtrados();
    const tbody = $("#tabela tbody");

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="8">${DB.itens.length
        ? vazio("🔎", "Nenhum resultado", "Ajuste a busca ou os filtros.")
        : vazio("📋", "Nenhum cadastro", "Clique em “Novo cadastro” para começar.")}</td></tr>`;
      $("#contador").textContent = "";
      return;
    }

    tbody.innerHTML = lista.map((i) => {
      const st = STATUS[i.status] || STATUS.pendente;
      return `<tr>
        <td data-label="Equipamento"><span class="cell-strong">${esc(i.equipamento)}</span></td>
        <td data-label="Parte">${esc(i.parte)}</td>
        <td data-label="Componente">
          <div class="crumb">${esc(i.equipamento)} <span>›</span> ${esc(i.parte)}</div>
          <div class="cell-strong">${esc(i.componente)}</div>
          ${i.obs ? `<div class="cell-sub">${esc(i.obs.length > 90 ? i.obs.slice(0, 90) + "…" : i.obs)}</div>` : ""}
        </td>
        <td data-label="NI">${i.ni
          ? `<span class="ni-tag">${esc(i.ni)}</span>`
          : `<span class="ni-empty">sem NI</span>`}</td>
        <td data-label="Especialidade">${chipEspCompleto(i.especialidade)}</td>
        <td data-label="Responsável">${esc(i.responsavel || "—")}</td>
        <td data-label="Status"><span class="chip ${st.classe}">${st.rotulo}</span></td>
        <td data-label="Ações"><div class="row-actions">
          <button class="icon-btn" title="Editar" aria-label="Editar ${esc(i.componente)}" data-edit="${i.id}">✏️</button>
          <button class="icon-btn danger" title="Excluir" aria-label="Excluir ${esc(i.componente)}" data-del="${i.id}">🗑️</button>
        </div></td>
      </tr>`;
    }).join("");

    const cad = lista.filter((i) => i.status === "concluido").length;
    $("#contador").textContent =
      `${lista.length} de ${DB.itens.length} componente(s) · ${cad} concluído(s) (${pct(cad, lista.length)}% do filtro)`;

    $$("[data-edit]", tbody).forEach((b) => b.addEventListener("click", () => abrirForm(b.dataset.edit)));
    $$("[data-del]", tbody).forEach((b) => b.addEventListener("click", () => excluir(b.dataset.del)));
  }

  function chipEspCompleto(esp) {
    if (esp === "Mecânica") return `<span class="chip esp c-mec">Mecânica</span>`;
    if (esp === "Elétrica") return `<span class="chip esp c-ele">Elétrica</span>`;
    return `<span class="ni-empty">—</span>`;
  }

  function valoresUnicos(campo) {
    return Array.from(new Set(DB.itens.map((i) => (i[campo] || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function sincronizarFiltros() {
    preencherSelect("#f-equip", "Todos os equipamentos", valoresUnicos("equipamento"));
    preencherSelect("#f-resp", "Todos os responsáveis", valoresUnicos("responsavel"));
    preencherDatalist("#dl-equip", valoresUnicos("equipamento"));
    preencherDatalist("#dl-parte", valoresUnicos("parte"));
    preencherDatalist("#dl-resp", valoresUnicos("responsavel"));
  }

  function preencherSelect(sel, rotuloTodos, opcoes) {
    const el = $(sel), atual = el.value;
    el.innerHTML = `<option value="">${rotuloTodos}</option>` +
      opcoes.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("");
    if (opcoes.includes(atual)) el.value = atual;
  }

  function preencherDatalist(sel, opcoes) {
    $(sel).innerHTML = opcoes.map((o) => `<option value="${esc(o)}"></option>`).join("");
  }

  /* ---------------- formulário ---------------- */
  function abrirForm(id, pre) {
    const it = id ? DB.itens.find((x) => x.id === id) : null;
    const p = pre || {};
    /* sugestões sempre atualizadas, venha o formulário de onde vier */
    preencherDatalist("#dl-equip", valoresUnicos("equipamento"));
    preencherDatalist("#dl-parte", valoresUnicos("parte"));
    preencherDatalist("#dl-resp", valoresUnicos("responsavel"));
    const v = (campo) => esc(it ? it[campo] : (p[campo] || ""));
    const sel = (campo, valor) => (it && it[campo] === valor ? "checked" : "");
    const statusSel = (s) => (it ? it.status === s : s === "pendente") ? "selected" : "";

    abrirModal(it ? "Editar componente" : "Novo componente", `
      <div class="field">
        <label for="f-eq">Equipamento <span class="req">*</span></label>
        <input id="f-eq" name="equipamento" list="dl-equip" required value="${v("equipamento")}" placeholder="Ex.: Slitter" autocomplete="off" />
      </div>
      <div class="field">
        <label for="f-pt">Parte <span class="req">*</span></label>
        <input id="f-pt" name="parte" list="dl-parte" required value="${v("parte")}" placeholder="Ex.: Desbobinador" autocomplete="off" />
      </div>
      <div class="field full">
        <label for="f-cp">Componente <span class="req">*</span></label>
        <input id="f-cp" name="componente" required value="${v("componente")}" placeholder="Ex.: Motor desbobinador" autocomplete="off" />
      </div>
      <div class="field full">
        <label>Especialidade <span class="req">*</span></label>
        <div class="seg-input">
          <label>
            <input type="radio" name="especialidade" value="Mecânica" ${it ? sel("especialidade", "Mecânica") : "checked"} />
            <span class="opt">🔩 Mecânica</span>
          </label>
          <label>
            <input type="radio" name="especialidade" value="Elétrica" ${sel("especialidade", "Elétrica")} />
            <span class="opt">⚡ Elétrica</span>
          </label>
        </div>
      </div>
      <div class="field">
        <label for="f-ni">NI <span class="hint">(sistema Usiminas)</span></label>
        <input id="f-ni" name="ni" value="${v("ni")}" placeholder="Ex.: NI-450231" autocomplete="off" />
      </div>
      <div class="field">
        <label for="f-rs">Responsável</label>
        <input id="f-rs" name="responsavel" list="dl-resp" value="${v("responsavel")}" placeholder="Nome" autocomplete="off" />
      </div>
      <div class="field full">
        <label for="f-st">Status <span class="req">*</span></label>
        <select id="f-st" name="status">
          <option value="pendente" ${statusSel("pendente")}>Pendente</option>
          <option value="andamento" ${statusSel("andamento")}>Em andamento</option>
          <option value="cadastro" ${statusSel("cadastro")}>Em cadastro</option>
          <option value="concluido" ${statusSel("concluido")}>Concluído</option>
        </select>
      </div>
      <div class="field full">
        <label for="f-ob">Observações e comentários</label>
        <textarea id="f-ob" name="obs" placeholder="Anotações sobre o cadastro, pendências, referências do fabricante...">${v("obs")}</textarea>
      </div>
    `, (form) => {
      const dados = {
        equipamento: form.equipamento.value.trim(),
        parte: form.parte.value.trim(),
        componente: form.componente.value.trim(),
        especialidade: (form.querySelector('input[name="especialidade"]:checked') || {}).value || "Mecânica",
        ni: form.ni.value.trim(),
        responsavel: form.responsavel.value.trim(),
        status: form.status.value,
        obs: form.obs.value.trim(),
      };

      if (!dados.equipamento || !dados.parte || !dados.componente)
        return toast("Preencha Equipamento, Parte e Componente.", "error");

      if (EXIGE_NI.includes(dados.status) && !dados.ni)
        return toast(`Informe o NI para marcar como ${STATUS[dados.status].rotulo}.`, "error");

      const dupNI = dados.ni && DB.itens.find(
        (x) => x.ni && x.ni.toLowerCase() === dados.ni.toLowerCase() && x.id !== id);
      if (dupNI) return toast(`O NI ${dados.ni} já está em "${dupNI.componente}".`, "error");

      if (it) { Object.assign(it, dados); toast("Componente atualizado."); }
      else { DB.itens.push({ id: uid(), ...dados }); toast("Componente cadastrado."); }

      /* Se estava na ficha e o equipamento mudou, acompanha o item */
      if (viewAtual() === "ficha" && dados.equipamento !== equipAtual) equipAtual = dados.equipamento;

      save();
      fecharModal();
      renderAtual();
    });
  }

  function excluir(id) {
    const it = DB.itens.find((x) => x.id === id);
    if (!it) return;
    if (!confirm(`Excluir "${it.componente}"?\n${it.equipamento} › ${it.parte}\n\nEsta ação não pode ser desfeita.`)) return;
    DB.itens = DB.itens.filter((x) => x.id !== id);
    save();
    toast("Componente excluído.");
    renderAtual();
  }

  /* ---------------- modal ---------------- */
  let aoSalvar = null;
  let focoAnterior = null;

  function abrirModal(titulo, corpo, onSubmit) {
    focoAnterior = document.activeElement;
    $("#modal-title").textContent = titulo;
    $("#modal-form").innerHTML = corpo;
    aoSalvar = onSubmit;
    $("#modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    const primeiro = $("#modal-form input, #modal-form select, #modal-form textarea");
    if (primeiro) setTimeout(() => primeiro.focus(), 60);
  }

  function fecharModal() {
    $("#modal").classList.add("hidden");
    $("#modal-form").innerHTML = "";
    aoSalvar = null;
    document.body.style.overflow = "";
    if (focoAnterior && focoAnterior.focus) focoAnterior.focus();
  }

  /* ---------------- exportar / importar ---------------- */
  function exportar() {
    const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cadastro-sobressalentes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Backup exportado.");
  }

  function importar(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        const itens = Array.isArray(d) ? d : d.itens;
        if (!Array.isArray(itens)) throw new Error("formato");
        DB.itens = itens.map((i) => ({
          id: i.id || uid(),
          equipamento: i.equipamento || "",
          parte: i.parte || "",
          componente: i.componente || "",
          especialidade: i.especialidade === "Elétrica" ? "Elétrica" : "Mecânica",
          ni: i.ni || "",
          responsavel: i.responsavel || "",
          status: STATUS[i.status] ? i.status : "pendente",
          obs: i.obs || "",
        }));
        save();
        toast(`${DB.itens.length} componente(s) importado(s).`);
        /* a ficha aberta pode não existir mais nos dados importados */
        if (atual === "ficha" && !itensDoEquip().length) {
          equipAtual = null;
          mostrarView("equipamentos");
        }
        renderAtual();
      } catch (e) {
        toast("Arquivo inválido. Use um backup exportado pelo app.", "error");
      }
    };
    r.readAsText(file);
  }

  /* ---------------- navegação ---------------- */
  let atual = "painel";
  const viewAtual = () => atual;

  function mostrarView(v) {
    atual = v;
    $$(".view").forEach((s) => s.classList.add("hidden"));
    $("#view-" + v).classList.remove("hidden");
    /* A ficha é filha de "equipamentos": mantém esse item destacado no menu */
    const destaque = v === "ficha" ? "equipamentos" : v;
    $$(".nav-item").forEach((b) => {
      const on = b.dataset.view === destaque;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  function renderAtual() {
    renderResumoLateral();
    marcarCarimbo();
    if (atual === "meus") renderMeus();
    else if (atual === "lista") renderCadastros();
    else if (atual === "equipamentos") renderEquipamentos();
    else if (atual === "ficha") renderFicha();
    else renderPainel();
  }

  function initNav() {
    $$(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        mostrarView(btn.dataset.view);
        renderAtual();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    $("#btn-voltar").addEventListener("click", () => {
      equipAtual = null;
      mostrarView("equipamentos");
      renderEquipamentos();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function initEventos() {
    $("#btn-novo").addEventListener("click", () => abrirForm(null));
    $("#btn-novo-equip").addEventListener("click", () => abrirForm(null));
    $("#btn-novo-comp").addEventListener("click", () => abrirForm(null, { equipamento: equipAtual }));

    $("#btn-novo-meu").addEventListener("click", () =>
      abrirForm(null, { responsavel: pessoaVista || "" }));
    $("#btn-trocar-eu").addEventListener("click", trocarEu);
    ["#busca-meus", "#meus-esp", "#meus-status"].forEach((sel) => {
      const el = $(sel);
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderMeus);
    });

    $("#busca-equip").addEventListener("input", renderEquipamentos);
    ["#busca-ficha", "#ficha-esp", "#ficha-status"].forEach((s) => {
      const el = $(s);
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderFicha);
    });

    ["#busca", "#f-equip", "#f-esp", "#f-status", "#f-resp"].forEach((s) => {
      const el = $(s);
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", renderCadastros);
    });

    $("#modal-form").addEventListener("submit", (e) => {
      e.preventDefault();
      if (aoSalvar) aoSalvar(e.target);
    });
    $("#modal-close").addEventListener("click", fecharModal);
    $("#modal-cancel").addEventListener("click", fecharModal);
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !$("#modal").classList.contains("hidden")) fecharModal();
    });

    $("#btn-exportar").addEventListener("click", exportar);
    $("#input-importar").addEventListener("change", (e) => {
      const f = e.target.files[0];
      if (f) importar(f);
      e.target.value = "";
    });
  }

  /* ---------------- boot ---------------- */
  carregarEu();
  load();
  initNav();
  initEventos();
  renderResumoLateral();
  marcarCarimbo();
  renderPainel();
})();

