// Form Handling

const { DOM, Storage, Validator, Http, ErrorHandler } = window.Utils;
const { FormValidator, Toast } = window.Components;

// Onboarding Form Handler
const OnboardingForm = {
    currentStep: 1,
    totalSteps: 4,
    formData: {},

    init() {
        this.form = DOM.$('#onboarding-form');
        this.nextBtn = DOM.$('#next-btn');
        this.prevBtn = DOM.$('#prev-btn');
        this.finishBtn = DOM.$('#finish-btn');

        if (!this.form) return;

        this.bindEvents();
        this.updateProgress();
    },

    bindEvents() {
        DOM.on(this.nextBtn, 'click', () => this.nextStep());
        DOM.on(this.prevBtn, 'click', () => this.prevStep());
        DOM.on(this.finishBtn, 'click', (e) => this.submitForm(e));
        
        // Auto-advance on radio selection
        DOM.delegate(this.form, 'input[type="radio"]', 'change', () => {
            setTimeout(() => {
                if (this.validateCurrentStep()) {
                    this.nextStep();
                }
            }, 300);
        });
    },

    nextStep() {
        if (!this.validateCurrentStep()) return;
        
        this.saveCurrentStepData();
        
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateButtons();
        }
    },

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.showStep(this.currentStep);
            this.updateProgress();
            this.updateButtons();
        }
    },

    showStep(step) {
        // Hide all steps
        const steps = DOM.$$('.step-content');
        steps.forEach(s => s.classList.remove('active'));

        // Show current step
        const currentStep = DOM.$(`[data-step="${step}"]`);
        if (currentStep) {
            currentStep.classList.add('active');
        }

        // Update step indicators
        const indicators = DOM.$$('.step-indicator');
        indicators.forEach((indicator, index) => {
            if (index + 1 <= step) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    },

    updateProgress() {
        const progress = (this.currentStep / this.totalSteps) * 100;
        const progressFill = DOM.$('#progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
            progressFill.setAttribute('data-progress', progress);
        }
    },

    updateButtons() {
        // Previous button
        if (this.currentStep === 1) {
            this.prevBtn.classList.add('hidden');
        } else {
            this.prevBtn.classList.remove('hidden');
        }

        // Next/Finish buttons
        if (this.currentStep === this.totalSteps) {
            this.nextBtn.classList.add('hidden');
            this.finishBtn.classList.remove('hidden');
        } else {
            this.nextBtn.classList.remove('hidden');
            this.finishBtn.classList.add('hidden');
        }
    },

    validateCurrentStep() {
        const currentStepElement = DOM.$(`[data-step="${this.currentStep}"]`);
        const inputs = currentStepElement.querySelectorAll('input, select');
        let isValid = true;

        inputs.forEach(input => {
            if (input.required && !input.value.trim()) {
                isValid = false;
                this.showFieldError(input, 'Это поле обязательно для заполнения');
            } else if (input.type === 'number' && input.value) {
                const value = Number(input.value);
                const min = input.min ? Number(input.min) : null;
                const max = input.max ? Number(input.max) : null;
                
                if (min !== null && value < min) {
                    isValid = false;
                    this.showFieldError(input, `Минимальное значение: ${min}`);
                } else if (max !== null && value > max) {
                    isValid = false;
                    this.showFieldError(input, `Максимальное значение: ${max}`);
                } else {
                    this.clearFieldError(input);
                }
            } else {
                this.clearFieldError(input);
            }
        });

        // Special validation for radio groups
        const radioGroups = currentStepElement.querySelectorAll('input[type="radio"]');
        const radioGroupNames = [...new Set(Array.from(radioGroups).map(r => r.name))];
        
        radioGroupNames.forEach(groupName => {
            const groupInputs = currentStepElement.querySelectorAll(`input[name="${groupName}"]`);
            const isGroupRequired = Array.from(groupInputs).some(input => input.required);
            const isGroupSelected = Array.from(groupInputs).some(input => input.checked);
            
            if (isGroupRequired && !isGroupSelected) {
                isValid = false;
                const errorElement = currentStepElement.querySelector(`input[name="${groupName}"]`).parentNode.parentNode.querySelector('.form-error');
                if (errorElement) {
                    errorElement.textContent = 'Пожалуйста, выберите один из вариантов';
                    errorElement.classList.remove('hidden');
                }
            }
        });

        return isValid;
    },

    showFieldError(input, message) {
        const errorElement = input.parentNode.querySelector('.form-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
        input.classList.add('border-destructive');
    },

    clearFieldError(input) {
        const errorElement = input.parentNode.querySelector('.form-error');
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
        input.classList.remove('border-destructive');
    },

    saveCurrentStepData() {
        const currentStepElement = DOM.$(`[data-step="${this.currentStep}"]`);
        const inputs = currentStepElement.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            if (input.type === 'radio' && input.checked) {
                this.formData[input.name] = input.value;
            } else if (input.type === 'checkbox') {
                if (!this.formData[input.name]) {
                    this.formData[input.name] = [];
                }
                if (input.checked) {
                    this.formData[input.name].push(input.value);
                }
            } else if (input.type !== 'radio') {
                this.formData[input.name] = input.value;
            }
        });
    },

    async submitForm(e) {
        e.preventDefault();
        
        if (!this.validateCurrentStep()) return;
        
        this.saveCurrentStepData();
        
        try {
            // Calculate BMR and daily calories
            const bmr = this.calculateBMR();
            const dailyCalories = this.calculateDailyCalories(bmr);
            const macros = this.calculateMacros(dailyCalories);
            
            const profileData = {
                ...this.formData,
                bmr,
                dailyCalories,
                ...macros,
                createdAt: new Date().toISOString()
            };

            // Save to localStorage
            Storage.set('userProfile', profileData);
            Storage.set('onboardingCompleted', true);

            Toast.show({
                type: 'success',
                message: 'Профиль успешно создан!'
            });

            // Redirect to main app
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            ErrorHandler.handle(error, 'onboarding form submission');
        }
    },

    calculateBMR() {
        const { gender, age, height, weight } = this.formData;
        
        // Mifflin-St Jeor Equation
        if (gender === 'male') {
            return 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) + 5;
        } else {
            return 10 * Number(weight) + 6.25 * Number(height) - 5 * Number(age) - 161;
        }
    },

    calculateDailyCalories(bmr) {
        const activityMultipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9
        };

        const multiplier = activityMultipliers[this.formData.activity_level] || 1.2;
        return Math.round(bmr * multiplier);
    },

    calculateMacros(dailyCalories) {
        // Standard macro distribution
        const proteinCalories = dailyCalories * 0.25; // 25% protein
        const carbCalories = dailyCalories * 0.45;    // 45% carbs
        const fatCalories = dailyCalories * 0.30;     // 30% fat

        return {
            proteinTarget: Math.round(proteinCalories / 4), // 4 cal/g
            carbsTarget: Math.round(carbCalories / 4),      // 4 cal/g
            fatsTarget: Math.round(fatCalories / 9),        // 9 cal/g
            caloriesTarget: dailyCalories
        };
    }
};

