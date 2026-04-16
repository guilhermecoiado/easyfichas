const API = "https://script.google.com/macros/s/AKfycbyge5Ik_wxlRAGW2JdwUnFTG4X3WyZmUhscR3CMDkm6EoFfXDrd82uHBFLgOi_zyzptig/exec";
let fichas = [];
let filtroRede = null;
let fichaPendenteEnvio = null;
let fichaPendenteRestaurar = null; // Variável global para controle
let tentativasLogin = 0;

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
        // Inicializa mostrando apenas as não enviadas
        const naoEnviadas = fichas.filter(f => f.FICHA_ENVIADA !== "Sim");
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

function home() { 
    document.getElementById("title").innerText = "easyfichas"; 
    document.getElementById("rede-indicator").style.display = "none";
    filtroRede = null;
    // Filtra para mostrar apenas o que NÃO foi enviado
    const naoEnviadas = fichas.filter(f => f.FICHA_ENVIADA !== "Sim");
    renderCards(naoEnviadas); 
}

function showSent() {
    // Se estiver filtrando por rede, mostra as enviadas daquela rede. Se não, mostra todas as enviadas.
    const base = filtroRede ? fichas.filter(f => f.REDE === filtroRede) : fichas;
    const filtradas = base.filter(f => f.FICHA_ENVIADA === "Sim");
    
    document.getElementById("title").innerText = `Enviadas (${filtradas.length})`;
    renderCards(filtradas);
}
function showFavorites() {
    const filtradas = fichas.filter(f => f.FAVORITO === "Sim");
    document.getElementById("title").innerText = "Favoritos";
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
    document.getElementById("modal-confirm-envio").style.display = "flex"; 
}

function fecharModalEnvio() { 
    document.getElementById("modal-confirm-envio").style.display = "none"; 
}

function processarEnvio() {
    const f = fichas.find(x => x.ID == fichaPendenteEnvio);
    if (!f) {
        fecharModalEnvio();
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
    renderCards(fichas);
    salvarNaPlanilha(f.ID, "FICHA_ENVIADA", "Sim");
    
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
        renderCards(fichas); 
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
        btn.style.cssText = `background: ${rede.cor}; color: white; padding: 12px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold;`;
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
        // Se estiver na Home, filtra a rede mas mantém ocultas as enviadas
        const base = filtroRede ? fichas.filter(f => f.REDE === filtroRede) : fichas;
        renderCards(base.filter(f => f.FICHA_ENVIADA !== "Sim"));
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
        } else if (ft.planilha === "decisao") {
            passaPlanilha = (f.ORIGEM === "NOVO_NASCIMENTO_MASTER" || f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER");
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

document.getElementById("search").addEventListener("input", (e) => {
    const t = e.target.value.toLowerCase();
    renderCards(fichas.filter(f => 
        (f["NOME"] || f["Nome"] || "").toLowerCase().includes(t) || 
        (f["BAIRRO"] || f["Bairro"] || "").toLowerCase().includes(t)
    ));
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

function atualizarContadores() {
    // Se houver filtro de rede ativo, baseamos os cálculos apenas naquela rede
    const baseFichas = filtroRede ? fichas.filter(f => f.REDE === filtroRede) : fichas;

    const totalGeral = baseFichas.length;
    const totalEnviadas = baseFichas.filter(f => f.FICHA_ENVIADA === "Sim").length;
    const totalPendentes = totalGeral - totalEnviadas;

    // Atualiza os badges de origem (Lifegroups / Novo Nascimento)
    document.getElementById("count-lifegroups").innerText = baseFichas.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER").length;
    document.getElementById("count-decisao").innerText = baseFichas.filter(f => f.ORIGEM === "NOVO_NASCIMENTO_MASTER" || f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER").length;

    // Se você quiser mostrar o total de enviadas no título quando estiver na tela de enviadas:
    if (document.getElementById("title").innerText === "Enviadas") {
        document.getElementById("title").innerText = `Enviadas (${totalEnviadas})`;
    }
    
    // Log para depuração no console (opcional)
    console.log(`Rede: ${filtroRede || 'Todas'} | Total: ${totalGeral} | Enviadas: ${totalEnviadas}`);
}

function filtrarPorPlanilhaRapido(tipo) {
    const selectPlanilha = document.getElementById("filter-planilha");
    if(selectPlanilha) selectPlanilha.value = tipo;
    aplicarFiltros();
}

function abrirSeletorRede(id) {
    window.fichaParaTaguear = id;
    const container = document.getElementById("container-seletor-redes");
    if(!container) return;
    
    container.innerHTML = ""; // Limpa anterior

    CONFIG_REDES.forEach(rede => {
        const btn = document.createElement("button");
        btn.innerText = rede.nome;
        btn.style.cssText = `background: ${rede.cor}; color: white; padding: 12px; border-radius: 10px; border: none; cursor: pointer; font-weight: bold;`;
        btn.onclick = () => aplicarTagRede(rede.nome);
        container.appendChild(btn);
    });

    document.getElementById("modal-rede").style.display = "flex";
}
