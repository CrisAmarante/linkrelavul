/**
 * API - Comunicação com backend (Google Apps Script)
 * Gerencia inspetores, terminais e logs
 */

let INSPETORES = {};
let refreshPromise = null;
let terminaisCache = [];
let terminaisTimestamp = 0;
const TERMINAIS_CACHE_DURACAO = 30 * 60 * 1000; // 30 minutos
let terminaisPromise = null;
let todosTerminaisCache = [];
let todosTerminaisPromise = null;

// ====================================================================
// LOG DE ATIVIDADES
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");
    await fetch(URL_PLANILHA, { method: "POST", body: formData, mode: "no-cors" });
  } catch (err) { 
    console.warn("Falha ao registrar log:", err); 
  }
}

// ====================================================================
// CARREGAR INSPETORES
// ====================================================================
function processarDadosPlanilha(dados) {
  if (Array.isArray(dados)) {
    const novoObjeto = {};
    dados.forEach(row => {
      if (row.apelido && row.hash && row.ativo === "SIM") {
        novoObjeto[row.apelido] = { 
          hash: row.hash, 
          nome: row.nome, 
          funcao: row.funcao 
        };
      }
    });
    INSPETORES = novoObjeto;
  } else { 
    INSPETORES = dados || {}; 
  }
}

async function refreshInspetores() {
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = new Promise((resolve, reject) => {
    const callbackName = 'processarDadosPlanilha_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    
    window[callbackName] = function(dados) {
      processarDadosPlanilha(dados);
      delete window[callbackName];
      refreshPromise = null;
      resolve();
    };
    
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?callback=${callbackName}&_=${Date.now()}`;
    script.onerror = () => { 
      delete window[callbackName]; 
      refreshPromise = null; 
      reject(); 
    };
    document.body.appendChild(script);
  });
  
  return refreshPromise;
}

// ====================================================================
// TERMINAIS (apenas SIM) com cache
// ====================================================================
function carregarTerminais(forceRefresh = false) {
  const agora = Date.now();
  
  if (!forceRefresh && terminaisCache.length && (agora - terminaisTimestamp < TERMINAIS_CACHE_DURACAO)) {
    return Promise.resolve(terminaisCache);
  }
  
  if (terminaisPromise) return terminaisPromise;
  
  terminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTerminaisCallback_' + Date.now();
    
    window[callbackName] = function(terminais) {
      terminaisCache = terminais;
      terminaisTimestamp = Date.now();
      delete window[callbackName];
      terminaisPromise = null;
      resolve(terminais);
    };
    
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais&callback=${callbackName}&_=${Date.now()}`;
    
    script.onerror = () => {
      delete window[callbackName];
      terminaisPromise = null;
      terminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      terminaisTimestamp = Date.now();
      resolve(terminaisCache);
    };
    document.body.appendChild(script);
  });
  
  return terminaisPromise;
}

function preencherSelectTerminais() {
  const select = getEl('terminal');
  if (!select) return;
  
  carregarTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { 
      const opt = document.createElement('option'); 
      opt.value = t; 
      opt.textContent = t; 
      select.appendChild(opt); 
    });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}

// ====================================================================
// TODOS OS TERMINAIS (para local no envio)
// ====================================================================
function carregarTodosTerminais(forceRefresh = false) {
  if (!forceRefresh && todosTerminaisCache.length) {
    return Promise.resolve(todosTerminaisCache);
  }
  
  if (todosTerminaisPromise) return todosTerminaisPromise;
  
  todosTerminaisPromise = new Promise((resolve) => {
    const callbackName = 'carregarTodosTerminaisCallback_' + Date.now();
    
    window[callbackName] = function(terminais) {
      todosTerminaisCache = terminais;
      delete window[callbackName];
      todosTerminaisPromise = null;
      resolve(terminais);
    };
    
    const script = document.createElement('script');
    script.src = `${URL_PLANILHA}?acao=terminais_todos&callback=${callbackName}&_=${Date.now()}`;
    
    script.onerror = () => {
      delete window[callbackName];
      todosTerminaisPromise = null;
      todosTerminaisCache = ['Terminal A', 'Terminal B', 'Terminal C', 'Terminal D'];
      resolve(todosTerminaisCache);
    };
    document.body.appendChild(script);
  });
  
  return todosTerminaisPromise;
}

