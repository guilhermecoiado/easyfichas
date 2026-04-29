const API = "https://script.google.com/macros/s/AKfycbw2yBR_PMRAqLx4FRHjU3PduvbAJxZsAxfUtNf4EV01m7S83jjCfZm95OHva6NH2Yumwg/exec";
let fichas = [];
let filtroRede = null;
let fichaPendenteEnvio = null;
let fichaPendenteRestaurar = null; // Variável global para controle
let tentativasLogin = 0;
let deferredInstallPrompt = null;

const INSTALL_CTA_DISMISSED_UNTIL_KEY = "easyfichas_install_cta_dismissed_until";
const INSTALL_CTA_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isStandaloneMode() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isMobileBrowser() {
    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || "");
}

function forcarAtualizacao() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(reg => reg.unregister());
        });
    }
    // Limpa cache do navegador e recarrega sem usar cache
    window.location.reload(true);
}

function isIosDevice() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstallCtaDismissed() {
    const until = Number(localStorage.getItem(INSTALL_CTA_DISMISSED_UNTIL_KEY) || 0);
    return until > Date.now();
}

function showInstallCta() {
    const cta = document.getElementById("install-cta");
    if (!cta || isStandaloneMode() || !isMobileBrowser() || isInstallCtaDismissed()) return;
    cta.hidden = false;
    lucide.createIcons();
}

function hideInstallCta() {
    const cta = document.getElementById("install-cta");
    if (!cta) return;
    cta.hidden = true;
}

function dismissInstallCta() {
    localStorage.setItem(INSTALL_CTA_DISMISSED_UNTIL_KEY, String(Date.now() + INSTALL_CTA_DISMISS_TTL_MS));
    hideInstallCta();
}

async function triggerInstallPrompt() {
    if (isStandaloneMode()) {
        hideInstallCta();
        return;
    }

    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === "accepted") {
            hideInstallCta();
        }
        deferredInstallPrompt = null;
        return;
    }

    if (isIosDevice()) {
        alert("Para instalar no iPhone: toque em Compartilhar e depois em Adicionar \\u00e0 Tela de In\\u00edcio.");
        return;
    }

    alert("No Android, use o menu do navegador e toque em Instalar app ou Adicionar \\u00e0 tela inicial.");
}

function setupPwaInstallPrompt() {
    const installBtn = document.getElementById("install-cta-action");
    const dismissBtn = document.getElementById("install-cta-dismiss");

    if (installBtn) installBtn.addEventListener("click", triggerInstallPrompt);
    if (dismissBtn) dismissBtn.addEventListener("click", dismissInstallCta);

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        showInstallCta();
    });

    window.addEventListener("appinstalled", () => {
        deferredInstallPrompt = null;
        hideInstallCta();
        localStorage.removeItem(INSTALL_CTA_DISMISSED_UNTIL_KEY);
    });

    if (!isStandaloneMode() && isMobileBrowser() && !isInstallCtaDismissed() && isIosDevice()) {
        showInstallCta();
    }
}

setupPwaInstallPrompt();

// Função para verificar se já existe login salvo ao abrir o app
function verificarLoginSalvo() {
    const salvoUser = localStorage.getItem("easyfichas_user");
    const salvaPass = localStorage.getItem("easyfichas_pass");

    if (salvoUser === "gestaofichas" && salvaPass === "pazfichas2026") {
        document.getElementById("login-container").style.display = "none";
        init(); // Pula o login e inicia o app
    }
}

function validarLogin() {
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;
    const errorMsg = document.getElementById("login-error");
    const btnAcessar = document.querySelector("#login-container button");

    if (user === "gestaofichas" && pass === "pazfichas2026") {
        // SALVA OS DADOS NO NAVEGADOR
        localStorage.setItem("easyfichas_user", user);
        localStorage.setItem("easyfichas_pass", pass);

        document.getElementById("login-container").style.display = "none";
        init(); 
    } else {
        tentativasLogin++;
        if (tentativasLogin >= 3) {
            errorMsg.innerText = "Entre em contato com o administrador e solicite novamente os dados de acesso.";
            btnAcessar.disabled = true;
            btnAcessar.style.background = "#ccc";
        } else {
            errorMsg.innerText = "Dados incorretos, tente novamente.";
        }
    }
}

