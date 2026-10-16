// Modal Helpers

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}

// --- CLAIM INSTANCE MODAL (18-CHAR CODE) ---

function openClaimModal() {
  const input = document.getElementById('access-code-input');
  input.value = '';
  document.getElementById('claim-error').style.display = 'none';
  openModal('modal-add-instance');
  setTimeout(() => input.focus(), 100);
}

async function submitClaimInstance() {
  const input = document.getElementById('access-code-input');
  const code = input.value.trim();
  const errBox = document.getElementById('claim-error');
  errBox.style.display = 'none';

  if (!code) {
    errBox.textContent = 'Debes ingresar un código de acceso.';
    errBox.style.display = 'block';
    return;
  }

  if (code.length !== 18) {
    errBox.textContent = `El código debe tener exactamente 18 caracteres (actualmente tiene ${code.length}).`;
    errBox.style.display = 'block';
    return;
  }

  const btn = document.getElementById('btn-claim-instance');
  btn.disabled = true;
  btn.textContent = 'Verificando con EsquizoStudios...';

  try {
    const res = await window.api.claimInstance(code);
    if (res.success && res.instance) {
      closeModal('modal-add-instance');

      // Refresh sidebar and select new instance
      const storeData = await window.api.getStore();
      renderSidebar(storeData);
      selectInstance(res.instance.id);
    } else {
      errBox.textContent = res.error || 'Código no válido o no encontrado.';
      errBox.style.display = 'block';
    }
  } catch (err) {
    errBox.textContent = 'Error de conexión con el servidor de EsquizoStudios.';
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verificar y Registrar';
  }
}

// --- ACCOUNT MANAGEMENT MODAL ---

async function openAccountManagementModal() {
  const storeData = await window.api.getStore();
  const current = storeData.current_account;
  const accounts = storeData.accounts || [];

  if (current) {
    document.getElementById('modal-skin-preview').src = current.skinUrl || `https://minotar.net/avatar/${current.username}/64.png`;
    document.getElementById('modal-account-name').textContent = current.username;
    document.getElementById('modal-account-badge').textContent = current.type === 'microsoft' ? 'Microsoft Premium' : 'Offline';

    const discordEl = document.getElementById('modal-discord-tag');
    if (current.discord_id) {
      discordEl.textContent = `Discord: @${current.discord_username || current.discord_id}`;
    } else {
      discordEl.textContent = '';
    }
  }

  // Populate accounts list
  const listEl = document.getElementById('modal-accounts-list');
  listEl.innerHTML = '';

  accounts.forEach(acc => {
    const isCurrent = current && acc.username.toLowerCase() === current.username.toLowerCase();
    const item = document.createElement('div');
    item.className = 'account-list-item' + (isCurrent ? ' active' : '');
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <img src="${acc.skinUrl || `https://minotar.net/avatar/${acc.username}/64.png`}" style="width:28px; height:28px; border-radius:4px; image-rendering:pixelated;">
        <div>
          <strong style="font-size:13px; color:#fff;">${acc.username}</strong>
          <small style="color:var(--text-muted); display:block;">${acc.type === 'microsoft' ? 'Microsoft' : 'Offline'}</small>
        </div>
      </div>
      ${isCurrent ? '<span class="badge" style="background:#10b981; color:#fff;">ACTIVA</span>' : '<button class="btn btn-secondary btn-sm">Usar</button>'}
    `;

    if (!isCurrent) {
      item.addEventListener('click', async () => {
        await window.api.switchAccount(acc);
        closeModal('modal-accounts');
        const updated = await window.api.getStore();
        renderSidebar(updated);
        updateDynamicGreeting(acc.username);
      });
    }

    listEl.appendChild(item);
  });

  openModal('modal-accounts');
}

function addNewAccountFromModal() {
  closeModal('modal-accounts');
  document.getElementById('view-main').style.display = 'none';
  document.getElementById('view-onboarding').classList.add('active');
  goToOnboardingStep('login');
}

async function logoutCurrentAccount() {
  await window.api.logout();
  closeModal('modal-accounts');
  document.getElementById('view-main').style.display = 'none';
  document.getElementById('view-onboarding').classList.add('active');
  goToOnboardingStep('login');
}
