const STORAGE_KEY = 'totte-wishlist-v1';

const PRIORITIES = ['今すぐ買う', '次の買い物', 'いつか買いたい', '保留'];
const TASK_BUCKETS = ['今日やる', '外出した時にやる', '余裕がある日にやる', 'いつかやりたい'];
const DEFAULT_CATEGORIES = ['コスメ', 'ジュエリー', '美容医療', '服', '日用品', '趣味', '株', 'その他'];
const PRIORITY_COLORS = {
  '今すぐ買う': '#d89c7f',
  '次の買い物': '#758d7e',
  'いつか買いたい': '#c1ad6e',
  '保留': '#a6aaa7'
};
const TASK_COLORS = ['#d89c7f', '#758d7e', '#c1ad6e', '#9b9e9a'];
const CATEGORY_STYLE = {
  'コスメ': ['#f1d9d2', '#a66358', 'C'],
  'ジュエリー': ['#ece0d2', '#8f6d43', '宝'],
  '美容医療': ['#dce8ec', '#53727c', '美'],
  '服': ['#dce5de', '#536d5d', 'F'],
  '日用品': ['#eee5c8', '#958144', '日'],
  '趣味': ['#e5deeb', '#71617c', '趣'],
  '株': ['#dbe7dc', '#4e7254', '株'],
  'その他': ['#e7e4df', '#706d68', '他']
};
const CUSTOM_CATEGORY_STYLES = [
  ['#e8e0ef', '#71617c'], ['#dce8ec', '#53727c'], ['#eee5c8', '#8b7740'],
  ['#f1d9d2', '#9a6155'], ['#dce5de', '#536d5d'], ['#e8e2da', '#74685d']
];
const VIEW_TITLES = {
  home: '',
  wishlist: '欲しいもの',
  tasks: 'タスク',
  history: '購入履歴',
  settings: '設定'
};

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function defaultState() {
  const now = new Date().toISOString();
  return {
    categories: [...DEFAULT_CATEGORIES],
    budgetCategories: { beauty: ['コスメ', '美容医療'], daily: ['日用品'] },
    wishes: [
      { id: uid('wish'), name: '香りのいいハンドクリーム', price: 1680, category: 'コスメ', priority: '今すぐ買う', need: '必要', store: '駅前のドラッグストア', memo: '今使っているものがなくなったら', link: '', purchased: false, createdAt: now, purchasedAt: null },
      { id: uid('wish'), name: 'やわらかい春色カーディガン', price: 6900, category: '服', priority: '次の買い物', need: 'あったら嬉しい', store: 'オンラインストア', memo: '手持ちの白いパンツに合わせたい', link: '', purchased: false, createdAt: now, purchasedAt: null },
      { id: uid('wish'), name: '小さなガラスの花瓶', price: 2800, category: '趣味', priority: 'いつか買いたい', need: 'ご褒美', store: '雑貨店', memo: '一輪だけ飾れるサイズ', link: '', purchased: false, createdAt: now, purchasedAt: null }
    ],
    tasks: [
      { id: uid('task'), title: '日用品のストックを確認する', bucket: '今日やる', memo: '', completed: false, createdAt: now, completedAt: null },
      { id: uid('task'), title: '気になるコスメを店頭で試す', bucket: '外出した時にやる', memo: '色味と香りを確認', completed: false, createdAt: now, completedAt: null },
      { id: uid('task'), title: 'クローゼットを少し整理する', bucket: '余裕がある日にやる', memo: '', completed: false, createdAt: now, completedAt: null }
    ],
    budgets: { [monthKey()]: { beauty: 12000, daily: 8000 } },
    initialized: true
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed || !Array.isArray(parsed.wishes) || !Array.isArray(parsed.tasks)) return defaultState();
    parsed.budgets ||= {};
    if (!Array.isArray(parsed.categories)) {
      const usedCategories = parsed.wishes.map(item => item.category).filter(Boolean);
      parsed.categories = [...new Set([...DEFAULT_CATEGORIES, ...usedCategories])];
    }
    parsed.categories = parsed.categories.map(item => String(item).trim()).filter(Boolean);
    if (!parsed.categories.length) parsed.categories = ['その他'];
    if (!parsed.budgetCategories) parsed.budgetCategories = { beauty: ['コスメ', '美容医療'], daily: ['日用品'] };
    parsed.budgetCategories.beauty ||= [];
    parsed.budgetCategories.daily ||= [];
    return parsed;
  } catch {
    return defaultState();
  }
}

