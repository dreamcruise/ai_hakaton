// UI Components

const { DOM, Storage, generateId, Animation, ErrorHandler } = window.Utils;

// Toast Notification System
const Toast = {
    container: null,
    
    init() {
        this.container = DOM.$('#toast-container');
        if (!this.container) {
            this.container = DOM.create('div', {
                id: 'toast-container',
                className: 'fixed top-4 right-4 z-50 space-y-2'
            });
            document.body.appendChild(this.container);
        }
    },

    show({ type = 'info', message, duration = 4000 }) {
        if (!this.container) this.init();

        const id = generateId();
        const toast = DOM.create('div', {
            id: `toast-${id}`,
            className: `toast ${type} animate-slide-in-right`
        });

        const content = DOM.create('div', {
            className: 'flex items-center space-x-3'
        });

        // Icon based on type
        const iconSvg = this.getIcon(type);
        const icon = DOM.create('div', {
            className: 'flex-shrink-0',
            innerHTML: iconSvg
        });

        const messageEl = DOM.create('div', {
            className: 'flex-1',
            textContent: message
        });

        const closeBtn = DOM.create('button', {
            className: 'flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors',
            innerHTML: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`
        });

        DOM.on(closeBtn, 'click', () => this.remove(id));

        content.appendChild(icon);
        content.appendChild(messageEl);
        content.appendChild(closeBtn);
        toast.appendChild(content);

        this.container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }

        return id;
    },

    remove(id) {
        const toast = DOM.$(`#toast-${id}`);
        if (toast) {
            toast.classList.add('animate-slide-out-right');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    },

    getIcon(type) {
        const icons = {
            success: `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>`,
            error: `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`,
            warning: `<svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>`,
            info: `<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>`
        };
        return icons[type] || icons.info;
    }
};

// Modal Component
const Modal = {
    stack: [],

    open(modalId) {
        const modal = DOM.$(`#${modalId}`);
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('animate-fade-in');
        this.stack.push(modalId);

        // Focus management
        const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }

        // Close on backdrop click
        DOM.on(modal, 'click', (e) => {
            if (e.target === modal) {
                this.close(modalId);
            }
        });

        // Close on escape
        DOM.on(document, 'keydown', (e) => {
            if (e.key === 'Escape' && this.stack[this.stack.length - 1] === modalId) {
                this.close(modalId);
            }
        });

        document.body.style.overflow = 'hidden';
    },

    close(modalId) {
        const modal = DOM.$(`#${modalId}`);
        if (!modal) return;

        modal.classList.add('animate-fade-out');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.classList.remove('animate-fade-in', 'animate-fade-out');
        }, 200);

        const index = this.stack.indexOf(modalId);
        if (index > -1) {
            this.stack.splice(index, 1);
        }

        if (this.stack.length === 0) {
            document.body.style.overflow = '';
        }
    },

    closeAll() {
        this.stack.forEach(modalId => this.close(modalId));
        this.stack = [];
        document.body.style.overflow = '';
    }
};

// Loading Component
const Loading = {
    show() {
        const spinner = DOM.$('#loading-spinner');
        if (spinner) {
            spinner.classList.remove('hidden');
        }
    },

    hide() {
        const spinner = DOM.$('#loading-spinner');
        if (spinner) {
            spinner.classList.add('hidden');
        }
    },

    element(element, show = true) {
        if (show) {
            element.classList.add('loading');
        } else {
            element.classList.remove('loading');
        }
    }
};

// Progress Bar Component
const ProgressBar = {
    update(element, progress, animated = true) {
        const fill = element.querySelector('.progress-fill');
        if (!fill) return;

        const percentage = Math.min(Math.max(progress, 0), 100);
        
        if (animated) {
            fill.style.transition = 'width 0.5s ease-in-out';
        } else {
            fill.style.transition = 'none';
        }
        
        fill.style.width = `${percentage}%`;
        fill.setAttribute('data-progress', percentage);
    },

    setColor(element, color) {
        const fill = element.querySelector('.progress-fill');
        if (fill) {
            fill.className = `progress-fill ${color}`;
        }
    }
};

