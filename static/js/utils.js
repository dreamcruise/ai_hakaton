// Utility Functions

// Local Storage Utilities
const Storage = {
    get: (key, defaultValue = null) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('Error getting from localStorage:', error);
            return defaultValue;
        }
    },

    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error setting to localStorage:', error);
        }
    },

    remove: (key) => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('Error removing from localStorage:', error);
        }
    },

    clear: () => {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }
};

// Generate unique ID
const generateId = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

// Format number with locale
const formatNumber = (number, decimals = 0) => {
    return Number(number).toLocaleString('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

// Format date
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Debounce function
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Throttle function
const throttle = (func, limit) => {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// DOM Utilities
const DOM = {
    // Element selection
    $: (selector) => document.querySelector(selector),
    $$: (selector) => document.querySelectorAll(selector),
    
    // Element creation
    create: (tag, attributes = {}, children = []) => {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key.startsWith('data-')) {
                element.setAttribute(key, value);
            } else {
                element[key] = value;
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    },

    // Show/hide elements
    show: (element) => element.classList.remove('hidden'),
    hide: (element) => element.classList.add('hidden'),
    toggle: (element) => element.classList.toggle('hidden'),

    // Add/remove classes
    addClass: (element, className) => element.classList.add(className),
    removeClass: (element, className) => element.classList.remove(className),
    toggleClass: (element, className) => element.classList.toggle(className),

    // Event handling
    on: (element, event, handler, options = {}) => {
        element.addEventListener(event, handler, options);
    },

    off: (element, event, handler) => {
        element.removeEventListener(event, handler);
    },

    // Delegation
    delegate: (parent, selector, event, handler) => {
        parent.addEventListener(event, (e) => {
            if (e.target.matches(selector) || e.target.closest(selector)) {
                handler.call(e.target.closest(selector), e);
            }
        });
    }
};

// Animation Utilities
const Animation = {
    fadeIn: (element, duration = 300) => {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    },

    fadeOut: (element, duration = 300) => {
        const start = performance.now();
        const initialOpacity = parseFloat(getComputedStyle(element).opacity);
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.opacity = initialOpacity * (1 - progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
            }
        };
        
        requestAnimationFrame(animate);
    },

    slideDown: (element, duration = 300) => {
        element.style.height = '0';
        element.style.overflow = 'hidden';
        element.style.display = 'block';
        
        const targetHeight = element.scrollHeight;
        const start = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.height = (targetHeight * progress) + 'px';
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.height = '';
                element.style.overflow = '';
            }
        };
        
        requestAnimationFrame(animate);
    },

    slideUp: (element, duration = 300) => {
        const initialHeight = element.offsetHeight;
        const start = performance.now();
        
        element.style.overflow = 'hidden';
        
        const animate = (currentTime) => {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            element.style.height = (initialHeight * (1 - progress)) + 'px';
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                element.style.display = 'none';
                element.style.height = '';
                element.style.overflow = '';
            }
        };
        
        requestAnimationFrame(animate);
    }
};

// Validation Utilities
const Validator = {
    email: (email) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    },

    required: (value) => {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },

    minLength: (value, min) => {
        return value && value.toString().length >= min;
    },

    maxLength: (value, max) => {
        return value && value.toString().length <= max;
    },

    number: (value) => {
        return !isNaN(value) && !isNaN(parseFloat(value));
    },

    integer: (value) => {
        return Number.isInteger(Number(value));
    },

    range: (value, min, max) => {
        const num = Number(value);
        return num >= min && num <= max;
    },

    pattern: (value, pattern) => {
        const regex = new RegExp(pattern);
        return regex.test(value);
    }
};

// HTTP Request Utilities
const Http = {
    request: async (url, options = {}) => {
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': Http.getCSRFToken(),
                ...options.headers
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            console.error('HTTP request failed:', error);
            throw error;
        }
    },

    get: (url, options = {}) => Http.request(url, { ...options, method: 'GET' }),
    post: (url, data, options = {}) => Http.request(url, { ...options, method: 'POST', body: data }),
    put: (url, data, options = {}) => Http.request(url, { ...options, method: 'PUT', body: data }),
    delete: (url, options = {}) => Http.request(url, { ...options, method: 'DELETE' }),
    patch: (url, data, options = {}) => Http.request(url, { ...options, method: 'PATCH', body: data }),

    getCSRFToken: () => {
        const token = DOM.$('[name=csrfmiddlewaretoken]');
        return token ? token.value : '';
    }
};

// URL Utilities
const Url = {
    params: new URLSearchParams(window.location.search),
    
    getParam: (name) => Url.params.get(name),
    setParam: (name, value) => {
        Url.params.set(name, value);
        window.history.replaceState({}, '', `${window.location.pathname}?${Url.params}`);
    },
    removeParam: (name) => {
        Url.params.delete(name);
        window.history.replaceState({}, '', `${window.location.pathname}?${Url.params}`);
    },

    navigate: (path) => {
        window.location.href = path;
    },

    reload: () => {
        window.location.reload();
    }
};

// Theme Utilities
const Theme = {
    current: () => document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    
    set: (theme) => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        Storage.set('theme', theme);
    },

    toggle: () => {
        const current = Theme.current();
        Theme.set(current === 'dark' ? 'light' : 'dark');
    },

    init: () => {
        const saved = Storage.get('theme');
        const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        Theme.set(saved || system);
    }
};

// Data Formatting Utilities
const Format = {
    currency: (amount, currency = 'RUB') => {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    percentage: (value, decimals = 1) => {
        return (value * 100).toFixed(decimals) + '%';
    },

    fileSize: (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
    },

    timeAgo: (date) => {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} дн. назад`;
        if (hours > 0) return `${hours} ч. назад`;
        if (minutes > 0) return `${minutes} мин. назад`;
        return 'только что';
    }
};

// Error Handling
const ErrorHandler = {
    handle: (error, context = '') => {
        console.error(`Error in ${context}:`, error);
        
        // Show user-friendly message
        showToast({
            type: 'error',
            message: 'Произошла ошибка. Пожалуйста, попробуйте еще раз.',
            duration: 5000
        });
    },

    network: (error) => {
        console.error('Network error:', error);
        showToast({
            type: 'error',
            message: 'Проблема с подключением к серверу.',
            duration: 5000
        });
    },

    validation: (errors) => {
        Object.entries(errors).forEach(([field, message]) => {
            const element = DOM.$(`[name="${field}"]`);
            if (element) {
                const errorElement = element.parentNode.querySelector('.form-error');
                if (errorElement) {
                    errorElement.textContent = message;
                    errorElement.classList.remove('hidden');
                }
            }
        });
    }
};

// Export utilities for use in other files
window.Utils = {
    Storage,
    generateId,
    formatNumber,
    formatDate,
    debounce,
    throttle,
    DOM,
    Animation,
    Validator,
    Http,
    Url,
    Theme,
    Format,
    ErrorHandler
};