// Chame a verificação assim que o script carregar
verificarLoginSalvo();

// Ajuste para o Enter no teclado
document.addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && document.getElementById("login-container").style.display !== "none") {
        validarLogin();
    }
});

// Função auxiliar para padronizar classes de rede (Slug)
const criarSlug = (texto) => {
    if (!texto) return "";
    return texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/\s+/g, '-')           // Espaço vira hífen
        .replace(/[^a-z0-9-]/g, '')    // Remove símbolos
        .replace(/-+/g, '-')           // Evita hífens duplos (---)
        .replace(/^-+|-+$/g, '');      // Remove hífens no início ou fim
};

// --- FUNÇÕES DE PERSISTÊNCIA ---

async function salvarNaPlanilha(id, campo, valor) {
    try {
        await fetch(API, {
            method: "POST",
            mode: "no-cors", 
            body: JSON.stringify({
                tipo: "atualizar",
                id: id,
                campo: campo,
                valor: valor
            })
        });
        console.log(`Persistência: ${campo} atualizado.`);
    } catch (e) {
        console.error("Erro ao salvar na planilha:", e);
    }
}

// --- INICIALIZAÇÃO E CARREGAMENTO ---

async function getFichas(){
  try { 
    const res = await fetch(API); 
    return await res.json(); 
  } catch(e) { 
    console.error("Erro ao buscar fichas:", e); 
    return []; 
  }
}

async function init() {
    const loader = document.getElementById("loader-container");
    fichas = await getFichas();
    
    if(Array.isArray(fichas)) {
        // Inicializa mostrando apenas as não enviadas em ordem alfabética
        const naoEnviadas = ordenarAlfabetica(fichas.filter(f => f.FICHA_ENVIADA !== "Sim"));
        mostrarModoHome();
        renderCards(naoEnviadas);
        configurarDropdowns();
        atualizarContadores();
    }
    
    setTimeout(() => {
        if(loader) loader.classList.add("loader-hidden");
        lucide.createIcons();
    }, 1500);
}
// --- NAVEGAÇÃO E TELAS ---

function obterNomeOrdenacaoFicha(f) {
    return (f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "").toString().trim();
}

function ordenarAlfabetica(lista) {
    return [...lista].sort((a, b) => {
        const nomeA = obterNomeOrdenacaoFicha(a);
        const nomeB = obterNomeOrdenacaoFicha(b);
        return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
    });
}

function ordenarNaoEnviadasPrimeiro(lista) {
    return [...lista].sort((a, b) => {
        const ordemA = a.FICHA_ENVIADA === "Sim" ? 1 : 0;
        const ordemB = b.FICHA_ENVIADA === "Sim" ? 1 : 0;
        if (ordemA !== ordemB) return ordemA - ordemB;
        const nomeA = obterNomeOrdenacaoFicha(a);
        const nomeB = obterNomeOrdenacaoFicha(b);
        return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
    });
}

function aplicarFiltroRede(lista) {
    return filtroRede ? lista.filter(f => f.REDE === filtroRede) : lista;
}

