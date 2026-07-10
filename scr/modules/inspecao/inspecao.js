/**
 * Módulo de Inspeção Veicular
 * Formulário e consulta de inspeções
 */

class InspecaoVeicular {
  constructor() {
    this.modal = new ModalController('modal-inspecao-veicular');
    this.initEventListeners();
  }

  close() {
    this.modal.close();
  }

  initEventListeners() {
    getEl('btn-inspecao-veicular')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.open();
    });

    const setupRowListeners = () => {
      document.querySelectorAll('#tabela-inspecao tbody tr.inspection-row').forEach(row => {
        const cbOk = row.querySelector('.ok');
        const cbDef = row.querySelector('.defeito');
        const item = row.dataset.item;
        const obsRow = document.querySelector(`#tabela-inspecao tbody tr.obs-row[data-item="${item}"]`);
        const obsInput = obsRow ? obsRow.querySelector('.obs-input') : null;
        const posBtns = row.querySelectorAll('.pos-btn');

        const atualizarEstadoLinha = () => {
          const isDefective = cbDef.checked;
          if (obsInput) {
            obsInput.disabled = !isDefective;
            if (!isDefective) obsInput.value = '';
          }
          if (posBtns && posBtns.length > 0) {
            posBtns.forEach(btn => {
              btn.disabled = !isDefective;
              if (!isDefective) btn.classList.remove('active');
            });
          }
        };

        if (cbOk && cbDef) {
          cbOk.addEventListener('change', () => {
            if (cbOk.checked) cbDef.checked = false;
            atualizarEstadoLinha();
          });
          cbDef.addEventListener('change', () => {
            if (cbDef.checked) cbOk.checked = false;
            atualizarEstadoLinha();
          });
        }
        atualizarEstadoLinha();
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupRowListeners);
    } else {
      setupRowListeners();
    }

    document.querySelectorAll('.pos-btn').forEach(btn =>
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!btn.disabled) btn.classList.toggle('active');
      })
    );

    getEl('btn-enviar-inspecao')?.addEventListener('click', () => this.enviarInspecao());
    getEl('btn-conferir-inspecoes')?.addEventListener('click', () => this.conferirInspecoes());
  }

  async open() {
    if (canCreateInspection) {
      preencherSelectTerminais();
      this.openForm();
    } else {
      await this.conferirInspecoes();
    }
  }

  openForm() {
    this.modal.open();
    this.preencherAutomatico();
    this.resetarFormulario();
    const btn = getEl('btn-conferir-inspecoes');
    if (btn)
      btn.style.display = currentUserRole === 'FISCAL' || currentUserRole === 'INSPETOR' ? 'block' : 'none';
  }

  preencherAutomatico() {
    const apelido = localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName') || 'Inspetor';
    if (getEl('fiscal')) getEl('fiscal').value = apelido;
    const agora = new Date();
    if (getEl('data')) getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora')) getEl('hora').value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  atualizarDataHora() {
    const agora = new Date();
    if (getEl('data')) getEl('data').value = agora.toLocaleDateString('pt-BR');
    if (getEl('hora')) getEl('hora').value = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  resetarFormulario() {
    if (getEl('carro')) getEl('carro').value = '';
    document.querySelectorAll('#tabela-inspecao tbody tr.inspection-row .ok, #tabela-inspecao tbody tr.inspection-row .defeito')
      .forEach(cb => cb.checked = false);
    document.querySelectorAll('.obs-input').forEach(inp => { inp.value = ''; inp.disabled = true; });
    document.querySelectorAll('.pos-btn').forEach(btn => { btn.classList.remove('active'); btn.disabled = true; });
  }

  coletarDados() {
    const carro = getEl('carro').value.trim();
    const terminal = getEl('terminal').value;
    const fiscal = getEl('fiscal').value;
    const data = getEl('data').value;
    const hora = getEl('hora').value;
    
    if (!carro || !terminal) {
      alert('Preencha o campo CARRO e selecione o TERMINAL.');
      return null;
    }
    
    const itens = {};
    document.querySelectorAll('#tabela-inspecao tbody tr.inspection-row').forEach(row => {
      const item = row.dataset.item;
      const ok = row.querySelector('.ok').checked;
      const defeito = row.querySelector('.defeito').checked;
      const obsRow = document.querySelector(`#tabela-inspecao tbody tr.obs-row[data-item="${item}"]`);
      const obs = obsRow ? obsRow.querySelector('.obs-input').value.trim() : '';
      itens[item] = { status: ok ? 'OK' : defeito ? 'DEFEITO' : '', obs };
      
      if (item === 'ventilador') {
        itens[item].posicao = Array.from(row.querySelectorAll('.pos-btn.active'))
          .map(btn => btn.dataset.pos).join(',');
      }
    });
    
    return { carro, terminal, fiscal, data, hora, itens };
  }

  async enviarInspecao() {
    if (!canCreateInspection) {
      alert('Seu perfil não permite criar inspeções.');
      return;
    }
    this.atualizarDataHora();
    const dados = this.coletarDados();
    if (!dados) return;

    const dadosEnvio = {
      carro: dados.carro,
      terminal: dados.terminal,
      fiscal: dados.fiscal,
      thoreb: dados.itens.thoreb,
      elevador: dados.itens.elevador,
      limpeza: dados.itens.limpeza,
      ventilador: dados.itens.ventilador,
    };

    let resumo = `CONFIRMAR ENVIO?\n\nCarro: ${dadosEnvio.carro}\nTerminal: ${dadosEnvio.terminal}\nFiscal: ${dadosEnvio.fiscal}\nData/Hora: ${dados.data} ${dados.hora}\n\nItens:\n`;
    for (const [item, info] of Object.entries(dados.itens)) {
      let status = info.status || 'NÃO INFORMADO';
      resumo += `- ${item.toUpperCase()}: ${status}`;
      if (info.obs) resumo += ` (Obs: ${info.obs})`;
      if (info.posicao) resumo += ` (Pos: ${info.posicao})`;
      resumo += '\n';
    }
    
    if (!confirm(resumo + '\n\nDeseja enviar os dados?')) return;

    try {
      await fetch(URL_PLANILHA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          acao: 'inspecao_veicular',
          dados: JSON.stringify(dadosEnvio),
        }),
      });
      alert('✅ Inspeção enviada com sucesso!');
      this.resetarFormulario();
    } catch (err) {
      console.error(err);
      alert('❌ Erro ao enviar. Tente novamente.');
    }
  }

  conferirInspecoes() {
    const hoje = new Date().toISOString().split('T')[0];
    this.conferirInspecoesComFiltro(hoje, hoje, null, null);
  }

  conferirInspecoesComFiltro(dataInicio, dataFim, carro, fiscalFiltro) {
    const hojeStr = new Date().toISOString().split('T')[0];

    if (dataInicio && dataInicio > hojeStr) {
      alert('A data de início não pode ser maior que a data atual.');
      return;
    }
    if (dataFim && dataFim > hojeStr) {
      alert('A data de fim não pode ser maior que a data atual.');
      return;
    }
    if (dataInicio && dataFim && dataInicio > dataFim) {
      alert('A data de início não pode ser maior que a data de fim.');
      return;
    }

    const params = new URLSearchParams();
    params.append('acao', 'consultar_inspecoes');
    params.append('userRole', currentUserRole);
    if (dataInicio) params.append('dataInicio', dataInicio);
    if (dataFim) params.append('dataFim', dataFim);
    if (carro) params.append('carro', carro);
    if (fiscalFiltro) params.append('fiscalFiltro', fiscalFiltro);
    
    // FISCAL: só vê as próprias inspeções
    if (currentUserRole === 'FISCAL') {
      params.append('fiscal', localStorage.getItem('inspectorApelido') || localStorage.getItem('inspectorName'));
    }
    
    return this._executarConsultaInspecao(params);
  }

  _executarConsultaInspecao(params) {
    return new Promise((resolve, reject) => {
      const callbackName = 'consultarInspecoesCallback_' + Date.now();
      
      window[callbackName] = dados => {
        if (dados && dados.erro) {
          alert('Erro ao consultar: ' + dados.erro);
        } else {
          mostrarModalConferir(dados || [], currentUserRole, params);
        }
        delete window[callbackName];
        resolve();
      };
      
      params.append('callback', callbackName);
      const url = `${URL_PLANILHA}?${params.toString()}`;
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        delete window[callbackName];
        alert('Erro ao consultar. Verifique sua conexão.');
        reject();
      };
      document.body.appendChild(script);
    });
  }
}

