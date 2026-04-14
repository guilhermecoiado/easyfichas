const API = "https://script.google.com/macros/s/AKfycbyge5Ik_wxlRAGW2JdwUnFTG4X3WyZmUhscR3CMDkm6EoFfXDrd82uHBFLgOi_zyzptig/exec";
let fichas = [];
let filtroRede = null;
let fichaPendenteEnvio = null;

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
        renderCards(fichas);
        configurarDropdowns();
        atualizarContadores();
    }
    
    setTimeout(() => {
        if(loader) loader.classList.add("loader-hidden");
        lucide.createIcons();
    }, 300);
}

// --- NAVEGAÇÃO E TELAS ---

function home() { 
    document.getElementById("title").innerText = "easyfichas"; 
    document.getElementById("rede-indicator").style.display = "none";
    filtroRede = null;
    renderCards(fichas); 
}

function showSent() {
    const filtradas = fichas.filter(f => f.FICHA_ENVIADA === "Sim");
    document.getElementById("title").innerText = "Enviadas";
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
    if(f) {
        f.FICHA_ENVIADA = "Sim";
        renderCards(fichas);
        salvarNaPlanilha(f.ID, "FICHA_ENVIADA", "Sim");
        
        // Mapeamento dos dados solicitados
        const nome = f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "Não informado";
        const contato = f["TELEFONE"] || f["Celular"] || f["Fone/Wpp"] || f["Fone/WhatsApp"] || "Não informado";
        const endereco = f["ENDERECO"] || f["Endereço"] || "Não informado";
        
        // Montagem da mensagem estruturada
        const msg = `*Nova Ficha*\n\n` +
                    `*Nome:* ${nome}\n` +
                    `*Contato:* ${contato}\n` +
                    `*Endereço:* ${endereco}`;
        
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    }
    fecharModalEnvio();
}
// --- FILTROS E BUSCA ---

function toggleRede() {
    if (!filtroRede) filtroRede = "Start";
    else if (filtroRede == "Start") filtroRede = "Diflen";
    else if (filtroRede == "Diflen") filtroRede = "Familia";
    else filtroRede = null;

    const ind = document.getElementById("rede-indicator");
    if(filtroRede) {
        ind.innerText = filtroRede; 
        ind.style.display = "block";
        ind.style.backgroundColor = `var(--${filtroRede.toLowerCase()})`;
        renderCards(fichas.filter(f => f.REDE === filtroRede));
    } else { 
        ind.style.display = "none"; 
        renderCards(fichas); 
    }
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
               (!ft.c || (f["ESTADO_CIVIL"] || f["Est. Civil"] || f["Estado Civil"]) === ft.c) &&
               (!ft.d || (f["MELHOR_DIA"] || f["Melhor dia?"]) === ft.d) &&
               (!ft.p || f["Pastor de Rede"] === ft.p);
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
        "filter-civil": ["ESTADO_CIVIL", "Est. Civil", "Estado Civil"], 
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

// --- IMPORTAÇÃO COM VALIDAÇÃO POR CONTEÚDO ---

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

        // --- VALIDAÇÃO POR COLUNAS (CABEÇALHOS) ---
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
            barra.style.backgroundColor = "red";
            statusTxt.innerText = "Erro: Colunas incompatíveis.";
            alert("❌ Planilha Errada! Os dados deste arquivo não batem com o destino selecionado (verifique as colunas).");
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
        (f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "").toLowerCase().includes(t) || 
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
        XLSX.utils.book_append_sheet(workbook, worksheet, "Todas as Fichas");
        const dataAtual = new Date().toLocaleDateString().replace(/\//g, '-');
        XLSX.writeFile(workbook, `easyfichas_completo_${dataAtual}.xlsx`);
    } catch (error) {
        alert("Erro ao gerar o arquivo Excel.");
    }
}

function openWhats(t) { if(t) window.open(`https://wa.me/55${t.replace(/\D/g,"")}`, "_blank"); }
function openMap(e) { if(e) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e)}`, "_blank"); }

function atualizarContadores() {
    const totalLife = fichas.filter(f => f.ORIGEM === "LIFE_GROUPS_MASTER").length;
    const totalDecisao = fichas.filter(f => 
        f.ORIGEM === "NOVO_NASCIMENTO_MASTER" || 
        f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER"
    ).length;

    document.getElementById("count-lifegroups").innerText = totalLife;
    document.getElementById("count-decisao").innerText = totalDecisao;
}

function filtrarPorPlanilhaRapido(tipo) {
    const selectPlanilha = document.getElementById("filter-planilha");
    if(selectPlanilha) selectPlanilha.value = tipo;
    aplicarFiltros();
}

init();
