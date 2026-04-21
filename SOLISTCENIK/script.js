document.addEventListener('DOMContentLoaded', () => {
    const categoryNav = document.getElementById('category-nav');
    const menuContent = document.getElementById('menu-content');
    const languageModal = document.getElementById('language-modal');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const languageSwitcher = document.getElementById('language-switcher');

    const defaultCategoryByLang = {
        slo: 'ZIMSKA PONUDBA',
        eng: 'Winter Offer',
        ita: 'Offerta Invernale',
        de: 'Winter Angebot'
    };

    const validityByLang = {
        slo: 'Cenik velja od 07.11.2025 oz. do izdaje novega',
        eng: 'Price list valid from 07.11.2025 or until a new one is issued',
        ita: 'Listino valido dal 07.11.2025 o fino a nuova emissione',
        de: 'Preisliste gültig ab 07.11.2025 bzw. bis zur Herausgabe einer neuen'
    };

    let currentLang = null;
    let currentCategory = null;
    let menuData = [];
    let isAdmin = false;
    let hasUnsavedChanges = false;
    let streamConnection = null;
    let usingApiBackend = true;

    function cloneData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function menuStorageKey(lang) {
        return `solist_menu_${lang}`;
    }

    function readLocalMenu(lang) {
        try {
            const raw = localStorage.getItem(menuStorageKey(lang));
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    function writeLocalMenu(lang, data) {
        try {
            localStorage.setItem(menuStorageKey(lang), JSON.stringify(data));
        } catch {
            // ignore storage quota/privacy mode errors
        }
    }

    function setSavingState(isSaving) {
        adminLoginBtn.disabled = isSaving;
        adminLoginBtn.textContent = isSaving ? 'Saving...' : (isAdmin ? 'Logout' : 'Login');
    }

    function markDirty() {
        if (!isAdmin) return;
        hasUnsavedChanges = true;
        adminLoginBtn.textContent = 'Logout*';
        if (!usingApiBackend && currentLang) {
            writeLocalMenu(currentLang, menuData);
        }
    }

    async function saveDataToServer() {
        if (!isAdmin || !currentLang || !hasUnsavedChanges) return;
        if (!usingApiBackend) {
            writeLocalMenu(currentLang, menuData);
            hasUnsavedChanges = false;
            return;
        }
        setSavingState(true);
        try {
            const response = await fetch(`/api/menu/${currentLang}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(menuData)
            });
            if (!response.ok) {
                throw new Error('Failed to save changes.');
            }
            hasUnsavedChanges = false;
        } catch {
            alert('Could not save changes to server. Please try logout again.');
            throw new Error('save failed');
        } finally {
            setSavingState(false);
        }
    }

    function refreshView() {
        populateCategories();
        if (!menuData.length) {
            menuContent.innerHTML = '<p>No categories.</p>';
            return;
        }

        if (!menuData.some(cat => cat.category === currentCategory)) {
            currentCategory = menuData[0].category;
        }
        displayCategory(currentCategory);
    }

    function connectRealtimeUpdates(lang) {
        if (!usingApiBackend) return;

        if (streamConnection) {
            streamConnection.close();
        }

        streamConnection = new EventSource(`/api/stream/${lang}`);
        streamConnection.onmessage = (event) => {
            const incomingData = JSON.parse(event.data);
            if (!Array.isArray(incomingData)) return;

            if (isAdmin && hasUnsavedChanges) return;
            const selectedCategory = currentCategory;
            menuData = cloneData(incomingData);
            currentCategory = selectedCategory;
            refreshView();
        };

        streamConnection.onerror = () => {
            // browser reconnects automatically
        };
    }

    async function fetchMenuData(lang) {
        try {
            const apiResponse = await fetch(`/api/menu/${lang}`);
            if (!apiResponse.ok) throw new Error('API request failed');
            usingApiBackend = true;
            return await apiResponse.json();
        } catch {
            const fileResponse = await fetch(`menu_${lang}.json`);
            if (!fileResponse.ok) throw new Error('Static menu request failed');
            usingApiBackend = false;
            const staticData = await fileResponse.json();
            const localData = readLocalMenu(lang);
            return localData || staticData;
        }
    }

    function loadMenu(lang) {
        currentLang = lang;
        languageModal.style.display = 'none';
        const validityEl = document.getElementById('validity-text');
        validityEl.textContent = validityByLang[lang] || validityByLang.slo;
        updateLanguageButtons();

        fetchMenuData(lang)
            .then(data => {
                menuData = Array.isArray(data) ? cloneData(data) : [];
                const desiredDefault = (defaultCategoryByLang[lang] || '').toLowerCase();
                const match = menuData.find(cat => (cat.category || '').toLowerCase() === desiredDefault);
                currentCategory = match ? match.category : (menuData[0] ? menuData[0].category : null);
                hasUnsavedChanges = false;
                connectRealtimeUpdates(lang);
                refreshView();
            })
            .catch(() => {
                menuContent.innerHTML = '<p>Error loading menu. Please try again later.</p>';
            });
    }

    function moveInArray(arr, index, dir) {
        const next = index + dir;
        if (next < 0 || next >= arr.length) return;
        [arr[index], arr[next]] = [arr[next], arr[index]];
    }

    function updateLanguageButtons() {
        if (!languageSwitcher) return;
        languageSwitcher.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
        });
    }

    function createButton(text, className, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = className;
        btn.onclick = onClick;
        return btn;
    }

    function populateCategories() {
        categoryNav.innerHTML = '';
        menuData.forEach((categoryData, index) => {
            const wrap = document.createElement('div');
            wrap.className = 'category-btn-wrap';

            const button = document.createElement('button');
            button.textContent = categoryData.category;
            if (categoryData.category === currentCategory) button.classList.add('active');
            button.onclick = () => {
                currentCategory = categoryData.category;
                refreshView();
            };
            wrap.appendChild(button);

            if (isAdmin) {
                const adminTools = document.createElement('div');
                adminTools.className = 'inline-tools';
                adminTools.appendChild(createButton('↑', 'tiny-btn', () => {
                    moveInArray(menuData, index, -1);
                    markDirty();
                    refreshView();
                }));
                adminTools.appendChild(createButton('↓', 'tiny-btn', () => {
                    moveInArray(menuData, index, 1);
                    markDirty();
                    refreshView();
                }));
                wrap.appendChild(adminTools);
            }

            categoryNav.appendChild(wrap);
        });

        if (isAdmin) {
            categoryNav.appendChild(createButton('+ Category', 'add-btn', () => {
                menuData.push({ category: 'New Category', items: [] });
                currentCategory = 'New Category';
                markDirty();
                refreshView();
            }));
        }
    }

    function createMenuItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('menu-item');

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('item-details');

        const title = document.createElement('h4');
        const rawTitle = item.title || '';
        const isPremium = rawTitle.includes('[premium]');
        const cleanTitle = rawTitle.replace('[premium]', '').trim();
        title.textContent = cleanTitle;

        if (isPremium) {
            const premiumTag = document.createElement('span');
            premiumTag.classList.add('premium-tag');
            premiumTag.textContent = 'premium';
            title.appendChild(premiumTag);
        }

        detailsDiv.appendChild(title);

        if (item.description) {
            const description = document.createElement('p');
            description.textContent = item.description;
            detailsDiv.appendChild(description);
        }

        itemDiv.appendChild(detailsDiv);

        const priceSpan = document.createElement('span');
        priceSpan.classList.add('item-price');
        const priceRegex = /^((?:[\d,.]+\s*(?:l|g|kg|ml)(?:\s*\/\s*)?)+)\s*(.*€.*)$/i;
        const priceMatch = item.price ? item.price.match(priceRegex) : null;

        if (priceMatch) {
            priceSpan.innerHTML = `<span class="item-size">${priceMatch[1].trim()}</span> <span class="item-cost">${priceMatch[2].trim()}</span>`;
        } else {
            priceSpan.innerHTML = `<span class="item-cost">${item.price || ''}</span>`;
        }

        itemDiv.appendChild(priceSpan);
        return itemDiv;
    }

    function makeItemEditor(parent, list, index) {
        const item = list[index];
        const row = document.createElement('div');
        row.className = 'editor-row';

        const title = document.createElement('input');
        title.value = item.title || '';
        title.placeholder = 'Title';
        title.oninput = () => { item.title = title.value; markDirty(); refreshView(); };

        const desc = document.createElement('input');
        desc.value = item.description || '';
        desc.placeholder = 'Description';
        desc.oninput = () => { item.description = desc.value; markDirty(); refreshView(); };

        const price = document.createElement('input');
        price.value = item.price || '';
        price.placeholder = 'Price';
        price.oninput = () => { item.price = price.value; markDirty(); refreshView(); };

        const controls = document.createElement('div');
        controls.className = 'inline-tools';
        controls.appendChild(createButton('↑', 'tiny-btn', () => { moveInArray(list, index, -1); markDirty(); refreshView(); }));
        controls.appendChild(createButton('↓', 'tiny-btn', () => { moveInArray(list, index, 1); markDirty(); refreshView(); }));
        controls.appendChild(createButton('✕', 'tiny-btn danger', () => { list.splice(index, 1); markDirty(); refreshView(); }));

        row.append(title, desc, price, controls);
        parent.appendChild(row);
    }

    function renderAdminEditor(category, categoryIndex) {
        const panel = document.createElement('div');
        panel.className = 'admin-panel';

        const title = document.createElement('h3');
        title.textContent = 'Admin CMS';
        panel.appendChild(title);

        const categoryName = document.createElement('input');
        categoryName.value = category.category || '';
        categoryName.placeholder = 'Category name';
        categoryName.oninput = () => {
            const oldName = category.category;
            category.category = categoryName.value;
            if (currentCategory === oldName) currentCategory = category.category;
            markDirty();
            refreshView();
        };
        panel.appendChild(categoryName);

        const categoryActions = document.createElement('div');
        categoryActions.className = 'inline-tools';
        categoryActions.appendChild(createButton('Delete category', 'tiny-btn danger', () => {
            menuData.splice(categoryIndex, 1);
            currentCategory = menuData[0] ? menuData[0].category : null;
            markDirty();
            refreshView();
        }));
        panel.appendChild(categoryActions);

        const featured = document.createElement('details');
        featured.open = true;
        featured.innerHTML = '<summary>Featured articles</summary>';
        if (!Array.isArray(category.featured)) category.featured = [];
        category.featured.forEach((item, idx) => makeItemEditor(featured, category.featured, idx));
        featured.appendChild(createButton('+ Featured article', 'add-btn', () => {
            category.featured.push({ title: 'New featured', description: '', price: '', image: '' });
            markDirty();
            refreshView();
        }));
        panel.appendChild(featured);

        const directItems = document.createElement('details');
        directItems.open = true;
        directItems.innerHTML = '<summary>Category articles</summary>';
        if (!Array.isArray(category.items)) category.items = [];
        category.items.forEach((item, idx) => makeItemEditor(directItems, category.items, idx));
        directItems.appendChild(createButton('+ Article', 'add-btn', () => {
            category.items.push({ title: 'New article', description: '', price: '' });
            markDirty();
            refreshView();
        }));
        panel.appendChild(directItems);

        const subWrap = document.createElement('details');
        subWrap.open = true;
        subWrap.innerHTML = '<summary>Subcategories</summary>';
        if (!Array.isArray(category.subcategories)) category.subcategories = [];

        category.subcategories.forEach((sub, sIndex) => {
            if (!Array.isArray(sub.items)) sub.items = [];
            const subBlock = document.createElement('div');
            subBlock.className = 'sub-editor';

            const subName = document.createElement('input');
            subName.value = sub.name || '';
            subName.placeholder = 'Subcategory name';
            subName.oninput = () => { sub.name = subName.value; markDirty(); refreshView(); };
            subBlock.appendChild(subName);

            const subControls = document.createElement('div');
            subControls.className = 'inline-tools';
            subControls.appendChild(createButton('↑', 'tiny-btn', () => { moveInArray(category.subcategories, sIndex, -1); markDirty(); refreshView(); }));
            subControls.appendChild(createButton('↓', 'tiny-btn', () => { moveInArray(category.subcategories, sIndex, 1); markDirty(); refreshView(); }));
            subControls.appendChild(createButton('✕', 'tiny-btn danger', () => { category.subcategories.splice(sIndex, 1); markDirty(); refreshView(); }));
            subBlock.appendChild(subControls);

            sub.items.forEach((item, idx) => makeItemEditor(subBlock, sub.items, idx));
            subBlock.appendChild(createButton('+ Subcategory article', 'add-btn', () => {
                sub.items.push({ title: 'New article', description: '', price: '' });
                markDirty();
                refreshView();
            }));
            subWrap.appendChild(subBlock);
        });

        subWrap.appendChild(createButton('+ Subcategory', 'add-btn', () => {
            category.subcategories.push({ name: 'New subcategory', items: [] });
            markDirty();
            refreshView();
        }));
        panel.appendChild(subWrap);

        return panel;
    }

    function displayCategory(categoryName) {
        const category = menuData.find(cat => cat.category === categoryName);
        const categoryIndex = menuData.findIndex(cat => cat.category === categoryName);
        menuContent.innerHTML = '';
        if (!category) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('menu-category');

        const categoryTitle = document.createElement('h2');
        categoryTitle.textContent = category.category;
        categoryDiv.appendChild(categoryTitle);

        if (Array.isArray(category.featured) && category.featured.length > 0) {
            const featuredGrid = document.createElement('div');
            featuredGrid.classList.add('featured-grid');
            category.featured.forEach(item => {
                const card = document.createElement('div');
                card.classList.add('featured-card');
                if (item.image) {
                    const img = document.createElement('img');
                    img.src = item.image;
                    img.alt = item.title || '';
                    card.appendChild(img);
                }
                const info = document.createElement('div');
                info.classList.add('featured-info');
                if (item.title) {
                    const t = document.createElement('h4');
                    t.classList.add('featured-title');
                    t.textContent = item.title;
                    info.appendChild(t);
                }
                if (item.description) {
                    const d = document.createElement('p');
                    d.classList.add('featured-desc');
                    d.textContent = item.description;
                    info.appendChild(d);
                }
                if (item.price) {
                    const p = document.createElement('span');
                    p.classList.add('featured-price');
                    p.textContent = item.price;
                    info.appendChild(p);
                }
                card.appendChild(info);
                featuredGrid.appendChild(card);
            });
            categoryDiv.appendChild(featuredGrid);
        }

        if (Array.isArray(category.subcategories)) {
            category.subcategories.forEach(subcategory => {
                const section = document.createElement('section');
                section.classList.add('subcategory-section');
                const subcategoryTitle = document.createElement('h3');
                subcategoryTitle.classList.add('subcategory-title');
                subcategoryTitle.textContent = subcategory.name;
                section.appendChild(subcategoryTitle);
                (subcategory.items || []).forEach(item => section.appendChild(createMenuItemElement(item)));
                categoryDiv.appendChild(section);
            });
        }

        if (Array.isArray(category.items)) {
            category.items.forEach(item => categoryDiv.appendChild(createMenuItemElement(item)));
        }

        if (isAdmin) {
            menuContent.appendChild(renderAdminEditor(category, categoryIndex));
        }
        menuContent.appendChild(categoryDiv);
    }

    adminLoginBtn.addEventListener('click', async () => {
        if (isAdmin) {
            try {
                await saveDataToServer();
            } catch {
                return;
            }

            isAdmin = false;
            hasUnsavedChanges = false;
            adminLoginBtn.textContent = 'Login';
            refreshView();
            return;
        }

        const username = prompt('Admin username:');
        const password = prompt('Admin password:');
        const expectedUserToken = 'T2xp';
        const expectedPassToken = 'aXp2T2xpMTIz';
        if (btoa(username || '') === expectedUserToken && btoa(password || '') === expectedPassToken) {
            isAdmin = true;
            adminLoginBtn.textContent = 'Logout';
            refreshView();
        } else {
            alert('Wrong credentials.');
        }
    });

    document.getElementById('lang-slo').addEventListener('click', () => loadMenu('slo'));
    document.getElementById('lang-eng').addEventListener('click', () => loadMenu('eng'));
    document.getElementById('lang-ita').addEventListener('click', () => loadMenu('ita'));
    document.getElementById('lang-de').addEventListener('click', () => loadMenu('de'));
    if (languageSwitcher) {
        languageSwitcher.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => loadMenu(btn.dataset.lang));
        });
    }

    languageModal.style.display = 'flex';
});
