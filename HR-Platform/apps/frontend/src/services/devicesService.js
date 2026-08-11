import api from './api';

/**
 * Devices Service
 * Terminallar shows every registered device (created here, with an
 * auto-generated token) plus any device_token seen in real camera traffic
 * that was never registered — powers Monitoring > Terminallar.
 */
export const devicesService = {
  async getTerminals() {
    const response = await api.get('/devices/terminals');
    return response.data.data;
  },

  /** Registers a new device; the backend generates its token. */
  async createDevice(name) {
    const response = await api.post('/devices', { name });
    return response.data.data;
  },

  async deleteDevice(id) {
    const response = await api.delete(`/devices/${id}`);
    return response.data;
  },
};

export default devicesService;