let state = loadState();
let currentView = 'home';
let wishFilter = 'all';
let toastTimer;
let pendingWishImage = '';

const yen = value => new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function safeLink(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch { return ''; }
}

function safeImage(value) {
  return typeof value === 'string' && /^data:image\/(?:jpeg|png|webp|gif);base64,/i.test(value) ? value : '';
}

function categoryVisual(category) {
  if (CATEGORY_STYLE[category]) return CATEGORY_STYLE[category];
  const text = String(category || 'その他');
  const hash = [...text].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const [bg, ink] = CUSTOM_CATEGORY_STYLES[hash % CUSTOM_CATEGORY_STYLES.length];
  return [bg, ink, text.slice(0, 1) || '他'];
}

function saveState(message) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    if (message) showToast(message);
    return true;
  } catch (error) {
    console.error(error);
    showToast('保存容量が足りません。画像を外すか、別の画像をお試しください');
    return false;
  }
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function formatDate(value, options = { month: 'short', day: 'numeric' }) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', options).format(new Date(value));
}

function deadlineInfo(task) {
  if (!task.deadline) return null;
  const deadline = new Date(task.deadline);
  if (Number.isNaN(deadline.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const dayDiff = Math.round((targetDay - today) / 86400000);
  const time = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit' }).format(deadline);
  const dateTime = new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(deadline);
  if (!task.completed && deadline < now) return { state: 'overdue', text: `期限超過・${dateTime}`, time: deadline.getTime() };
  if (dayDiff === 0) return { state: 'today', text: `今日 ${time}まで`, time: deadline.getTime() };
  if (dayDiff === 1) return { state: 'soon', text: `明日 ${time}まで`, time: deadline.getTime() };
  return { state: dayDiff > 1 && dayDiff <= 7 ? 'soon' : 'future', text: `${dateTime}まで`, time: deadline.getTime() };
}

function sortTasksByDeadline(a, b) {
  if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
  const aTime = deadlineInfo(a)?.time ?? Infinity;
  const bTime = deadlineInfo(b)?.time ?? Infinity;
  return aTime - bTime;
}

function homeTasks() {
  const seen = new Set();
  return state.tasks.filter(task => {
    const deadline = deadlineInfo(task);
    const relevant = task.bucket === '今日やる' || ['today', 'overdue'].includes(deadline?.state);
    if (!relevant || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  }).sort(sortTasksByDeadline);
}

function activeWishes() { return state.wishes.filter(item => !item.purchased); }
function purchasedWishes() { return state.wishes.filter(item => item.purchased).sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt)); }
function budgetForMonth() { return state.budgets[monthKey()] || { beauty: 0, daily: 0 }; }

function budgetStats() {
  const budget = budgetForMonth();
  const total = Number(budget.beauty || 0) + Number(budget.daily || 0);
  const spent = purchasedWishes()
    .filter(item => item.purchasedAt && monthKey(new Date(item.purchasedAt)) === monthKey() && [...state.budgetCategories.beauty, ...state.budgetCategories.daily].includes(item.category))
    .reduce((sum, item) => sum + Number(item.price), 0);
  return { total, spent, remaining: total - spent };
}

function renderHeader() {
  const now = new Date();
  document.querySelector('#today-label').textContent = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(now);
  const title = document.querySelector('#view-title');
  title.textContent = VIEW_TITLES[currentView];
  title.hidden = currentView === 'home';
}

function renderNavigation() {
  document.querySelectorAll('[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === currentView));
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `view-${currentView}`));
}