/**
 * Exibe o modal de conferência de inspeções
 * @param {Array} inspecoes - Lista de inspeções retornadas
 * @param {string} userRole - Papel do usuário atual
 * @param {URLSearchParams} params - Parâmetros da consulta
 */
function mostrarModalConferir(inspecoes, userRole, params) {
  const modal = document.getElementById('modal-conferir-inspecoes');
  const lista = document.getElementById('lista-inspecoes');
  const titulo = modal.querySelector('.modal-title');
  
  // Define título baseado no papel
  let tituloTexto = '📋 Minhas Inspeções';
  if (userRole === 'INSPETOR') {
    tituloTexto = '📋 Inspeções (Todos os Fiscais)';
  } else if (['ENCARREGADO', 'GERENTE', 'PLANTONISTA', 'ADMIN'].includes(userRole)) {
    tituloTexto = '📋 Todas as Inspeções';
  }
  titulo.textContent = tituloTexto;
  
  // Perfis que podem exportar inspeções (todos exceto FISCAL e SAF)
  const perfisPodemExportar = ['ENCARREGADO', 'GERENTE', 'PLANTONISTA', 'ADMIN', 'INSPETOR'];
  const podeExportar = perfisPodemExportar.includes(userRole);
  
  if (!inspecoes || inspecoes.length === 0) {
    lista.innerHTML = '<p style="text-align:center;padding:20px;">Nenhuma inspeção encontrada.</p>';
  } else {
    let html = '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f0f0f0;">';
    html += '<th style="padding:10px;border:1px solid #ddd;">Data</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Carro</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Terminal</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Fiscal</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">THOREB</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Elevador</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Limpeza</th>';
    html += '<th style="padding:10px;border:1px solid #ddd;">Ventilador</th>';
    html += '</tr></thead><tbody>';
    
    inspecoes.forEach(insp => {
      html += '<tr>';
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.dataPreenchimento || ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.carro || ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.terminal || ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.fiscal || ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.thoreb?.status || ''}${insp.thoreb?.obs ? ' (' + insp.thoreb.obs + ')' : ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.elevador?.status || ''}${insp.elevador?.obs ? ' (' + insp.elevador.obs + ')' : ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.limpeza?.status || ''}${insp.limpeza?.obs ? ' (' + insp.limpeza.obs + ')' : ''}</td>`;
      html += `<td style="padding:8px;border:1px solid #ddd;">${insp.ventilador?.status || ''}${insp.ventilador?.obs ? ' (' + insp.ventilador.obs + ')' : ''}${insp.ventilador?.posicao ? ' (Pos: ' + insp.ventilador.posicao + ')' : ''}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    // Adiciona botão de exportar se o perfil permitir
    if (podeExportar) {
      html += `
        <div style="margin-top: 20px; text-align: center;">
          <button id="btn-exportar-inspecoes-pdf" class="btn-principal" style="margin: 5px;">📄 Exportar PDF</button>
          <button id="btn-exportar-inspecoes-excel" class="btn-secundario" style="margin: 5px;">📊 Exportar Excel</button>
        </div>
      `;
    }
    
    lista.innerHTML = html;
    
    // Armazena as inspeções para exportação
    window._inspecoesParaExportar = inspecoes;
  }
  
  modal.style.display = 'flex';
  
  // Configura os eventos dos botões de exportação
  if (podeExportar && inspecoes && inspecoes.length > 0) {
    setTimeout(() => {
      const btnPDF = document.getElementById('btn-exportar-inspecoes-pdf');
      const btnExcel = document.getElementById('btn-exportar-inspecoes-excel');
      
      if (btnPDF) {
        const novoBtnPDF = btnPDF.cloneNode(true);
        btnPDF.parentNode.replaceChild(novoBtnPDF, btnPDF);
        novoBtnPDF.addEventListener('click', () => exportarInspecoesPDF(inspecoes));
      }
      
      if (btnExcel) {
        const novoBtnExcel = btnExcel.cloneNode(true);
        btnExcel.parentNode.replaceChild(novoBtnExcel, btnExcel);
        novoBtnExcel.addEventListener('click', () => exportarInspecoesExcel(inspecoes));
      }
    }, 100);
  }
}

/**
 * Fecha o modal de conferência de inspeções
 */
function fecharModalConferir() {
  const modal = document.getElementById('modal-conferir-inspecoes');
  if (modal) modal.style.display = 'none';
}

// Exporta para escopo global
window.mostrarModalConferir = mostrarModalConferir;
window.fecharModalConferir = fecharModalConferir;

/**
 * Exporta inspeções para PDF
 */
async function exportarInspecoesPDF(inspecoes) {
  try {
    if (typeof window.jspdf === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
      await new Promise(resolve => { script.onload = resolve; });
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    // Cabeçalho
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("RELATÓRIO DE INSPEÇÕES VEICULARES", pageWidth / 2, y, { align: "center" });
    
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dataGeracao = new Date().toLocaleString('pt-BR');
    doc.text(`Gerado em: ${dataGeracao}`, pageWidth / 2, y, { align: "center" });
    
    y += 10;
    doc.setFontSize(9);
    doc.text(`Total de inspeções: ${inspecoes.length}`, margin, y);
    
    y += 8;

    // Configurações da tabela
    const colWidths = [25, 20, 35, 35, 25, 25, 25, 30];
    const headers = ['Data', 'Carro', 'Terminal', 'Fiscal', 'THOREB', 'Elevador', 'Limpeza', 'Ventilador'];
    const lineHeight = 6;
    
    // Desenha cabeçalho da tabela
    doc.setFont("helvetica", "bold");
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - margin * 2, 6, 'F');
    
    let x = margin;
    headers.forEach((header, i) => {
      doc.text(header, x, y);
      x += colWidths[i];
    });
    
    y += 2;
    doc.line(margin, y, pageWidth - margin, y);
    y += lineHeight;
    
    // Desenha linhas de dados
    doc.setFont("helvetica", "normal");
    inspecoes.forEach((insp, idx) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      x = margin;
      const data = insp.dataPreenchimento || '';
      const carro = insp.carro || '';
      const terminal = insp.terminal || '';
      const fiscal = insp.fiscal || '';
      const thoreb = insp.thoreb?.status || '';
      const elevador = insp.elevador?.status || '';
      const limpeza = insp.limpeza?.status || '';
      let ventilador = insp.ventilador?.status || '';
      if (insp.ventilador?.posicao) ventilador += ` (${insp.ventilador.posicao})`;
      
      doc.text(data.substring(0, 10), x, y);
      x += colWidths[0];
      doc.text(carro, x, y);
      x += colWidths[1];
      doc.text(terminal.substring(0, 15), x, y);
      x += colWidths[2];
      doc.text(fiscal.substring(0, 15), x, y);
      x += colWidths[3];
      doc.text(thoreb, x, y);
      x += colWidths[4];
      doc.text(elevador, x, y);
      x += colWidths[5];
      doc.text(limpeza, x, y);
      x += colWidths[6];
      doc.text(ventilador.substring(0, 15), x, y);
      
      y += lineHeight;
    });

    const nomeArquivo = `inspecoes_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(nomeArquivo);
    alert(`✅ PDF gerado com sucesso!\\n\\nNome do arquivo: ${nomeArquivo}`);
  } catch (error) {
    console.error("Erro ao gerar PDF:", error);
    alert('❌ Erro ao gerar o PDF:\\n' + error.message);
  }
}

/**
 * Exporta inspeções para Excel (CSV)
 */
function exportarInspecoesExcel(inspecoes) {
  try {
    // Cabeçalhos CSV
    const headers = ['Data', 'Carro', 'Terminal', 'Fiscal', 'THOREB_Status', 'THOREB_Obs', 'Elevador_Status', 'Elevador_Obs', 'Limpeza_Status', 'Limpeza_Obs', 'Ventilador_Status', 'Ventilador_Posicao', 'Ventilador_Obs'];
    
    // Converte dados para CSV
    const csvRows = [];
    csvRows.push(headers.join(';'));
    
    inspecoes.forEach(insp => {
      const row = [
        insp.dataPreenchimento || '',
        insp.carro || '',
        insp.terminal || '',
        insp.fiscal || '',
        insp.thoreb?.status || '',
        (insp.thoreb?.obs || '').replace(/;/g, ','),
        insp.elevador?.status || '',
        (insp.elevador?.obs || '').replace(/;/g, ','),
        insp.limpeza?.status || '',
        (insp.limpeza?.obs || '').replace(/;/g, ','),
        insp.ventilador?.status || '',
        (insp.ventilador?.posicao || '').replace(/;/g, ','),
        (insp.ventilador?.obs || '').replace(/;/g, ',')
      ];
      csvRows.push(row.join(';'));
    });
    
    const csvContent = csvRows.join('
');
    
    // Cria blob e faz download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inspecoes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ Excel (CSV) gerado com sucesso!`);
  } catch (error) {
    console.error("Erro ao gerar Excel:", error);
    alert('❌ Erro ao gerar o Excel:\\n' + error.message);
  }
}

window.InspecaoVeicular = InspecaoVeicular;
window.exportarInspecoesPDF = exportarInspecoesPDF;
window.exportarInspecoesExcel = exportarInspecoesExcel;
