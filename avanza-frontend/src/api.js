import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const searchCustomers = async (q) => {
    const response = await axios.get(`${API_URL}/api/customers/search`, { params: { q } });
    return response.data;
};

export const uploadAudio = async (file, customer, onProgress) => {
    const formData = new FormData();
    formData.append('audio', file);

    if (customer) {
        formData.append('cnic', customer.cnic || '');
        formData.append('phone_number', customer.phone_number || '');
        formData.append('customer_name', customer.full_name || '');
        formData.append('customer_email', customer.email || '');
    }

    const response = await axios.post(`${API_URL}/api/calls/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            if (onProgress) onProgress(percentCompleted);
        }
    });

    return response.data;
};

export const processCall = async (callId) => {
    const response = await axios.post(`${API_URL}/api/analysis/process-complete/${callId}`);
    return response.data;
};