function renderHome() {
  const wishes = activeWishes();
  const urgent = wishes.filter(item => item.priority === '今すぐ買う');
  const relevantHomeTasks = homeTasks();
  const todayTasks = relevantHomeTasks.filter(task => !task.completed);
  const budget = budgetStats();

  document.querySelector('#stat-urgent-total').textContent = yen(urgent.reduce((sum, item) => sum + Number(item.price), 0));
  document.querySelector('#stat-urgent-count').textContent = `${urgent.length} items`;
  document.querySelector('#stat-today-count').textContent = todayTasks.length;
  document.querySelector('#stat-today-caption').textContent = todayTasks.length ? `あと${todayTasks.length}つあります` : 'すべて完了';
  document.querySelector('#stat-wish-count').textContent = wishes.length;
  document.querySelector('#side-wish-count').textContent = wishes.length;
  document.querySelector('#side-task-count').textContent = state.tasks.filter(task => !task.completed).length;

  document.querySelector('#home-budget-remaining').textContent = yen(budget.remaining);
  document.querySelector('#home-budget-spent').textContent = `使用 ${yen(budget.spent)}`;
  document.querySelector('#home-budget-total').textContent = `予算 ${yen(budget.total)}`;
  const spentPercent = budget.total ? Math.min((budget.spent / budget.total) * 100, 100) : 0;
  const bar = document.querySelector('#home-budget-bar');
  bar.style.width = `${spentPercent}%`;
  bar.classList.toggle('over', budget.remaining < 0);
  document.querySelector('.budget-caption').textContent = budget.remaining < 0 ? '予算を超えています' : '残っています';

  const totals = PRIORITIES.map(priority => ({
    priority,
    items: wishes.filter(item => item.priority === priority),
  })).map(group => ({ ...group, total: group.items.reduce((sum, item) => sum + Number(item.price), 0) }));
  const maxTotal = Math.max(...totals.map(group => group.total), 1);
  document.querySelector('#priority-summary').innerHTML = totals.map(group => `
    <div class="priority-row" style="--dot:${PRIORITY_COLORS[group.priority]};--progress:${Math.round(group.total / maxTotal * 100)}%">
      <span class="priority-label"><i></i>${group.priority}</span>
      <span class="priority-track"><i></i></span>
      <span class="priority-value"><strong>${yen(group.total)}</strong><small>${group.items.length} items</small></span>
    </div>`).join('');

  const visibleToday = relevantHomeTasks.slice(0, 4);
  document.querySelector('#home-task-list').innerHTML = visibleToday.length
    ? visibleToday.map(task => {
        const deadline = deadlineInfo(task);
        return `<div class="mini-task">
          <button class="task-check ${task.completed ? 'completed' : ''}" data-toggle-task="${task.id}" aria-label="${task.completed ? '未完了に戻す' : '完了にする'}"></button>
          <div class="mini-task-body">
            <span class="mini-task-title ${task.completed ? 'completed' : ''}">${escapeHTML(task.title)}</span>
            ${deadline ? `<span class="mini-task-deadline ${deadline.state}"><svg><use href="#i-calendar"></use></svg>${escapeHTML(deadline.text)}</span>` : ''}
          </div>
        </div>`;
      }).join('')
    : emptyState('check', '今日のタスクはありません', 'ゆっくり過ごす日も大切です');

  const nextWishes = [...wishes].sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)).slice(0, 3);
  document.querySelector('#home-wish-list').innerHTML = nextWishes.length
    ? nextWishes.map(item => renderWishCard(item)).join('')
    : emptyState('heart', '欲しいものはまだありません', '思いついたときに、そっと追加しましょう');
}

