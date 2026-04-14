function renderCards(lista) {
  const cards = document.getElementById("cards");
  cards.innerHTML = "";

  // Mensagem para banco vazio
  if (!lista || lista.length === 0) {
    cards.innerHTML = `
      <div style="text-align: center; padding: 50px 20px; color: #888;">
        <i data-lucide="database-zap" style="width: 48px; height: 48px; margin-bottom: 10px; opacity: 0.5;"></i>
        <p style="font-size: 16px; font-weight: bold;">Banco de fichas vazio.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  lista.forEach(f => {
    // Mapeamento de campos básicos
    const nome = f["NOME"] || f["Nome"] || f["Nome e sobrenome"] || "Sem Nome";
    const telefone = f["TELEFONE"] || f["Celular"] || f["Fone/Wpp"] || f["Fone/WhatsApp"] || "";
    const bairro = f["BAIRRO"] || f["Bairro"] || "";
    const cidade = f["CIDADE"] || f["Cidade/UF"] || "";
    const endereco = f["ENDERECO"] || f["Endereço"] || "";
    
    const tagSexo = f["SEXO"] || f["Sexo"] || "";
    const tagCivil = f["ESTADO_CIVIL"] || f["Est. Civil"] || f["Estado Civil"] || "";
    const tagFilhos = f["Filhos (de 2-11)?"] || f["Filhos"] || "";

    // 1. Define a classe de cor baseada na planilha de origem
    let classeOrigem = "";
    if (f.ORIGEM === "LIFE_GROUPS_MASTER") classeOrigem = "card-life-groups";
    else if (f.ORIGEM === "NOVO_NASCIMENTO_MASTER") classeOrigem = "card-novo-nascimento";
    else if (f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER") classeOrigem = "card-decisao-online";

    // 2. Lógica condicional de exibição de informações por Origem
    let infoLinha1, infoLinha2, icone1, icone2;

    if (f.ORIGEM === "NOVO_NASCIMENTO_MASTER") {
        const idade = f["idade"] || f["Idade"] || "Não inf.";
        const noLife = f["Já num Life?"] || f["Já em um Life?"] || "Não inf.";
        icone1 = "user"; 
        infoLinha1 = `Idade: ${idade}`;
        icone2 = "users"; 
        infoLinha2 = `No Life? ${noLife}`;

    } else if (f.ORIGEM === "DECISAO_POR_JESUS_ONLINE_MASTER") {
        const idade = f["Idade"] || f["idade"] || "Não inf.";
        const noLife = f["Já está em um Life Group?"] || f["Já num Life?"] || "Não inf.";
        icone1 = "map-pin"; 
        infoLinha1 = endereco || `${bairro} - ${cidade}`;
        icone2 = "info"; 
        infoLinha2 = `Idade: ${idade} | Life: ${noLife}`;

    } else {
        // Padrão (Life Groups Master)
        const melhorDia = f["MELHOR_DIA"] || f["Melhor dia?"] || f["Melhor dia"] || "Não informado";
        icone1 = "map-pin";
        infoLinha1 = `${bairro} - ${cidade}`;
        icone2 = "calendar";
        infoLinha2 = `Melhor dia: ${melhorDia}`;
    }

    // 3. Criação do elemento Card (Única declaração)
    const card = document.createElement("div");
    // Combina as classes: card básico + classe da rede + classe da cor da origem
    card.className = `card ${f.REDE || ''} ${classeOrigem}`;

    card.innerHTML = `
      <div class="rede-highlight" style="background: var(--${(f.REDE || '').toLowerCase()})"></div>
      <div class="card-header">
        <div>
          <div class="name">${nome}</div>
          <div style="display:flex; gap:5px; align-items:center; flex-wrap: wrap;">
             ${f.REDE ? `<span class="tag-rede" style="background: var(--${f.REDE.toLowerCase()})">${f.REDE}</span>` : ''}
             ${f.FICHA_ENVIADA === "Sim" ? `<span class="tag-rede" style="background: #666; font-size:9px;">ENVIADA</span>` : ''}
          </div>
        </div>
        <button class="view-btn" onclick="verDetalhes('${f.ID}')">
            <i data-lucide="eye"></i>
        </button>
      </div>

      <div class="info-row"><i data-lucide="${icone1}"></i> <span>${infoLinha1}</span></div>
      <div class="info-row"><i data-lucide="${icone2}"></i> <span>${infoLinha2}</span></div>

      <div class="tags-group">
        ${tagCivil ? `<span class="tag">${tagCivil}</span>` : ""}
        ${tagFilhos ? `<span class="tag">${tagFilhos} Filhos</span>` : ""}
        ${tagSexo ? `<span class="tag">${tagSexo}</span>` : ""}
      </div>

      <div class="actions">
        <button class="whatsapp" onclick="openWhats('${telefone}')"><i data-lucide="message-circle"></i> Whats</button>
        <button class="map" onclick="openMap('${endereco}')"><i data-lucide="map"></i> Mapa</button>
        <button class="share" onclick="confirmarEnvio('${f.ID}')"><i data-lucide="send"></i> Enviar</button>
        <button class="btn-rede-tag" onclick="abrirSeletorRede('${f.ID}')"><i data-lucide="tag"></i> Rede</button>
        <button class="star" onclick="toggleFav('${f.ID}')">
            <i data-lucide="star" class="${f.FAVORITO === 'Sim' ? 'fav-active' : ''}"></i>
        </button>
      </div>
    `;
    cards.appendChild(card);
  });

  function verDetalhes(id) {
    const f = fichas.find(x => x.ID == id);
    if (!f) return;

    const modal = document.getElementById("modal-detalhes");
    const container = document.getElementById("detalhes-content");
    
    // Filtramos para não mostrar campos internos ou vazios
    const camposIgnorar = ["ID", "REDE", "FAVORITO", "FICHA_ENVIADA", "ORIGEM"];
    
    let html = `<div class="detalhes-lista">`;
    
    for (let campo in f) {
        if (!camposIgnorar.includes(campo) && f[campo] && f[campo] !== "") {
            html += `
                <div class="detalhe-item">
                    <label>${campo}:</label>
                    <span>${f[campo]}</span>
                </div>
            `;
        }
    }
    
    html += `</div>`;
    
    container.innerHTML = html;
    modal.style.display = "flex";
}

function fecharModalDetalhes() {
    document.getElementById("modal-detalhes").style.display = "none";
}
  // Renderiza os ícones do Lucide após criar os elementos
  lucide.createIcons(); 
}
