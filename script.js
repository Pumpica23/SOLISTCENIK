document.addEventListener('DOMContentLoaded', () => {
    const categoryNav = document.getElementById('category-nav');
    const menuContent = document.getElementById('menu-content');
    let menuData = [];

    // Fetch menu data from JSON file
    fetch('menu.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            menuData = data;
            populateCategories();
            // Display the first category by default
            if (menuData.length > 0) {
                displayCategory(menuData[0].category);
                // Set the first button as active
                const firstButton = categoryNav.querySelector('button');
                if (firstButton) {
                    firstButton.classList.add('active');
                }
            }
        })
        .catch(error => {
            console.error('Error fetching menu data:', error);
            menuContent.innerHTML = '<p>Error loading menu. Please try again later.</p>';
        });

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

        category.items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('menu-item');

            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('item-details');

            const title = document.createElement('h3');
            title.textContent = item.title;
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
            // Looks for patterns like "0,1 l 3,20 €" or "100g 15,50 €" or "0,1 l / 0,75 l 4,50 € / 31,50 €"
            const priceRegex = /^((?:[\d,\.]+\s*(?:l|g|kg|ml)(?:\s*\/\s*)?)+)\s*(.*€.*)$/i;
            const priceMatch = item.price ? item.price.match(priceRegex) : null;

            if (priceMatch) {
                // If size/unit found, split into separate spans
                priceSpan.innerHTML = `<span class="item-size">${priceMatch[1].trim()}</span> <span class="item-cost">${priceMatch[2].trim()}</span>`;
            } else if (item.price) {
                // Otherwise, just display the price
                priceSpan.innerHTML = `<span class="item-cost">${item.price}</span>`;
            } else {
                priceSpan.innerHTML = `<span class="item-cost"></span>`; // Handle null/empty price
            }

            itemDiv.appendChild(priceSpan);

            categoryDiv.appendChild(itemDiv);
        });

        menuContent.appendChild(categoryDiv);
    }
}); 