function renderWishCard(item, compact = false) {
  const [bg, ink, letter] = categoryVisual(item.category);
  const link = safeLink(item.link);
  const image = safeImage(item.image);
  return `
    <article class="wish-card ${image ? 'has-image' : ''} ${compact ? 'wish-card-compact' : ''}" style="--category-bg:${bg};--category-ink:${ink}">
      ${image ? `<div class="wish-image"><img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}" /></div>` : ''}
      <div class="wish-card-top">
        <span class="category-mark" aria-label="${escapeHTML(item.category)}">${letter}</span>
        <div class="more-wrap">
          <button class="more-button" data-menu-for="${item.id}" aria-label="${escapeHTML(item.name)}のメニュー" title="メニュー"><svg><use href="#i-more"></use></svg></button>
          <div class="card-menu">
            ${compact ? `<button data-purchase="${item.id}"><svg><use href="#i-bag"></use></svg>購入済みにする</button>` : ''}
            ${compact && link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-link"></use></svg>商品ページ</a>` : ''}
            <button data-edit-wish="${item.id}"><svg><use href="#i-edit"></use></svg>編集する</button>
            <button class="danger" data-delete-wish="${item.id}"><svg><use href="#i-trash"></use></svg>削除する</button>
          </div>
        </div>
      </div>
      <h3 class="wish-title" title="${escapeHTML(item.name)}">${escapeHTML(item.name)}</h3>
      <strong class="wish-price">${yen(item.price)}</strong>
      <div class="tag-row"><span class="tag">${escapeHTML(item.priority)}</span><span class="tag need">${escapeHTML(item.need)}</span></div>
      <div class="wish-meta">
        <span>${escapeHTML(item.category)}${item.store ? ` ・ ${escapeHTML(item.store)}` : ''}</span>
        ${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer"><svg><use href="#i-link"></use></svg>商品ページを見る</a>` : ''}
      </div>
      ${item.memo ? `<p class="wish-note">${escapeHTML(item.memo)}</p>` : `<p class="wish-note">メモはまだありません</p>`}
      <div class="wish-actions"><button class="purchase-button" data-purchase="${item.id}">購入済みにする</button></div>
    </article>`;
}

function renderWishlist() {
  const all = activeWishes();
  const filtered = wishFilter === 'all' ? all : all.filter(item => item.priority === wishFilter);
  const total = filtered.reduce((sum, item) => sum + Number(item.price), 0);
  document.querySelector('#wishlist-summary').innerHTML = `<span><strong>${filtered.length}</strong> アイテム</span><span>合計 <strong>${yen(total)}</strong></span>`;
  document.querySelector('#wishlist-grid').innerHTML = filtered.length
    ? filtered.map(item => renderWishCard(item, true)).join('')
    : emptyState('heart', '当てはまるものはありません', '別の優先度を見てみましょう');
  document.querySelectorAll('#wish-filters .filter-chip').forEach(button => button.classList.toggle('active', button.dataset.filter === wishFilter));
}

function renderTasks() {
  document.querySelector('#task-groups').innerHTML = TASK_BUCKETS.map((bucket, index) => {
    const tasks = state.tasks.filter(task => task.bucket === bucket).sort(sortTasksByDeadline);
    const remaining = tasks.filter(task => !task.completed).length;
    return `<section class="task-group" style="--dot:${TASK_COLORS[index]}">
      <div class="task-group-heading"><i></i><h2>${bucket}</h2><span>${remaining} remaining</span></div>
      ${tasks.length ? tasks.map(task => {
        const deadline = deadlineInfo(task);
        return `
        <div class="task-row ${task.completed ? 'done' : ''} ${deadline ? 'has-deadline' : ''}">
          <button class="task-check ${task.completed ? 'completed' : ''}" data-toggle-task="${task.id}" aria-label="${task.completed ? '未完了に戻す' : '完了にする'}"></button>
          <div>
            <h3>${escapeHTML(task.title)}</h3>
            ${task.memo ? `<p>${escapeHTML(task.memo)}</p>` : ''}
            ${deadline ? `<div class="task-meta-line"><span class="deadline-badge ${deadline.state}"><svg><use href="#i-calendar"></use></svg>${escapeHTML(deadline.text)}</span></div>` : ''}
          </div>
          <div class="task-row-actions more-wrap">
            <button class="more-button" data-menu-for="${task.id}" aria-label="${escapeHTML(task.title)}のメニュー" title="メニュー"><svg><use href="#i-more"></use></svg></button>
            <div class="card-menu">
              <button data-edit-task="${task.id}"><svg><use href="#i-edit"></use></svg>編集する</button>
              <button class="danger" data-delete-task="${task.id}"><svg><use href="#i-trash"></use></svg>削除する</button>
            </div>
          </div>
        </div>`;
      }).join('') : `<div class="empty-state"><span>ここにはまだありません</span></div>`}
    </section>`;
  }).join('');
}

function renderHistory() {
  const items = purchasedWishes();
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);
  document.querySelector('#history-overview').innerHTML = `<div><span>これまで大切に選んだもの</span><strong>${yen(total)}</strong></div><div class="history-count"><span>購入済み</span><strong>${items.length}<small> items</small></strong></div>`;
  document.querySelector('#history-list').innerHTML = items.length
      ? items.map(item => {
        const [bg, ink, letter] = categoryVisual(item.category);
        const image = safeImage(item.image);
        return `<article class="history-item" style="--category-bg:${bg};--category-ink:${ink}">
          ${image ? `<span class="history-thumb"><img src="${escapeHTML(image)}" alt="" /></span>` : `<span class="category-mark">${letter}</span>`}
          <div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.category)} ・ ${formatDate(item.purchasedAt)}に購入</p></div>
          <strong>${yen(item.price)}</strong>
          <button class="restore-button" data-restore="${item.id}" aria-label="欲しいものに戻す" title="欲しいものに戻す"><svg><use href="#i-rotate"></use></svg></button>
        </article>`;
      }).join('')
    : emptyState('history', '購入履歴はまだありません', '購入済みにしたものが、ここに残ります');
}

function renderSettings() {
  const budget = budgetForMonth();
  document.querySelector('#beauty-budget').value = Number(budget.beauty || 0);
  document.querySelector('#daily-budget').value = Number(budget.daily || 0);
  document.querySelector('#settings-month').textContent = `${new Date().getMonth() + 1}月分`;
  document.querySelector('#settings-wish-count').textContent = `${state.wishes.length}件`;
  document.querySelector('#settings-task-count').textContent = `${state.tasks.length}件`;
  document.querySelector('#settings-category-count').textContent = `${state.categories.length}件`;
  document.querySelector('#category-count').textContent = `${state.categories.length}個`;
  document.querySelector('#category-list').innerHTML = state.categories.map(category => {
    const [bg, ink, letter] = categoryVisual(category);
    return `<div class="category-row" style="--category-bg:${bg};--category-ink:${ink}">
      <span class="category-dot">${escapeHTML(letter)}</span>
      <strong>${escapeHTML(category)}</strong>
      <button class="category-action" type="button" data-edit-category="${escapeHTML(category)}" aria-label="${escapeHTML(category)}の名前を変更" title="名前を変更"><svg><use href="#i-edit"></use></svg></button>
      <button class="category-action danger" type="button" data-delete-category="${escapeHTML(category)}" aria-label="${escapeHTML(category)}を削除" title="削除"><svg><use href="#i-trash"></use></svg></button>
    </div>`;
  }).join('');
  renderCategoryOptions();
}

function renderCategoryOptions(selectedValue) {
  const select = document.querySelector('#wish-category');
  const selected = selectedValue || select.value || state.categories[0];
  select.innerHTML = state.categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
  select.value = state.categories.includes(selected) ? selected : state.categories[0];
}

function emptyState(icon, title, caption) {
  return `<div class="empty-state"><svg><use href="#i-${icon}"></use></svg><strong>${title}</strong><span>${caption}</span></div>`;
}

function renderAll() {
  renderHeader();
  renderNavigation();
  renderHome();
  renderWishlist();
  renderTasks();
  renderHistory();
  renderSettings();
}

function navigate(view) {
  currentView = view;
  renderHeader();
  renderNavigation();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderImagePreview() {
  const preview = document.querySelector('#wish-image-preview');
  const removeButton = document.querySelector('#remove-wish-image');
  const image = safeImage(pendingWishImage);
  preview.innerHTML = image
    ? `<img src="${escapeHTML(image)}" alt="選択中の商品画像" />`
    : '<svg><use href="#i-image"></use></svg><span>画像を選ぶと<br />ここに表示されます</span>';
  removeButton.disabled = !image;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('画像ファイルを選んでください'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('画像が大きすぎます。15MB以下の画像を選んでください'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('画像を読み込めませんでした'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('この画像形式は読み込めません'));
      image.onload = () => {
        const maxSide = 1000;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.8));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function openWishDialog(item = null) {
  const form = document.querySelector('#wish-form');
  form.reset();
  pendingWishImage = safeImage(item?.image);
  renderCategoryOptions(item?.category);
  renderImagePreview();
  document.querySelector('#wish-dialog-title').textContent = item ? '欲しいものを編集' : '欲しいものを追加';
  document.querySelector('#wish-id').value = item?.id || '';
  if (item) {
    document.querySelector('#wish-name').value = item.name;
    document.querySelector('#wish-price').value = item.price;
    document.querySelector('#wish-priority').value = item.priority;
    document.querySelector('#wish-need').value = item.need;
    document.querySelector('#wish-store').value = item.store || '';
    document.querySelector('#wish-link').value = item.link || '';
    document.querySelector('#wish-memo').value = item.memo || '';
  }
  document.querySelector('#wish-dialog').showModal();
  setTimeout(() => document.querySelector('#wish-name').focus(), 50);
}

function openTaskDialog(task = null) {
  const form = document.querySelector('#task-form');
  form.reset();
  document.querySelector('#task-dialog-title').textContent = task ? 'タスクを編集' : 'タスクを追加';
  document.querySelector('#task-id').value = task?.id || '';
  if (task) {
    document.querySelector('#task-title').value = task.title;
    document.querySelector('#task-bucket').value = task.bucket;
    document.querySelector('#task-deadline').value = task.deadline || '';
    document.querySelector('#task-memo').value = task.memo || '';
  }
  document.querySelector('#task-dialog').showModal();
  setTimeout(() => document.querySelector('#task-title').focus(), 50);
}

document.addEventListener('click', event => {
  const nav = event.target.closest('[data-view]');
  if (nav) navigate(nav.dataset.view);
  const go = event.target.closest('[data-go]');
  if (go) navigate(go.dataset.go);
  if (event.target.closest('[data-add-wish]')) openWishDialog();
  if (event.target.closest('[data-add-task]')) openTaskDialog();
  if (event.target.closest('#mobile-settings')) navigate('settings');

  const filter = event.target.closest('[data-filter]');
  if (filter) { wishFilter = filter.dataset.filter; renderWishlist(); }

  const menuButton = event.target.closest('[data-menu-for]');
  if (menuButton) {
    event.stopPropagation();
    const menu = menuButton.closest('.more-wrap')?.querySelector('.card-menu');
    document.querySelectorAll('.card-menu.open').forEach(item => { if (item !== menu) item.classList.remove('open'); });
    menu?.classList.toggle('open');
    return;
  }
  if (!event.target.closest('.card-menu')) document.querySelectorAll('.card-menu.open').forEach(menu => menu.classList.remove('open'));

  const toggle = event.target.closest('[data-toggle-task]');
  if (toggle) {
    const task = state.tasks.find(item => item.id === toggle.dataset.toggleTask);
    if (task) { task.completed = !task.completed; task.completedAt = task.completed ? new Date().toISOString() : null; saveState(task.completed ? 'タスクを完了しました' : '未完了に戻しました'); }
  }
  const purchase = event.target.closest('[data-purchase]');
  if (purchase) {
    const item = state.wishes.find(wish => wish.id === purchase.dataset.purchase);
    if (item) { item.purchased = true; item.purchasedAt = new Date().toISOString(); saveState('購入履歴に移しました'); }
  }
  const restore = event.target.closest('[data-restore]');
  if (restore) {
    const item = state.wishes.find(wish => wish.id === restore.dataset.restore);
    if (item) { item.purchased = false; item.purchasedAt = null; saveState('欲しいものに戻しました'); }
  }
  const editWish = event.target.closest('[data-edit-wish]');
  if (editWish) openWishDialog(state.wishes.find(item => item.id === editWish.dataset.editWish));
  const deleteWish = event.target.closest('[data-delete-wish]');
  if (deleteWish && confirm('この欲しいものを削除しますか？')) {
    state.wishes = state.wishes.filter(item => item.id !== deleteWish.dataset.deleteWish);
    saveState('削除しました');
  }
  const editTask = event.target.closest('[data-edit-task]');
  if (editTask) openTaskDialog(state.tasks.find(item => item.id === editTask.dataset.editTask));
  const deleteTask = event.target.closest('[data-delete-task]');
  if (deleteTask && confirm('このタスクを削除しますか？')) {
    state.tasks = state.tasks.filter(item => item.id !== deleteTask.dataset.deleteTask);
    saveState('タスクを削除しました');
  }
  const editCategory = event.target.closest('[data-edit-category]');
  if (editCategory) {
    const currentName = editCategory.dataset.editCategory;
    const nextName = prompt('新しいカテゴリ名を入力してください', currentName)?.trim();
    if (nextName && nextName !== currentName) {
      if (state.categories.includes(nextName)) showToast('同じ名前のカテゴリがすでにあります');
      else {
        state.categories = state.categories.map(category => category === currentName ? nextName : category);
        state.wishes.forEach(item => { if (item.category === currentName) item.category = nextName; });
        Object.values(state.budgetCategories).forEach(categories => {
          const index = categories.indexOf(currentName);
          if (index >= 0) categories[index] = nextName;
        });
        saveState('カテゴリ名を変更しました');
      }
    }
  }
  const deleteCategory = event.target.closest('[data-delete-category]');
  if (deleteCategory) {
    const category = deleteCategory.dataset.deleteCategory;
    if (state.categories.length === 1) showToast('カテゴリは1つ以上必要です');
    else {
      const replacement = category !== 'その他' && state.categories.includes('その他')
        ? 'その他'
        : state.categories.find(item => item !== category);
      const inUse = state.wishes.some(item => item.category === category);
      const message = inUse
        ? `「${category}」を削除しますか？このカテゴリの商品は「${replacement}」に移します。`
        : `「${category}」を削除しますか？`;
      if (confirm(message)) {
        state.categories = state.categories.filter(item => item !== category);
        state.wishes.forEach(item => { if (item.category === category) item.category = replacement; });
        Object.values(state.budgetCategories).forEach(categories => {
          const index = categories.indexOf(category);
          if (index >= 0) categories.splice(index, 1);
        });
        saveState('カテゴリを削除しました');
      }
    }
  }
  const close = event.target.closest('[data-close-dialog]');
  if (close) close.closest('dialog').close();
});

document.querySelector('#wish-image').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    showToast('画像を準備しています…');
    pendingWishImage = await compressImage(file);
    renderImagePreview();
    showToast('画像を追加しました');
  } catch (error) {
    pendingWishImage = '';
    renderImagePreview();
    showToast(error.message || '画像を読み込めませんでした');
  }
});

document.querySelector('#remove-wish-image').addEventListener('click', () => {
  pendingWishImage = '';
  document.querySelector('#wish-image').value = '';
  renderImagePreview();
});

document.querySelector('#wish-form').addEventListener('submit', event => {
  event.preventDefault();
  const beforeChange = JSON.parse(JSON.stringify(state));
  const id = document.querySelector('#wish-id').value;
  const existing = state.wishes.find(item => item.id === id);
  const data = {
    name: document.querySelector('#wish-name').value.trim(),
    price: Number(document.querySelector('#wish-price').value),
    category: document.querySelector('#wish-category').value,
    priority: document.querySelector('#wish-priority').value,
    need: document.querySelector('#wish-need').value,
    store: document.querySelector('#wish-store').value.trim(),
    link: document.querySelector('#wish-link').value.trim(),
    memo: document.querySelector('#wish-memo').value.trim(),
    image: pendingWishImage
  };
  if (existing) Object.assign(existing, data);
  else state.wishes.unshift({ id: uid('wish'), ...data, purchased: false, createdAt: new Date().toISOString(), purchasedAt: null });
  if (saveState(existing ? '内容を更新しました' : '欲しいものを追加しました')) document.querySelector('#wish-dialog').close();
  else state = beforeChange;
});

document.querySelector('#task-form').addEventListener('submit', event => {
  event.preventDefault();
  const id = document.querySelector('#task-id').value;
  const existing = state.tasks.find(item => item.id === id);
  const data = {
    title: document.querySelector('#task-title').value.trim(),
    bucket: document.querySelector('#task-bucket').value,
    deadline: document.querySelector('#task-deadline').value,
    memo: document.querySelector('#task-memo').value.trim()
  };
  if (existing) Object.assign(existing, data);
  else state.tasks.unshift({ id: uid('task'), ...data, completed: false, createdAt: new Date().toISOString(), completedAt: null });
  document.querySelector('#task-dialog').close();
  saveState(existing ? 'タスクを更新しました' : 'タスクを追加しました');
});

document.querySelector('#budget-form').addEventListener('submit', event => {
  event.preventDefault();
  state.budgets[monthKey()] = {
    beauty: Number(document.querySelector('#beauty-budget').value),
    daily: Number(document.querySelector('#daily-budget').value)
  };
  saveState('今月の予算を保存しました');
});

document.querySelector('#category-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#new-category-name');
  const category = input.value.trim();
  if (!category) return;
  if (state.categories.includes(category)) {
    showToast('同じ名前のカテゴリがすでにあります');
    return;
  }
  state.categories.push(category);
  input.value = '';
  saveState('カテゴリを追加しました');
});

document.querySelector('#reset-data').addEventListener('click', () => {
  if (!confirm('すべてのデータをサンプル入りの初期状態に戻しますか？')) return;
  state = defaultState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
  showToast('初期状態に戻しました');
});

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
});

if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
renderAll();