function montarListaDaTelaAtual() {
    const tituloAtual = document.getElementById("title").innerText || "";
    const planilha = document.getElementById("filter-planilha").value;

    let base = aplicarFiltroRede(fichas);

    if (tituloAtual.startsWith("Enviadas")) {
        return ordenarAlfabetica(base.filter(f => f.FICHA_ENVIADA === "Sim"));
    }

    if (tituloAtual === "Favoritos") {
        return ordenarAlfabetica(base.filter(f => f.FAVORITO === "Sim"));
    }

    if (planilha === "lifegroups") {
        return ordenarNaoEnviadasPrimeiro(base.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER"));
    }

    if (planilha === "novo-nascimento") {
        return ordenarNaoEnviadasPrimeiro(base.filter(f => f.ORIGEM === "NOVO_NASCIMENTO_MASTER"));
    }

    if (planilha === "decisao-online") {
        return ordenarNaoEnviadasPrimeiro(base.filter(f => f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER"));
    }

    // Home padrão: apenas não enviadas em ordem alfabética
    return ordenarAlfabetica(base.filter(f => f.FICHA_ENVIADA !== "Sim"));
}

function mostrarModoHome() {
    document.getElementById("summary-shortcuts").style.display = "";
    document.getElementById("enviadas-filter").style.display = "none";
    document.getElementById("nao-enviadas-counter").style.display = "";
}

function mostrarModoEnviadas() {
    document.getElementById("summary-shortcuts").style.display = "none";
    document.getElementById("enviadas-filter").style.display = "";
    document.getElementById("nao-enviadas-counter").style.display = "none";
    // Atualiza totais dos pills
    const base = aplicarFiltroRede(fichas).filter(f => f.FICHA_ENVIADA === "Sim");
    document.getElementById("pill-count-todas").innerText          = base.length;
    document.getElementById("pill-count-lifegroups").innerText     = base.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER").length;
    document.getElementById("pill-count-novo-nascimento").innerText = base.filter(f => f.ORIGEM === "NOVO_NASCIMENTO_MASTER").length;
    document.getElementById("pill-count-decisao-online").innerText  = base.filter(f => f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER").length;
    lucide.createIcons();
}

function home() { 
    document.getElementById("title").innerText = "easyfichas"; 
    document.getElementById("rede-indicator").style.display = "none";
    filtroRede = null;
    document.getElementById("filter-planilha").value = "";
    atualizarCorBusca(null);
    mostrarModoHome();
    const naoEnviadas = ordenarAlfabetica(fichas.filter(f => f.FICHA_ENVIADA !== "Sim"));
    renderCards(naoEnviadas); 
    atualizarContadores();
}

function showSent() {
    document.getElementById("filter-planilha").value = "";
    atualizarCorBusca(null);
    mostrarModoEnviadas();
    filtrarEnviadas("todas");
}

function abrirFiltroEnviadas() {
    document.getElementById("enviadas-backdrop").classList.add("open");
    document.getElementById("enviadas-sheet").classList.add("open");
    lucide.createIcons();
}

function fecharFiltroEnviadas() {
    document.getElementById("enviadas-backdrop").classList.remove("open");
    document.getElementById("enviadas-sheet").classList.remove("open");
}

function filtrarEnviadas(tipo) {
    fecharFiltroEnviadas();

    const base = ordenarAlfabetica(aplicarFiltroRede(fichas).filter(f => f.FICHA_ENVIADA === "Sim"));
    let lista = base;
    if (tipo === "lifegroups")           lista = base.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER");
    else if (tipo === "novo-nascimento") lista = base.filter(f => f.ORIGEM === "NOVO_NASCIMENTO_MASTER");
    else if (tipo === "decisao-online")  lista = base.filter(f => f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER");

    document.getElementById("title").innerText = `Enviadas (${lista.length})`;
    renderCards(lista);

    // Label na barra
    const labels = { todas: "Todas", lifegroups: "Lifegroups", "novo-nascimento": "Novo Nasc.", "decisao-online": "Decis\u00e3o Online" };
    document.getElementById("enviadas-filtro-texto").innerText = labels[tipo] || "Todas";

    // Estado ativo nos itens do sheet
    document.querySelectorAll(".enviadas-sheet-item").forEach(el => {
        el.className = "enviadas-sheet-item";
    });
    const classeAtiva = tipo === "todas" ? "active" :
                        tipo === "lifegroups" ? "active-lifegroups" :
                        tipo === "novo-nascimento" ? "active-novo-nascimento" :
                        "active-decisao-online";
    const idSheet = tipo === "todas" ? "sheet-todas" :
                    tipo === "lifegroups" ? "sheet-lifegroups" :
                    tipo === "novo-nascimento" ? "sheet-novo-nascimento" :
                    "sheet-decisao-online";
    document.getElementById(idSheet).classList.add(classeAtiva);
}
function showFavorites() {
    const filtradas = ordenarAlfabetica(aplicarFiltroRede(fichas).filter(f => f.FAVORITO === "Sim"));
    document.getElementById("title").innerText = "Favoritos";
    document.getElementById("nao-enviadas-counter").style.display = "none";
    renderCards(filtradas);
}

// --- AÇÕES DOS CARDS (COM PERSISTÊNCIA) ---

function toggleFav(id) {
    const f = fichas.find(x => x.ID == id);
    if(f) {
        f.FAVORITO = (f.FAVORITO === "Sim") ? "Não" : "Sim";
        renderCards(fichas);
        salvarNaPlanilha(id, "FAVORITO", f.FAVORITO);
    }
}

function aplicarTagRede(r) {
    const f = fichas.find(x => x.ID === window.fichaParaTaguear);
    if(f) {
        f.REDE = r;
        renderCards(fichas);
        salvarNaPlanilha(f.ID, "REDE", r);
    }
    fecharModalRede();
}

function confirmarEnvio(id) { 
    fichaPendenteEnvio = id; 
    const checkbox = document.getElementById("toggle-destinatario-envio");
    const container = document.getElementById("container-destinatario-envio");
    const input = document.getElementById("input-destinatario-envio");
    if (checkbox) checkbox.checked = false;
    if (container) container.style.display = "none";
    if (input) input.value = "";
    document.getElementById("modal-confirm-envio").style.display = "flex"; 
}

function fecharModalEnvio() { 
    document.getElementById("modal-confirm-envio").style.display = "none"; 
}

function toggleDestinatarioEnvio() {
    const checkbox = document.getElementById("toggle-destinatario-envio");
    const container = document.getElementById("container-destinatario-envio");
    const input = document.getElementById("input-destinatario-envio");
    if (!checkbox || !container) return;

    container.style.display = checkbox.checked ? "block" : "none";
    if (checkbox.checked && input) {
        input.focus();
    }
}

function processarEnvio() {
    const f = fichas.find(x => x.ID == fichaPendenteEnvio);
    if (!f) {
        fecharModalEnvio();
        return;
    }

    const informarDestinatario = document.getElementById("toggle-destinatario-envio")?.checked;
    const nomeDestinatario = (document.getElementById("input-destinatario-envio")?.value || "").trim();

    if (informarDestinatario && !nomeDestinatario) {
        alert("Informe o nome do destinatário.");
        return;
    }

    let msg = "";
    const nome = (f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "Não informado").toUpperCase();
    const fone = f["TELEFONE"] || f["Celular"] || f["Fone/Wpp"] || f["Fone/WhatsApp"] || "";

    if (f.ORIGEM === "LIFE_GROUPS_MASTER") {
        msg = `*Ficha Lifegroup*\n\n`;
        msg += `*Nome:* ${nome}\n`;
        if (f["idade"] || f["Idade"]) msg += `*Idade:* ${f["idade"] || f["Idade"]}\n`;
        if (f["ESTADO_CIVIL"] || f["Estado Civil"]) msg += `*Estado Civil:* ${f["ESTADO_CIVIL"] || f["Estado Civil"]}\n`;
        const endereco = f["ENDERECO"] || f["Endereço"] || "";
        const bairro = f["BAIRRO"] || f["Bairro"] || "";
        if (endereco || bairro) msg += `*Endereço/Bairro:* ${endereco}${endereco && bairro ? ' - ' : ''}${bairro}\n`;
        if (f["MELHOR_DIA"] || f["Melhor dia?"]) msg += `*Melhor dia:* ${f["MELHOR_DIA"] || f["Melhor dia?"]}\n`;
        const instagram = f["Instagram"] || f["User Instagram"] || "";
        msg += `*Contato/Instagram:* ${fone}${fone && instagram ? ' / ' : ''}${instagram}\n`;
    } else {
        msg = `*Ficha Decisão Por Jesus/Novo Nascimento*\n\n`;
        msg += `*Nome:* ${nome}\n`;
        if (f["Idade"] || f["idade"]) msg += `*Idade:* ${f["Idade"] || f["idade"]}\n`;
        if (f["ESTADO_CIVIL"] || f["Estado Civil"]) msg += `*Est. Civil:* ${f["ESTADO_CIVIL"] || f["Estado Civil"]}\n`;
        msg += `*Contato/Fone/Wpp:* ${fone}\n`;
        const endereco = f["ENDERECO"] || f["Endereço"] || "";
        const bairro = f["BAIRRO"] || f["Bairro"] || "";
        if (endereco || bairro) msg += `*Endereço/Bairro:* ${endereco}${endereco && bairro ? ' - ' : ''}${bairro}\n`;
        const noLife = f["Já num Life?"] || f["Já está em um Life Group?"] || f["Já em um Life?"];
        if (noLife) msg += `*Já Num Life?:* ${noLife}\n`;
        if (f["Sobre sua decisão"]) msg += `\n*Sobre sua decisão:* ${f["Sobre sua decisão"]}\n`;
    }

    f.FICHA_ENVIADA = "Sim";
    f.ENVIADO_PARA = informarDestinatario ? nomeDestinatario : "";
    renderCards(montarListaDaTelaAtual());
    salvarNaPlanilha(f.ID, "FICHA_ENVIADA", "Sim");
    salvarNaPlanilha(f.ID, "ENVIADO_PARA", f.ENVIADO_PARA);
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    fecharModalEnvio();
}

// --- FUNÇÕES DE RESTAURAÇÃO ---

function confirmarRestaurar(id) { 
    fichaPendenteRestaurar = id; 
    document.getElementById("modal-confirm-restaurar").style.display = "flex"; 
}

function fecharModalRestaurar() { 
    document.getElementById("modal-confirm-restaurar").style.display = "none"; 
}

async function processarRestauracao() {
    fecharModalRestaurar();
    const f = fichas.find(x => x.ID == fichaPendenteRestaurar);
    if(f) {
        f.FICHA_ENVIADA = "Não"; 
        renderCards(montarListaDaTelaAtual());
        salvarNaPlanilha(f.ID, "FICHA_ENVIADA", "Não");
    }
}

// --- FILTROS E BUSCA ---

// Abre o popup de filtro de rede e cria os botões dinamicamente
function toggleRede() {
    const container = document.getElementById("container-filtro-redes");
    if(!container) return;
    
    container.innerHTML = ""; // Limpa anterior

    CONFIG_REDES.forEach(rede => {
        const btn = document.createElement("button");
        btn.innerText = rede.nome;
        btn.className = "rede-option-btn";
        btn.style.setProperty("--rede-color", rede.cor || "#4b5563");
        btn.onclick = () => selecionarFiltroRede(rede);
        container.appendChild(btn);
    });

    document.getElementById("modal-filtro-rede").style.display = "flex";
}

// Aplica o filtro selecionado e fecha o modal
function selecionarFiltroRede(redeConfig) {
    const ind = document.getElementById("rede-indicator");
    const telaAtual = document.getElementById("title").innerText;

    if(redeConfig) {
        filtroRede = redeConfig.nome;
        ind.innerText = filtroRede; 
        ind.style.display = "block";
        ind.style.backgroundColor = redeConfig.cor;
    } else {
        filtroRede = null;
        ind.style.display = "none"; 
    }

    // Lógica para decidir o que renderizar após filtrar a rede
    if (telaAtual.startsWith("Enviadas")) {
        showSent();
    } else if (telaAtual === "Favoritos") {
        showFavorites();
    } else {
        const planilha = document.getElementById("filter-planilha").value;
        if (planilha === "lifegroups" || planilha === "novo-nascimento" || planilha === "decisao-online") {
            filtrarPorPlanilhaRapido(planilha);
        } else {
            renderCards(montarListaDaTelaAtual());
        }
    }
    
    atualizarContadores();
    fecharFiltroRede();
}

function fecharFiltroRede() {
    document.getElementById("modal-filtro-rede").style.display = "none";
}

function openFilter() { document.getElementById("modal-filtros").style.display = "flex"; }
function fecharFiltros() { document.getElementById("modal-filtros").style.display = "none"; }

function aplicarFiltros() {
    const ft = {
        b: document.getElementById("filter-bairro").value,
        s: document.getElementById("filter-sexo").value,
        c: document.getElementById("filter-civil").value,
        d: document.getElementById("filter-dia").value,
        p: document.getElementById("filter-pastor").value,
        planilha: document.getElementById("filter-planilha").value 
    };

    const filtradas = fichas.filter(f => {
        let passaPlanilha = true;
        if (ft.planilha === "lifegroups") {
            passaPlanilha = f.ORIGEM === "LIFE_GROUPS_MASTER";
        } else if (ft.planilha === "novo-nascimento") {
            passaPlanilha = f.ORIGEM === "NOVO_NASCIMENTO_MASTER";
        } else if (ft.planilha === "decisao-online") {
            passaPlanilha = f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER";
        }

        return passaPlanilha &&
               (!ft.b || (f["BAIRRO"] || f["Bairro"]) === ft.b) &&
               (!ft.s || (f["SEXO"] || f["Sexo"]) === ft.s) &&
               (!ft.c || (f["ESTADO_CIVIL"] || f["Estado Civil"]) === ft.c) &&
               (!ft.d || (f["MELHOR_DIA"] || f["Melhor dia?"]) === ft.d);
    });

    renderCards(filtradas);
    fecharFiltros();
}

function limparFiltros() { 
    document.querySelectorAll(".filter-input").forEach(i => i.value = ""); 
    renderCards(fichas); 
    fecharFiltros(); 
}

function configurarDropdowns() {
    const campos = {
        "filter-bairro": ["BAIRRO", "Bairro"], 
        "filter-sexo": ["SEXO", "Sexo"], 
        "filter-civil": ["ESTADO_CIVIL", "Estado Civil"], 
        "filter-dia": ["MELHOR_DIA", "Melhor dia?"], 
        "filter-pastor": ["Pastor de Rede"]
    };
    Object.keys(campos).forEach(id => {
        const select = document.getElementById(id);
        const vals = [...new Set(fichas.map(f => {
            let v = ""; 
            campos[id].forEach(col => { if(f[col]) v = f[col]; }); 
            return v;
        }))].filter(v => v !== "").sort();
        select.innerHTML = `<option value="">${select.options[0].text}</option>` + vals.map(v => `<option value="${v}">${v}</option>`).join("");
    });
}

// --- IMPORTAÇÃO ---

function importPlanilha() { document.getElementById("modal-importar").style.display = "flex"; }
function fecharImportar() { document.getElementById("modal-importar").style.display = "none"; }
function fecharModalProgresso() { 
    document.getElementById("modal-progresso").style.display = "none"; 
    document.getElementById("fileInput").value = ""; 
}

function selecionarArquivo(m) { 
    window.masterSelecionada = m; 
    fecharImportar(); 
    document.getElementById("fileInput").click(); 
}

document.getElementById("fileInput").addEventListener("change", async function(e) {
    const file = e.target.files[0]; 
    if(!file) return;

    const modalProg = document.getElementById("modal-progresso");
    const barra = document.getElementById("barra-progresso");
    const statusTxt = document.getElementById("status-importacao");
    const btnOk = document.getElementById("btn-concluir-import");

    modalProg.style.display = "flex";
    barra.style.width = "20%";
    barra.style.backgroundColor = "var(--primary)";
    statusTxt.innerText = "Lendo arquivo...";
    btnOk.style.display = "none";

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        if (json.length === 0) throw new Error("Planilha vazia.");

        const colunasDoArquivo = Object.keys(json[0]);
        const master = window.masterSelecionada;
        let validou = false;

        if (master === 'LIFE_GROUPS_MASTER' && colunasDoArquivo.includes('Melhor dia?')) {
            validou = true;
        } else if (master === 'NOVO_NASCIMENTO_MASTER' && colunasDoArquivo.includes('Já num Life?')) {
            validou = true;
        } else if (master === 'DECISAO_POR_JESUS_ONLINE_MASTER' && colunasDoArquivo.includes('Já está em um Life Group?')) {
            validou = true;
        }

        if (!validou) {
            barra.style.width = "100%";
            barra.style.backgroundColor = "red";
            statusTxt.innerText = "❌ Colunas incompatíveis! Verifique o arquivo.";
            this.value = "";
            btnOk.style.display = "block";
            return;
        }

        barra.style.width = "60%";
        statusTxt.innerText = "Enviando para o Google Sheets...";

        await fetch(API, { 
            method: "POST", 
            mode: "no-cors", 
            body: JSON.stringify({ tipo: "importar", master: master, dados: json }) 
        });

        barra.style.width = "100%";
        statusTxt.innerText = "Dados carregados com sucesso!";
        btnOk.style.display = "block";
        
        this.value = ""; 
        setTimeout(init, 2000); 
    } catch (err) {
        statusTxt.innerText = "Erro ao processar dados.";
        barra.style.backgroundColor = "red";
        btnOk.style.display = "block";
        this.value = "";
    }
});

// --- BUSCA E UTILITÁRIOS ---

// --- CONTROLE DE COR DA BARRA DE BUSCA ---
function atualizarCorBusca(ctx, limparCampo = true) {
    const wrap = document.getElementById("search-wrap");
    const input = document.getElementById("search");
    if (!wrap || !input) return;
    wrap.className  = "search-wrap"  + (ctx ? " ctx-" + ctx : "");
    input.className = ctx ? "ctx-" + ctx : "";
    if (limparCampo) input.value = ""; // limpa a busca ao trocar de contexto
}

function filtrarPorTexto(lista, termo) {
    const t = (termo || "").toLowerCase();
    return lista.filter(f => {
        const nome = (f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "").toLowerCase();
        const bairro = (f["BAIRRO"] || f["Bairro"] || "").toLowerCase();
        return nome.includes(t) || bairro.includes(t);
    });
}

function origemParaPlanilha(origem) {
    if (origem === "LIFE_GROUPS_MASTER") return "lifegroups";
    if (origem === "NOVO_NASCIMENTO_MASTER") return "novo-nascimento";
    if (origem === "DECISAO_POR_JESUS_ONLINE_MASTER") return "decisao-online";
    return "";
}

function escolherDestinoBusca(resultados) {
    if (!resultados || resultados.length === 0) return null;

    const todasEnviadas = resultados.every(f => f.FICHA_ENVIADA === "Sim");
    if (todasEnviadas) return { tipo: "enviadas" };

    const planilhas = [...new Set(resultados.map(f => origemParaPlanilha(f.ORIGEM)).filter(Boolean))];
    if (planilhas.length === 1) return { tipo: "planilha", planilha: planilhas[0] };

    return null;
}

function aplicarDestinoBusca(destino) {
    if (!destino) return;

    if (destino.tipo === "enviadas") {
        document.getElementById("filter-planilha").value = "";
        atualizarCorBusca(null, false);
        const total = aplicarFiltroRede(fichas).filter(f => f.FICHA_ENVIADA === "Sim").length;
        document.getElementById("title").innerText = `Enviadas (${total})`;
        return;
    }

    if (destino.tipo === "planilha") {
        const tipo = destino.planilha;
        document.getElementById("filter-planilha").value = tipo;

        const nomesPlanilha = {
            "lifegroups": "Life Groups",
            "novo-nascimento": "Novo Nascimento",
            "decisao-online": "Decisão Online"
        };

        const nomePlanilha = nomesPlanilha[tipo] || "easyfichas";
        document.getElementById("title").innerText = nomePlanilha;
        atualizarCorBusca(tipo, false);
    }
}

document.getElementById("search").addEventListener("input", (e) => {
    const t = e.target.value.toLowerCase();

    let base = montarListaDaTelaAtual();

    if (!t) {
        renderCards(base);
        return;
    }

    let resultados = filtrarPorTexto(base, t);

    const tituloAtual = document.getElementById("title").innerText || "";
    const planilhaAtual = document.getElementById("filter-planilha").value;
    const isHome = !tituloAtual.startsWith("Enviadas") && tituloAtual !== "Favoritos" && !planilhaAtual;

    // Na Home, se não encontrou na tela atual, tenta o conjunto geral e navega para a tela correta.
    if (isHome && resultados.length === 0) {
        const resultadosGerais = filtrarPorTexto(aplicarFiltroRede(fichas), t);
        const destino = escolherDestinoBusca(resultadosGerais);
        if (destino) {
            aplicarDestinoBusca(destino);
            base = montarListaDaTelaAtual();
            resultados = filtrarPorTexto(base, t);
        }
    }

    renderCards(resultados);
});

function exportar() {
    if (!fichas || fichas.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }
    try {
        const worksheet = XLSX.utils.json_to_sheet(fichas);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Fichas");
        const dataAtual = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(workbook, `easyfichas_completo_${dataAtual}.xlsx`);
    } catch (error) {
        alert("Erro ao gerar o arquivo Excel.");
    }
}

function openWhats(t) { if(t) window.open(`https://wa.me/55${t.replace(/\D/g,"")}`, "_blank"); }
function openMap(e) { if(e) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`, "_blank"); }

function atualizarContadorNaoEnviadas(base) {
    const count = base.filter(f => f.FICHA_ENVIADA !== "Sim").length;
    const el = document.getElementById("nao-enviadas-counter");
    const countEl = document.getElementById("count-nao-enviadas");
    if (el && countEl) {
        countEl.innerText = count;
    }
    lucide.createIcons();
}

function atualizarContadores() {
    // Base de cálculo sempre respeita a rede se ela estiver selecionada
    const baseFichas = filtroRede ? fichas.filter(f => f.REDE === filtroRede) : fichas;

    const totalLife = baseFichas.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER").length;
    const totalNovoNascimento = baseFichas.filter(f => f.ORIGEM === "NOVO_NASCIMENTO_MASTER").length;
    const totalDecisaoOnline = baseFichas.filter(f => f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER").length;

    const totalEnviadas = baseFichas.filter(f => f.FICHA_ENVIADA === "Sim").length;

    document.getElementById("count-lifegroups").innerText = totalLife;
    document.getElementById("count-novo-nascimento").innerText = totalNovoNascimento;
    document.getElementById("count-decisao-online").innerText = totalDecisaoOnline;

    // Atualiza contador de não enviadas (home = todas as planilhas)
    atualizarContadorNaoEnviadas(baseFichas);

    // Atualiza o título se estiver na tela de enviadas para mostrar o total correto da rede
    const titulo = document.getElementById("title").innerText;
    if (titulo.startsWith("Enviadas")) {
        document.getElementById("title").innerText = `Enviadas (${totalEnviadas})`;
    }
}

function filtrarPorPlanilhaRapido(tipo) {
    mostrarModoHome();
    // 1. Atualizamos o valor no dropdown oculto de filtros para manter sincronia
    const selectPlanilha = document.getElementById("filter-planilha");
    if(selectPlanilha) selectPlanilha.value = tipo;

    // 2. Criamos a filtragem respeitando a REDE ATIVA e a ORIGEM
    const filtradas = fichas.filter(f => {
        // Filtro de Origem (o que o botão clicado representa)
        let passaPlanilha = false;
        if (tipo === "lifegroups") {
            passaPlanilha = f.ORIGEM === "LIFE_GROUPS_MASTER";
        } else if (tipo === "novo-nascimento") {
            passaPlanilha = f.ORIGEM === "NOVO_NASCIMENTO_MASTER";
        } else if (tipo === "decisao-online") {
            passaPlanilha = f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER";
        }

        // Filtro de Rede (se houver uma rede selecionada no momento)
        const passaRede = filtroRede ? f.REDE === filtroRede : true;

        return passaPlanilha && passaRede;
    });

    const ordenadas = ordenarNaoEnviadasPrimeiro(filtradas);

    // 3. Renderiza o resultado
    renderCards(ordenadas);

    // Atualiza contador de não enviadas para a planilha selecionada
    atualizarContadorNaoEnviadas(filtradas);
    
    // 4. Ajusta o título e a cor da barra de busca
    const nomesPlanilha = {
        "lifegroups": "Life Groups",
        "novo-nascimento": "Novo Nascimento",
        "decisao-online": "Decisão Online"
    };
    const nomePlanilha = nomesPlanilha[tipo] || "easyfichas";
    document.getElementById("title").innerText = nomePlanilha;
    atualizarCorBusca(tipo);
}

function abrirSeletorRede(id) {
    window.fichaParaTaguear = id;
    const container = document.getElementById("container-seletor-redes");
    if(!container) return;
    
    container.innerHTML = ""; // Limpa anterior

    CONFIG_REDES.forEach(rede => {
        const btn = document.createElement("button");
        btn.innerText = rede.nome;
        btn.className = "rede-option-btn";
        btn.style.setProperty("--rede-color", rede.cor || "#4b5563");
        btn.onclick = () => aplicarTagRede(rede.nome);
        container.appendChild(btn);
    });

    document.getElementById("modal-rede").style.display = "flex";
}