function preencherSelectLocal() {
  const select = getEl('envio-local');
  if (!select) return;
  
  carregarTodosTerminais().then(terminais => {
    const valorAtual = select.value;
    select.innerHTML = '<option value="">Selecione...</option>';
    terminais.forEach(t => { 
      const opt = document.createElement('option'); 
      opt.value = t; 
      opt.textContent = t; 
      select.appendChild(opt); 
    });
    if (valorAtual && terminais.includes(valorAtual)) select.value = valorAtual;
  });
}

// Exportar para escopo global
window.INSPETORES = INSPETORES;
window.refreshInspetores = refreshInspetores;
window.carregarTerminais = carregarTerminais;
window.preencherSelectTerminais = preencherSelectTerminais;
window.carregarTodosTerminais = carregarTodosTerminais;
window.preencherSelectLocal = preencherSelectLocal;
window.registrarLog = registrarLog;

// ====================================================================
// FUNÇÕES DE LOGIN E AUTENTICAÇÃO
// ====================================================================

/**
 * Função de login - valida credenciais com o backend
 */
async function login(e) {
  if (e) e.preventDefault();
  
  const passwordInput = getEl('password');
  const errorEl = getEl('login-error');
  const senha = passwordInput ? passwordInput.value.trim() : '';
  
  if (!senha) {
    if (errorEl) errorEl.style.display = 'block';
    return;
  }
  
  try {
    // Busca os inspetores atualizados
    await refreshInspetores();
    
    let usuarioEncontrado = null;
    
    // Tenta encontrar usuário comparando hash calculado com hash armazenado
    // O hash é calculado usando senha + apelido como salt (mesmo método do backend)
    for (const [apelido, dados] of Object.entries(INSPETORES)) {
      const hashedPassword = await hashPassword(senha, apelido);
      
      if (dados.hash === hashedPassword || dados.hash === senha) {
        usuarioEncontrado = {
          apelido: apelido,
          nome: dados.nome,
          funcao: dados.funcao
        };
        break;
      }
    }
    
    // Se não encontrou localmente, tenta fazer login via API
    if (!usuarioEncontrado) {
      const response = await fetch(`${URL_PLANILHA}?acao=login&senha=${encodeURIComponent(senha)}&apelido=_any_`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result && result.sucesso) {
        usuarioEncontrado = {
          apelido: result.apelido,
          nome: result.nome,
          funcao: result.funcao
        };
      }
    }
    
    if (usuarioEncontrado) {
      // Salva informações do usuário logado
      localStorage.setItem('inspectorApelido', usuarioEncontrado.apelido);
      localStorage.setItem('inspectorNome', usuarioEncontrado.nome);
      localStorage.setItem('inspectorRole', usuarioEncontrado.funcao);
      sessionStorage.setItem('inspectorApelido', usuarioEncontrado.apelido);
      sessionStorage.setItem('inspectorNome', usuarioEncontrado.nome);
      sessionStorage.setItem('inspectorRole', usuarioEncontrado.funcao);
      
      // Define variável global
      window.currentUserRole = usuarioEncontrado.funcao;
      window.currentUserName = usuarioEncontrado.nome;
      window.currentUserApelido = usuarioEncontrado.apelido;
      
      // Fecha modal de login
      if (window.modals && window.modals.login) {
        window.modals.login.close();
      }
      
      // Limpa campo de senha
      if (passwordInput) {
        passwordInput.value = '';
      }
      
      // Esconde erro
      if (errorEl) errorEl.style.display = 'none';
      
      // Atualiza UI para mostrar tela logada
      showInspectorScreen(usuarioEncontrado);
      
      // Registra log de sucesso
      registrarLog(usuarioEncontrado.apelido);
      
      console.log('✅ Login bem-sucedido:', usuarioEncontrado.nome);
    } else {
      // Login falhou
      if (errorEl) errorEl.style.display = 'block';
      console.warn('⚠️ Login falhou: usuário/senha inválidos');
    }
  } catch (err) {
    console.error('❌ Erro no login:', err);
    if (errorEl) {
      errorEl.textContent = 'Erro de conexão. Tente novamente.';
      errorEl.style.display = 'block';
    }
  }
}