// Collapsible Component
const Collapsible = {
    toggle(trigger) {
        const content = trigger.nextElementSibling;
        if (!content) return;

        const isOpen = content.getAttribute('data-state') === 'open';
        
        if (isOpen) {
            this.close(content);
        } else {
            this.open(content);
        }

        // Update trigger icon
        const icon = trigger.querySelector('svg');
        if (icon) {
            icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    },

    open(content) {
        content.setAttribute('data-state', 'open');
        content.style.height = 'auto';
        const height = content.scrollHeight;
        content.style.height = '0';
        
        requestAnimationFrame(() => {
            content.style.height = height + 'px';
        });

        setTimeout(() => {
            content.style.height = 'auto';
        }, 300);
    },

    close(content) {
        content.setAttribute('data-state', 'closed');
        const height = content.scrollHeight;
        content.style.height = height + 'px';
        
        requestAnimationFrame(() => {
            content.style.height = '0';
        });
    }
};

// Tab Component
const Tabs = {
    switch(tabContainer, targetTab) {
        const buttons = tabContainer.querySelectorAll('.tab-button');
        const panels = tabContainer.querySelectorAll('.tab-panel');

        // Update buttons
        buttons.forEach(btn => btn.classList.remove('active'));
        const targetButton = tabContainer.querySelector(`[data-tab="${targetTab}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        // Update panels
        panels.forEach(panel => {
            panel.classList.add('hidden');
            panel.classList.remove('active');
        });
        
        const targetPanel = tabContainer.querySelector(`#${targetTab}-tab`);
        if (targetPanel) {
            targetPanel.classList.remove('hidden');
            targetPanel.classList.add('active');
        }
    },

    init(tabContainer) {
        const buttons = tabContainer.querySelectorAll('.tab-button');
        
        buttons.forEach(button => {
            DOM.on(button, 'click', () => {
                const targetTab = button.getAttribute('data-tab');
                this.switch(tabContainer, targetTab);
            });
        });
    }
};

// Dropdown Component
const Dropdown = {
    toggle(trigger) {
        const dropdown = trigger.nextElementSibling;
        if (!dropdown) return;

        const isVisible = !dropdown.classList.contains('hidden');
        
        // Close all other dropdowns
        this.closeAll();
        
        if (!isVisible) {
            dropdown.classList.remove('hidden');
            dropdown.classList.add('animate-fade-in');
            
            // Position dropdown
            this.position(trigger, dropdown);
        }
    },

    close(dropdown) {
        if (dropdown && !dropdown.classList.contains('hidden')) {
            dropdown.classList.add('animate-fade-out');
            setTimeout(() => {
                dropdown.classList.add('hidden');
                dropdown.classList.remove('animate-fade-in', 'animate-fade-out');
            }, 150);
        }
    },

    closeAll() {
        const dropdowns = DOM.$$('.suggestions-dropdown, .dropdown-menu');
        dropdowns.forEach(dropdown => this.close(dropdown));
    },

    position(trigger, dropdown) {
        const triggerRect = trigger.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if dropdown fits below trigger
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        if (spaceBelow < dropdownRect.height && spaceAbove > spaceBelow) {
            // Show above
            dropdown.style.bottom = '100%';
            dropdown.style.top = 'auto';
        } else {
            // Show below (default)
            dropdown.style.top = '100%';
            dropdown.style.bottom = 'auto';
        }
    }
};

// Form Validation Component
const FormValidator = {
    validate(form) {
        const errors = {};
        const inputs = form.querySelectorAll('input, select, textarea');

        inputs.forEach(input => {
            const fieldErrors = this.validateField(input);
            if (fieldErrors.length > 0) {
                errors[input.name] = fieldErrors[0]; // Show first error
            }
        });

        this.displayErrors(form, errors);
        return Object.keys(errors).length === 0;
    },

    validateField(input) {
        const errors = [];
        const value = input.value.trim();
        const rules = this.getValidationRules(input);

        rules.forEach(rule => {
            if (!rule.test(value)) {
                errors.push(rule.message);
            }
        });

        return errors;
    },

    getValidationRules(input) {
        const rules = [];
        const { Validator } = window.Utils;

        // Required
        if (input.required) {
            rules.push({
                test: (value) => Validator.required(value),
                message: 'Это поле обязательно для заполнения'
            });
        }

        // Email
        if (input.type === 'email') {
            rules.push({
                test: (value) => !value || Validator.email(value),
                message: 'Введите корректный email адрес'
            });
        }

        // Number
        if (input.type === 'number') {
            rules.push({
                test: (value) => !value || Validator.number(value),
                message: 'Введите корректное число'
            });

            if (input.min !== '') {
                rules.push({
                    test: (value) => !value || Number(value) >= Number(input.min),
                    message: `Минимальное значение: ${input.min}`
                });
            }

            if (input.max !== '') {
                rules.push({
                    test: (value) => !value || Number(value) <= Number(input.max),
                    message: `Максимальное значение: ${input.max}`
                });
            }
        }

        // Text length
        if (input.minLength) {
            rules.push({
                test: (value) => !value || value.length >= input.minLength,
                message: `Минимальная длина: ${input.minLength} символов`
            });
        }

        if (input.maxLength) {
            rules.push({
                test: (value) => !value || value.length <= input.maxLength,
                message: `Максимальная длина: ${input.maxLength} символов`
            });
        }

        return rules;
    },

    displayErrors(form, errors) {
        // Clear previous errors
        const errorElements = form.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
        });

        // Show new errors
        Object.entries(errors).forEach(([fieldName, message]) => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (field) {
                const errorElement = field.parentNode.querySelector('.form-error');
                if (errorElement) {
                    errorElement.textContent = message;
                    errorElement.classList.remove('hidden');
                }
                field.classList.add('border-destructive');
            }
        });
    },

    clearErrors(form) {
        const errorElements = form.querySelectorAll('.form-error');
        errorElements.forEach(el => {
            el.classList.add('hidden');
            el.textContent = '';
        });

        const fields = form.querySelectorAll('input, select, textarea');
        fields.forEach(field => {
            field.classList.remove('border-destructive');
        });
    }
};

