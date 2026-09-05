const profileName = document.querySelector('#profileName');
const profileHandle = document.querySelector('#profileHandle');
const profileBio = document.querySelector('#profileBio');
const profileAvatar = document.querySelector('#profileAvatar');
const profileForm = document.querySelector('#profileForm');
const profileEditor = document.querySelector('#profileEditor');
const saveStatus = document.querySelector('#saveStatus');
const profileSections = document.querySelector('#profileSections');
const spaceToolbar = document.querySelector('#spaceToolbar');
const addModal = document.querySelector('#addModal');
const sectionModal = document.querySelector('#sectionModal');
const toast = document.querySelector('#profileToast');
const imageUpload = document.querySelector('#imageUpload');
const profileAvatarUpload = document.querySelector('#profileAvatarUpload');
let profileUser;
let state = { editing: false, activeSectionId: null, selectedSectionId: null, selectedElementId: null, sections: [], draggedSectionId: null };
let activePointer = null;

const starterSections = [
    {
        id: 'section-interestelar', type: 'movie', title: 'Interestelar', description: 'Um filme que me faz pensar sobre tempo, memória e tudo que permanece.', theme: 'space', divider: 'stars',
        elements: [
            { id: 'interestelar-poster', type: 'movie', title: 'Interestelar', meta: '2014', src: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=600&q=85', x: 54, y: 42, width: 180, height: 250, z: 2 },
            { id: 'interestelar-photo', type: 'image', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=700&q=85', x: 270, y: 58, width: 295, height: 190, z: 1 },
            { id: 'interestelar-text', type: 'text', content: '“O amor é a única coisa que transcende o tempo e o espaço.”', x: 290, y: 285, width: 360, height: 105, z: 3 }
        ]
    },
    {
        id: 'section-castelo', type: 'movie', title: 'O Castelo Animado', description: 'Uma das animações que mais parecem um sonho acordado.', theme: 'warm', divider: 'wave',
        elements: [
            { id: 'castelo-photo', type: 'image', src: 'https://images.unsplash.com/photo-1511108690759-009324a90311?auto=format&fit=crop&w=700&q=85', x: 48, y: 48, width: 270, height: 200, z: 1 },
            { id: 'castelo-poster', type: 'movie', title: 'O Castelo Animado', meta: '2004', src: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=85', x: 610, y: 35, width: 180, height: 250, z: 2 },
            { id: 'castelo-text', type: 'text', content: '“Uma casa que anda, uma porta para cada mundo e um coração aprendendo a ficar.”', x: 350, y: 300, width: 330, height: 112, z: 3 }
        ]
    },
    {
        id: 'section-space-song', type: 'music', title: 'Space Song', description: 'Essa música parece literalmente uma memória.', theme: 'lavender', divider: 'dots',
        elements: [
            { id: 'space-song-music', type: 'music', title: 'Space Song', meta: 'Beach House', src: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=300&q=85', x: 95, y: 70, width: 335, height: 78, z: 2 },
            { id: 'space-song-decor', type: 'decor', src: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=85', x: 520, y: 35, width: 235, height: 200, z: 1 }
        ]
    }
];

function sectionsKey() { return `starlitProfileSections:${profileUser?.id || 'guest'}`; }
function oldSpaceKey() { return `starlitProfileSpace:${profileUser?.id || 'guest'}`; }
function avatarKey() { return `starlitProfileAvatar:${profileUser?.id || 'guest'}`; }
function saveSections() { localStorage.setItem(sectionsKey(), JSON.stringify(state.sections)); }
function currentSection() { return state.sections.find((section) => section.id === state.selectedSectionId); }
function selectedElement() { const section = currentSection(); return section?.elements.find((item) => item.id === state.selectedElementId); }
function getCanvasSize(canvas) { return { width: canvas.clientWidth, height: canvas.clientHeight }; }
function clampElement(item, canvas) { const size = getCanvasSize(canvas); item.width = Math.max(70, Math.min(item.width, size.width)); item.height = Math.max(45, Math.min(item.height, size.height)); item.x = Math.max(0, Math.min(item.x, size.width - item.width)); item.y = Math.max(0, Math.min(item.y, size.height - item.height)); }
function setSelected(sectionId, elementId = null) {
    state.selectedSectionId = sectionId;
    state.selectedElementId = elementId;
    document.querySelectorAll('.profile-element').forEach((element) => element.classList.toggle('is-selected', element.dataset.id === elementId));
    document.querySelector('#bringFront').disabled = !elementId;
    document.querySelector('#sendBack').disabled = !elementId;
    document.querySelector('#deleteBlock').disabled = !elementId;
}
function showToast(message) { toast.textContent = message; window.setTimeout(() => { toast.textContent = ''; }, 2600); }
function makeImage(src, alt) { const image = document.createElement('img'); image.src = src; image.alt = alt; image.draggable = false; return image; }
function makeMeta(title, meta) { const wrapper = document.createElement('div'); wrapper.className = 'profile-element-meta'; const heading = document.createElement('strong'); heading.textContent = title || 'Sem título'; const detail = document.createElement('span'); detail.textContent = meta || ''; wrapper.append(heading, detail); return wrapper; }
function elementContent(item) {
    const content = document.createElement('div'); content.className = 'profile-element-content';
    if (item.type === 'text' || item.type === 'sticker') { content.className += ` profile-element-${item.type}`; content.textContent = item.content; }
    else if (item.type === 'music') { content.className += ' profile-element-music'; content.append(makeImage(item.src, `Capa de ${item.title}`), makeMeta(item.title, item.meta)); }
    else if (item.type === 'book' || item.type === 'movie') { content.className += ` profile-element-${item.type}`; content.append(makeImage(item.src, `${item.type === 'book' ? 'Capa' : 'Pôster'} de ${item.title}`), makeMeta(item.title, item.meta)); }
    else content.append(makeImage(item.src, item.type === 'decor' ? 'Imagem decorativa' : 'Foto da coleção'));
    return content;
}
function makeHandle(position) { const handle = document.createElement('span'); handle.className = `perfil-handle-icon perfil-handle-${position}`; handle.dataset.resize = position; handle.setAttribute('aria-hidden', 'true'); return handle; }
function renderElement(item, section, canvas) {
    clampElement(item, canvas);
    const element = document.createElement('article'); element.className = 'profile-element'; element.dataset.id = item.id; element.dataset.sectionId = section.id; element.style.left = `${item.x}px`; element.style.top = `${item.y}px`; element.style.width = `${item.width}px`; element.style.height = `${item.height}px`; element.style.zIndex = item.z || 1;
    element.append(elementContent(item), makeHandle('nw'), makeHandle('ne'), makeHandle('sw'), makeHandle('se'));
    if (state.editing) { const remove = document.createElement('button'); remove.className = 'perfil-element-delete'; remove.type = 'button'; remove.textContent = 'Excluir'; remove.addEventListener('click', (event) => { event.stopPropagation(); deleteSelected(); }); element.append(remove); }
    element.addEventListener('pointerdown', beginPointerAction); element.addEventListener('click', (event) => { event.stopPropagation(); if (state.editing) setSelected(section.id, item.id); });
    canvas.appendChild(element);
}
function dividerElement(section) { const divider = document.createElement('div'); divider.className = `perfil-divider perfil-divider-${section.divider || 'stars'}`; divider.innerHTML = `<span>${section.divider === 'heart' ? '♡ · ───── · ♡' : section.divider === 'wave' ? '〰 〰 〰' : section.divider === 'dots' ? '· · · · ·' : section.divider === 'line' ? '───────' : section.divider === 'glass' ? '✦' : '✦ · ───── · ✦'}</span>`; return divider; }
function renderSection(section, index) {
    const wrapper = document.createElement('article'); wrapper.className = `perfil-section perfil-section-${section.theme || 'default'}`; wrapper.dataset.sectionId = section.id; wrapper.draggable = state.editing;
    const header = document.createElement('header'); header.className = 'perfil-section-header';
    const headerInfo = document.createElement('div'); headerInfo.className = 'perfil-section-info'; const type = document.createElement('span'); type.className = 'perfil-section-type'; type.textContent = section.type === 'movie' ? 'FILME' : section.type === 'book' ? 'LIVRO' : section.type === 'music' ? 'MÚSICA' : 'COLEÇÃO'; const title = document.createElement('h3'); title.textContent = section.title; const description = document.createElement('p'); description.textContent = section.description || 'Uma coleção de coisas que pertencem a este universo.'; headerInfo.append(type, title, description);
    const actions = document.createElement('div'); actions.className = 'perfil-section-actions';
    if (state.editing) { const add = document.createElement('button'); add.className = 'perfil-section-add'; add.type = 'button'; add.textContent = '＋ Adicionar'; add.addEventListener('click', () => openAddModal(section.id)); const up = document.createElement('button'); up.type = 'button'; up.title = 'Mover seção para cima'; up.textContent = '↑'; up.addEventListener('click', () => moveSection(section.id, -1)); const down = document.createElement('button'); down.type = 'button'; down.title = 'Mover seção para baixo'; down.textContent = '↓'; down.addEventListener('click', () => moveSection(section.id, 1)); const remove = document.createElement('button'); remove.type = 'button'; remove.title = 'Excluir seção'; remove.textContent = '×'; remove.addEventListener('click', () => removeSection(section.id)); actions.append(add, up, down, remove); }
    header.append(headerInfo, actions); wrapper.append(header, dividerElement(section));
    const canvas = document.createElement('div'); canvas.className = `profile-space${state.editing ? ' perfil-editing' : ''}`; canvas.dataset.sectionId = section.id; canvas.tabIndex = 0; canvas.setAttribute('aria-label', `Espaço da seção ${section.title}`); canvas.addEventListener('click', () => { if (state.editing) setSelected(section.id); }); section.elements.forEach((item) => renderElement(item, section, canvas)); wrapper.append(canvas); profileSections.appendChild(wrapper);
    if (state.editing) { wrapper.addEventListener('dragstart', () => { state.draggedSectionId = section.id; }); wrapper.addEventListener('dragover', (event) => event.preventDefault()); wrapper.addEventListener('drop', () => reorderSection(state.draggedSectionId, section.id)); }
}
function renderSections() { profileSections.replaceChildren(); state.sections.forEach(renderSection); setSelected(state.selectedSectionId, state.selectedElementId); }
function beginPointerAction(event) {
    if (!state.editing) return; const element = event.currentTarget; const section = state.sections.find((item) => item.id === element.dataset.sectionId); const item = section?.elements.find((entry) => entry.id === element.dataset.id); if (!item || event.target.closest('.perfil-element-delete')) return;
    setSelected(section.id, item.id); const resize = event.target.dataset.resize || null; activePointer = { item, section, canvas: element.parentElement, resize, startX: event.clientX, startY: event.clientY, x: item.x, y: item.y, width: item.width, height: item.height }; event.preventDefault();
}
function movePointer(event) { if (!activePointer) return; const data = activePointer; const dx = event.clientX - data.startX; const dy = event.clientY - data.startY; if (!data.resize) { data.item.x = data.x + dx; data.item.y = data.y + dy; } else { if (data.resize.includes('e')) data.item.width = data.width + dx; if (data.resize.includes('s')) data.item.height = data.height + dy; if (data.resize.includes('w')) { data.item.width = data.width - dx; data.item.x = data.x + dx; } if (data.resize.includes('n')) { data.item.height = data.height - dy; data.item.y = data.y + dy; } } clampElement(data.item, data.canvas); renderSections(); }
function finishPointer() { if (activePointer) saveSections(); activePointer = null; }
function deleteSelected() { const section = currentSection(); if (!section || !state.selectedElementId) return; section.elements = section.elements.filter((item) => item.id !== state.selectedElementId); state.selectedElementId = null; saveSections(); renderSections(); }
function moveSection(id, direction) { const index = state.sections.findIndex((section) => section.id === id); const target = index + direction; if (index < 0 || target < 0 || target >= state.sections.length) return; [state.sections[index], state.sections[target]] = [state.sections[target], state.sections[index]]; saveSections(); renderSections(); }
function reorderSection(sourceId, targetId) { if (!sourceId || sourceId === targetId) return; const sourceIndex = state.sections.findIndex((section) => section.id === sourceId); const targetIndex = state.sections.findIndex((section) => section.id === targetId); const [section] = state.sections.splice(sourceIndex, 1); state.sections.splice(targetIndex, 0, section); state.draggedSectionId = null; saveSections(); renderSections(); }
function removeSection(id) { if (state.sections.length === 1) return showToast('O perfil precisa ter pelo menos uma seção.'); if (!window.confirm('Excluir esta seção e todo o seu conteúdo?')) return; state.sections = state.sections.filter((section) => section.id !== id); saveSections(); renderSections(); }
function nextPosition(width, height, section) { const index = section.elements.length; return { x: 30 + (index % 3) * 72, y: 28 + (index % 4) * 65, width, height }; }
function addElement(item, sectionId) { const section = state.sections.find((entry) => entry.id === sectionId); if (!section) return; item.id = `element-${Date.now()}-${Math.random().toString(16).slice(2)}`; item.z = Math.max(1, ...section.elements.map((entry) => entry.z || 1)) + 1; section.elements.push(item); state.selectedSectionId = sectionId; state.selectedElementId = item.id; saveSections(); renderSections(); }
function openAddModal(sectionId) { state.activeSectionId = sectionId; addModal.hidden = false; document.querySelector('[data-block="image"]').focus(); }
function closeModal() { addModal.hidden = true; }
function promptElement(type, sectionId) { const section = state.sections.find((entry) => entry.id === sectionId); if (!section) return; if (type === 'text' || type === 'sticker') { const content = window.prompt(type === 'sticker' ? 'Digite um símbolo ou sticker:' : 'Escreva algo para esta seção:'); if (content?.trim()) addElement({ type, content: content.trim(), ...nextPosition(type === 'sticker' ? 110 : 250, type === 'sticker' ? 110 : 110, section) }, sectionId); return; } const title = window.prompt(`Nome do ${type}:`); if (!title?.trim()) return; const meta = window.prompt(type === 'music' ? 'Artista:' : type === 'book' ? 'Autor:' : 'Ano ou detalhe:') || ''; const samples = { music: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=300&q=85', movie: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=600&q=85', book: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=85' }; const dimensions = type === 'music' ? [310, 78] : [170, 245]; addElement({ type, title: title.trim(), meta: meta.trim(), src: samples[type], ...nextPosition(...dimensions, section) }, sectionId); }
function handleImageChoice(type, sectionId) { imageUpload.onchange = () => { const file = imageUpload.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => addElement({ type, src: reader.result, ...nextPosition(type === 'decor' ? 220 : 260, type === 'decor' ? 180 : 220, state.sections.find((item) => item.id === sectionId)) }, sectionId); reader.readAsDataURL(file); imageUpload.value = ''; }; imageUpload.click(); }
function toggleEditing(editing) { state.editing = editing; spaceToolbar.hidden = !editing; document.querySelector('#spaceHint').textContent = editing ? 'Arraste blocos, reorganize seções ou use Delete para excluir.' : 'Cada seção é um pequeno universo dentro do seu perfil.'; document.querySelector('#finishSpaceEdit').hidden = !editing; renderSections(); }
function openSectionModal() { sectionModal.hidden = false; document.querySelector('#sectionTitle').focus(); }
function closeSectionModal() { sectionModal.hidden = true; }

window.addEventListener('pointermove', movePointer); window.addEventListener('pointerup', finishPointer); window.addEventListener('resize', () => { state.sections.forEach((section) => { const canvas = document.querySelector(`.profile-space[data-section-id="${section.id}"]`); section.elements.forEach((item) => canvas && clampElement(item, canvas)); }); renderSections(); saveSections(); });
window.addEventListener('keydown', (event) => { if (state.editing && (event.key === 'Delete' || event.key === 'Backspace') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) deleteSelected(); if (event.key === 'Escape') { closeModal(); closeSectionModal(); } });
document.querySelector('#spaceToolbar').addEventListener('click', (event) => { if (event.target.id === 'finishSpaceEdit') toggleEditing(false); });
document.querySelector('#spaceEdit')?.addEventListener('click', () => toggleEditing(true));
document.querySelector('#finishSpaceEdit').addEventListener('click', () => toggleEditing(false)); document.querySelector('#newSection').addEventListener('click', openSectionModal); document.querySelector('#closeSectionModal').addEventListener('click', closeSectionModal); sectionModal.addEventListener('click', (event) => { if (event.target === sectionModal) closeSectionModal(); });
document.querySelector('#bringFront').addEventListener('click', () => { const item = selectedElement(); const section = currentSection(); if (item && section) { item.z = Math.max(...section.elements.map((entry) => entry.z || 1)) + 1; saveSections(); renderSections(); } }); document.querySelector('#sendBack').addEventListener('click', () => { const item = selectedElement(); const section = currentSection(); if (item && section) { item.z = Math.min(...section.elements.map((entry) => entry.z || 1)) - 1; saveSections(); renderSections(); } }); document.querySelector('#deleteBlock').addEventListener('click', deleteSelected);
document.querySelector('#addModal').addEventListener('click', (event) => { if (event.target === addModal) closeModal(); }); document.querySelector('#closeModal').addEventListener('click', closeModal); document.querySelectorAll('[data-block]').forEach((button) => button.addEventListener('click', () => { const type = button.dataset.block; closeModal(); if (type === 'image' || type === 'decor') handleImageChoice(type, state.activeSectionId); else promptElement(type, state.activeSectionId); }));
document.querySelector('#sectionForm').addEventListener('submit', (event) => { event.preventDefault(); const section = { id: `section-${Date.now()}`, type: document.querySelector('#sectionType').value, title: document.querySelector('#sectionTitle').value.trim(), description: document.querySelector('#sectionDescription').value.trim(), theme: document.querySelector('#sectionTheme').value, divider: document.querySelector('#sectionDivider').value, elements: [] }; if (!section.title) return; state.sections.push(section); saveSections(); closeSectionModal(); renderSections(); toggleEditing(true); document.querySelector('#sectionForm').reset(); });

document.querySelector('#editProfile').addEventListener('click', () => { profileEditor.hidden = !profileEditor.hidden; document.querySelector('#editProfile').setAttribute('aria-pressed', String(!profileEditor.hidden)); }); profileAvatar.addEventListener('click', () => { if (!profileEditor.hidden) profileAvatarUpload.click(); }); profileAvatarUpload.addEventListener('change', () => { const file = profileAvatarUpload.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { profileAvatar.src = reader.result; localStorage.setItem(avatarKey(), reader.result); }; reader.readAsDataURL(file); });
profileForm.addEventListener('submit', async (event) => { event.preventDefault(); const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.querySelector('#nameInput').value, bio: document.querySelector('#bioInput').value }) }); if (!response.ok) return; const profile = await response.json(); profileName.textContent = profile.name; profileHandle.textContent = `@${profile.name.toLowerCase().replace(/\s+/g, '')}`; profileBio.textContent = profile.bio || 'Colecionando histórias, sons e pequenos mundos.'; saveStatus.textContent = 'Perfil salvo'; window.setTimeout(() => { saveStatus.textContent = ''; }, 1800); });

async function loadProfile() { const response = await fetch('/api/profile'); if (!response.ok) throw new Error('Sessão expirada'); profileUser = await response.json(); profileName.textContent = profileUser.name; profileHandle.textContent = `@${profileUser.name.toLowerCase().replace(/\s+/g, '')}`; profileBio.textContent = profileUser.bio || 'Colecionando histórias, sons e pequenos mundos.'; document.querySelector('#nameInput').value = profileUser.name; document.querySelector('#bioInput').value = profileUser.bio || ''; const savedAvatar = localStorage.getItem(avatarKey()); if (savedAvatar) profileAvatar.src = savedAvatar; const storedSections = localStorage.getItem(sectionsKey()); const oldSpace = localStorage.getItem(oldSpaceKey()); if (storedSections) state.sections = JSON.parse(storedSections); else if (oldSpace) state.sections = [{ id: 'section-migrated', type: 'custom', title: 'Meu espaço', description: 'Uma coleção que nasceu do seu mural anterior.', theme: 'default', divider: 'glass', elements: JSON.parse(oldSpace) }]; else state.sections = starterSections.map((section) => ({ ...section, elements: section.elements.map((item) => ({ ...item })) })); saveSections(); renderSections(); }
loadProfile().catch(() => window.location.replace('entrar.html'));