/**
 * Mostra a tela do inspetor após login bem-sucedido
 */
function showInspectorScreen(usuario) {
  const mainScreen = getEl('main-screen');
  const inspectorScreen = getEl('inspector-screen');
  
  if (mainScreen) mainScreen.style.display = 'none';
  if (inspectorScreen) inspectorScreen.style.display = 'block';
  
  // Preenche campos com dados do usuário
  const fiscalField = getEl('fiscal');
  const envioResponsavel = getEl('envio-responsavel');
  
  if (fiscalField) fiscalField.value = usuario.nome;
  if (envioResponsavel) envioResponsavel.value = usuario.nome;
  
  // Mostra toast de boas-vindas
  const toastName = getEl('toast-name');
  if (toastName) toastName.textContent = usuario.nome.split(' ')[0]; // Primeiro nome
  
  const welcomeToast = getEl('welcome-toast');
  if (welcomeToast) {
    welcomeToast.style.display = 'flex';
    setTimeout(() => {
      welcomeToast.style.display = 'none';
    }, 5000);
  }
  
  // Mostra botões específicos baseados na função
  updateUIByRole(usuario.funcao);
}

/**
 * Atualiza a UI baseado no papel do usuário
 */
function updateUIByRole(role) {
  const btnInspecaoVeicular = getEl('btn-inspecao-veicular');
  const btnEnvioInformacoes = getEl('btn-envio-informacoes');
  const btnPainelAdmin = getEl('btn-painel-admin');
  
  // Mostra botões baseado na função
  if (btnInspecaoVeicular) {
    btnInspecaoVeicular.style.display = (role === 'FISCAL' || role === 'INSPETOR' || role === 'PLANTONISTA') ? 'block' : 'none';
  }
  
  if (btnEnvioInformacoes) {
    btnEnvioInformacoes.style.display = (role === 'FISCAL' || role === 'INSPETOR' || role === 'PLANTONISTA' || role === 'ENCARREGADO') ? 'block' : 'none';
  }
  
  if (btnPainelAdmin) {
    btnPainelAdmin.style.display = (role === 'ADMIN') ? 'block' : 'none';
  }
}

/**
 * Verifica status do login ao carregar a página
 */
function checkLoginStatus() {
  const apelido = localStorage.getItem('inspectorApelido') || sessionStorage.getItem('inspectorApelido');
  const nome = localStorage.getItem('inspectorNome') || sessionStorage.getItem('inspectorNome');
  const role = localStorage.getItem('inspectorRole') || sessionStorage.getItem('inspectorRole');
  
  if (apelido && nome && role) {
    // Usuário já estava logado
    window.currentUserRole = role;
    window.currentUserName = nome;
    window.currentUserApelido = apelido;
    
    showInspectorScreen({ apelido, nome, funcao: role });
  }
}

/**
 * Faz logout do usuário
 */
function logoutInspector() {
  // Limpa dados de sessão
  localStorage.removeItem('inspectorApelido');
  localStorage.removeItem('inspectorNome');
  localStorage.removeItem('inspectorRole');
  sessionStorage.removeItem('inspectorApelido');
  sessionStorage.removeItem('inspectorNome');
  sessionStorage.removeItem('inspectorRole');
  
  // Limpa variáveis globais
  window.currentUserRole = null;
  window.currentUserName = null;
  window.currentUserApelido = null;
  
  // Volta para tela inicial
  const mainScreen = getEl('main-screen');
  const inspectorScreen = getEl('inspector-screen');
  
  if (mainScreen) mainScreen.style.display = 'block';
  if (inspectorScreen) inspectorScreen.style.display = 'none';
  
  // Limpa campos
  const fiscalField = getEl('fiscal');
  const envioResponsavel = getEl('envio-responsavel');
  
  if (fiscalField) fiscalField.value = '';
  if (envioResponsavel) envioResponsavel.value = '';
  
  console.log('👋 Logout realizado com sucesso');
}

// Exportar funções de login para escopo global
window.login = login;
window.checkLoginStatus = checkLoginStatus;
window.logoutInspector = logoutInspector;
window.showInspectorScreen = showInspectorScreen;
window.updateUIByRole = updateUIByRole;
