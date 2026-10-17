// Master Application Controller

document.addEventListener('DOMContentLoaded', async () => {
  setupWindowControls();
  setupSidebarEvents();
  setupGameEventListeners();

  await initApp();
});

// Window Titlebar Controls
function setupWindowControls() {
  document.getElementById('win-min').addEventListener('click', () => window.api.minimizeWindow());
  document.getElementById('win-max').addEventListener('click', () => window.api.maximizeWindow());
  document.getElementById('win-close').addEventListener('click', () => window.api.closeWindow());
}

async function initApp() {
  try {
    const storeData = await window.api.getStore();

    // 1. Check if user accepted TOS
    if (!storeData.tos_accepted) {
      document.getElementById('view-onboarding').classList.add('active');
      document.getElementById('view-main').style.display = 'none';
      goToOnboardingStep('welcome');
      return;
    }

    // 2. Check if user has an active account
    if (!storeData.current_account) {
      document.getElementById('view-onboarding').classList.add('active');
      document.getElementById('view-main').style.display = 'none';
      goToOnboardingStep('login');
      return;
    }

    // 3. User is ready: Enter Main Menu
    enterMainMenu(storeData);
  } catch (err) {
    console.error('Error initializing app:', err);
  }
}

function onLoginSuccessful(account) {
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('view-main').style.display = 'flex';

  window.api.getStore().then(storeData => {
    enterMainMenu(storeData);
  });
}

function enterMainMenu(storeData) {
  document.getElementById('view-onboarding').classList.remove('active');
  document.getElementById('view-main').style.display = 'flex';

  const account = storeData.current_account;

  // Initialize Dynamic Greeting based on PC Clock & Username & Avatar
  updateDynamicGreeting(account?.username, account?.skinUrl);

  // Render Sidebar
  renderSidebar(storeData);

  // If there's an instance selected, display it; else show Home
  if (storeData.selected_instance_id && storeData.instances.some(i => i.id === storeData.selected_instance_id)) {
    showInstanceView(storeData.selected_instance_id);
  } else {
    setActiveSidebarNav('home');
    showHomeView();
  }
}

// Global Toast Notification Helper
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}
