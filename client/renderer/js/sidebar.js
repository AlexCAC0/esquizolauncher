// Sidebar Controller

function renderSidebar(storeData) {
  const currentAccount = storeData.current_account;
  const instances = storeData.instances || [];
  const selectedInstanceId = storeData.selected_instance_id;

  // 1. Update Player Skin Head
  const skinHeadEl = document.getElementById('sidebar-skin-head');
  if (currentAccount) {
    skinHeadEl.src = currentAccount.skinUrl || `https://minotar.net/avatar/${currentAccount.username}/64.png`;
    skinHeadEl.title = `${currentAccount.username} (${currentAccount.type === 'microsoft' ? 'Microsoft' : 'Offline'})`;
  } else {
    skinHeadEl.src = 'https://minotar.net/avatar/Steve/64.png';
  }

  // 2. Render Instances List
  const listEl = document.getElementById('sidebar-instances-list');
  listEl.innerHTML = '';

  instances.forEach(inst => {
    const btn = document.createElement('button');
    btn.className = 'instance-logo-btn' + (inst.id === selectedInstanceId ? ' active' : '');
    btn.title = inst.name || inst.id;

    // Use inst.logo if available, or placeholder SVG
    const logoSrc = inst.logo ? `${storeData.settings.api_url || 'http://localhost:3001'}${inst.logo}` : 'assets/default-instance.png';

    btn.innerHTML = `
      <img src="${logoSrc}" alt="${inst.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'%23c084fc\\' stroke-width=\\'2\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/></svg>'">
    `;

    btn.addEventListener('click', () => {
      selectInstance(inst.id);
    });

    listEl.appendChild(btn);
  });
}

function setupSidebarEvents() {
  // Home Button
  document.getElementById('nav-btn-home').addEventListener('click', () => {
    setActiveSidebarNav('home');
    showHomeView();
  });

  // Gallery Button
  document.getElementById('nav-btn-gallery').addEventListener('click', () => {
    setActiveSidebarNav('gallery');
    showGalleryView();
  });

  // Add Instance (+)
  document.getElementById('btn-add-instance').addEventListener('click', () => {
    openClaimModal();
  });

  // Player Profile Modal
  document.getElementById('btn-player-profile').addEventListener('click', () => {
    openAccountManagementModal();
  });

  // Official Studio Discord Button
  const discordSidebarBtn = document.getElementById('btn-sidebar-discord');
  if (discordSidebarBtn) {
    discordSidebarBtn.addEventListener('click', () => {
      openDiscordInvite();
    });
  }

  // Settings Gear
  document.getElementById('btn-settings').addEventListener('click', () => {
    setActiveSidebarNav('settings');
    showSettingsView();
  });
}

function setActiveSidebarNav(navName) {
  document.querySelectorAll('.sidebar-icon-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.instance-logo-btn').forEach(b => b.classList.remove('active'));

  if (navName === 'home') {
    document.getElementById('nav-btn-home').classList.add('active');
  } else if (navName === 'gallery') {
    document.getElementById('nav-btn-gallery').classList.add('active');
  } else if (navName === 'settings') {
    document.getElementById('btn-settings').classList.add('active');
  }
}

async function selectInstance(instanceId) {
  await window.api.selectInstance(instanceId);
  setActiveSidebarNav(null);

  // Mark logo button active
  const storeData = await window.api.getStore();
  renderSidebar(storeData);

  // Display Instance in Center Screen
  showInstanceView(instanceId);
}