// Add Products Form Handler
const AddProductsForm = {
    products: [],
    suggestions: [
        { name: 'Молоко', category: 'dairy' },
        { name: 'Хлеб', category: 'grains' },
        { name: 'Яйца', category: 'other' },
        { name: 'Курица', category: 'meat' },
        { name: 'Помидоры', category: 'vegetables' },
        { name: 'Яблоки', category: 'fruits' },
        { name: 'Рис', category: 'grains' },
        { name: 'Творог', category: 'dairy' },
        { name: 'Лук', category: 'vegetables' },
        { name: 'Морковь', category: 'vegetables' },
        { name: 'Картофель', category: 'vegetables' },
        { name: 'Говядина', category: 'meat' },
        { name: 'Рыба', category: 'meat' },
        { name: 'Сыр', category: 'dairy' },
        { name: 'Бананы', category: 'fruits' },
        { name: 'Гречка', category: 'grains' },
        { name: 'Макароны', category: 'grains' },
        { name: 'Оливковое масло', category: 'other' }
    ],

    init() {
        this.form = DOM.$('#add-product-form');
        this.searchInput = DOM.$('#product-search');
        this.suggestionsDropdown = DOM.$('#suggestions-dropdown');
        this.productsList = DOM.$('#added-products-list');

        if (!this.form) return;

        this.loadProducts();
        this.bindEvents();
        this.renderProducts();
    },

    bindEvents() {
        DOM.on(this.form, 'submit', (e) => this.handleSubmit(e));
        DOM.on(this.searchInput, 'input', this.handleSearch.bind(this));
        DOM.on(this.searchInput, 'focus', () => this.showSuggestions());
        DOM.on(this.searchInput, 'blur', () => {
            // Delay hiding to allow suggestion clicks
            setTimeout(() => this.hideSuggestions(), 200);
        });

        // Remove product handlers
        DOM.delegate(this.productsList, '.remove-product-btn', 'click', (e) => {
            const productItem = e.target.closest('.product-item');
            const productId = productItem.getAttribute('data-id');
            this.removeProduct(productId);
        });
    },

    handleSearch(e) {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length === 0) {
            this.hideSuggestions();
            return;
        }

        const filtered = this.suggestions.filter(item => 
            item.name.toLowerCase().includes(query)
        );

        this.renderSuggestions(filtered);
        this.showSuggestions();
    },

    renderSuggestions(items) {
        this.suggestionsDropdown.innerHTML = '';

        if (items.length === 0) {
            this.hideSuggestions();
            return;
        }

        items.forEach(item => {
            const suggestion = this.createSuggestionElement(item);
            DOM.on(suggestion, 'click', () => {
                this.searchInput.value = item.name;
                this.hideSuggestions();
                DOM.$('#quantity').focus();
            });
            this.suggestionsDropdown.appendChild(suggestion);
        });
    },

    createSuggestionElement(item) {
        const template = DOM.$('#suggestion-item-template');
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.suggestion-name').textContent = item.name;
        clone.querySelector('.suggestion-category').textContent = this.getCategoryName(item.category);
        
        return clone.querySelector('.suggestion-item');
    },

    showSuggestions() {
        this.suggestionsDropdown.classList.remove('hidden');
    },

    hideSuggestions() {
        this.suggestionsDropdown.classList.add('hidden');
    },

    handleSubmit(e) {
        e.preventDefault();

        const formData = new FormData(this.form);
        const productName = DOM.$('#product-search').value.trim();
        const quantity = DOM.$('#quantity').value;
        const unit = DOM.$('#unit').value;
        const proteins = DOM.$('#proteins').value;
        const fats = DOM.$('#fats').value;
        const carbs = DOM.$('#carbs').value;
        const calories = DOM.$('#calories').value;

        if (!productName || !quantity || !unit) {
            Toast.show({
                type: 'error',
                message: 'Пожалуйста, заполните все поля'
            });
            return;
        }

        const product = {
            id: this.generateId(),
            name: productName,
            quantity: Number(quantity),
            unit: unit,
            category: this.getProductCategory(productName),
            nutrition: (proteins || fats || carbs || calories) ? {
                proteins: Number(proteins) || 0,
                fats: Number(fats) || 0,
                carbs: Number(carbs) || 0,
                calories: Number(calories) || 0
            } : null,
            addedAt: new Date().toISOString()
        };

        this.addProduct(product);
        this.form.reset();
        this.searchInput.focus();
    },

    addProduct(product) {
        // Check if product already exists
        const existingIndex = this.products.findIndex(p => 
            p.name.toLowerCase() === product.name.toLowerCase() && p.unit === product.unit
        );

        if (existingIndex !== -1) {
            // Update quantity
            this.products[existingIndex].quantity += product.quantity;
            Toast.show({
                type: 'success',
                message: `Количество ${product.name} обновлено`
            });
        } else {
            // Add new product
            this.products.push(product);
            Toast.show({
                type: 'success',
                message: `${product.name} добавлен в список`
            });
        }

        this.saveProducts();
        this.renderProducts();
    },

    removeProduct(productId) {
        const index = this.products.findIndex(p => p.id === productId);
        if (index !== -1) {
            const product = this.products[index];
            this.products.splice(index, 1);
            this.saveProducts();
            this.renderProducts();
            
            Toast.show({
                type: 'success',
                message: `${product.name} удален из списка`
            });
        }
    },

    renderProducts() {
        if (this.products.length === 0) {
            this.productsList.innerHTML = `
                <div class="text-center py-8 text-muted-foreground">
                    <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                    <p>Добавленные продукты появятся здесь</p>
                </div>
            `;
            return;
        }

        this.productsList.innerHTML = '';
        this.products.forEach(product => {
            const productElement = this.createProductElement(product);
            this.productsList.appendChild(productElement);
        });
    },

    createProductElement(product) {
        const template = DOM.$('#product-item-template');
        const clone = template.content.cloneNode(true);
        
        const productItem = clone.querySelector('.product-item');
        productItem.setAttribute('data-id', product.id);
        
        clone.querySelector('.product-name').textContent = product.name;
        clone.querySelector('.product-details').textContent = `${product.quantity} ${this.getUnitName(product.unit)}`;
        
        return clone;
    },

    getProductCategory(productName) {
        const suggestion = this.suggestions.find(s => 
            s.name.toLowerCase() === productName.toLowerCase()
        );
        return suggestion ? suggestion.category : 'other';
    },

    getCategoryName(category) {
        const names = {
            vegetables: 'Овощи',
            fruits: 'Фрукты',
            meat: 'Мясо',
            dairy: 'Молочные',
            grains: 'Крупы',
            other: 'Другое'
        };
        return names[category] || 'Другое';
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
    },

    generateId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    },

    loadProducts() {
        this.products = Storage.get('products', []);
    },

    saveProducts() {
        Storage.set('products', this.products);
    }
};

// Initialize forms based on current page
document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    const currentPath = window.location.pathname;
    
    if (currentPath.includes('onboarding')) {
        OnboardingForm.init();
    } else if (currentPath.includes('add-products')) {
        AddProductsForm.init();
    }
});

// Export form handlers
window.Forms = {
    OnboardingForm,
    AddProductsForm
};