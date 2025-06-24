document.addEventListener('DOMContentLoaded', () => {
    const categoryNav = document.getElementById('category-nav');
    const menuContent = document.getElementById('menu-content');
    const languageModal = document.getElementById('language-modal');
    const langSloButton = document.getElementById('lang-slo');
    const langEngButton = document.getElementById('lang-eng');
    const langItaButton = document.getElementById('lang-ita');
    const langDeButton = document.getElementById('lang-de');
    let menuData = [];

    function loadMenu(lang) {
        languageModal.style.display = 'none'; // Hide modal

        // Clear previous menu content and nav
        categoryNav.innerHTML = '';
        menuContent.innerHTML = '';

        // Fetch menu data for the selected language
        fetch(`menu_${lang}.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                menuData = data;
                populateCategories();
                // Display the first category by default, but show Signature Cocktails after 16:00
                if (menuData.length > 0) {
                    const currentHour = new Date().getHours();
                    let defaultCategory = menuData[0].category;
                    
                    // After 18:00 (6 PM), show Signature Cocktails instead
                    if (currentHour >= 18) {
                        const signatureCategory = menuData.find(cat => 
                            cat.category.toLowerCase().includes('signature') || 
                            cat.category.toLowerCase().includes('cocktail signature')
                        );
                        if (signatureCategory) {
                            defaultCategory = signatureCategory.category;
                        }
                    }
                    
                    displayCategory(defaultCategory);
                    // Set the corresponding button as active
                    const buttons = categoryNav.querySelectorAll('button');
                    buttons.forEach(btn => {
                        if (btn.textContent === defaultCategory) {
                            btn.classList.add('active');
                        }
                    });
                }
            })
            .catch(error => {
                console.error(`Error fetching menu data for ${lang}:`, error);
                menuContent.innerHTML = '<p>Error loading menu. Please try again later.</p>';
            });
    }

    // Add event listeners to language buttons
    langSloButton.addEventListener('click', () => loadMenu('slo'));
    langEngButton.addEventListener('click', () => loadMenu('eng'));
    langItaButton.addEventListener('click', () => loadMenu('ita'));
    langDeButton.addEventListener('click', () => loadMenu('de'));

    // Initial Load: Always show the modal
    languageModal.style.display = 'flex'; // Show modal

    // Populate category navigation
    function populateCategories() {
        menuData.forEach(categoryData => {
            const button = document.createElement('button');
            button.textContent = categoryData.category;
            button.onclick = () => {
                displayCategory(categoryData.category);
                // Update active button style
                document.querySelectorAll('#category-nav button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            };
            categoryNav.appendChild(button);
        });
    }

    // Display items for a selected category
    function displayCategory(categoryName) {
        const category = menuData.find(cat => cat.category === categoryName);
        menuContent.innerHTML = ''; // Clear previous content

        if (!category) return;

        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('menu-category');

        const categoryTitle = document.createElement('h2');
        categoryTitle.textContent = category.category;
        categoryDiv.appendChild(categoryTitle);

        // Check if the category has subcategories or direct items
        if (category.subcategories) {
            category.subcategories.forEach(subcategory => {
                const subcategoryTitle = document.createElement('h3'); // Use h3 for subcategory titles
                subcategoryTitle.classList.add('subcategory-title'); // Add a class for styling
                subcategoryTitle.textContent = subcategory.name;
                categoryDiv.appendChild(subcategoryTitle);

                subcategory.items.forEach(item => {
                    categoryDiv.appendChild(createMenuItemElement(item));
                });
            });
        } else if (category.items) {
            // Handle categories with direct items (original structure)
            category.items.forEach(item => {
                categoryDiv.appendChild(createMenuItemElement(item));
            });
        }

        menuContent.appendChild(categoryDiv);
    }

    // Helper function to create a single menu item element
    function createMenuItemElement(item) {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('menu-item');

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('item-details');

        const title = document.createElement('h4'); // Use h4 for item titles within subcategories
        
        // Check if this is a premium item and format the title accordingly
        if (item.title && item.title.includes('[premium]')) {
            // Split the title to remove [premium] tag
            const formattedTitle = item.title.replace('[premium]', '');
            
            // Set the basic title text
            title.textContent = formattedTitle;
            
            // Create premium tag span
            const premiumTag = document.createElement('span');
            premiumTag.classList.add('premium-tag');
            premiumTag.textContent = 'premium';
            
            // Append the premium tag
            title.appendChild(premiumTag);
        } else {
            title.textContent = item.title;
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

        // Regex to identify size/unit and price parts
        const priceRegex = /^((?:[\d,.]+\s*(?:l|g|kg|ml)(?:\s*\/\s*)?)+)\s*(.*€.*)$/i;
        const priceMatch = item.price ? item.price.match(priceRegex) : null;

        if (priceMatch) {
            priceSpan.innerHTML = `<span class="item-size">${priceMatch[1].trim()}</span> <span class="item-cost">${priceMatch[2].trim()}</span>`;
        } else if (item.price) {
            priceSpan.innerHTML = `<span class="item-cost">${item.price}</span>`;
        } else {
            priceSpan.innerHTML = `<span class="item-cost"></span>`; // Handle null/empty price
        }

        itemDiv.appendChild(priceSpan);
        return itemDiv;
    }
}); 