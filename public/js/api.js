// Global State
let authToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user') || 'null');

// API Helper
const api = {
    async request(endpoint, options = {}) {
        const url = `/api${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken ? `Bearer ${authToken}` : ''
            },
            ...options
        };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        const response = await fetch(url, config);
        if (response.status === 401) {
            if (typeof logout === 'function') logout();
            throw new Error('Session expired');
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Request failed');
        }

        return response.json();
    },

    get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
    post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
    put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
    delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
};
