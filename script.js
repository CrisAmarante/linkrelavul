const URL_PLANILHA = "https://script.google.com/macros/s/AKfycbwOdmBDWJPVRkepk05SZ7JDSYSCzW8kW6Hb8YTjLWQDp-vykS7bd5-_e_thkwpcbVFL/exec";

let INSPETORES = {};

// ====================================================================
// REGISTRO DE LOG
// ====================================================================
async function registrarLog(nomeApelido) {
  try {
    const formData = new URLSearchParams();
    formData.append("nome", nomeApelido);
    formData.append("acao", "Login bem-sucedido");

    await fetch(URL_PLANILHA, {
      method: "POST",
      body: formData,
      mode: "no-cors"
    });

    console.log("Log enviado:", nomeApelido);
  } catch (err) {
    console.warn("Falha ao registrar log:", err);
  }
}

// ====================================================================
// CARREGAMENTO DA LISTA DE USUÁRIOS (JSONP)
// ====================================================================
function processarDadosPlanilha(dados) {
  INSPETORES = dados;
  console.log("Lista de inspetores carregada.");
}

function carregarInspetores() {
  const script = document.createElement('script');
  script.src = `${URL_PLANILHA}?callback=processarDadosPlanilha`;
  document.body.appendChild(script);
}

// ====================================================================
// LOGIN
// ====================================================================
function checkLoginStatus() {
  const logado = localStorage.getItem('inspectorLoggedIn');
  const nomeInspetor = localStorage.getItem('inspectorName');

  if (logado === 'true' && nomeInspetor) {
    document.getElementById('main-screen').style.display = 'none';
    document.getElementById('inspector-screen').style.display = 'flex';

    const welcomeMsg = document.getElementById('welcome-msg');
    if (welcomeMsg) {
      welcomeMsg.innerText = `Bem-vindo, Inspetor ${nomeInspetor}!`;
    }
  } else {
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('inspector-screen').style.display = 'none';
  }
}

function login(e) {
  e.preventDefault();

  const senhaDigitada = document.getElementById('password').value.trim();
  const nomeEncontrado = Object.keys(INSPETORES).find(
    nome => INSPETORES[nome] === senhaDigitada
  );

  if (nomeEncontrado) {
    localStorage.setItem('inspectorLoggedIn', 'true');
    localStorage.setItem('inspectorName', nomeEncontrado);

    registrarLog(nomeEncontrado);

    closeModal('modal-login');
    checkLoginStatus();
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('password').value = '';
    document.getElementById('password').focus();
  }
}

function logoutInspector() {
  localStorage.removeItem('inspectorLoggedIn');
  localStorage.removeItem('inspectorName');
  checkLoginStatus();
}

// ====================================================================
// MODAIS
// ====================================================================
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// ====================================================================
// BLOQUEIO DE BOTÕES POR DATA
// ====================================================================
const disableDates = {
  'btn-osasco': new Date('2026-02-19'),
  'btn-santana': new Date('2026-02-03')
};

function aplicarBloqueioDeDatas() {
  const now = new Date();
  for (const [id, date] of Object.entries(disableDates)) {
    const btn = document.getElementById(id);
    if (btn && now < date) {
      btn.classList.add('disabled');
      btn.setAttribute('href', '#');
      btn.title = 'Disponível a partir de ' + date.toLocaleDateString('pt-BR');
    }
  }
}

// ====================================================================
// BANNER TEMPORÁRIO
// ====================================================================
const dataInicio = new Date('2026-03-11T00:01:00');
const dataFim    = new Date('
