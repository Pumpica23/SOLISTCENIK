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
            priceSpan.textContent = item.price;
            itemDiv.appendChild(priceSpan);

            categoryDiv.appendChild(itemDiv);
        });

        menuContent.appendChild(categoryDiv);
    }
}); 