// Main Application Logic

const { DOM, Storage, generateId, Theme, Format } = window.Utils;
const { Toast, ProgressBar, Collapsible, Modal } = window.Components;

// Application State
const App = {
    state: {
        user: null,
        meals: [],
        products: [],
        macros: {
            protein: { current: 0, target: 120 },
            carbs: { current: 0, target: 250 },
            fats: { current: 0, target: 80 },
            calories: { current: 0, target: 2000 }
        },
        eatenMeals: new Set(),
        dislikedMeals: new Set(),
        unplannedMeals: []
    },

    init() {
        this.loadUserData();
        this.initializeTheme();
        this.bindGlobalEvents();
        
        // Initialize page-specific functionality
        const currentPath = window.location.pathname;
        
        if (currentPath === '/' || currentPath === '/index/') {
            this.initializeMealPlanner();
        } else if (currentPath.includes('my-fridge')) {
            this.initializeMyFridge();
        }
    },

    loadUserData() {
        this.state.user = Storage.get('userProfile');
        this.state.products = Storage.get('products', []);
        this.state.eatenMeals = new Set(Storage.get('eatenMeals', []));
        this.state.dislikedMeals = new Set(Storage.get('dislikedMeals', []));
        this.state.unplannedMeals = Storage.get('unplannedMeals', []);
        
        if (this.state.user) {
            this.state.macros = {
                protein: { current: 0, target: this.state.user.proteinTarget || 120 },
                carbs: { current: 0, target: this.state.user.carbsTarget || 250 },
                fats: { current: 0, target: this.state.user.fatsTarget || 80 },
                calories: { current: 0, target: this.state.user.caloriesTarget || 2000 }
            };
        }
        
        this.generateMealPlan();
        this.calculateCurrentMacros();
    },

    initializeTheme() {
        Theme.init();
        
        const themeToggle = DOM.$('#theme-toggle');
        if (themeToggle) {
            DOM.on(themeToggle, 'click', () => {
                Theme.toggle();
                this.updateThemeIcon();
            });
            this.updateThemeIcon();
        }
    },

    updateThemeIcon() {
        const themeToggle = DOM.$('#theme-toggle');
        if (!themeToggle) return;

        const isDark = Theme.current() === 'dark';
        themeToggle.innerHTML = isDark ? 
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>` :
            `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
            </svg>`;
    },

    bindGlobalEvents() {
        // Compose diet button
        const composeDietBtn = DOM.$('#compose-diet-btn');
        if (composeDietBtn) {
            DOM.on(composeDietBtn, 'click', () => this.composeDiet());
        }
    },

    // Meal Planner Functions
    initializeMealPlanner() {
        this.renderMacroProgress();
        this.renderMealPlan();
        this.bindMealPlanEvents();
        this.updateDislikedMealsButton();
    },

    generateMealPlan() {
        // Sample meal data - in a real app, this would come from an API
        this.state.meals = [
            {
                id: 'breakfast',
                time: '08:00',
                name: 'Завтрак',
                dishes: [
                    {
                        id: 'dish-1',
                        name: 'Овсяная каша с бананом',
                        protein: 12,
                        carbs: 45,
                        fats: 8,
                        calories: 295,
                        ingredients: ['Овсяные хлопья 50г', 'Банан 1 шт', 'Молоко 200мл', 'Мед 1 ч.л.']
                    }
                ]
            },
            {
                id: 'lunch',
                time: '13:00',
                name: 'Обед',
                dishes: [
                    {
                        id: 'dish-2',
                        name: 'Куриная грудка с рисом',
                        protein: 35,
                        carbs: 40,
                        fats: 5,
                        calories: 340,
                        ingredients: ['Куриная грудка 150г', 'Рис 80г', 'Овощи 100г', 'Оливковое масло 5мл']
                    }
                ]
            },
            {
                id: 'dinner',
                time: '18:00',
                name: 'Ужин',
                dishes: [
                    {
                        id: 'dish-3',
                        name: 'Рыба с овощами',
                        protein: 28,
                        carbs: 15,
                        fats: 12,
                        calories: 265,
                        ingredients: ['Лосось 120г', 'Брокколи 150г', 'Морковь 100г', 'Лимон 1/2 шт']
                    }
                ]
            },
            {
                id: 'snack1',
                time: '10:30',
                name: 'Перекус',
                dishes: [
                    {
                        id: 'dish-4',
                        name: 'Греческий йогурт с орехами',
                        protein: 15,
                        carbs: 8,
                        fats: 10,
                        calories: 175,
                        ingredients: ['Греческий йогурт 150г', 'Грецкие орехи 20г', 'Ягоды 50г']
                    }
                ]
            },
            {
                id: 'snack2',
                time: '16:00',
                name: 'Перекус',
                dishes: [
                    {
                        id: 'dish-5',
                        name: 'Яблоко с миндалем',
                        protein: 6,
                        carbs: 20,
                        fats: 8,
                        calories: 165,
                        ingredients: ['Яблоко 1 шт', 'Миндаль 15г']
                    }
                ]
            }
        ];
    },

    calculateCurrentMacros() {
        let protein = 0, carbs = 0, fats = 0, calories = 0;

        // Calculate from eaten meals
        this.state.meals.forEach(meal => {
            if (this.state.eatenMeals.has(meal.id)) {
                meal.dishes.forEach(dish => {
                    protein += dish.protein;
                    carbs += dish.carbs;
                    fats += dish.fats;
                    calories += dish.calories;
                });
            }
        });

        // Add unplanned meals
        this.state.unplannedMeals.forEach(meal => {
            protein += meal.protein || 0;
            carbs += meal.carbs || 0;
            fats += meal.fats || 0;
            calories += meal.calories || 0;
        });

        this.state.macros.protein.current = protein;
        this.state.macros.carbs.current = carbs;
        this.state.macros.fats.current = fats;
        this.state.macros.calories.current = calories;
    },

    renderMacroProgress() {
        const macroTypes = ['protein', 'carbs', 'fats', 'calories'];
        
        macroTypes.forEach(type => {
            const currentEl = DOM.$(`#${type}-current`);
            const targetEl = DOM.$(`#${type}-target`);
            const progressEl = DOM.$(`.macro-item[data-macro="${type}"] .progress-fill`);

            if (currentEl && targetEl && progressEl) {
                const current = this.state.macros[type].current;
                const target = this.state.macros[type].target;
                const percentage = Math.min((current / target) * 100, 100);

                currentEl.textContent = current;
                targetEl.textContent = target;
                ProgressBar.update(progressEl.parentNode, percentage);
            }
        });
    },

    renderMealPlan() {
        const mealList = DOM.$('#meal-list');
        if (!mealList) return;

        mealList.innerHTML = '';

        this.state.meals.forEach(meal => {
            const mealElement = this.createMealElement(meal);
            mealList.appendChild(mealElement);
        });

        // Add unplanned meals
        this.state.unplannedMeals.forEach(meal => {
            const mealElement = this.createUnplannedMealElement(meal);
            mealList.appendChild(mealElement);
        });
    },

    createMealElement(meal) {
        const isEaten = this.state.eatenMeals.has(meal.id);
        const isDisliked = meal.dishes.some(dish => this.state.dislikedMeals.has(dish.id));

        const mealDiv = DOM.create('div', {
            className: `meal-item ${isEaten ? 'completed' : ''} ${isDisliked ? 'disliked' : ''}`,
            'data-meal-id': meal.id
        });

        const dish = meal.dishes[0]; // Assuming one dish per meal for simplicity

        mealDiv.innerHTML = `
            <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <label class="checkbox-item">
                            <input type="checkbox" class="meal-checkbox" ${isEaten ? 'checked' : ''}>
                            <span class="checkbox-indicator"></span>
                        </label>
                        <div>
                            <div class="flex items-center space-x-2">
                                <span class="text-sm text-muted-foreground">${meal.time}</span>
                                <span class="font-medium text-foreground">${meal.name}</span>
                            </div>
                            <h3 class="font-semibold text-foreground">${dish.name}</h3>
                            <p class="text-sm text-muted-foreground">
                                Б: ${dish.protein}г • У: ${dish.carbs}г • Ж: ${dish.fats}г • ${dish.calories} ккал
                            </p>
                        </div>
                    </div>
                    
                    <div class="flex items-center space-x-1">
                        <button class="collapsible-trigger p-1.5 rounded-full hover:bg-accent transition-smooth" data-collapsible-trigger>
                            <svg class="w-4 h-4 text-muted-foreground transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                            </svg>
                        </button>
                        <button class="dislike-btn p-1.5 rounded-full hover:bg-accent transition-smooth" data-dish-id="${dish.id}">
                            <svg class="w-4 h-4 transition-smooth ${this.state.dislikedMeals.has(dish.id) ? 'text-destructive fill-destructive' : 'text-muted-foreground hover:text-destructive'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 13l3 3 7-7"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="collapsible-content" data-state="closed" style="height: 0;">
                    <div class="pt-3 border-t border-border">
                        <h4 class="font-medium text-foreground mb-2">Ингредиенты:</h4>
                        <ul class="text-sm text-muted-foreground space-y-1">
                            ${dish.ingredients.map(ingredient => `<li>• ${ingredient}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
        `;

        return mealDiv;
    },

    createUnplannedMealElement(meal) {
        const mealDiv = DOM.create('div', {
            className: 'meal-item border-dashed',
            'data-unplanned-id': meal.id
        });

        mealDiv.innerHTML = `
            <div class="p-4 space-y-3">
                <div class="flex items-center justify-between">
                    <div>
                        <div class="flex items-center space-x-2 mb-1">
                            <span class="text-xs bg-accent text-accent-foreground px-2 py-1 rounded">Незапланированный</span>
                        </div>
                        <h3 class="font-semibold text-foreground">${meal.name}</h3>
                        <p class="text-sm text-muted-foreground">
                            Б: ${meal.protein || 0}г • У: ${meal.carbs || 0}г • Ж: ${meal.fats || 0}г • ${meal.calories || 0} ккал
                        </p>
                    </div>
                    <button class="remove-unplanned-btn btn-icon-danger" data-unplanned-id="${meal.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        return mealDiv;
    },

    bindMealPlanEvents() {
        const mealList = DOM.$('#meal-list');
        if (!mealList) return;

        // Meal checkbox handler
        DOM.delegate(mealList, '.meal-checkbox', 'change', (e) => {
            const mealItem = e.target.closest('.meal-item');
            const mealId = mealItem.getAttribute('data-meal-id');
            this.toggleMealEaten(mealId);
        });

        // Dislike button handler
        DOM.delegate(mealList, '.dislike-btn', 'click', (e) => {
            e.stopPropagation();
            const dishId = e.target.closest('.dislike-btn').getAttribute('data-dish-id');
            this.toggleMealDislike(dishId);
        });

        // Remove unplanned meal handler
        DOM.delegate(mealList, '.remove-unplanned-btn', 'click', (e) => {
            const unplannedId = e.target.closest('.remove-unplanned-btn').getAttribute('data-unplanned-id');
            this.removeUnplannedMeal(unplannedId);
        });

        // Unplanned meal modal
        const addUnplannedBtn = DOM.$('#add-unplanned-meal');
        if (addUnplannedBtn) {
            DOM.on(addUnplannedBtn, 'click', () => {
                Modal.open('unplanned-meal-modal');
                this.initializeUnplannedMealModal();
            });
        }

        // Update disliked meals button
        const updateMealsBtn = DOM.$('#update-meals-btn button');
        if (updateMealsBtn) {
            DOM.on(updateMealsBtn, 'click', () => this.updateDislikedMeals());
        }
    },

    toggleMealEaten(mealId) {
        if (this.state.eatenMeals.has(mealId)) {
            this.state.eatenMeals.delete(mealId);
        } else {
            this.state.eatenMeals.add(mealId);
        }

        Storage.set('eatenMeals', Array.from(this.state.eatenMeals));
        this.calculateCurrentMacros();
        this.renderMacroProgress();
        this.renderMealPlan();
    },

    toggleMealDislike(dishId) {
        if (this.state.dislikedMeals.has(dishId)) {
            this.state.dislikedMeals.delete(dishId);
        } else {
            this.state.dislikedMeals.add(dishId);
        }

        Storage.set('dislikedMeals', Array.from(this.state.dislikedMeals));
        this.updateDislikedMealsButton();
        this.renderMealPlan();
    },

    updateDislikedMealsButton() {
        const updateBtn = DOM.$('#update-meals-btn');
        const updateText = DOM.$('#update-meals-text');
        
        if (this.state.dislikedMeals.size > 0) {
            DOM.show(updateBtn);
            if (updateText) {
                updateText.textContent = `Обновить рацион (${this.state.dislikedMeals.size} блюд)`;
            }
        } else {
            DOM.hide(updateBtn);
        }
    },

    updateDislikedMeals() {
        // In a real app, this would call an API to generate new meal suggestions
        console.log('Updating disliked meals:', Array.from(this.state.dislikedMeals));
        
        this.state.dislikedMeals.clear();
        Storage.set('dislikedMeals', []);
        
        Toast.show({
            type: 'success',
            message: 'Рацион будет обновлен с учетом ваших предпочтений'
        });
        
        this.updateDislikedMealsButton();
        this.renderMealPlan();
    },

    initializeUnplannedMealModal() {
        const modal = DOM.$('#unplanned-meal-modal');
        if (!modal) return;

        // Initialize tabs
        const tabs = modal.querySelector('.tabs');
        if (tabs) {
            const { Tabs } = window.Components;
            Tabs.init(tabs);
        }

        // Search functionality
        const searchInput = DOM.$('#dish-search');
        const suggestionsDiv = DOM.$('#dish-suggestions');
        
        if (searchInput && suggestionsDiv) {
            DOM.on(searchInput, 'input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                
                if (query.length < 2) {
                    DOM.hide(suggestionsDiv);
                    return;
                }

                // Sample dish suggestions
                const dishes = [
                    { name: 'Салат Цезарь', protein: 15, carbs: 12, fats: 18, calories: 250 },
                    { name: 'Суп томатный', protein: 4, carbs: 15, fats: 3, calories: 95 },
                    { name: 'Стейк говяжий', protein: 35, carbs: 0, fats: 15, calories: 280 }
                ];

                const filtered = dishes.filter(dish => 
                    dish.name.toLowerCase().includes(query)
                );

                this.renderDishSuggestions(suggestionsDiv, filtered);
                DOM.show(suggestionsDiv);
            });
        }

        // Add unplanned dish button
        const addBtn = DOM.$('#add-unplanned-dish');
        if (addBtn) {
            DOM.on(addBtn, 'click', () => this.addUnplannedDish());
        }
    },

    renderDishSuggestions(container, dishes) {
        container.innerHTML = '';
        
        dishes.forEach(dish => {
            const suggestion = DOM.create('div', {
                className: 'p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0',
                textContent: dish.name
            });

            DOM.on(suggestion, 'click', () => {
                DOM.$('#dish-search').value = dish.name;
                DOM.hide(container);
            });

            container.appendChild(suggestion);
        });
    },

    addUnplannedDish() {
        const activeTab = DOM.$('#unplanned-meal-modal .tab-panel.active');
        let dishData = {};

        if (activeTab.id === 'search-tab') {
            const dishName = DOM.$('#dish-search').value.trim();
            if (!dishName) {
                Toast.show({
                    type: 'error',
                    message: 'Пожалуйста, выберите блюдо'
                });
                return;
            }
            
            // In a real app, would fetch nutrition data from API
            dishData = {
                name: dishName,
                protein: 10,
                carbs: 20,
                fats: 5,
                calories: 160
            };
        } else {
            const name = DOM.$('#new-dish-name').value.trim();
            const protein = Number(DOM.$('#new-dish-protein').value) || 0;
            const carbs = Number(DOM.$('#new-dish-carbs').value) || 0;
            const fats = Number(DOM.$('#new-dish-fats').value) || 0;
            const calories = Number(DOM.$('#new-dish-calories').value) || 0;

            if (!name) {
                Toast.show({
                    type: 'error',
                    message: 'Пожалуйста, введите название блюда'
                });
                return;
            }

            dishData = { name, protein, carbs, fats, calories };
        }

        const unplannedMeal = {
            id: generateId(),
            ...dishData,
            addedAt: new Date().toISOString()
        };

        this.state.unplannedMeals.push(unplannedMeal);
        Storage.set('unplannedMeals', this.state.unplannedMeals);

        this.calculateCurrentMacros();
        this.renderMacroProgress();
        this.renderMealPlan();

        Modal.close('unplanned-meal-modal');

        Toast.show({
            type: 'success',
            message: `${dishData.name} добавлено в рацион`
        });
    },

    removeUnplannedMeal(mealId) {
        const index = this.state.unplannedMeals.findIndex(m => m.id === mealId);
        if (index !== -1) {
            const meal = this.state.unplannedMeals[index];
            this.state.unplannedMeals.splice(index, 1);
            Storage.set('unplannedMeals', this.state.unplannedMeals);

            this.calculateCurrentMacros();
            this.renderMacroProgress();
            this.renderMealPlan();

            Toast.show({
                type: 'success',
                message: `${meal.name} удалено из рациона`
            });
        }
    },

    composeDiet() {
        Toast.show({
            type: 'info',
            message: 'Функция составления рациона будет доступна в ближайшее время'
        });
    },

    // My Fridge Functions
    initializeMyFridge() {
        this.renderFridgeStats();
        this.renderProductsList();
        this.bindFridgeEvents();
    },

    renderFridgeStats() {
        const totalProducts = DOM.$('#total-products');
        const productCategories = DOM.$('#product-categories');

        if (totalProducts) {
            totalProducts.textContent = this.state.products.length;
        }

        if (productCategories) {
            const categories = new Set(this.state.products.map(p => p.category || 'other'));
            productCategories.textContent = categories.size;
        }
    },

    renderProductsList() {
        const productsList = DOM.$('#products-list');
        const emptyState = DOM.$('#empty-state');

        if (!productsList) return;

        if (this.state.products.length === 0) {
            DOM.show(emptyState);
            productsList.innerHTML = '';
            return;
        }

        DOM.hide(emptyState);
        productsList.innerHTML = '';

        this.state.products.forEach(product => {
            const productElement = this.createProductListElement(product);
            productsList.appendChild(productElement);
        });
    },

    createProductListElement(product) {
        const productDiv = DOM.create('div', {
            className: 'product-item',
            'data-category': product.category || 'other',
            'data-id': product.id
        });

        const categoryIndicator = DOM.create('div', {
            className: 'category-indicator',
            'data-category': product.category || 'other'
        });

        productDiv.innerHTML = `
            <div class="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-smooth">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        ${categoryIndicator.outerHTML}
                        <div>
                            <h3 class="font-medium text-foreground product-name">${product.name}</h3>
                            <p class="text-sm text-muted-foreground product-details">${product.quantity} ${this.getUnitName(product.unit)}</p>
                        </div>
                    </div>
                </div>
                
                <div class="flex items-center space-x-2">
                    <button class="btn btn-outline btn-sm edit-product-btn" data-id="${product.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon-danger delete-product-btn" data-id="${product.id}">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        return productDiv;
    },

    bindFridgeEvents() {
        // Search functionality
        const searchToggle = DOM.$('#search-toggle');
        const searchBar = DOM.$('#search-bar');
        const productSearch = DOM.$('#product-search');

        if (searchToggle && searchBar) {
            DOM.on(searchToggle, 'click', () => {
                DOM.toggle(searchBar);
                if (!searchBar.classList.contains('hidden')) {
                    productSearch.focus();
                }
            });
        }

        // Product actions
        const productsList = DOM.$('#products-list');
        if (productsList) {
            DOM.delegate(productsList, '.edit-product-btn', 'click', (e) => {
                const productId = e.target.closest('.edit-product-btn').getAttribute('data-id');
                this.editProduct(productId);
            });

            DOM.delegate(productsList, '.delete-product-btn', 'click', (e) => {
                const productId = e.target.closest('.delete-product-btn').getAttribute('data-id');
                this.deleteProduct(productId);
            });
        }
    },

    editProduct(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (!product) return;

        // Populate edit form
        DOM.$('#edit-product-name').value = product.name;
        DOM.$('#edit-quantity').value = product.quantity;
        DOM.$('#edit-unit').value = product.unit;

        Modal.open('edit-product-modal');

        // Handle save
        const saveBtn = DOM.$('#save-product-btn');
        const newHandler = () => {
            const updatedProduct = {
                ...product,
                name: DOM.$('#edit-product-name').value.trim(),
                quantity: Number(DOM.$('#edit-quantity').value),
                unit: DOM.$('#edit-unit').value
            };

            const index = this.state.products.findIndex(p => p.id === productId);
            this.state.products[index] = updatedProduct;
            
            Storage.set('products', this.state.products);
            
            this.renderFridgeStats();
            this.renderProductsList();
            
            Modal.close('edit-product-modal');
            
            Toast.show({
                type: 'success',
                message: 'Продукт обновлен'
            });

            DOM.off(saveBtn, 'click', newHandler);
        };

        DOM.on(saveBtn, 'click', newHandler);
    },

    deleteProduct(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (!product) return;

        if (confirm(`Удалить ${product.name} из холодильника?`)) {
            const index = this.state.products.findIndex(p => p.id === productId);
            this.state.products.splice(index, 1);
            
            Storage.set('products', this.state.products);
            
            this.renderFridgeStats();
            this.renderProductsList();
            
            Toast.show({
                type: 'success',
                message: `${product.name} удален из холодильника`
            });
        }
    },

    getUnitName(unit) {
        const names = {
            gram: 'г',
            milliliter: 'мл',
            piece: 'шт',
            kilogram: 'кг',
            liter: 'л',
            tablespoon: 'ст. л.',
            teaspoon: 'ч. л.',
            cup: 'ст.',
            package: 'уп.'
        };
        return names[unit] || unit;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Global functions for templates
window.initializeMealPlanner = () => App.initializeMealPlanner();
window.initializeMyFridge = () => App.initializeMyFridge();
window.initializeOnboarding = () => window.Forms.OnboardingForm.init();
window.initializeAddProducts = () => window.Forms.AddProductsForm.init();

// Export app for debugging
window.App = App;