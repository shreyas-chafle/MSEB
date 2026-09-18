import api from './api';
import { Customer, NearbyCustomer } from '@/types';

export const customerService = {
  clearCache() {
    // No-op: Caching has been completely disabled for real-time live data fetching
  },

  async getCustomers(params?: {
    area?: string;
    status?: string;
    min_amount?: number;
    max_amount?: number;
    assigned_officer_id?: string;
    all_officers?: boolean;
    search?: string;
    limit?: number;
  }): Promise<Customer[]> {
    // Perform fresh Network API Request on every call
    const response = await api.get<Customer[]>('/api/customers', {
      params: { limit: 1000, ...params },
    });

    return response.data;
  },

  async getNearbyCustomers(
    latitude: number,
    longitude: number,
    radius: number = 5000,
    status?: string
  ): Promise<NearbyCustomer[]> {
    const response = await api.get<NearbyCustomer[]>('/api/customers/nearby', {
      params: { latitude, longitude, radius, status },
    });
    return response.data;
  },

  async getCustomerById(id: string): Promise<Customer> {
    const response = await api.get<Customer>(`/api/customers/${id}`);
    return response.data;
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const response = await api.post<Customer>('/api/customers', data);
    this.clearCache();
    return response.data;
  },

  async uploadCustomers(file: File): Promise<{
    success: boolean;
    filename: string;
    total_processed: number;
    inserted_count: number;
    updated_count: number;
    errors: string[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/customers/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    this.clearCache();
    return response.data;
  },
};