// Initialize global components
document.addEventListener('DOMContentLoaded', () => {
    Toast.init();

    // Global modal close handlers
    DOM.delegate(document, '.modal-close', 'click', (e) => {
        const modal = e.target.closest('.modal-overlay');
        if (modal) {
            Modal.close(modal.id);
        }
    });

    // Global collapsible handlers
    DOM.delegate(document, '[data-collapsible-trigger]', 'click', (e) => {
        Collapsible.toggle(e.target);
    });

    // Global dropdown handlers
    DOM.delegate(document, '[data-dropdown-trigger]', 'click', (e) => {
        e.stopPropagation();
        Dropdown.toggle(e.target);
    });

    // Close dropdowns on outside click
    DOM.on(document, 'click', () => {
        Dropdown.closeAll();
    });

    // Initialize all tab containers
    const tabContainers = DOM.$$('.tabs');
    tabContainers.forEach(container => {
        Tabs.init(container);
    });
});

// Global functions for templates
window.showToast = Toast.show.bind(Toast);
window.openModal = Modal.open.bind(Modal);
window.closeModal = Modal.close.bind(Modal);
window.showLoading = Loading.show.bind(Loading);
window.hideLoading = Loading.hide.bind(Loading);

// Export components
window.Components = {
    Toast,
    Modal,
    Loading,
    ProgressBar,
    Collapsible,
    Tabs,
    Dropdown,
    FormValidator
};